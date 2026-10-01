import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {buildSecVerifiedIntegrationPackage} from './secIntegration';
import type {SecCompanyBundleLike} from './secFinancialMapper';
import {normalizeReport} from '../../utils/reportIntegrity';
import {validateAndPrepareReport} from '../../utils/reportValidation';
import {resolveReportCompletion} from '../../domain/reportCompletion';
import {resolveReportTtmFlow,TTM_FLOW_METRICS} from '../../domain/canonicalTtmFlow';
import {resolveCanonicalMultiples} from '../../domain/valuation/valuationDependencies';
import {resolveFundamentalMetrics} from '../../domain/valuation/metricRegistry';
import {calculateDeterministicConvictionScore} from '../../utils/valuation/convictionScorer';
import {persistReport,readPersistedReport,reportHistoryRecord,type ReportPersistenceStore} from '../reportPersistenceService';
import {assertPayloadSize,jsonByteSize,REPORT_PERSISTENCE_LIMITS} from '../../utils/reportPersistence';
import type {AnalysisReport,ReportData} from '../../types';
const capture=(name:string)=>JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/${name}`,import.meta.url))).toString());
const source=capture('generic-universe-public-2026-09-29.json.gz');
const evidence=capture('generic-public-statement-evidence-2026-09-29.json.gz');
const quotes=JSON.parse(readFileSync(new URL('./fixtures/generic-universe-market-2026-09-29.json',import.meta.url),'utf8')).quotes;
const bundles:SecCompanyBundleLike[]=source.bundles.map((b:SecCompanyBundleLike)=>evidence.bundles.find((e:SecCompanyBundleLike)=>e.identity.ticker===b.identity.ticker)||b);
test('public regression universe is broad test data, not a production whitelist',()=>{
  assert.equal(bundles.length,25);assert.equal(new Set(bundles.map(b=>b.identity.cik)).size,25);
  assert.ok(new Set(bundles.map(b=>b.submissions.sic)).size>=15);
});
for(const bundle of bundles) test(`${bundle.identity.ticker}: source → canonical → consumers → bounded save → History readback`,async()=>{
  const original=JSON.stringify(bundle),pkg=buildSecVerifiedIntegrationPackage(bundle);
  assert.equal(JSON.stringify(bundle),original,'Raw source must remain immutable');
  const ds=pkg.canonicalFinancials!;assert.ok(ds);assert.ok(pkg.financialStatements);
  assert.equal(ds.resolutionAudit?.falseNegativeCandidateCount,0,JSON.stringify(ds.resolutionAudit?.diagnostics.filter(d=>d.falseNegativeCandidate)));
  const prepared=validateAndPrepareReport({ticker:bundle.identity.ticker,generated_at:source.capturedAt,summary:'Source integration regression',analysis_type:'fundamental',
    company_profile:{overview:{company_name:bundle.identity.title},industry:bundle.submissions.sicDescription},
    canonical_financials:ds,financial_statements:pkg.financialStatements,valuation_ratios:[{name:'PEG Ratio',value:999,verdict:'cheap'}],verdict:{summary:'Canonical source control',key_takeaways:[]}} as ReportData,bundle.identity.ticker,{marketQuotes:{[bundle.identity.ticker]:quotes[bundle.identity.ticker]},requireMarketSnapshot:true});
  assert.ok(prepared.report);assert.equal(prepared.canPersist,true,JSON.stringify(prepared.validation.issues));
  const report=prepared.report;
  assert.equal(report.canonical_financials?.ticker,bundle.identity.ticker);
  for(const key of TTM_FLOW_METRICS){const audit=resolveReportTtmFlow(report,key);if(audit.canonicalValue!=null){
    const exact=ds.values[key]?.filter(v=>audit.periodsUsed.includes(v.period)).reduce((a,v)=>a+v.value!,0);
    assert.ok(Math.abs(audit.canonicalValue-exact!)<0.01,key);assert.equal((report as ReportData).ttm_flow_reconciliation?.[key]?.canonicalValue,audit.canonicalValue);
  }}
  const metrics=resolveFundamentalMetrics(report,bundle.identity.ticker);
  assert.equal(report.valuation_ratios?.find(r=>r.name==='PEG Ratio')?.value,metrics.peg.value ?? null,'Ratio cards, Five Pillars and Conviction must share PEG eligibility');
  assert.ok(!/NaN|Infinity/.test(JSON.stringify(metrics)));
  const conviction=calculateDeterministicConvictionScore(report,bundle.identity.ticker);
  if(conviction) assert.deepEqual(report.verdict?.conviction_breakdown,conviction.conviction_breakdown);
  for(const m of resolveCanonicalMultiples(report))if(m.rawValue!=null&&m.rawValue<=0){assert.equal(m.value,null);assert.equal(m.verdict,'not_meaningful');}
  report.report_completion=resolveReportCompletion(report,prepared.validation);
  assert.equal(report.report_completion.executionStatus,'COMPLETED');
  assert.equal(report.report_completion.coverageStatus,'PARTIAL','Partial accounting coverage must remain saveable');
  const docs=new Map<string,Record<string,any>>();
  const store:ReportPersistenceStore={async write(path,value){assertPayloadSize(value,path);assert.ok(!docs.has(path));docs.set(path,structuredClone(value));},
    async read(path){return structuredClone(docs.get(path));},async publish(path){assert.ok(docs.has(path+'/sections/_manifest'));docs.get(path)!.persistenceState='ready';}};
  const id='universe_'+bundle.identity.ticker;
  await persistReport(store,report as AnalysisReport,{reportId:id,userId:'regression_owner',language:'Thai',now:source.capturedAt});
  const main=docs.get(`reports/${id}`)!;
  assert.ok(jsonByteSize(main)<REPORT_PERSISTENCE_LIMITS.summaryHardBytes);
  const history=reportHistoryRecord(id,main);assert.equal(history.ticker,bundle.identity.ticker);
  assert.equal(history.executionStatus,'COMPLETED');assert.equal(history.persistenceStatus,'SUCCEEDED');
  const restored=await readPersistedReport(store,id);
  assert.equal(restored.ticker,report.ticker);
  assert.deepEqual(restored.canonical_financials.values,JSON.parse(JSON.stringify(report.canonical_financials.values)),'No accounting observations may change during save/reopen; undefined metadata is safely omitted');
  assert.deepEqual(restored.financial_statements?.income_statement.revenue,report.financial_statements?.income_statement.revenue);
  console.log(JSON.stringify({ticker:report.ticker,periods:ds.periods.length,latest:ds.periods.at(-1),falseNA:ds.resolutionAudit?.falseNegativeCandidateCount,
    archetype:report.canonical_executive_snapshot?.identity.archetype,core:ds.resolutionAudit?.coreFactsResolved,coreExpected:ds.resolutionAudit?.coreFactsExpected,
    statements:report.financial_statements?.quality_status,metrics:Object.values(metrics).filter((m:any)=>m?.value!=null).length,
    dcf:pkg.dcfCoverage.eligible?'ELIGIBLE':'UNAVAILABLE',dcfMissing:pkg.dcfCoverage.issues.map(i=>i.code),
    multiples:resolveCanonicalMultiples(report).map(m=>[m.name,m.status]),conviction:conviction?.conviction_score,pillars:conviction?.conviction_breakdown,
    persistence:'SUCCEEDED (in-memory production adapter contract)',rootBytes:jsonByteSize(main)}));
});
test('identical issuer facts resolve identically under a previously unseen ticker',()=>{
  const b=structuredClone(bundles[1]),before=buildSecVerifiedIntegrationPackage(b);
  b.identity.ticker='UNSEENISSUER';const after=buildSecVerifiedIntegrationPackage(b);
  assert.deepEqual(after.canonicalFinancials?.values,before.canonicalFinancials?.values);
  assert.deepEqual(after.dcfCoverage.issues,before.dcfCoverage.issues);
});
