import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { buildSecVerifiedIntegrationPackage } from '../services/sec/secIntegration';
import { adaptSecCanonicalToFinancialStatements } from '../services/sec/secLegacyAdapter';
import { buildVerifiedStatementPeriods, reconcileVerifiedDataset } from './verifiedFinancialStatements';
import { calculateVerifiedKeyIndicators } from './verifiedKeyIndicators';
import { normalizeReport } from '../utils/reportIntegrity';
import { validateFinancialStatements, detectStatementTemplate } from '../utils/statementValidator';
import { aggregateQuarterlyToAnnual } from '../utils/statementAggregation';
import { getMetricCalculationDetail } from '../utils/metricCalculations';
import { financialSynthesisHasUnsupportedNumbers, verifiedMetricSeries, selectVerifiedSynthesisPeriodView } from './financialSynthesisGuard';
import { normalizeDurationFactsToStandaloneQuarters } from '../services/sec/xbrlNormalizer';
import { resolveFundamentalMetrics } from './valuation/metricRegistry';
import {mapSecBundleToCanonicalFinancials} from '../services/sec/secFinancialMapper';
import {getMetricInterpretationContext,getBusinessAwareLocalFallback} from './financialMetricContext';
import type { ReportData } from '../types';

const bundle = JSON.parse(readFileSync(new URL('../services/sec/fixtures/verified-tsla-2026q2.json', import.meta.url), 'utf8'));
const canonical = () => buildSecVerifiedIntegrationPackage(structuredClone(bundle)).canonicalFinancials!;
const financials = () => adaptSecCanonicalToFinancialStatements(canonical())!;

test('analyst definitions consume canonical return formulas and preserve currency, per-share and ratio units',()=>{
 const fs=financials();
 const ctx=(key:string,unit:string,isCurrency=false)=>getMetricInterpretationContext({metricKey:key,metricName:key,reportData:fs,historyValues:[1.34],periods:fs.periods.slice(-1),unit,isCurrency,isSourceReconciled:false});
 assert.equal(ctx('roe','%').formula,fs.indicator_details!.roe.at(-1)!.formula);
 const revenue=getBusinessAwareLocalFallback(ctx('revenue','$',true),28236,false);
 assert.match(revenue.interpretation_en,/\$28\.24B/);assert.doesNotMatch(revenue.interpretation_en,/28236.*%/);
 assert.match(revenue.status_label_en,/Partial reconciliation/);
 assert.match(getBusinessAwareLocalFallback(ctx('eps','$'),.32,false).interpretation_en,/\$0\.32\/share/);
 assert.match(getBusinessAwareLocalFallback(ctx('quick_ratio','x'),1.34,false).interpretation_en,/1\.34x/);
 assert.match(ctx('gross_profit','$',true).formula,/Gross Profit = Revenue - Cost of Revenue/);
 assert.equal(ctx('free_cash_flow','$',true).periodType,'QUARTER');
 fs.validation_summary!.reconciliation_status='failed';
 assert.equal(getBusinessAwareLocalFallback(ctx('revenue','$',true),28236,false).status_label_en,'Data unavailable');
});

test('a newer isolated comparative equity fact cannot mix with an older balance-sheet filing cohort',()=>{
  const b=structuredClone(bundle);
  const concepts=b.companyFacts.facts['us-gaap'];
  const series=concepts.StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest.units.USD;
  const original=series.find((f:any)=>f.end==='2025-06-30');
  assert.ok(original);
  series.push({...original,val:original.val+497000000,accn:'isolated-restatement',filed:'2026-09-27'});
  const clean=mapSecBundleToCanonicalFinancials(bundle)!;
  const result=mapSecBundleToCanonicalFinancials(b)!;
  const key='balance_sheet.total_equity';
  assert.deepEqual(result.values[key].map(v=>v.value),clean.values[key].map(v=>v.value));
  assert.ok(result.values[key].every(v=>v.accession!=='isolated-restatement'));
});

test('current return ratios are not suppressed by an unrelated failed historical instant',()=>{
  const fs=financials();const expected=calculateVerifiedKeyIndicators(fs);
  fs.validation_summary={...fs.validation_summary!,reconciliation_status:'failed',failed_guards:['BALANCE_SHEET_IMBALANCE: Q1 2020 Assets mismatch']};
  const current=calculateVerifiedKeyIndicators(fs);
  assert.equal(current.roe.at(-1)?.value,expected.roe.at(-1)?.value);
  fs.validation_summary.failed_guards=[`BALANCE_SHEET_IMBALANCE: ${fs.periods.at(-1)} Assets mismatch`];
  assert.equal(calculateVerifiedKeyIndicators(fs).roe.at(-1)?.value,null);
});

test('official SEC capture maps actual Q3 2025–Q2 2026 standalone flows, not prior-year comparatives', () => {
  const fs = financials();
  assert.deepEqual(fs.periods.slice(-4), ['Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026']);
  assert.deepEqual(fs.income_statement.revenue.slice(-4), [28095, 24901, 22387, 28236]);
  assert.deepEqual(fs.income_statement.net_income_common?.slice(-4), [1373, 840, 477, 1114]);
  assert.equal(fs.income_statement.net_income.at(-1), 1128);
  assert.deepEqual(fs.cash_flow.operating_cash_flow?.slice(-4), [6238, 3813, 3937, 4697]);
  assert.deepEqual(fs.cash_flow.capex?.slice(-4), [-2248, -2393, -2493, -5789]);
  assert.deepEqual(fs.cash_flow.free_cash_flow?.slice(-4), [3990, 1420, 1444, -1092]);
  assert.equal(fs.balance_sheet.stockholders_equity?.at(-1), 86858);
  assert.equal(fs.balance_sheet.total_equity?.at(-1), 87465);
  assert.equal(fs.balance_sheet.noncontrolling_interest?.at(-1), 607);
  assert.equal(fs.balance_sheet.redeemable_noncontrolling_interest?.at(-1), 54);
  assert.ok(fs.period_snapshots?.at(-1)?.observations['income_statement.revenue'].source?.documentUrl?.includes('tsla-20260630'));
});

test('series order has no authority; own structured fiscal identity controls placement', () => {
  const d = canonical(); d.values['balance_sheet.inventory'].reverse();
  assert.deepEqual(adaptSecCanonicalToFinancialStatements(d)?.balance_sheet.inventory, financials().balance_sheet.inventory);
});
test('a relabeled current instant cannot enter a historical period', () => {
  const d = canonical(); const item = d.values['balance_sheet.inventory'].at(-1)!;
  item.period = d.periods[0];
  assert.equal(adaptSecCanonicalToFinancialStatements(d)?.balance_sheet.inventory?.at(-1), null);
});
test('a mixed historical cell with an incompatible actual end stays null', () => {
  const d = canonical(); d.values['balance_sheet.inventory'][1].periodEnd = '2024-06-30';
  assert.equal(adaptSecCanonicalToFinancialStatements(d)?.balance_sheet.inventory?.[1], null);
});
test('duplicate observations fail closed instead of choosing the first', () => {
  const d = canonical(); d.values['balance_sheet.inventory'].push(structuredClone(d.values['balance_sheet.inventory'][0]));
  assert.equal(adaptSecCanonicalToFinancialStatements(d)?.balance_sheet.inventory?.[0], null);
});
test('wrong unit, source period, currency, estimated type or unverified status cannot enter accepted cells', () => {
  for (const change of [{unit:'unknown'}, {currency:'EUR'}, {type:'estimated'}, {type:undefined}, {verification:'source_linked'}, {source:{provider:'AI',documentUrl:'https://example.com'}}]) {
    const d = canonical(); Object.assign(d.values['balance_sheet.inventory'].at(-1)!, change);
    assert.equal(adaptSecCanonicalToFinancialStatements(d)?.balance_sheet.inventory?.at(-1), null);
  }
});

test('missing gross profit or COGS derives centrally with compatible source components, including zero', () => {
  for (const [missing, left, right] of [['gross_profit','revenue','cogs'],['cogs','revenue','gross_profit']]) {
    const d = canonical(); delete d.values[`income_statement.${missing}`];
    const result = reconcileVerifiedDataset(d)!;
    const item = result.values[`income_statement.${missing}`].at(-1)!;
    assert.equal(item.value, d.values[`income_statement.${left}`].at(-1)!.value! - d.values[`income_statement.${right}`].at(-1)!.value!);
    assert.equal(item.type, 'derived'); assert.equal(item.sourceComponents?.length, 2);
    assert.ok(item.sourceComponents?.every(c => c.periodEnd === item.periodEnd && c.verification === 'verified'));
    const fs = adaptSecCanonicalToFinancialStatements(result)!;
    assert.equal(fs.income_statement[missing as 'gross_profit'|'cogs']?.at(-1), item.value);
    assert.ok(fs.indicator_details!.gross_margin.at(-1)?.value !== null);
  }
  const d = canonical(); delete d.values['income_statement.gross_profit'];
  d.values['income_statement.cogs'].at(-1)!.value = d.values['income_statement.revenue'].at(-1)!.value;
  assert.equal(reconcileVerifiedDataset(d)!.values['income_statement.gross_profit'].at(-1)!.value, 0);
});

test('gross-profit identity cannot mask incompatible or duplicated disclosed inputs', () => {
  const d = canonical(); delete d.values['income_statement.gross_profit'];
  d.values['income_statement.cogs'].at(-1)!.periodStart = '2026-01-01';
  assert.equal(reconcileVerifiedDataset(d)!.values['income_statement.gross_profit'].at(-1)!.value, null);
  const conflict = canonical();
  conflict.values['income_statement.gross_profit'].push(structuredClone(conflict.values['income_statement.gross_profit'].at(-1)!));
  assert.equal(reconcileVerifiedDataset(conflict)!.values['income_statement.gross_profit'].at(-1)!.value, null);
});
test('missing and zero remain different, including goodwill, dividends and leases', () => {
  const d = canonical(); const series = d.values['balance_sheet.inventory'];
  series[0].value = 0; series[1].value = null;
  const fs = adaptSecCanonicalToFinancialStatements(d)!;
  assert.equal(fs.balance_sheet.inventory?.[0], 0); assert.equal(fs.balance_sheet.inventory?.[1], null);
  assert.equal(fs.cash_flow.dividends_paid, undefined);
});
test('legacy package without mapping/normalization version is not retroactively verified', () => {
  const d = canonical(); delete d.mappingVersion;
  assert.equal(adaptSecCanonicalToFinancialStatements(d), null);
});

test('parent income cannot be silently renamed common income when common allocation and preferred-equity proof are absent',()=>{
 const b=structuredClone(bundle);delete b.companyFacts.facts['us-gaap'].NetIncomeLossAvailableToCommonStockholdersBasic;
 delete b.companyFacts.facts['us-gaap'].PreferredStockValue;
 const fs=buildSecVerifiedIntegrationPackage(b).financialStatements!;
 assert.equal((fs.income_statement as any).net_income_parent.at(-1),1114);
 assert.equal(fs.income_statement.net_income_common,undefined);
 assert.equal(fs.indicator_details!.roe.at(-1)!.value,null);
});
test('AI arrays, ratios and numerical cells never override SEC authority', () => {
  const d = canonical();
  const report = normalizeReport({ ticker:'TSLA', canonical_financials:d, financial_statements: { ...financials(), income_statement:{revenue:[999999],net_income:[777777]} }, key_indicators:{roe:999} } as any);
  assert.deepEqual(report.financial_statements?.income_statement.revenue.slice(-4), [28095,24901,22387,28236]);
  assert.equal(report.key_indicators, undefined);
  const unavailable = normalizeReport({ ticker:'TEST', financial_statements:financials() } as ReportData);
  assert.deepEqual(unavailable.financial_statements?.periods, []);
});
test('FCF always derives from OCF and absolute CapEx, even if a provider reports another value', () => {
  const d = canonical(); d.values['cash_flow.free_cash_flow'].at(-1)!.value = 123456;
  assert.equal(reconcileVerifiedDataset(d)?.values['cash_flow.free_cash_flow'].at(-1)?.value, -1092);
});
test('balance equation uses combined equity once and redeemable NCI separately', () => {
  const fs = financials();
  const v = validateFinancialStatements(fs);
  assert.equal(v.discrepancy_amount?.at(-1), 0); assert.equal(v.is_balanced, true);
  assert.equal(v.reconciliation_components?.at(-1)?.noncontrollingInterest, 607);
  fs.balance_sheet.total_assets![fs.periods.length-1]! += 50;
  const bad = validateFinancialStatements(fs);
  assert.equal(bad.reconciliation_status, 'failed'); assert.equal(bad.impossible_guards_passed, false);
});
test('missing reconciliation inputs never produce green Passed', () => {
  const fs = financials(); delete fs.balance_sheet.total_assets;
  assert.equal(validateFinancialStatements(fs).is_balanced, false);
  assert.equal(validateFinancialStatements(fs).impossible_guards_passed, false);
});
test('ROE uses common NI TTM and true prior-year common equity; ROA has total NI basis', () => {
  const fs = financials(), k = calculateVerifiedKeyIndicators(fs);
  assert.equal(k.roe.at(-1)?.variables.commonNetIncomeTtm, 3804);
  assert.equal(k.roe.at(-1)?.variables.averageEquity, (77314 + 86858)/2);
  assert.equal(k.roa.at(-1)?.variables.totalNetIncomeTtm, 3864);
  assert.equal(k.roe.at(-1)?.value, 4.63);
  const detail = getMetricCalculationDetail('roe', fs.periods.length-1, fs)!;
  assert.ok(detail.variables.every(v => v.unit === 'USD_M' && v.isCurrency));
  const roic = k.roic.at(-1)!;
  const inputs = roic.variables;
  const computed = inputs.operatingIncomeTtm! * (1 - inputs.taxRate!) / inputs.investedCapitalUsed! * 100;
  assert.equal(Math.round(computed*100)/100, roic.value);
  if (roic.basis.includes('Ending')) {
    assert.match(roic.formula, /Ending/); assert.equal(roic.status, 'approximate');
  }
});
test('Key Indicators, formula details and Five Pillars resolve identical values/bases', () => {
  const fs = financials(), k = calculateVerifiedKeyIndicators(fs);
  const resolved = resolveFundamentalMetrics({ticker:'TSLA', financial_statements:fs, canonical_financials:fs.verified_dataset,company_profile:{sector:'Consumer Cyclical',industry:'Auto Manufacturers'}} as any);
  for (const [key, field] of [['roe','roe'],['roa','roa'],['roic','roic'],['quick_ratio','quickRatio'],['net_margin','netMargin']] as const) {
    assert.equal(getMetricCalculationDetail(key,fs.periods.length-1,fs)?.resultValue, k[key].at(-1)?.value);
    assert.equal(resolved[field].value ?? null, k[key].at(-1)?.value);
  }
});
test('quick assets are cash + STI + AR; debt/assets excludes other liabilities', () => {
  const k = calculateVerifiedKeyIndicators(financials());
  assert.equal(k.quick_ratio.at(-1)?.value, Math.round((15219+28305+4087)/35425*100)/100);
  assert.equal(k.debt_to_asset.at(-1)?.value, Math.round(9342/148524*10000)/100);
});
test('DSO/DIO use average instants and actual 91-day Q2; DPO is an explicit COGS proxy', () => {
  const k = calculateVerifiedKeyIndicators(financials());
  assert.equal(k.dso.at(-1)?.variables.days, 91);
  assert.equal(k.dio.at(-1)?.variables.days, 91);
  assert.equal(k.dpo.at(-1)?.status, 'approximate');
});
test('annual flows are summed; instants end the year; EPS is not blindly additive', () => {
  const annual = aggregateQuarterlyToAnnual(financials())!;
  assert.ok(annual.periods.includes('FY 2025'));
  assert.equal(annual.income_statement.eps_diluted?.at(-1), null);
  const k = calculateVerifiedKeyIndicators(annual);
  assert.equal(k.dso.at(-1)?.variables.days, 365);
  assert.deepEqual(annual.income_statement.net_margin_pct, k.net_margin.map(v => v.value));
  assert.deepEqual(annual.balance_sheet.debt_to_equity, k.debt_to_equity.map(v => v.value));
});

test('quarterly percentage disclosures are not summed annually; bank KPIs and cash-flow aliases share accepted values', () => {
  const fs = financials();
  fs.income_statement.net_interest_margin_pct = fs.periods.map(() => 2);
  assert.ok(aggregateQuarterlyToAnnual(fs)!.income_statement.net_interest_margin_pct!.every(v => v === null));
  assert.deepEqual(verifiedMetricSeries(fs, 'ocf', fs.periods), fs.cash_flow.operating_cash_flow);
  assert.deepEqual(verifiedMetricSeries(fs, 'icf', fs.periods), fs.cash_flow.investing_cash_flow);
  const bankBundle = JSON.parse(readFileSync(new URL('../services/sec/fixtures/verified-cross-sector-2026.json', import.meta.url), 'utf8')).bundles.find((b:any) => b.identity.ticker === 'JPM');
  const bank = buildSecVerifiedIntegrationPackage(bankBundle).financialStatements!;
  const k = calculateVerifiedKeyIndicators(bank);
  assert.equal(k.deposit_growth.at(-1)!.value, bank.balance_sheet.deposits!.at(-1));
  assert.deepEqual(verifiedMetricSeries(bank, 'loan_deposit_ratio', bank.periods), k.loan_deposit_ratio.map(v => v.value));
  assert.equal(getMetricCalculationDetail('loan_deposit_ratio', bank.periods.length-1, bank)!.resultValue, k.loan_deposit_ratio.at(-1)!.value);
});

test('synthesis requests for LTM alone resolve the same annual value even though its label contains quarters', () => {
  const fs = financials(), label = aggregateQuarterlyToAnnual(fs)!.periods.at(-1)!;
  assert.match(label, /^LTM.*Q3.*Q2/);
  const view = selectVerifiedSynthesisPeriodView(fs, [label])!;
  assert.equal(view.fiscal_period_type, 'annual');
  assert.deepEqual(verifiedMetricSeries(view, 'revenue', [label]), [103619]);
  assert.equal(selectVerifiedSynthesisPeriodView(fs, ['FY 1900']), null);
});
test('YTD contamination and non-equivalent concepts cannot be subtracted', () => {
  const source = (end:string,val:number,unit:string) => ({start:'2026-01-01',end,val,fy:2026,fp:end.endsWith('03-31')?'Q1':'Q2',form:'10-Q',sourceUnit:unit,sourceConcept:'A'});
  assert.equal(normalizeDurationFactsToStandaloneQuarters([source('2026-03-31',10,'USD'),source('2026-06-30',25,'EUR')]).length,1);
  const d = canonical(); d.values['cash_flow.operating_cash_flow'].at(-1)!.periodStart = '2026-01-01';
  assert.equal(adaptSecCanonicalToFinancialStatements(d)?.cash_flow.operating_cash_flow?.at(-1),null);
});
test('ratio/per-share YTD differences are prohibited', () => {
  const facts=[{start:'2026-01-01',end:'2026-03-31',val:.4,fy:2026,fp:'Q1',form:'10-Q'}, {start:'2026-01-01',end:'2026-06-30',val:.8,fy:2026,fp:'Q2',form:'10-Q'}];
  assert.equal(normalizeDurationFactsToStandaloneQuarters(facts,{additive:false}).length,1);
});
test('bank, insurer, payments fintech, REIT and pre-profit applicability comes from business model', () => {
  for (const [industry, expected] of [['Banks - Diversified','banking'],['Insurance','insurance'],['Payment processing financial technology','standard'],['REIT - Industrial','reit'],['clinical-stage biotechnology','biotech']] as const) {
    const fs = financials(); fs.statement_template = detectStatementTemplate({company_profile:{industry}} as any);
    assert.equal(fs.statement_template, expected);
    if (['banking','insurance'].includes(expected)) {
      const k=calculateVerifiedKeyIndicators(fs); assert.equal(k.quick_ratio.at(-1)?.value,null); assert.equal(k.roic.at(-1)?.value,null); assert.equal(k.inventory_turnover.at(-1)?.value,null);
    }
  }
});
test('unsupported numeric synthesis rejected; supported source values and fiscal labels retained', () => {
  assert.equal(financialSynthesisHasUnsupportedNumbers({interpretation:'Q2 2026 revenue 28.24B'},[2,2026,28236]),false);
  assert.equal(financialSynthesisHasUnsupportedNumbers({interpretation:'Revenue was $999B'},[28236]),true);
});
test('JSON persistence round trip retains observation identity and calculation inputs', () => {
  const fs=financials(), restored=JSON.parse(JSON.stringify(fs));
  assert.deepEqual(JSON.parse(JSON.stringify(buildVerifiedStatementPeriods(restored.verified_dataset))),JSON.parse(JSON.stringify(buildVerifiedStatementPeriods(fs.verified_dataset))));
  assert.deepEqual(calculateVerifiedKeyIndicators(restored),calculateVerifiedKeyIndicators(fs));
});
