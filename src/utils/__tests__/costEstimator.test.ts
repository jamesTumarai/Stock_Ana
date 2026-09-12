import assert from 'node:assert/strict';
import { estimateTokenCost, getModelPricing, formatCostUsd, formatCostThb, PRICING_CATALOG_METADATA } from '../costEstimator';

// 1. Model pricing catalog resolution
{
  const flashPricing = getModelPricing('gemini-3.8-flash');
  assert.ok(flashPricing);
  assert.equal(flashPricing.tier, 'flash');
  assert.equal(flashPricing.inputPerMillion, 0.10);
  assert.equal(flashPricing.outputPerMillion, 0.40);
  assert.equal(flashPricing.catalogVersion, PRICING_CATALOG_METADATA.version);
  assert.equal(flashPricing.source, PRICING_CATALOG_METADATA.source);

  const proPricing = getModelPricing('gemini-1.5-pro');
  assert.ok(proPricing);
  assert.equal(proPricing.tier, 'pro');
  assert.equal(proPricing.inputPerMillion, 1.25);
  assert.equal(proPricing.outputPerMillion, 5.00);

  // Unknown model returns null (fail-closed, no arbitrary standard pricing)
  const unknownPricing = getModelPricing('unknown-model');
  assert.equal(unknownPricing, null);

  // Arbitrary model containing "pro" does NOT map to Gemini 1.5 Pro
  const arbitraryProPricing = getModelPricing('my-pro-custom');
  assert.equal(arbitraryProPricing, null);

  const llamaProPricing = getModelPricing('llama-3-pro');
  assert.equal(llamaProPricing, null);
}

// 2. Exact token breakdown estimation with explicit model
{
  const estimate = estimateTokenCost({
    promptTokens: 20_000,
    completionTokens: 5_000,
    model: 'gemini-3.8-flash',
    fxRateUsdThb: 36.0,
  });

  assert.equal(estimate.isAvailable, true);
  assert.equal(estimate.totalTokens, 25_000);
  assert.equal(estimate.promptTokens, 20_000);
  assert.equal(estimate.completionTokens, 5_000);
  assert.equal(estimate.isEstimatedBreakdown, false);
  assert.equal(estimate.approximationNote, undefined);

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
  assert.equal(estimate.pricingMetadata?.catalogVersion, PRICING_CATALOG_METADATA.version);
}

// 3. Fallback derivation when only totalTokens is provided (estimated distribution surfaced clearly)
{
  const estimate = estimateTokenCost({
    totalTokens: 10_000,
    model: 'gemini-3.8-flash',
  });

  assert.equal(estimate.isAvailable, true);
  assert.equal(estimate.totalTokens, 10_000);
  assert.equal(estimate.promptTokens, null);
  assert.equal(estimate.completionTokens, null);
  assert.equal(estimate.isEstimatedBreakdown, true);
  assert.ok(estimate.approximationNote?.includes('75% input / 25% output assumption'));
  assert.ok(estimate.approximationNoteTh?.includes('75%'));

  // Input: (7500 / 1M) * 0.10 = 0.00075
  // Output: (2500 / 1M) * 0.40 = 0.001
  // Total: 0.00175
  assert.equal(estimate.totalCostUsd, 0.00175);
  assert.equal(estimate.formattedCostUsd, '$0.0018');
  assert.equal(estimate.totalCostThb, null);
  assert.equal(estimate.formattedCostThb, null);
}

// 4. Unknown model yields isAvailable=false and null costs
{
  const unknownEstimate = estimateTokenCost({
    totalTokens: 10_000,
    model: 'unrecognized-model-v1',
  });

  assert.equal(unknownEstimate.isAvailable, false);
  assert.ok(unknownEstimate.reason?.includes('Pricing unavailable'));
  assert.equal(unknownEstimate.totalCostUsd, null);
  assert.equal(unknownEstimate.formattedCostUsd, 'N/A');
  assert.equal(unknownEstimate.totalCostThb, null);
  assert.equal(unknownEstimate.pricingTier, null);

  // Arbitrary pro model also fails closed
  const proUnknownEstimate = estimateTokenCost({
    totalTokens: 10_000,
    model: 'deepseek-pro',
  });
  assert.equal(proUnknownEstimate.isAvailable, false);
  assert.equal(proUnknownEstimate.totalCostUsd, null);
}

// 5. Zero tokens edge case with known model
{
  const estimate = estimateTokenCost({ totalTokens: 0, model: 'gemini-3.8-flash' });
  assert.equal(estimate.isAvailable, true);
  assert.equal(estimate.totalCostUsd, 0);
  assert.equal(estimate.formattedCostUsd, '$0.00');
  assert.equal(estimate.totalCostThb, null);
  assert.equal(estimate.formattedCostThb, null);
}

// 6. Formatting helpers
{
  assert.equal(formatCostUsd(0.0005), '$0.0005');
  assert.equal(formatCostUsd(0.0123), '$0.012');
  assert.equal(formatCostThb(0.03), '< ฿0.05');
  assert.equal(formatCostThb(1.25), '฿1.25');
}

// 7. Missing model identity fails closed without arbitrary fallback
{
  const missingModelEstimate = estimateTokenCost({ totalTokens: 10_000 });
  assert.equal(missingModelEstimate.isAvailable, false);
  assert.equal(missingModelEstimate.model, null);
  assert.equal(missingModelEstimate.totalCostUsd, null);
  assert.equal(missingModelEstimate.formattedCostUsd, 'N/A');
  assert.ok(missingModelEstimate.reason?.includes('Model identity unavailable'));
}

// 8. Requested model != actual model: must calculate price using actual model only
{
  const requestedModel = 'perseus'; // client alias/unpriced rewrite
  const actualModel = 'gemini-3.8-flash'; // actual inference model in catalog

  // Directly providing actual model yields accurate pricing
  const actualEstimate = estimateTokenCost({
    totalTokens: 10_000,
    model: actualModel,
  });
  assert.equal(actualEstimate.isAvailable, true);
  assert.equal(actualEstimate.model, 'gemini-3.8-flash');
  assert.ok(actualEstimate.totalCostUsd !== null && actualEstimate.totalCostUsd > 0);
  assert.equal(actualEstimate.pricingTier, 'flash');

  // Passing unpriced requested alias without actual model fails closed
  const requestedEstimate = estimateTokenCost({
    totalTokens: 10_000,
    model: requestedModel,
  });
  assert.equal(requestedEstimate.isAvailable, false);
  assert.equal(requestedEstimate.totalCostUsd, null);
  assert.equal(requestedEstimate.formattedCostUsd, 'N/A');
}

// 9. Unknown actual model fails closed
{
  const unknownActualEstimate = estimateTokenCost({
    totalTokens: 10_000,
    model: 'custom-internal-llm-v99',
  });
  assert.equal(unknownActualEstimate.isAvailable, false);
  assert.equal(unknownActualEstimate.totalCostUsd, null);
  assert.equal(unknownActualEstimate.formattedCostUsd, 'N/A');
}

console.log('Cost estimator checks passed');
