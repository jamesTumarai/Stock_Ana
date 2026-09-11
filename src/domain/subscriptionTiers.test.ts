import assert from 'node:assert/strict';
import { SUBSCRIPTION_TIERS, getTierDefinition } from './subscriptionTiers';

// 1. Tier catalog integrity
{
  assert.ok(SUBSCRIPTION_TIERS.free);
  assert.ok(SUBSCRIPTION_TIERS.pro);
  assert.ok(SUBSCRIPTION_TIERS.institutional);

  // Free Tier constraints
  assert.equal(SUBSCRIPTION_TIERS.free.monthlyAnalysisQuota, 5);
  assert.equal(SUBSCRIPTION_TIERS.free.maxHoldings, 5);
  assert.equal(SUBSCRIPTION_TIERS.free.maxAlerts, 3);
  assert.equal(SUBSCRIPTION_TIERS.free.features.standard_analyze, true);
  assert.equal(SUBSCRIPTION_TIERS.free.features.deep_think, false);

  // Pro Tier constraints
  assert.equal(SUBSCRIPTION_TIERS.pro.monthlyAnalysisQuota, 100);
  assert.equal(SUBSCRIPTION_TIERS.pro.maxHoldings, 50);
  assert.equal(SUBSCRIPTION_TIERS.pro.maxAlerts, 50);
  assert.equal(SUBSCRIPTION_TIERS.pro.features.deep_think, true);
  assert.equal(SUBSCRIPTION_TIERS.pro.features.multi_scenario_matrix, true);

  // Institutional Desk constraints
  assert.equal(SUBSCRIPTION_TIERS.institutional.monthlyAnalysisQuota, Infinity);
  assert.equal(SUBSCRIPTION_TIERS.institutional.maxHoldings, Infinity);
  assert.equal(SUBSCRIPTION_TIERS.institutional.features.custom_wacc_templates, true);
}

// 2. getTierDefinition fallbacks
{
  assert.equal(getTierDefinition(null).id, 'free');
  assert.equal(getTierDefinition(undefined).id, 'free');
  assert.equal(getTierDefinition('invalid').id, 'free');
  assert.equal(getTierDefinition('PRO').id, 'pro');
  assert.equal(getTierDefinition('institutional').id, 'institutional');
}

console.log('Subscription tier checks passed');
