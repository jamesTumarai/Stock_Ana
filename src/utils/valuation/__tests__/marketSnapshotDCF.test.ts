import assert from 'node:assert/strict';
import type { ReportData } from '../../../types';
import { buildRigorousDCFModel } from '../dcfMathEngine';
import type { MarketSnapshot } from '../../../domain/marketSnapshot';

const baseReport = {
  ticker: 'TEST',
  generated_at: '2026-09-09T00:00:00.000Z',
  summary: 'test',
  company_profile: {
    stock_price: 90,
    shares_outstanding: '100M',
  },
  financial_statements: {
    currency: 'USD',
    fiscal_period_type: 'quarterly',
    periods: ['Q4 2025', 'Q1 2026', 'Q2 2026', 'Q3 2026'],
    income_statement: {
      revenue: [250, 260, 270, 280],
      net_income: [25, 26, 27, 28],
      eps_diluted: [0.25, 0.26, 0.27, 0.28],
    },
    balance_sheet: {
      cash_and_equivalents: [100, 100, 100, 100],
      short_term_investments: [20, 20, 20, 20],
      total_debt: [40, 40, 40, 40],
    },
    cash_flow: {
      free_cash_flow: [20, 21, 22, 23],
    },
  },
  intrinsic_value: {
    current_price: 100,
    summary: {
      fair_value_range_low: null,
      fair_value_range_high: null,
      base_case_fair_value: null,
      margin_of_safety_pct: null,
    },
    dcf_model: {
      assumptions: {
        wacc_pct: 9,
        terminal_growth_pct: 3,
        projection_years: 5,
      },
      scenarios: {
        bear: { revenue_cagr_pct: 3, terminal_margin_pct: 8, fair_value_per_share: null, key_assumption_note: 'bear' },
        base: { revenue_cagr_pct: 5, terminal_margin_pct: 10, fair_value_per_share: null, key_assumption_note: 'base' },
        bull: { revenue_cagr_pct: 7, terminal_margin_pct: 12, fair_value_per_share: null, key_assumption_note: 'bull' },
      },
    },
  },
} as unknown as ReportData;

const marketSnapshot: MarketSnapshot = {
  ticker: 'TEST',
  price: 200,
  provider: 'Yahoo Finance',
  asOf: '2026-09-09T16:00:00.000Z',
  retrievedAt: '2026-09-09T16:00:01.000Z',
  dataKind: 'market_quote',
  isRealtime: false,
};

const withSnapshot = { ...baseReport, market_snapshot: marketSnapshot };
const snapshotResult = buildRigorousDCFModel(withSnapshot, 'TEST');
assert.equal(snapshotResult.inputs.isValid, true);
assert.equal(snapshotResult.inputs.currentPrice, 200);
assert.equal(snapshotResult.inputs.priceSource, 'market_snapshot');
assert.equal(snapshotResult.dcfModel.inputs?.currentPrice, 200);

const withoutSnapshot = buildRigorousDCFModel(baseReport, 'TEST');
assert.equal(withoutSnapshot.inputs.currentPrice, 100);
assert.equal(withoutSnapshot.inputs.priceSource, 'intrinsic_value');

console.log('Market snapshot DCF checks passed');
