import assert from 'node:assert/strict';
import { estimateTokenCost, getModelPricing, formatCostUsd, formatCostThb } from '../costEstimator';

// 1. Model pricing catalog resolution
{
  const flashPricing = getModelPricing('gemini-3.8-flash');
  assert.equal(flashPricing.tier, 'flash');
  assert.equal(flashPricing.inputPerMillion, 0.10);
  assert.equal(flashPricing.outputPerMillion, 0.40);

  const proPricing = getModelPricing('gemini-1.5-pro');
  assert.equal(proPricing.tier, 'pro');
  assert.equal(proPricing.inputPerMillion, 1.25);
  assert.equal(proPricing.outputPerMillion, 5.00);

  const defaultPricing = getModelPricing('unknown-model');
  assert.equal(defaultPricing.tier, 'standard');
}

// 2. Exact token breakdown estimation
{
  const estimate = estimateTokenCost({
    promptTokens: 20_000,
    completionTokens: 5_000,
    model: 'gemini-3.8-flash',
    fxRateUsdThb: 36.0,
  });

  assert.equal(estimate.totalTokens, 25_000);
  assert.equal(estimate.promptTokens, 20_000);
  assert.equal(estimate.completionTokens, 5_000);
  assert.equal(estimate.isEstimatedBreakdown, false);

  // Input: (20000 / 1M) * 0.10 = $0.002
  // Output: (5000 / 1M) * 0.40 = $0.002
  // Total: $0.004
  assert.equal(estimate.inputCostUsd, 0.002);
  assert.equal(estimate.outputCostUsd, 0.002);
  assert.equal(estimate.totalCostUsd, 0.004);
  assert.equal(estimate.formattedCostUsd, '$0.0040');

  // THB: 0.004 * 36 = 0.144
  assert.equal(estimate.totalCostThb, 0.144);
  assert.equal(estimate.formattedCostThb, '฿0.14');
}

// 3. Fallback derivation when only totalTokens is provided (estimated distribution, null prompt/completion tokens)
{
  const estimate = estimateTokenCost({
    totalTokens: 10_000,
    model: 'gemini-3.8-flash',
  });

  assert.equal(estimate.totalTokens, 10_000);
  assert.equal(estimate.promptTokens, null);
  assert.equal(estimate.completionTokens, null);
  assert.equal(estimate.isEstimatedBreakdown, true);

  // Input: (7500 / 1M) * 0.10 = 0.00075
  // Output: (2500 / 1M) * 0.40 = 0.001
  // Total: 0.00175
  assert.equal(estimate.totalCostUsd, 0.00175);
  assert.equal(estimate.formattedCostUsd, '$0.0018');
  assert.equal(estimate.totalCostThb, null);
  assert.equal(estimate.formattedCostThb, null);
}

// 4. Zero tokens edge case
{
  const estimate = estimateTokenCost({ totalTokens: 0 });
  assert.equal(estimate.totalCostUsd, 0);
  assert.equal(estimate.formattedCostUsd, '$0.00');
  assert.equal(estimate.totalCostThb, null);
  assert.equal(estimate.formattedCostThb, null);
}

// 5. Formatting helpers
{
  assert.equal(formatCostUsd(0.0005), '$0.0005');
  assert.equal(formatCostUsd(0.0123), '$0.012');
  assert.equal(formatCostThb(0.03), '< ฿0.05');
  assert.equal(formatCostThb(1.25), '฿1.25');
}

console.log('Cost estimator checks passed');
