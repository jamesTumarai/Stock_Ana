import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {buildSecVerifiedIntegrationPackage} from '../src/services/sec/secIntegration';
import {validateAndPrepareReport} from '../src/utils/reportValidation';
import {resolveReportCompletion} from '../src/domain/reportCompletion';
import {persistReport,readPersistedReport,type ReportPersistenceStore} from '../src/services/reportPersistenceService';
import {assertPayloadSize,jsonByteSize} from '../src/utils/reportPersistence';
import type {AnalysisReport,ReportData} from '../src/types';
import type {SecCompanyBundleLike} from '../src/services/sec/secFinancialMapper';

/** Reproducible source-only audit. This deliberately does not invent valuation
 * assumptions or substitute for the required live Gemini/browser acceptance. */
const fixtureRoot=new URL('../src/services/sec/fixtures/',import.meta.url);
const compressed=(name:string)=>JSON.parse(gunzipSync(readFileSync(new URL(name,fixtureRoot))).toString());
const source=compressed('generic-universe-public-2026-09-29.json.gz');
const evidence=compressed('generic-public-statement-evidence-2026-09-29.json.gz');
const quotes=JSON.parse(readFileSync(new URL('generic-universe-market-2026-09-29.json',fixtureRoot),'utf8')).quotes;
const rows=[];
for(const original of source.bundles as SecCompanyBundleLike[]){
  const bundle:SecCompanyBundleLike=evidence.bundles.find((b:SecCompanyBundleLike)=>b.identity.ticker===original.identity.ticker)||original;
  const pkg=buildSecVerifiedIntegrationPackage(bundle),ds=pkg.canonicalFinancials!;
  const draft={ticker:bundle.identity.ticker,generated_at:source.capturedAt,summary:'Captured independent source audit',analysis_type:'fundamental',
    company_profile:{overview:{company_name:bundle.identity.title},industry:bundle.submissions.sicDescription},
    canonical_financials:ds,financial_statements:pkg.financialStatements,verdict:{summary:'Canonical source audit',key_takeaways:[]}} as ReportData;
  const options={marketQuotes:{[bundle.identity.ticker]:quotes[bundle.identity.ticker]},requireMarketSnapshot:true};
  const prepared=validateAndPrepareReport(draft,bundle.identity.ticker,options),report=prepared.report!;
  assert.ok(report);assert.equal(prepared.canPersist,true);assert.equal(ds.resolutionAudit?.falseNegativeCandidateCount,0);
  const repeated=validateAndPrepareReport(structuredClone(draft),bundle.identity.ticker,options).report!;
  assert.deepEqual(repeated.intrinsic_value?.canonical_run,report.intrinsic_value?.canonical_run);
  assert.deepEqual(repeated.canonical_financials?.values,report.canonical_financials?.values);
  report.report_completion=resolveReportCompletion(report,prepared.validation);
  const documents=new Map<string,Record<string,any>>();
  const store:ReportPersistenceStore={async write(path,data){assertPayloadSize(data,path);documents.set(path,structuredClone(data));},
    async read(path){return structuredClone(documents.get(path));},async publish(path){assert.ok(documents.has(path+'/sections/_manifest'));documents.get(path)!.persistenceState='ready';}};
  const reportId='audit_'+bundle.identity.ticker.replaceAll('.','_');
  await persistReport(store,report as AnalysisReport,{reportId,userId:'audit_owner',language:'Thai',now:source.capturedAt});
  const loaded=await readPersistedReport(store,reportId);
  assert.deepEqual(loaded.canonical_financials?.values,JSON.parse(JSON.stringify(report.canonical_financials?.values)));
  const run=report.intrinsic_value?.canonical_run;
  rows.push({ticker:bundle.identity.ticker,archetype:run?.archetype??report.canonical_executive_snapshot?.identity.archetype,
    canonicalData:`${ds.resolutionAudit?.coreFactsResolved}/${ds.resolutionAudit?.coreFactsExpected} core; ${ds.periods.length} periods`,
    statements:report.financial_statements?.quality_status,businessKpis:ds.verifiedBusinessKpis?.length??0,
    primaryValuationMethod:run?.requestedPrimaryMethod??'NOT_EVALUATED_SOURCE_ONLY',baseFairValueAvailable:run?.baseFairValue!=null,
    conviction:report.verdict?.conviction_score??null,consistency:report.report_completion.consistencyStatus,
    valuationDeterminism:'NOT_EVALUATED (canonical accounting readback is stable; priced methods tested separately)',
    persistence:'PASS (production adapter contract in memory; NOT live Firestore)',unexpectedFalseNa:ds.resolutionAudit?.falseNegativeCandidateCount??null,
    intentionalUnavailable:run?.missingInputs??[],summaryBytes:jsonByteSize(documents.get('reports/'+reportId))});
}
mkdirSync('docs/audits',{recursive:true});
writeFileSync('docs/audits/master-source-matrix-2026-09-30.json',JSON.stringify({capturedAt:source.capturedAt,
  evidence:'Independent captured SEC/company-facts/primary filings + market quotes; no Gemini output or model assumptions',
  liveCloudPersistence:'BLOCKED: Firestore resource-exhausted / Quota exceeded observed during live acceptance',rows},null,2));
const columns=['Ticker','Archetype','Canonical Data','Statements','Business KPIs','Primary Valuation Policy','Base Fair Value Available?','Conviction','Consistency','Valuation Determinism','Persistence','Unexpected False-N/A'];
const matrix=['# Captured source regression matrix','',
  'This is source-only regression evidence, not live report acceptance. Missing model assumptions intentionally leave fair values unavailable. Full priced-method determinism is covered by the separate synthetic cross-sector/model suites. Persistence here verifies the production adapter contract in memory; live Firestore is blocked by quota.',
  '',`Source capture: ${source.capturedAt}`,'',`| ${columns.join(' | ')} |`,`| ${columns.map(()=>'---').join(' | ')} |`,
  ...rows.map(r=>`| ${[r.ticker,r.archetype,r.canonicalData,r.statements,r.businessKpis,r.primaryValuationMethod,r.baseFairValueAvailable?'Yes':'Not evaluated — source-only report',r.conviction??'Unavailable',r.consistency,'Not evaluated — accounting readback stable','PASS — in memory',r.unexpectedFalseNa].join(' | ')} |`)];
writeFileSync('docs/audits/master-source-matrix-2026-09-30.md',matrix.join('\n')+'\n');
console.log(JSON.stringify({tickers:rows.length,falseNa:rows.reduce((n,r)=>n+(r.unexpectedFalseNa??0),0),matrix:'docs/audits/master-source-matrix-2026-09-30.md'}));
