import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeDurationFactsToStandaloneQuarters } from '../../../services/sec/xbrlNormalizer.js';
import { resolveFundamentalMetrics } from '../metricRegistry.js';
import { resolveAdaptiveFivePillars } from '../fivePillarsResolver.js';
import { validTrailingFourQuarterLabels } from '../canonicalQuarterWindow.js';
import type { ReportData } from '../../../types.js';

describe('Canonical period and cross-metric integrity', () => {
  it('rejects TTM gaps, duplicate fiscal quarters, YTD and annual labels', () => {
    assert.equal(validTrailingFourQuarterLabels(['Q3 2024', 'Q4 2024', 'Q1 2025', 'Q2 2025']), true);
    assert.equal(validTrailingFourQuarterLabels(['Q2 2024', 'Q4 2024', 'Q1 2025', 'Q2 2025']), false);
    assert.equal(validTrailingFourQuarterLabels(['Q3 2024', 'Q4 2024', 'Q4 2024', 'Q2 2025']), false);
    assert.equal(validTrailingFourQuarterLabels(['Q3 2024', 'FY2024', 'Q1 2025', 'Q2 2025']), false);
    assert.equal(validTrailingFourQuarterLabels(['Q3 2024', 'Q4 2024', 'Q1 2025 YTD', 'Q2 2025']), false);
  });
  it('subtracts only compatible cumulative facts and retains standalone quarter boundaries', () => {
    const facts = [
      { fy: 2025, fp: 'Q1', form: '10-Q', start: '2025-01-01', end: '2025-03-31', val: 100 },
      { fy: 2025, fp: 'Q2', form: '10-Q', start: '2025-01-01', end: '2025-06-30', val: 230 },
      { fy: 2025, fp: 'Q3', form: '10-Q', start: '2025-01-01', end: '2025-09-30', val: 390 },
      { fy: 2025, fp: 'FY', form: '10-K', start: '2025-01-01', end: '2025-12-31', val: 580 },
    ];
    const quarters = normalizeDurationFactsToStandaloneQuarters(facts as any);
    assert.deepEqual(quarters.map(q => q.value), [100, 130, 160, 190]);
    assert.deepEqual(quarters.map(q => q.start), ['2025-01-01', '2025-04-01', '2025-07-01', '2025-10-01']);
    assert.ok(quarters.every(q => q.periodType === 'standalone_quarter' && q.durationDays! >= 90));

    const incompatible = normalizeDurationFactsToStandaloneQuarters([
      facts[0],
      { ...facts[1], start: '2025-02-01' },
    ] as any);
    assert.deepEqual(incompatible.map(q => q.fiscalQuarter), [1]);
  });

  it('uses filing-reported standalone diluted EPS instead of subtracting weighted-average YTD EPS', () => {
    const facts = [
      { fy: 2025, fp: 'Q1', form: '10-Q', start: '2025-01-01', end: '2025-03-31', val: 0.17 },
      { fy: 2025, fp: 'Q2', form: '10-Q', start: '2025-01-01', end: '2025-06-30', val: 0.48 },
      { fy: 2025, fp: 'Q2', form: '10-Q', start: '2025-04-01', end: '2025-06-30', val: 0.32 },
    ];
    const quarters = normalizeDurationFactsToStandaloneQuarters(facts as any);
    assert.deepEqual(quarters.map(quarter => quarter.value), [0.17, 0.32]);
    assert.equal(quarters[1].derivation, 'reported_standalone');
  });

  it('uses same-quarter EPS and FCF, distinct quarter margin, and the same four-quarter FCF in yield and conversion', () => {
    const periods = ['Q2 2024', 'Q3 2024', 'Q4 2024', 'Q1 2025', 'Q2 2025'];
    const make = (values: number[]) => values.map((value, index) => ({
      period: periods[index], value, verification: 'verified',
    }));
    const report: Partial<ReportData> = {
      ticker: 'GENERIC_OPERATING',
      company_profile: { sector: 'Industrials', industry: 'Machinery' } as any,
      market_snapshot: { market_cap: 1000 } as any,
      financial_statements: {
        periods,
        income_statement: { revenue: [100, 110, 120, 130, 200], net_income: [10, 10, 10, 10, 10], operating_income: [20, 20, 20, 20, 20], yoy_eps_growth_pct: [null, null, null, null, 500], yoy_revenue_growth_pct: [null, null, null, null, 500] } as any,
        balance_sheet: {
          total_equity: [300, 310, 320, 330, 350], total_debt: [100, 100, 100, 100, 100],
          cash_and_equivalents: [50, 50, 50, 50, 50], total_assets: [600, 610, 620, 630, 650],
        } as any,
        cash_flow: { free_cash_flow: [20, 10, 20, 30, -10] } as any,
      } as any,
      canonical_financials: {
        provenanceStatus: 'verified', generatedBy: 'sec-xbrl-test', periods,
        values: {
          'income_statement.revenue': make([100, 110, 120, 130, 200]),
          'income_statement.net_income': make([10, 10, 10, 10, 10]),
          'income_statement.operating_income': make([20, 20, 20, 20, 20]),
          'income_statement.eps_diluted': make([0.33, 0.30, 0.31, 0.34, 0.32]),
          'cash_flow.free_cash_flow': make([20, 10, 20, 30, -10]),
        },
      } as any,
    };
    const result = resolveFundamentalMetrics(report);
    assert.equal(result.epsGrowthYoY.value, -3.03);
    assert.equal(result.revenueGrowthYoY.value, 100);
    assert.equal(result.epsGrowthYoY.basis, 'QUARTER_YOY');
    assert.equal(result.fcfGrowthYoY.status, 'DETERIORATION');
    assert.equal(result.fcfMargin.value, -5);
    assert.equal(result.fcfMargin.period, 'Q2 2025');
    assert.equal(result.fcfYield.value, 5);
    assert.equal(result.fcfConversion.value, 125);
    assert.deepEqual(result.fcfYield.quartersUsed, ['Q3 2024', 'Q4 2024', 'Q1 2025', 'Q2 2025']);
    assert.deepEqual(result.fcfYield.quartersUsed, result.fcfConversion.quartersUsed);
    assert.equal(result.fcfYield.inputsUsed?.freeCashFlow, result.fcfConversion.inputsUsed?.freeCashFlow);
    assert.equal(result.roic.value, 16.85);
    assert.equal(result.roe.value, 12.31);
    assert.equal(result.roa.value, 6.4);
    const persisted = resolveAdaptiveFivePillars(report, 'GENERIC_OPERATING').fivePillarsData.yields;
    assert.deepEqual(persisted.fcf_yield_quarters_used, result.fcfYield.quartersUsed);
    assert.deepEqual(persisted.fcf_conversion_inputs_used, result.fcfConversion.inputsUsed);
  });

  it('does not replace incomplete verified EPS and revenue history with an AI growth percentage', () => {
    const report: Partial<ReportData> = {
      ticker: 'HISTORY_GAP',
      financial_statements: {
        periods: ['Q2 2025'],
        income_statement: { revenue: [200], eps_diluted: [0.32], yoy_revenue_growth_pct: [500], yoy_eps_growth_pct: [500] } as any,
      } as any,
      canonical_financials: {
        ticker: 'HISTORY_GAP', provenanceStatus: 'verified', generatedBy: 'sec-xbrl-test',
        periods: ['Q2 2025'], values: {
          'income_statement.revenue': [{ period: 'Q2 2025', value: 200, verification: 'verified' }],
          'income_statement.eps_diluted': [{ period: 'Q2 2025', value: 0.32, verification: 'verified' }],
        },
      } as any,
    };
    const result = resolveFundamentalMetrics(report);
    assert.equal(result.epsGrowthYoY.status, 'INSUFFICIENT_HISTORY');
    assert.equal(result.epsGrowthYoY.value, null);
    assert.equal(result.revenueGrowthYoY.status, 'INSUFFICIENT_HISTORY');
    assert.equal(result.revenueGrowthYoY.value, undefined);
  });
});
