import 'dotenv/config';
import { classifyCanaryFilingPolicy, selectRotatingSecFilers } from '../server/services/secCanaryPolicy';
import { SecEdgarClient,SEC_TICKER_INDEX_URL } from '../src/services/sec/secClient';
import {fetchSecVerifiedIntegrationPackage} from '../src/services/sec/secIntegration';
import {validateAndPrepareReport} from '../src/utils/reportValidation';
import {persistReport,readPersistedReport,type ReportPersistenceStore} from '../src/services/reportPersistenceService';
import {jsonByteSize,assertPayloadSize} from '../src/utils/reportPersistence';
const countArg=process.argv.find(a=>a.startsWith('--count='));
const count=Number(countArg?.split('=')[1]||3);
if(!Number.isInteger(count)||count<1||count>10) throw Error('Canary count must be 1–10');
const seed=process.argv.find(a=>a.startsWith('--seed='))?.slice(7)||new Date().toISOString().slice(0,10);
const client=new SecEdgarClient({minIntervalMs:250});
const index=await client.fetchJson<Record<string,{cik_str:number;ticker:string;title:string}>>(SEC_TICKER_INDEX_URL);
// Rank the live index by date/seed hash, rather than sampling our fixed fixtures.
// Ticker spelling never affects production resolver behavior.
const sample=selectRotatingSecFilers(index,seed,count);
let failed=0;
for(const item of sample){
  try{const bundle=await client.fetchCompanyBundle(item.ticker);if(!bundle)throw Error('Identity not resolved');
    // Exercise the production resolver, including independently retrieved primary
    // filings. Company Facts alone omits issuer extensions and is not the full path.
    const pkg=await fetchSecVerifiedIntegrationPackage(item.ticker,client),ds=pkg.canonicalFinancials;
    const filingPolicy=classifyCanaryFilingPolicy(bundle.submissions.filings?.recent?.form??[]);
    const unsupportedFiling=filingPolicy!=='US_PERIODIC';
    const falseNegative=ds?.resolutionAudit?.falseNegativeCandidateCount??0;
    const anomaly=ds?.resolutionAudit?.health==='CORE_SOURCE_COVERAGE_ANOMALY';
    if(falseNegative||anomaly||(!ds&&!unsupportedFiling)) failed++;
    const latestEnd=ds&&Object.values(ds.values).flat().filter(v=>v.period===ds.periods.at(-1)).find(v=>v.periodEnd)?.periodEnd;
    const stale=latestEnd ? Date.now()-Date.parse(latestEnd)>550*86400000 : true;
    let persistence='NOT_APPLICABLE_NO_CANONICAL_DATA',finalization='UNAVAILABLE',rootBytes:number|undefined;
    if (ds) {
      const prepared=validateAndPrepareReport({ticker:item.ticker,summary:'SEC canary source integration',generated_at:new Date().toISOString(),analysis_type:'fundamental',company_profile:{overview:{company_name:item.title},industry:bundle.submissions.sicDescription},canonical_financials:ds,financial_statements:pkg.financialStatements,verdict:{summary:'Public-source integration test (no AI research)',key_takeaways:[]}},item.ticker,{requireMarketSnapshot:false});
      finalization=prepared.report?.report_completion?.executionStatus || 'FAILED';
      if (!prepared.report || !prepared.canPersist) {failed++;persistence='BLOCKED_BY_VALIDATION';console.log(JSON.stringify({ticker:item.ticker,canaryValidation:prepared.validation.issues}));}
      else {
        const docs=new Map<string,any>();
        const store:ReportPersistenceStore={async write(path,data){assertPayloadSize(data,path);docs.set(path,structuredClone(data));},async read(path){return docs.get(path);},async publish(path){docs.get(path).persistenceState='ready';}};
        const id='canary_'+item.cik_str;
        await persistReport(store,prepared.report,{reportId:id,userId:'test_canary',language:'English'});
        const restored=await readPersistedReport(store,id);
        if (restored.ticker!==item.ticker) throw Error('Persistence identity mismatch');
        rootBytes=jsonByteSize(docs.get('reports/'+id));persistence='SUCCEEDED_IN_MEMORY_PRODUCTION_ADAPTER';
      }
    }
    console.log(JSON.stringify({seed,ticker:item.ticker,cik:bundle.identity.cik,identity:'RESOLVED',
      status:filingPolicy==='FOREIGN_PERIODIC'?'FOREIGN_PERIODIC_SEPARATE_POLICY'
        :filingPolicy==='NO_SUPPORTED_PERIODIC_FILING'?'NO_SUPPORTED_PERIODIC_FILING'
        :!ds?'PERIOD_NOT_RESOLVED':anomaly?'CORE_SOURCE_COVERAGE_ANOMALY':finalization==='FAILED'?'FINALIZATION_FAILED':stale?'STALE_SOURCE_HISTORY':'PASS',
      filingPolicy,
      latestFiling:bundle.submissions.filings?.recent?.accessionNumber?.[0],latestEnd,stale,finalization,persistence,rootBytes,
      periods:ds?.periods,falseNegativeCandidateCount:falseNegative,trueUnavailableCount:ds?.resolutionAudit?.trueUnavailableCount,
      rejectedCandidateCount:ds?.resolutionAudit?.rejectedCandidateCount,dcfMissing:pkg.dcfCoverage.issues.map(i=>i.code)}));
  }catch(e){failed++;console.log(JSON.stringify({seed,ticker:item.ticker,status:'SOURCE_FETCH_FAILED',reason:e instanceof Error?e.message:String(e)}));}
}
process.exitCode=failed?1:0;
