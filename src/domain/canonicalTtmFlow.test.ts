import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CanonicalFinancialDataset, CanonicalFinancialValue } from './financialValue';
import {
  reconcileCanonicalTtmFlow, reconcileAllCanonicalTtmFlows, resolveReportTtmFlow,
  TTM_FLOW_METRICS, TTM_CURRENCY_ROUNDING_TOLERANCE_M,
} from './canonicalTtmFlow';
import { buildCanonicalExecutiveSnapshot, reconcileExecutiveSummary, reconcileKeyTakeaways } from './canonicalExecutiveSnapshot';
import { buildSecDcfFinancialInputs } from '../services/sec/secDcfInputs';
import { normalizeReport } from '../utils/reportIntegrity';
import { resolveFundamentalMetrics } from './valuation/metricRegistry';
import { extractMemorySnapshot } from './investmentMemory';
import { upgradeCanonicalTestFixture } from './__tests__/verifiedFixtureBuilder';

const makeDataset = (periods = ['Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026']): CanonicalFinancialDataset => {
  const values: CanonicalFinancialDataset['values'] = {};
  for (const metric of TTM_FLOW_METRICS) {
    const [statement, name] = metric.split('.') as [CanonicalFinancialValue['statement'], string];
    values[metric] = periods.map((period, index) => ({
      statement, metric: name, period, value: [100.11, 120.22, 140.33, 160.44][index],
      unit: 'USD_M', periodType: 'standalone_quarter', type: 'reported', verification: 'verified',
      source: { provider: 'SEC EDGAR' },
    }));
  }
  return upgradeCanonicalTestFixture({
    schemaVersion: 1, generatedBy: 'lumina-financial-provenance-v1+sec-xbrl-v1',
    ticker: 'TEST', currency: 'USD', periods, values, provenanceStatus: 'verified',
    provenanceWarnings: [], sourceCoverage: { sourceLinkedValues: 0, verifiedValues: 44, nonNullValues: 44, missingValues: 0, totalValues: 44 },
  });
};

test('every approved flow metric uses the exact same four-quarter sum, including non-calendar fiscal years', () => {
  const dataset = makeDataset();
  const audit = reconcileAllCanonicalTtmFlows(dataset);
  for (const metric of TTM_FLOW_METRICS) {
    const result = audit[metric]!;
    assert.equal(result.status, 'verified');
    assert.equal(result.canonicalValue, 521.1);
    assert.deepEqual(result.periodsUsed, dataset.periods);
    assert.ok(Math.abs(result.canonicalValue! - dataset.values[metric].reduce((sum, item) => sum + item.value!, 0)) <= TTM_CURRENCY_ROUNDING_TOLERANCE_M);
  }
});

test('calendar fiscal year and a 53-week quarter remain compatible', () => {
  const dataset = makeDataset(['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026']);
  dataset.values['income_statement.revenue'].forEach((item, index) => {
    item.fiscalYear = 2026;
    item.fiscalQuarter = (index + 1) as 1 | 2 | 3 | 4;
    item.periodStart = ['2026-01-01', '2026-04-01', '2026-07-01', '2026-09-28'][index];
    item.periodEnd = ['2026-03-31', '2026-06-30', '2026-09-27', '2027-01-03'][index];
  });
  assert.equal(reconcileCanonicalTtmFlow(dataset, 'income_statement.revenue').canonicalValue, 521.1);
  const shortFiscalLabels = makeDataset(['Q1 FY26', 'Q2 FY26', 'Q3 FY26', 'Q4 FY26']);
  assert.equal(reconcileCanonicalTtmFlow(shortFiscalLabels, 'income_statement.revenue').canonicalValue, 521.1);
});

test('missing and duplicate fiscal quarters fail closed', () => {
  const missing = makeDataset(['Q2 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026']);
  const duplicate = makeDataset(['Q3 2025', 'Q4 2025', 'Q4 2025', 'Q2 2026']);
  assert.equal(reconcileCanonicalTtmFlow(missing, 'income_statement.revenue').status, 'invalid_period');
  assert.equal(reconcileCanonicalTtmFlow(duplicate, 'income_statement.revenue').canonicalValue, null);
  const absent = makeDataset();
  absent.values['income_statement.revenue'][2].value = null;
  assert.equal(reconcileCanonicalTtmFlow(absent, 'income_statement.revenue').status, 'missing_fact');
});

test('YTD, annual, long cumulative durations and balance-sheet instants cannot enter a TTM flow', () => {
  const dataset = makeDataset();
  dataset.values['income_statement.revenue'][2].periodType = 'ytd';
  assert.equal(reconcileCanonicalTtmFlow(dataset, 'income_statement.revenue').canonicalValue, null);
  dataset.values['income_statement.revenue'][2].periodType = 'standalone_quarter';
  dataset.values['income_statement.revenue'][2].periodStart = '2025-07-01';
  dataset.values['income_statement.revenue'][2].periodEnd = '2026-03-31';
  assert.equal(reconcileCanonicalTtmFlow(dataset, 'income_statement.revenue').status, 'invalid_period');
  assert.equal(reconcileCanonicalTtmFlow(dataset, 'balance_sheet.cash_and_equivalents' as any).status, 'not_flow_metric');
});

test('provider TTM disagreement remains diagnostic and cannot override the canonical sum', () => {
  const result = reconcileCanonicalTtmFlow(makeDataset(), 'income_statement.revenue', { value: 522, source: 'Provider TTM feed' });
  assert.equal(result.canonicalValue, 521.1);
  assert.equal(result.providerValue, 522);
  assert.ok(Math.abs(result.delta! - 0.9) < 1e-9);
  assert.equal(result.disagrees, true);
  assert.equal(result.source, 'SEC EDGAR');
  assert.equal(reconcileCanonicalTtmFlow(makeDataset(), 'income_statement.revenue', { value: 521.105, source: 'Provider TTM feed' }).disagrees, false);
});

test('DCF eligibility still requires each verified revenue quarter to be positive', () => {
  const dataset = makeDataset();
  dataset.values['income_statement.revenue'][1].value = -1;
  assert.equal(reconcileCanonicalTtmFlow(dataset, 'income_statement.revenue').canonicalValue, 399.88);
  assert.equal(buildSecDcfFinancialInputs(dataset, null, null).startingRevenueM, null);
});

test('Summary, takeaways, normalized report and SEC DCF share the same verified TTM revenue', () => {
  const dataset = makeDataset();
  const report: any = {
    ticker: 'TEST', canonical_financials: dataset,
    company_profile: { sector: 'Industrials' }, market_snapshot: { market_cap: 1_000_000_000 },
    financial_statements: { periods: dataset.periods, income_statement: { revenue: [1, 2, 3, 4] }, cash_flow: { free_cash_flow: [1, 2, 3, 4] } },
    key_indicators: { growth: { revenue_ttm: 520 } },
    verdict: { summary: 'รายได้รวม TTM อยู่ที่ 520 ล้านดอลลาร์', key_takeaways: ['TTM revenue was $520M'] },
  };
  const canonical = resolveReportTtmFlow(report, 'income_statement.revenue');
  const snapshot = buildCanonicalExecutiveSnapshot(report);
  assert.equal(snapshot.growth.revenueTtm, canonical.canonicalValue);
  const metrics = resolveFundamentalMetrics(report);
  assert.equal(metrics.fcfYield.inputsUsed?.freeCashFlow, resolveReportTtmFlow(report, 'cash_flow.free_cash_flow').canonicalValue);
  assert.equal(extractMemorySnapshot(report)?.valuation.inputSnapshot?.normalizedBaseFcf, canonical.canonicalValue);
  assert.match(reconcileExecutiveSummary(report.verdict.summary, snapshot), /521\.1/);
  assert.match(reconcileKeyTakeaways(report.verdict.key_takeaways, snapshot)[0], /521\.1/);
  const dcf = buildSecDcfFinancialInputs(dataset, null, null);
  assert.equal(dcf.startingRevenueM, canonical.canonicalValue);
  const normalized = normalizeReport(report);
  assert.equal(normalized.canonical_executive_snapshot?.growth.revenueTtm, canonical.canonicalValue);
  assert.equal((normalized as any).ttm_flow_reconciliation['income_statement.revenue'].canonicalValue, canonical.canonicalValue);
  assert.equal((normalized as any).ttm_flow_reconciliation['income_statement.revenue'].disagrees, true);
  assert.equal((normalized as any).ttm_flow_reconciliation['income_statement.revenue'].providerSource, 'Key Indicators (revenue_ttm)');
});
