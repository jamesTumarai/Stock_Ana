import assert from 'node:assert/strict';
import { attachDcfAssumptionModel, validateDcfAssumptionModel } from './dcfAssumptionProposal';

const candidate = {
  assumptions: { wacc_pct: 8.5, terminal_growth_pct: 2.5, projection_years: 5 },
  scenarios: {
    bear: { revenue_cagr_pct: 7, terminal_margin_pct: 18, fair_value_per_share: 999, key_assumption_note: 'Bear assumption' },
    base: { revenue_cagr_pct: 11, terminal_margin_pct: 21, fair_value_per_share: 999, key_assumption_note: 'Base assumption' },
    bull: { revenue_cagr_pct: 15, terminal_margin_pct: 24, fair_value_per_share: 999, key_assumption_note: 'Bull assumption' },
  },
};

const validated = validateDcfAssumptionModel(candidate);
assert.ok(validated);
assert.equal(validated.scenarios.base.fair_value_per_share, null, 'AI-supplied fair value must never cross the assumption boundary');
assert.equal(validated.assumptions.wacc_pct, 8.5);

const attached = attachDcfAssumptionModel({ ticker: 'MSFT' } as any, validated);
assert.equal(attached.intrinsic_value?.dcf_model?.scenarios.bull.revenue_cagr_pct, 15);

assert.equal(validateDcfAssumptionModel({
  ...candidate,
  assumptions: { ...candidate.assumptions, terminal_growth_pct: 9 },
}), null, 'terminal growth >= WACC must fail closed');

assert.equal(validateDcfAssumptionModel({
  ...candidate,
  scenarios: {
    ...candidate.scenarios,
    bear: { ...candidate.scenarios.bear, revenue_cagr_pct: 20 },
  },
}), null, 'scenario ordering must fail closed');

assert.equal(validateDcfAssumptionModel(null), null);
console.log('DCF assumption proposal boundary checks passed');
