import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {buildSecVerifiedIntegrationPackage} from './secIntegration';
import type {SecCompanyBundleLike} from './secFinancialMapper';
import {resolveReportCompletion} from '../../domain/reportCompletion';
import {sanitizeReportForSave, restoreReportSections} from '../../utils/reportPersistence';
const captured=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/filing-focus-date-public-2026-09-30.json.gz',import.meta.url))).toString());
const input=():SecCompanyBundleLike=>structuredClone(captured.bundle);
const fact=(bundle:SecCompanyBundleLike,metric:string,period:string)=>buildSecVerifiedIntegrationPackage(bundle)
  .canonicalFinancials!.values[metric]?.find(f=>f.period===period);

test('actual opposite-signed FY/YTD expense facts cannot certify a fictitious negative Q4 cost',()=>{
  const pkg=buildSecVerifiedIntegrationPackage(input()),ds=pkg.canonicalFinancials!;
  const q4=ds.values['income_statement.operating_expenses'].find(f=>f.period==='Q4 2025')!;
  assert.equal(q4.value,null);
  assert.equal(q4.verification,'unverified');
  assert.match(q4.derivation!,/COST_SIGN_CONVENTION_MISMATCH/);
  assert.deepEqual(q4.sourceComponents?.map(f=>f.value),[-2280.683,1685.958]);
  assert.ok(q4.sourceComponents?.every(f=>f.periodType!=='standalone_quarter'&&f.source?.documentUrl));
  assert.ok(ds.provenanceWarnings.some(w=>w.code==='COST_SIGN_CONVENTION_MISMATCH'));
  assert.equal(ds.values['income_statement.operating_expenses'].find(f=>f.period==='Q1 2026')?.value,612.295);
  assert.equal(ds.values['income_statement.revenue'].find(f=>f.period==='Q2 2026')?.value,2425.452);
});

test('captured rejected cost evidence survives report health and section-storage reconstruction',()=>{
  const pkg=buildSecVerifiedIntegrationPackage(input());
  const report={ticker:pkg.ticker, analysis_type:'fundamental', generated_at:'2026-10-01T04:00:00Z',
    canonical_financials:pkg.canonicalFinancials, financial_statements:pkg.financialStatements,
    intrinsic_value:{canonical_run:{status:'UNAVAILABLE',primaryMethod:'AFFO_MULTIPLE',missingInputs:['verifiedAffo']}},
    verdict:{conviction_score:null}} as any;
  report.report_completion=resolveReportCompletion(report,{status:'valid',issues:[],
    checked_at:report.generated_at,schema_version:3} as any);
  const plan=sanitizeReportForSave(report,{reportId:'captured-source-cost-test',userId:'test',language:'en'});
  const loaded=restoreReportSections(plan.sections,plan.aliases,plan.recomputedFields);
  const q4=loaded.financial_statements!.verified_dataset!.values['income_statement.operating_expenses']
    .find(f=>f.period==='Q4 2025')!;
  assert.equal(q4.value,null);
  assert.equal(q4.verification,'unverified');
  assert.deepEqual(q4.sourceComponents?.map(f=>f.value),[-2280.683,1685.958]);
  assert.match(q4.derivation!,/COST_SIGN_CONVENTION_MISMATCH/);
  assert.ok(loaded.report_completion!.diagnosticCodes.includes('COST_SIGN_CONVENTION_MISMATCH'));
  assert.equal(loaded.report_completion!.executionStatus,'COMPLETED');
  assert.equal(loaded.report_completion!.coverageStatus,'PARTIAL');
  assert.equal(loaded.report_completion!.valuationStatus,'UNAVAILABLE');
});

test('a directly reported standalone expense credit is preserved rather than converted with abs',()=>{
  const bundle=input();
  bundle.filingDocuments=[]; // Synthetic edit must not conflict with the original primary filing.
  bundle.companyFacts.facts!['us-gaap'].OperatingExpenses.units.USD.forEach(f=>{
    if(f.start==='2026-01-01'&&f.end==='2026-03-31')f.val=-612295000;
  });
  const reported=fact(bundle,'income_statement.operating_expenses','Q1 2026')!;
  assert.equal(reported.value,-612.295);
  assert.equal(reported.verification,'verified');
});

test('losses and tax benefits with opposite cumulative signs remain legitimate additive flows',()=>{
  const bundle=input(),facts=bundle.companyFacts.facts!['us-gaap'];
  bundle.filingDocuments=[];
  // Explicit synthetic alternatives to the captured source, not real issuer results.
  const duration=(fp:string,end:string,val:number)=>({start:'2025-01-01',end,val,fy:2025,fp,
    form:fp==='FY'?'10-K':'10-Q',filed:fp==='FY'?'2026-02-13':'2025-10-28',accn:fp==='FY'?'0001193125-26-051453':'0001193125-25-253512'});
  facts.ProfitLoss={units:{USD:[duration('Q3','2025-09-30',20000000),duration('FY','2025-12-31',-100000000)]}};
  facts.IncomeTaxExpenseBenefit={units:{USD:[duration('Q3','2025-09-30',6000000),duration('FY','2025-12-31',-3000000)]}};
  const ds=buildSecVerifiedIntegrationPackage(bundle).canonicalFinancials!;
  assert.equal(ds.values['income_statement.net_income'].find(f=>f.period==='Q4 2025')?.value,-120);
  assert.equal(ds.values['income_statement.income_tax_expense'].find(f=>f.period==='Q4 2025')?.value,-9);
});
