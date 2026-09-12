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

// Terminal Growth Policy Transparency Tests
// 1. Raw assumption 4% clamped to 3% with full disclosure
const reportWith4PctGrowth = {
  ...baseReport,
  intrinsic_value: {
    ...baseReport.intrinsic_value,
    dcf_model: {
      ...baseReport.intrinsic_value.dcf_model,
      assumptions: {
        ...baseReport.intrinsic_value.dcf_model.assumptions,
        terminal_growth_pct: 4,
      },
    },
  },
} as unknown as ReportData;

const res4Pct = buildRigorousDCFModel(reportWith4PctGrowth, 'TEST');
assert.equal(res4Pct.inputs.requestedTerminalGrowthPct, 4);
assert.equal(res4Pct.inputs.usedTerminalGrowthPct, 3);
assert.equal(res4Pct.inputs.terminalGrowthPolicyApplied, true);
assert.ok(res4Pct.inputs.terminalGrowthPolicyReason?.includes('policy maximum'));
assert.equal(res4Pct.dcfModel.assumptions.requested_terminal_growth_pct, 4);
assert.equal(res4Pct.dcfModel.assumptions.used_terminal_growth_pct, 3);
assert.equal(res4Pct.dcfModel.assumptions.terminal_growth_policy_applied, true);

// 2. Raw assumption 0.5% raised to 1% floor with full disclosure
const reportWith05PctGrowth = {
  ...baseReport,
  intrinsic_value: {
    ...baseReport.intrinsic_value,
    dcf_model: {
      ...baseReport.intrinsic_value.dcf_model,
      assumptions: {
        ...baseReport.intrinsic_value.dcf_model.assumptions,
        terminal_growth_pct: 0.5,
      },
    },
  },
} as unknown as ReportData;

const res05Pct = buildRigorousDCFModel(reportWith05PctGrowth, 'TEST');
assert.equal(res05Pct.inputs.requestedTerminalGrowthPct, 0.5);
assert.equal(res05Pct.inputs.usedTerminalGrowthPct, 1);
assert.equal(res05Pct.inputs.terminalGrowthPolicyApplied, true);
assert.ok(res05Pct.inputs.terminalGrowthPolicyReason?.includes('policy minimum'));

// 3. Raw assumption 2.5% unchanged within policy range
const reportWith25PctGrowth = {
  ...baseReport,
  intrinsic_value: {
    ...baseReport.intrinsic_value,
    dcf_model: {
      ...baseReport.intrinsic_value.dcf_model,
      assumptions: {
        ...baseReport.intrinsic_value.dcf_model.assumptions,
        terminal_growth_pct: 2.5,
      },
    },
  },
} as unknown as ReportData;

const res25Pct = buildRigorousDCFModel(reportWith25PctGrowth, 'TEST');
assert.equal(res25Pct.inputs.requestedTerminalGrowthPct, 2.5);
assert.equal(res25Pct.inputs.usedTerminalGrowthPct, 2.5);
assert.equal(res25Pct.inputs.terminalGrowthPolicyApplied, false);
assert.equal(res25Pct.inputs.terminalGrowthPolicyReason, undefined);

console.log('Market snapshot DCF checks passed');
