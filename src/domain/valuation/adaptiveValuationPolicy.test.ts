import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveAdaptiveValuationRun, resetValuationDeterminismRegistryForTest, valuationFingerprint, valuationMethodPolicy } from './adaptiveValuationPolicy';
import { verifiedFixtureFromStatements } from '../__tests__/verifiedFixtureBuilder';
import { adaptSecCanonicalToFinancialStatements } from '../../services/sec/secLegacyAdapter';
import { buildRigorousDCFModel, calculateStrictDCFValue } from '../../utils/valuation/dcfMathEngine';
import { resolveAdaptiveFivePillars } from './fivePillarsResolver';
import { calculateVerifiedKeyIndicators } from '../verifiedKeyIndicators';

const sourcePeers=(archetype:string,industry:string,metric:string)=>[2,3,4].map(n=>({ticker:`PX${n}`,companyName:`Observed peer ${n}`,
  archetype,industry,sector:archetype==='reit'?'Real Estate':'Healthcare',subIndustry:industry,revenueModels:['product_sales'],
  majorBusinessLines:[industry],geography:'US',lifecycle:'growth',profitabilityState:'profitable',capitalIntensity:'moderate',regulatoryType:'standard',scaleTier:'mid',
  metrics:{[metric]:{value:n,unit:'x',period:'TTM Q2 2026',source:'Yahoo market quote + SEC canonical financial snapshot',reportedOrDerived:'DERIVED',status:'VERIFIED'}}}));

// Explicit synthetic source fixtures: none of these values enter production.
const sourceReport = (industry = 'Software - Infrastructure', sector = 'Technology') => {
  const ds = verifiedFixtureFromStatements({ periods: ['Q2 2025','Q3 2025','Q4 2025','Q1 2026','Q2 2026'],
    income_statement: { revenue: [25,25,25,25,25], net_income: [4,4,4,4,4], net_income_common: [4,4,4,4,4] },
    balance_sheet: { total_assets:[200,200,200,200,200], total_liabilities:[100,100,100,100,100],
      stockholders_equity:[100,100,100,100,100], common_equity:[100,100,100,100,100],
      total_equity:[100,100,100,100,100], cash_and_equivalents:[10,10,10,10,10],
      short_term_investments:[0,0,0,0,0],total_debt:[10,10,10,10,10] },
    cash_flow: {operating_cash_flow:[4,4,4,4,4],capex:[0,0,0,0,0],free_cash_flow:[4,4,4,4,4]} } as any);
  ds.ticker = 'GENERIC';
  return {ticker:'GENERIC',company_profile:{sector,industry},canonical_financials:ds,
    financial_statements:adaptSecCanonicalToFinancialStatements(ds),
    market_snapshot:{ticker:'GENERIC',price:100,provider:'Independent test provider',dataKind:'market_quote'},
    sec_verification:{ticker:'GENERIC',dcf_financial_inputs:{current_shares_outstanding_m:1,ticker:'GENERIC',generated_by:'sec-verified-financial-inputs-v1',share_as_of:'2026-07-15'}},
    intrinsic_value:{dcf_model:{inputs:{isValid:true},assumptions:{wacc_pct:10,terminal_growth_pct:3,projection_years:5},
      scenarios:{bear:{revenue_cagr_pct:2,terminal_margin_pct:10,fair_value_per_share:999},
        base:{revenue_cagr_pct:5,terminal_margin_pct:16,fair_value_per_share:999},
        bull:{revenue_cagr_pct:8,terminal_margin_pct:20,fair_value_per_share:999}}}}} as any;
};
test('bank uses verified residual income despite a model supplied DCF label', () => {
  const report=sourceReport('Banks - Diversified','Financial Services');
  report.intrinsic_value.selected_model={model_type:'dcf_standard'};
  report.intrinsic_value.ddm_model={assumptions:{current_roe_pct:99,cost_of_equity_pct:10,terminal_growth_pct:3}};
  const run=resolveAdaptiveValuationRun(report);
  assert.equal(run.primaryMethod,'RESIDUAL_INCOME');
  assert.equal(run.baseFairValue,185.71);
  assert.equal(run.inputSnapshot.roePct,16);
  assert.deepEqual(valuationMethodPolicy('conglomerate'),['SOTP']);
});
test('dated source shares incompatible with the current statement cannot price an equity model',()=>{
  const report=sourceReport('Banks - Diversified','Financial Services');
  report.intrinsic_value.ddm_model={assumptions:{cost_of_equity_pct:10,terminal_growth_pct:3}};
  report.sec_verification.dcf_financial_inputs.share_as_of='2011-04-29';
  assert.equal(resolveAdaptiveValuationRun(report).baseFairValue,null);
  report.sec_verification.dcf_financial_inputs.share_as_of='2027-01-01';
  assert.equal(resolveAdaptiveValuationRun(report).baseFairValue,null);
});
test('fee-based property services use FCFF despite their sector or investment management subsidiary',()=>{
  const report=sourceReport('Real Estate Services','Real Estate');
  report.company_profile.description='Commercial property advisory and facilities management with an investment management subsidiary serving real estate investment trusts.';
  const run=resolveAdaptiveValuationRun(report);
  assert.equal(run.archetype,'general_operating');
  assert.equal(run.primaryMethod,'FCFF_DCF');
  assert.ok(run.baseFairValue!>0);
});
test('FCFF recomputes source bound inputs and ignores all AI output fields', () => {
  const report=sourceReport(); const first=resolveAdaptiveValuationRun(report);
  assert.equal(first.baseFairValue,calculateStrictDCFValue(100,1,0,10,3,5,16,5));
  report.intrinsic_value.dcf_model.scenarios.base.fair_value_per_share=888;
  report.intrinsic_value.dcf_model.inputs.startingRevenueM=9999;
  assert.equal(resolveAdaptiveValuationRun(report).baseFairValue,first.baseFairValue);
  report.sec_verification.dcf_financial_inputs.current_shares_outstanding_m=null;
  assert.equal(resolveAdaptiveValuationRun(report).baseFairValue,null);
});

test('detailed FCFF and canonical run share verified inputs under partial SEC coverage', () => {
  const report = sourceReport();
  report.sec_verification.status = 'verified_partial';
  report.sec_verification.dcf_financial_inputs.eligible = false;
  report.company_profile.shares_outstanding = '999M';
  report.financial_statements.income_statement.revenue = [900, 900, 900, 900, 900];
  report.financial_statements.cash_flow.free_cash_flow = [900, 900, 900, 900, 900];
  const detailed = buildRigorousDCFModel(report, report.ticker);
  assert.equal(detailed.inputs.isValid, true);
  assert.equal(detailed.inputs.financialDataSource, 'sec_verified');
  assert.equal(detailed.inputs.startingRevenueM, 100);
  assert.equal(detailed.inputs.sharesOutstandingM, 1);
  assert.equal(detailed.inputs.netCashM, 0);
  report.intrinsic_value.dcf_model = detailed.dcfModel;
  assert.equal(resolveAdaptiveValuationRun(report).baseFairValue, detailed.dcfModel.scenarios.base.fair_value_per_share);
  report.sec_verification.dcf_financial_inputs.share_as_of = '2011-04-29';
  const invalid = buildRigorousDCFModel(report, report.ticker);
  assert.equal(invalid.inputs.isValid, false);
  assert.equal(invalid.inputs.sharesOutstandingM, null);
  assert.ok(invalid.inputs.missingFields?.includes('verified current common shares outstanding'));
  report.intrinsic_value.dcf_model = invalid.dcfModel;
  assert.equal(resolveAdaptiveValuationRun(report).baseFairValue, null);
});

test('incomplete historical dependencies preserve forward assumptions across repeated normalization', () => {
  const report = sourceReport();
  report.intrinsic_value.dcf_model = buildRigorousDCFModel(report, report.ticker).dcfModel;
  const baseline = resolveAdaptiveValuationRun(report);
  report.sec_verification.dcf_financial_inputs.current_shares_outstanding_m = null;
  for (let pass = 0; pass < 2; pass++) {
    report.intrinsic_value.dcf_model = buildRigorousDCFModel(report, report.ticker).dcfModel;
    assert.equal(report.intrinsic_value.dcf_model.inputs.isValid, false);
    assert.equal(report.intrinsic_value.dcf_model.scenarios.base.revenue_cagr_pct, 5);
    assert.equal(report.intrinsic_value.dcf_model.scenarios.base.terminal_margin_pct, 16);
    assert.equal(report.intrinsic_value.dcf_model.scenarios.base.fair_value_per_share, null);
    const unavailable = resolveAdaptiveValuationRun(report);
    assert.equal(unavailable.baseFairValue, null);
    assert.ok(!unavailable.missingInputs.includes('baseGrowth'));
    assert.ok(!unavailable.missingInputs.includes('baseMargin'));
  }
  report.sec_verification.dcf_financial_inputs.current_shares_outstanding_m = 1;
  report.intrinsic_value.dcf_model = buildRigorousDCFModel(report, report.ticker).dcfModel;
  const restored = resolveAdaptiveValuationRun(report);
  assert.equal(restored.baseFairValue, baseline.baseFairValue);
  assert.equal(restored.assumptionHash, baseline.assumptionHash);
  assert.equal(restored.inputHash, baseline.inputHash);
});

test('a missing, wrong-issuer or unproven quote cannot produce MoS but does not erase intrinsic value',()=>{
  const report=sourceReport(),expected=resolveAdaptiveValuationRun(report).baseFairValue;
  for(const quote of [undefined,{price:100},{ticker:'OTHER',provider:'Test',dataKind:'market_quote',price:100}]){
    report.market_snapshot=quote;
    const run=resolveAdaptiveValuationRun(report);
    assert.equal(run.baseFairValue,expected);
    assert.equal(run.currentPrice,null);
    assert.equal(run.marginOfSafetyPct,null);
    assert.equal(run.provenance.marketInputs,'UNAVAILABLE');
  }
});
test('identical accepted facts and assumptions are stable across timestamps and quotes', () => {
  resetValuationDeterminismRegistryForTest(); const report=sourceReport();
  const a=resolveAdaptiveValuationRun(report);
  report.canonical_financials.values['balance_sheet.total_equity'][0].source.retrievedAt='2026-10-01T00:00:00Z';
  report.market_snapshot.price=110;
  const b=resolveAdaptiveValuationRun(report);
  assert.equal(a.financialSnapshotId,b.financialSnapshotId); assert.equal(a.valuationRunId,b.valuationRunId);
  assert.equal(a.baseFairValue,b.baseFairValue); assert.notEqual(a.marginOfSafetyPct,b.marginOfSafetyPct);
  report.intrinsic_value.dcf_model.assumptions.wacc_pct=11;
  assert.notEqual(resolveAdaptiveValuationRun(report).assumptionHash,a.assumptionHash);
  assert.equal(valuationFingerprint({a:1,b:2}),valuationFingerprint({b:2,a:1}));
});
test('a persisted run with identical fingerprints and contradictory output fails closed', () => {
  resetValuationDeterminismRegistryForTest();const report=sourceReport();
  report.intrinsic_value.canonical_run={...resolveAdaptiveValuationRun(report),baseFairValue:999};
  const result=resolveAdaptiveValuationRun(report);
  assert.equal(result.status,'NON_DETERMINISTIC'); assert.equal(result.baseFairValue,null);
});
test('SOTP binds independent segment disclosures and excludes mixed basis or incomplete taxonomies', () => {
  const report=sourceReport('Diversified Holding Company','Financial Services');
  const ds=report.canonical_financials;
  ds.operatingSegments=[['Lending',0.6],['Platform',0.4]].map(([name,weight])=>({id:name,name,axis:'SegmentsAxis',member:name,
    values:{'income_statement.revenue':ds.values['income_statement.revenue'].map((v:any)=>({...v,value:v.value*Number(weight)}))}}));
  report.intrinsic_value.sotp_model={components:ds.operatingSegments.map((s:any)=>({name:s.name,segmentId:s.id,
    financialMetric:'income_statement.revenue',inputBasis:'TTM',valuationMultiple:2,valuationBasis:'EQUITY'})),
    corporateAdjustments:-10,valuePerShare:999};
  assert.equal(resolveAdaptiveValuationRun(report).baseFairValue,190);
  report.intrinsic_value.sotp_model.components.forEach((part:any)=>{part.bearValuationMultiple=1;part.bullValuationMultiple=3;});
  const cases=resolveAdaptiveValuationRun(report);
  assert.equal(cases.bearFairValue,90);assert.equal(cases.bullFairValue,290);
  assert.equal(cases.baseFairValue,190,'Explicit thesis assumptions do not rewrite the base');
  delete report.intrinsic_value.sotp_model.components[1].bearValuationMultiple;
  assert.equal(resolveAdaptiveValuationRun(report).bearFairValue,null,'One missing case assumption cannot become an invented discount');
  report.intrinsic_value.sotp_model.components[1].valuationBasis='ENTERPRISE';
  assert.equal(resolveAdaptiveValuationRun(report).baseFairValue,null);
  report.intrinsic_value.sotp_model.components.pop();
  assert.equal(resolveAdaptiveValuationRun(report).baseFairValue,null);
});
test('raw model AFFO, peer medians and dividend observations never qualify as financial evidence', () => {
  const report=sourceReport('Industrial REIT','Real Estate');
  report.intrinsic_value.reit_model={assumptions:{current_affo_per_share:4.8,peer_median_affo_multiple:26}};
  assert.equal(resolveAdaptiveValuationRun(report).baseFairValue,null);
  report.company_profile={industry:'Biotechnology',sector:'Healthcare'};
  for (const key of ['income_statement.net_income','income_statement.net_income_common','cash_flow.free_cash_flow','cash_flow.operating_cash_flow']) {
    report.canonical_financials.values[key].forEach((fact:any)=>{fact.value=-10;});
  }
  report.financial_statements=adaptSecCanonicalToFinancialStatements(report.canonical_financials);
  report.intrinsic_value.relative_only_model={fair_value_per_share:25,peer_median_multiple:2.5};
  assert.equal(resolveAdaptiveValuationRun(report).baseFairValue,null);
});
test('source identity mismatch and impossible assumptions cannot produce a fair value', () => {
  const report=sourceReport();report.canonical_financials.ticker='ANOTHER';
  assert.equal(resolveAdaptiveValuationRun(report).baseFairValue,null);
  report.canonical_financials.ticker='GENERIC';report.intrinsic_value.dcf_model.scenarios.base.terminal_margin_pct=101;
  assert.equal(resolveAdaptiveValuationRun(report).baseFairValue,null);
  report.canonical_financials.sourceCoverage.verifiedValues=0;
  assert.deepEqual(resolveAdaptiveValuationRun(report).missingInputs,['CANONICAL_FINANCIAL_SOURCE_UNVERIFIED']);
});

test('verified bank debt/equity has one ratio definition in the table and Five Pillars',()=>{
  const report=sourceReport('Banks - Diversified','Financial Services');
  const indicator=calculateVerifiedKeyIndicators(report.financial_statements).debt_to_equity.at(-1)!;
  assert.equal(indicator.value,0.1);
  assert.equal(resolveAdaptiveFivePillars(report,'GENERIC').fivePillarsData.balance_sheet.debt_to_equity,indicator.value);
});

test('REIT AFFO and preprofit peer valuations require independently verified observations and are deterministic',()=>{
  const reit=sourceReport('REIT - Retail','Real Estate'),ds=reit.canonical_financials;
  ds.issuerReportedNonGaap=ds.values['income_statement.revenue'].slice(-4).map((f:any)=>({metric:'companyReportedAFFO',value:1,unit:'USD_M',period:f.period,periodStart:f.periodStart,periodEnd:f.periodEnd,source:{...f.source,filingDate:'2026-08-01'},verification:'ISSUER_REPORTED_NON_GAAP'}));
  reit.peer_comparison={peers:sourcePeers('reit','REIT - Retail','p_affo_multiple')};
  const a=resolveAdaptiveValuationRun(reit);assert.equal(a.primaryMethod,'AFFO_MULTIPLE');assert.equal(a.baseFairValue,12);
  assert.equal(resolveAdaptiveValuationRun(structuredClone(reit)).valuationRunId,a.valuationRunId);
  const early=sourceReport('Biotechnology','Healthcare');
  for(const key of ['income_statement.net_income','income_statement.net_income_common','cash_flow.operating_cash_flow','cash_flow.free_cash_flow'])early.canonical_financials.values[key].forEach((f:any)=>{f.value=-1;});
  early.financial_statements=adaptSecCanonicalToFinancialStatements(early.canonical_financials);
  early.peer_comparison={peers:sourcePeers('biotech','Biotechnology','ev_sales')};
  const b=resolveAdaptiveValuationRun(early);assert.equal(b.primaryMethod,'PEER_EV_SALES');assert.equal(b.baseFairValue,300);
});
