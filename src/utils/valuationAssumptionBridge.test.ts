import assert from 'node:assert/strict';
import {
  extractLastJsonObjectFromText,
  hasUsableDcfAssumptions,
  mergeStructuredValuationAssumptions,
  normalizeStructuredValuationAssumptions,
} from '../../server/lib/valuationAssumptionBridge.ts';

const valid = {
  wacc_pct: 9.25,
  terminal_growth_pct: 2.5,
  projection_years: 5,
  scenarios: {
    bear: { revenue_cagr_pct: 8, terminal_margin_pct: 19, key_assumption_note: 'Bear assumptions.' },
    base: { revenue_cagr_pct: 11, terminal_margin_pct: 22, key_assumption_note: 'Base assumptions.' },
    bull: { revenue_cagr_pct: 14, terminal_margin_pct: 25, key_assumption_note: 'Bull assumptions.' },
  },
};

assert.deepEqual(normalizeStructuredValuationAssumptions(valid), valid);

assert.equal(
  normalizeStructuredValuationAssumptions({ ...valid, terminal_growth_pct: 10 }),
  null,
  'terminal growth must remain below WACC',
);

assert.equal(
  normalizeStructuredValuationAssumptions({
    ...valid,
    scenarios: {
      ...valid.scenarios,
      bear: { ...valid.scenarios.bear, revenue_cagr_pct: 15 },
    },
  }),
  null,
  'Bear/Base/Bull growth assumptions must be ordered',
);

const parsed = extractLastJsonObjectFromText([
  'analysis text',
  '```json',
  JSON.stringify({ old: true }),
  '```',
  'more text',
  '```json',
  JSON.stringify({ final: true }),
  '```',
].join('\n'));
assert.deepEqual(parsed, { final: true });

const sourceReport: any = {
  ticker: 'MSFT',
  sec_verification: {
    status: 'verified_eligible',
    dcf_financial_inputs: {
      eligible: true,
      starting_revenue_m: 331839,
      net_cash_m: 36549,
      current_shares_outstanding_m: 7425.545491,
    },
  },
  financial_statements: {
    currency: 'USD',
    periods: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
    income_statement: { revenue: [70000, 75000, 80000, 90000] },
  },
};
const sourceBefore = structuredClone(sourceReport);
const merged = mergeStructuredValuationAssumptions(sourceReport, valid);

assert.deepEqual(sourceReport, sourceBefore, 'bridge must not mutate the source report');
assert.deepEqual(merged.sec_verification, sourceBefore.sec_verification, 'SEC envelope must be preserved exactly');
assert.deepEqual(merged.financial_statements, sourceBefore.financial_statements, 'report financial facts must be preserved exactly');
assert.equal(merged.intrinsic_value.current_price, null, 'bridge must not invent a current price');
assert.deepEqual(merged.intrinsic_value.dcf_model.assumptions, {
  wacc_pct: 9.25,
  terminal_growth_pct: 2.5,
  projection_years: 5,
});
assert.equal(merged.intrinsic_value.dcf_model.scenarios.bear.fair_value_per_share, null);
assert.equal(merged.intrinsic_value.dcf_model.scenarios.base.fair_value_per_share, null);
assert.equal(merged.intrinsic_value.dcf_model.scenarios.bull.fair_value_per_share, null);
assert.equal(merged.intrinsic_value.summary.base_case_fair_value, null);
assert.equal(merged.intrinsic_value.summary.margin_of_safety_pct, null);
assert.equal(hasUsableDcfAssumptions(merged), true);

const incomplete = mergeStructuredValuationAssumptions(sourceReport, {
  ...valid,
  wacc_pct: null,
});
assert.equal(hasUsableDcfAssumptions(incomplete), false, 'null assumptions must remain fail-closed');

console.log('Valuation assumption bridge invariants passed');
