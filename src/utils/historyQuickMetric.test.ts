import assert from 'node:assert/strict';
import { test } from 'node:test';
import { historyQuickMetric } from './historyQuickMetric';

test('compact and hydrated canonical History records retain the same badge without legacy aliases', () => {
  const compact = { fairValue: 201.73, marketPrice: 370.59,
    data: { intrinsic_value: { summary: { dcf_fair_value: 201.73, current_price: 370.59 } } } };
  const hydrated = { ...compact, data: { intrinsic_value: { canonical_run: { baseFairValue: 201.73 }, current_price: 370.59 } } };
  assert.equal(historyQuickMetric(compact), 'Fair Value: $201.73');
  assert.equal(historyQuickMetric(hydrated), historyQuickMetric(compact));
  assert.equal(historyQuickMetric({ data: hydrated.data }), historyQuickMetric(compact));
});

test('non-DCF and legacy saved values use a neutral label without recalculation', () => {
  assert.equal(historyQuickMetric({ data: { intrinsic_value: { canonical_run: { baseFairValue: 330.97 } } } }), 'Fair Value: $330.97');
  assert.equal(historyQuickMetric({ data: { intrinsic_value: { summary: { dcf_fair_value: 100 } } } }), 'Fair Value: $100.00');
});

test('explicit unavailable values never revive stale legacy fair-value aliases', () => {
  const data = { intrinsic_value: { canonical_run: { baseFairValue: null }, current_price: 50, summary: { dcf_fair_value: 999 } } };
  assert.equal(historyQuickMetric({ data }), '$50.00');
  assert.equal(historyQuickMetric({ fairValue: null, marketPrice: 50, data }), '$50.00');
  assert.equal(historyQuickMetric({ marketPrice: null, data }), null);
});

test('real zero remains visible and non-finite or missing values are not fabricated', () => {
  assert.equal(historyQuickMetric({ fairValue: 0, marketPrice: 50 }), 'Fair Value: $0.00');
  assert.equal(historyQuickMetric({ marketPrice: 0 }), '$0.00');
  assert.equal(historyQuickMetric({ fairValue: Infinity, marketPrice: NaN }), null);
  assert.equal(historyQuickMetric({}), null);
});
