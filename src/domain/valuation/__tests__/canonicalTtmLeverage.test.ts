import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { ReportData } from '../../../types';
import type { CanonicalFinancialDataset } from '../../financialValue';
import { resolveFundamentalMetrics } from '../metricRegistry';
import { resolveAdaptiveFivePillars } from '../fivePillarsResolver';
import { buildCanonicalExecutiveSnapshot, reconcileCurrentValuationProse } from '../../canonicalExecutiveSnapshot';
import { sanitizeReportForSave, restoreReportSections } from '../../../utils/reportPersistence';

// Dated, scoped public SEC observations captured independently of the analyst.
// These are accounting inputs, not a ticker-specific production calculation.
const captured: CanonicalFinancialDataset = JSON.parse(gunzipSync(readFileSync(new URL(
  '../../../services/sec/fixtures/ttm-leverage-public-2026-10-01.json.gz', import.meta.url,
))).toString('utf8'));
const report = (): Partial<ReportData> => ({
  ticker: captured.ticker,
  company_profile: { sector: 'Technology', industry: 'Software' } as ReportData['company_profile'],
  canonical_financials: structuredClone(captured),
  financial_statements: {
    periods: captured.periods,
    income_statement: { operating_income: [2261, 2418, 2238, 2354], ebitda: [2445, 2592, 2431, 2569] },
    // Deliberately incompatible indicator/array paths must not replace verified TTM.
    cash_flow: { depreciation: [999, 999, 999, 999] },
    balance_sheet: {},
  } as unknown as ReportData['financial_statements'],
  key_indicators: { ebitda: 1 } as ReportData['key_indicators'],
});

test('public non-calendar filing uses current net debt / four-quarter EBITDA in registry, Pillars and executive truth', () => {
  const current = report();
  const metric = resolveFundamentalMetrics(current).netDebtToEbitda;
  assert.equal(metric.status, 'CALCULATED');
  assert.equal(metric.value, 0.07); // 724 / (9,271 + 766), not 724 / latest-quarter 2,569.
  assert.deepEqual(metric.inputsUsed, { netDebt: 724, operatingIncomeTtm: 9271, depreciationTtm: 766, ebitdaTtm: 10037 });
  assert.deepEqual(metric.quartersUsed, captured.periods);
  assert.equal(metric.periodBasis, 'TTM');
  assert.equal(metric.period, 'Q3 2026');
  assert.equal(resolveAdaptiveFivePillars(current).fivePillarsData.balance_sheet.net_debt_to_ebitda, 0.07);
  assert.equal(buildCanonicalExecutiveSnapshot(current).balanceSheet.netDebtToEbitda, 0.07);
});

test('missing, duplicate, unverified, annual or currency-incompatible D&A cannot borrow a quarter/provider EBITDA', () => {
  for (const mutate of [
    (ds: CanonicalFinancialDataset) => { ds.values['cash_flow.depreciation'][1].value = null; },
    (ds: CanonicalFinancialDataset) => { ds.values['cash_flow.depreciation'].push({ ...ds.values['cash_flow.depreciation'][1] }); },
    (ds: CanonicalFinancialDataset) => { ds.values['cash_flow.depreciation'][1].verification = 'unverified'; },
    (ds: CanonicalFinancialDataset) => { ds.values['cash_flow.depreciation'][1].periodType = 'annual'; },
    (ds: CanonicalFinancialDataset) => { ds.values['cash_flow.depreciation'][1].unit = 'CURRENCY_M'; },
  ]) {
    const current = report(); mutate(current.canonical_financials!);
    const metric = resolveFundamentalMetrics(current).netDebtToEbitda;
    assert.equal(metric.status, 'UNAVAILABLE');
    assert.equal(metric.value, undefined);
    assert.equal(metric.inputsUsed, undefined);
  }
});

test('two individually valid TTM sums require matching fiscal dates and the current instant debt period', () => {
  const shifted = report();
  for (const item of shifted.canonical_financials!.values['cash_flow.depreciation']) {
    item.periodStart = new Date(Date.parse(item.periodStart!) + 86400000).toISOString().slice(0, 10);
    item.periodEnd = new Date(Date.parse(item.periodEnd!) + 86400000).toISOString().slice(0, 10);
  }
  assert.equal(resolveFundamentalMetrics(shifted).netDebtToEbitda.value, undefined);
  const missingCurrent = report();
  missingCurrent.canonical_financials!.values['income_statement.operating_income'].pop();
  assert.equal(resolveFundamentalMetrics(missingCurrent).netDebtToEbitda.value, undefined);
});

test('signed depreciation is preserved and non-positive TTM EBITDA is N/M', () => {
  const signed = report();
  signed.canonical_financials!.values['cash_flow.depreciation'].forEach(item => { item.value = -item.value!; });
  const signedMetric = resolveFundamentalMetrics(signed).netDebtToEbitda;
  assert.equal(signedMetric.inputsUsed?.ebitdaTtm, 8505);
  assert.equal(signedMetric.value, 0.09);
  const loss = report();
  loss.canonical_financials!.values['income_statement.operating_income'].forEach(item => { item.value = -item.value!; });
  const invalid = resolveFundamentalMetrics(loss).netDebtToEbitda;
  assert.equal(invalid.status, 'UNAVAILABLE');
  assert.equal(invalid.value, undefined);
  assert.match(invalid.reason!, /N\/M/);
});

test('financial and net-cash sector guards remain intact', () => {
  const bank = report(); bank.company_profile = { sector: 'Financial Services', industry: 'Banks' } as ReportData['company_profile'];
  assert.equal(resolveFundamentalMetrics(bank).netDebtToEbitda.status, 'GUARDED');
  const prose = { verdict: { summary: 'Net Debt / EBITDA 2x', key_takeaways: [] } } as unknown as ReportData;
  reconcileCurrentValuationProse(prose, buildCanonicalExecutiveSnapshot(bank));
  assert.match(prose.verdict.summary, /Not applicable/);
  assert.doesNotMatch(prose.verdict.summary, /unavailable/);
  const netCash = report();
  for (const key of ['balance_sheet.short_term_debt', 'balance_sheet.long_term_debt'])
    netCash.canonical_financials!.values[key].forEach(item => { item.value = 0; });
  assert.equal(resolveFundamentalMetrics(netCash).netDebtToEbitda.status, 'NOT_APPLICABLE');
  const legacy = report(); delete legacy.canonical_financials;
  assert.notEqual(resolveFundamentalMetrics(legacy).netDebtToEbitda.status, 'CALCULATED');
});

test('equivalent fiscal labels do not make compatible verified quarter dates unavailable', () => {
  const current = report();
  current.canonical_financials!.values['cash_flow.depreciation'].forEach(item => {
    item.period = item.period.replace(/ (\d{4})$/, ' FY$1');
  });
  assert.equal(resolveFundamentalMetrics(current).netDebtToEbitda.value, 0.07);
});

test('compact section-storage reconstruction preserves the same canonical TTM denominator', () => {
  const current = { ...report(), verdict: { summary: 'Verified TTM leverage', key_takeaways: [], conviction_score: null } } as unknown as ReportData;
  const plan = sanitizeReportForSave(current, { reportId: 'ttm-leverage-test', userId: 'test-only', language: 'en' });
  const loaded = restoreReportSections(plan.sections, plan.aliases, plan.recomputedFields);
  const after = resolveFundamentalMetrics(loaded).netDebtToEbitda;
  assert.equal(after.value, 0.07);
  assert.deepEqual(after.inputsUsed, resolveFundamentalMetrics(current).netDebtToEbitda.inputsUsed);
});

test('current Thai/English leverage prose shares the ratio; source quotes, forecasts and immutable snapshots remain distinct', () => {
  const snapshot = buildCanonicalExecutiveSnapshot(report());
  const current = {
    verdict: { summary: 'Net Debt / EBITDA: 0.28x', key_takeaways: ['Net Debt ต่อ EBITDA เพียง 0.28 เท่า'] },
    comprehensive_analysis: { fundamentals_check: 'หนี้สินสุทธิต่อ EBITDA 0.28 เท่า',
      historical: 'Net Debt / EBITDA: 0.28x', sources: 'Net Debt / EBITDA: 0.28x' },
    final_report: 'FY2025 Net Debt / EBITDA 0.28x\nExpected Net Debt / EBITDA 0.5x\nPeer Net Debt / EBITDA 2x\nAnalyst says Net Debt / EBITDA 0.28x',
    thesis_history: [{ text: 'Net Debt / EBITDA: 0.28x' }],
    current_narrative_audit: [] as NonNullable<ReportData['current_narrative_audit']>,
  };
  const historical = JSON.stringify([current.comprehensive_analysis.historical, current.comprehensive_analysis.sources, current.final_report, current.thesis_history]);
  reconcileCurrentValuationProse(current as unknown as ReportData, snapshot);
  assert.equal(current.verdict.summary, 'Net Debt / EBITDA: 0.07x');
  assert.equal(current.verdict.key_takeaways[0], 'Net Debt ต่อ EBITDA เพียง 0.07 เท่า');
  assert.equal(current.comprehensive_analysis.fundamentals_check, 'หนี้สินสุทธิต่อ EBITDA 0.07 เท่า');
  assert.equal(JSON.stringify([current.comprehensive_analysis.historical, current.comprehensive_analysis.sources, current.final_report, current.thesis_history]), historical);
  assert.equal(current.current_narrative_audit?.length, 1);
  const first = JSON.stringify(current); reconcileCurrentValuationProse(current as unknown as ReportData, snapshot);
  assert.equal(JSON.stringify(current), first);
});

test('missing canonical TTM dependencies remove current ratio claims without manufacturing an alternative', () => {
  const incomplete = report(); incomplete.canonical_financials!.values['cash_flow.depreciation'][0].value = null;
  const current = { verdict: { summary: 'Net Debt / EBITDA: 0.28x', key_takeaways: [] } } as unknown as ReportData;
  reconcileCurrentValuationProse(current, buildCanonicalExecutiveSnapshot(incomplete));
  assert.match(current.verdict.summary, /unavailable/);
  assert.doesNotMatch(current.verdict.summary, /0\.28x/);
  assert.equal(current.current_narrative_audit?.[0].canonicalValue, null);
});
