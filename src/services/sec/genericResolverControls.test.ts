import assert from 'node:assert/strict';
import {test} from 'node:test';
import {normalizeDurationFactsToStandaloneQuarters,normalizeInstantFactsToFiscalQuarters} from './xbrlNormalizer';
import {buildSecShareSnapshot} from './secShareSnapshot';
import {buildSecVerifiedIntegrationPackage} from './secIntegration';
import type {SecCompanyBundleLike} from './secFinancialMapper';
import {reconcileCanonicalTtmFlow} from '../../domain/canonicalTtmFlow';
import {completeBundleFromInlineStatements} from './secStatementCompletion';
import {reconcileCanonicalFlowAndMultipleNarrative} from '../../domain/canonicalExecutiveSnapshot';
import {FINANCIAL_METRIC_REGISTRY} from '../../domain/selectedFinancialMetric';
import {CANONICAL_METRIC_DEFINITIONS} from './canonicalMetricDefinitions';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
const fact=(value:number,fp:string,end:string,start?:string)=>({val:value,fy:2026,fp,end,start,form:fp==='FY'?'10-K':'10-Q',filed:'2026-09-20',accn:'0000000001-26-000001'});
const bundle=(facts:any):SecCompanyBundleLike=>({identity:{ticker:'UNSEEN',cik:'0000000001',title:'Unseen issuer'},submissions:{cik:'0000000001'},companyFacts:{cik:1,facts},retrievedAt:'2026-09-29T00:00:00Z'});
test('every controlled canonical family has central semantic metadata and interpretation policy',()=>{
  for (const def of CANONICAL_METRIC_DEFINITIONS) {
    assert.ok(FINANCIAL_METRIC_REGISTRY[def.metric],def.key);
    assert.ok(FINANCIAL_METRIC_REGISTRY[def.metric].assessmentPolicy,def.key);
  }
});
test('redeemable NCI is not added twice; scope classification requires explicit primary row evidence',()=>{
  const capture=(name:string)=>JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/'+name,import.meta.url))).toString());
  const b=capture('generic-universe-public-2026-09-29.json.gz').bundles.find((b:any)=>b.identity.ticker==='CVX');
  const before=buildSecVerifiedIntegrationPackage(b),original=before.canonicalFinancials!.values['balance_sheet.redeemable_noncontrolling_interest'].find(v=>v.period==='Q3 2023')!;
  assert.equal(original.value,150);assert.equal(original.balancePresentation,undefined);
  assert.equal(before.financialStatements!.validation_summary!.failed_guards!.filter(g=>/BALANCE_SHEET_IMBALANCE/.test(g)).length,0);
  assert.notEqual(before.financialStatements!.validation_summary!.reconciliation_status,'passed');
  b.filingDocuments=[capture('generic-redeemable-nci-presentation.json.gz').document];
  const after=buildSecVerifiedIntegrationPackage(b).canonicalFinancials!.values['balance_sheet.redeemable_noncontrolling_interest'].find(v=>v.period==='Q3 2023')!;
  assert.equal(after.value,150);assert.equal(after.balancePresentation?.classification,'INCLUDED_IN_NCI');
  assert.match(after.balancePresentation!.documentUrl,/sec.gov/);
});
test('conflicting equally ranked consolidated facts are rejected; array order is not candidate ranking',()=>{
  const a=fact(10,'Q1','2026-03-31','2026-01-01'),b={...a,val:99};
  assert.equal(normalizeDurationFactsToStandaloneQuarters([a,b]).length,0);
  assert.equal(normalizeDurationFactsToStandaloneQuarters([b,a]).length,0);
  assert.equal(normalizeDurationFactsToStandaloneQuarters([a,{...b,filed:'2026-09-21',form:'10-Q/A'}])[0].value,99);
});

for (const [end,days,annual] of [['2026-08-30',112,52],['2026-09-06',119,53]] as const) test(`${annual}-week retail year: compatible FY minus Q3 produces ${days}-day Q4, exactly four quarters in TTM`,()=>{
  const normalized=normalizeDurationFactsToStandaloneQuarters([
    fact(10,'Q1','2025-11-23','2025-09-01'),fact(30,'Q2','2026-02-15','2025-09-01'),
    fact(60,'Q3','2026-05-10','2025-09-01'),fact(100,'FY',end,'2025-09-01'),
  ]);
  assert.deepEqual(normalized.map(f=>f.value),[10,20,30,40]);assert.equal(normalized.at(-1)?.durationDays,days);
  const periods=normalized.map(f=>`Q${f.fiscalQuarter} ${f.fiscalYear}`);
  const ds:any={periods,values:{'income_statement.revenue':normalized.map(f=>({metric:'revenue',statement:'income_statement',value:f.value,unit:'USD_M',periodType:'standalone_quarter',periodStart:f.start,periodEnd:f.end,durationDays:f.durationDays,fiscalYear:f.fiscalYear,fiscalQuarter:f.fiscalQuarter,period:`Q${f.fiscalQuarter} ${f.fiscalYear}`,verification:'verified',currency:'USD'}))}};
  assert.equal(reconcileCanonicalTtmFlow(ds,'income_statement.revenue').canonicalValue,100);
});
test('latest instant rejects geography/class contexts while retaining consolidated fact',()=>{
  const source=[fact(100,'Q2','2026-06-30'),{...fact(999,'Q2','2026-06-30'),dimensions:{geography:'US'},filed:'2026-09-21'}];
  assert.equal(normalizeInstantFactsToFiscalQuarters(source)[0].value,100);
});
test('missing predecessor never turns H1 YTD into a quarter and has a precise failure boundary',()=>{
  const pkg=buildSecVerifiedIntegrationPackage(bundle({'us-gaap':{Assets:{units:{USD:[fact(100,'Q2','2026-06-30')]}},NetCashProvidedByUsedInOperatingActivities:{units:{USD:[fact(30,'Q2','2026-06-30','2026-01-01')]}}}}));
  assert.equal(pkg.canonicalFinancials!.values['cash_flow.operating_cash_flow']?.at(-1)?.value ?? null,null);
  const diagnostic=pkg.resolutionAudit!.diagnostics.find(d=>d.metricKey==='cash_flow.operating_cash_flow')!;
  assert.equal(diagnostic.status,'PERIOD_NOT_RESOLVED');assert.equal(diagnostic.falseNegativeCandidate,false);
});
test('common shares use a verified consolidated instant; conflicting class counts and diluted averages never substitute',()=>{
  const b=bundle({'us-gaap':{CommonStockSharesOutstanding:{units:{shares:[fact(20e6,'Q2','2026-06-30')]}},WeightedAverageNumberOfDilutedSharesOutstanding:{units:{shares:[fact(22e6,'Q2','2026-06-30','2026-04-01')]}}}});
  const shares=()=>buildSecShareSnapshot(b.identity,b.submissions,b.companyFacts,b.retrievedAt);
  assert.equal(shares().currentCommonSharesOutstanding?.sharesM,20);
  b.companyFacts.facts!['us-gaap'].CommonStockSharesOutstanding.units!.shares!.push(fact(5e6,'Q2','2026-06-30'));
  assert.equal(shares().currentCommonSharesOutstanding,null);assert.equal(shares().latestDilutedWeightedAverageShares?.sharesM,22);
});
test('exact extension label without primary semantic evidence is a discovery candidate, not a fabricated fact',()=>{
  const pkg=buildSecVerifiedIntegrationPackage(bundle({'us-gaap':{Assets:{units:{USD:[fact(100,'Q2','2026-06-30')]}}},issuer:{CompanyRevenue:{label:'Revenues',units:{USD:[fact(20,'Q2','2026-06-30','2026-04-01')]}}}}));
  const diagnostic=pkg.resolutionAudit!.diagnostics.find(d=>d.metricKey==='income_statement.revenue')!;
  assert.equal(diagnostic.status,'NO_SEMANTIC_MAPPING');assert.match(diagnostic.rejectedCandidates[0].reason!,/SEMANTIC_EVIDENCE/);
  assert.equal(pkg.canonicalFinancials!.values['income_statement.revenue']?.at(-1)?.value ?? null,null);
});
test('extension inside primary consolidated statement retains exact row/context evidence; segment row fails closed',()=>{
  const b=bundle({'us-gaap':{Assets:{units:{USD:[fact(100,'Q2','2026-06-30')]}}}});
  const ctx='<xbrli:context id="con"><xbrli:entity><xbrli:identifier scheme="x">1</xbrli:identifier></xbrli:entity><xbrli:period><xbrli:startDate>2026-04-01</xbrli:startDate><xbrli:endDate>2026-06-30</xbrli:endDate></xbrli:period></xbrli:context>';
  const number='<ix:nonFraction name="issuer:Sales" contextRef="con" unitRef="USD" scale="6">20</ix:nonFraction>';
  b.filingDocuments=[{accession:'0000000001-26-000001',form:'10-Q',filingDate:'2026-09-20',documentUrl:'https://www.sec.gov/Archives/edgar/data/1/000000000126000001/report.htm',html:ctx+'<xbrli:unit id="USD"><xbrli:measure>iso4217:USD</xbrli:measure></xbrli:unit><table><tr><td>Revenues</td><td>'+number+'</td></tr><tr><td>Net income</td></tr></table>'}];
  const value=buildSecVerifiedIntegrationPackage(b).canonicalFinancials!.values['income_statement.revenue'].at(-1)!;
  assert.equal(value.value,20);assert.equal(value.mappingKind,'ISSUER_EXTENSION_VERIFIED');assert.equal(value.mappingEvidence?.definition,'Revenues');
  b.filingDocuments[0].html=b.filingDocuments[0].html.replace('<xbrli:entity>','<xbrli:entity><segment><xbrldi:explicitMember dimension="Product">X</xbrldi:explicitMember></segment>');
  const noSegment=completeBundleFromInlineStatements(b,buildSecVerifiedIntegrationPackage({...b,filingDocuments:[]}).canonicalFinancials!);
  assert.equal(noSegment.companyFacts.facts!['us-gaap'].RevenueFromContractWithCustomerExcludingAssessedTax,undefined);
});
test('current narrative keeps TTM units and trailing/forward/PEG eligibility distinct',()=>{
  const snapshot:any={growth:{revenueTtm:2000},cashFlow:{fcfTtm:1000},balanceSheet:{netCashOrDebt:null},market:{peTrailing:30,peForward:12},marketMultiples:{peTrailing:{value:30},peForward:{value:12},peg:{value:null}}};
  const text=reconcileCanonicalFlowAndMultipleNarrative('TTM Revenue $8 billion; TTM FCF $3 billion; Trailing P/E 55x; Forward P/E 15x; PEG Ratio 0.47x; Net Cash $9 billion',snapshot,false);
  assert.match(text,/TTM Revenue \$2 billion/);assert.match(text,/TTM FCF \$1 billion/);assert.match(text,/Trailing P\/E 30 x/);assert.match(text,/Forward P\/E 12 x/);assert.ok(!text.includes('0.47'));assert.ok(!text.includes('9 billion'));
});

test('missing canonical debt cannot be described as zero while combined liquidity remains separate',()=>{
  const snapshot:any={balanceSheet:{totalDebt:null,totalCashAndInvestments:9409.1,netCashOrDebt:null},market:{}};
  const text=reconcileCanonicalFlowAndMultipleNarrative('เงินสดและตราสารหนี้ระยะสั้น 9,409.10 ล้านดอลลาร์ โดยมีหนี้สินที่มีภาระดอกเบี้ยเป็นศูนย์ (0.00 MUSD)',snapshot,true);
  assert.ok(text.includes('9,409.10'));assert.ok(!text.includes('เป็นศูนย์'));assert.ok(!text.includes('0.00 MUSD'));
});
