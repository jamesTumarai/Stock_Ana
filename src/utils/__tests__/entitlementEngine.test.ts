import assert from 'node:assert/strict';
import {
  evaluateFeatureEntitlement,
  evaluateAnalysisQuota,
  evaluateHoldingsQuota,
  isModelAuthorized,
} from '../entitlementEngine';

// 1. Feature entitlement tests
{
  const freeDeepThink = evaluateFeatureEntitlement('free', 'deep_think');
  assert.equal(freeDeepThink.allowed, false);
  assert.equal(freeDeepThink.upgradeRecommended, true);

  const proDeepThink = evaluateFeatureEntitlement('pro', 'deep_think');
  assert.equal(proDeepThink.allowed, true);

  const freeStandard = evaluateFeatureEntitlement('free', 'standard_analyze');
  assert.equal(freeStandard.allowed, true);

  const proWaccTemplates = evaluateFeatureEntitlement('pro', 'custom_wacc_templates');
  assert.equal(proWaccTemplates.allowed, false);

  const instWaccTemplates = evaluateFeatureEntitlement('institutional', 'custom_wacc_templates');
  assert.equal(instWaccTemplates.allowed, true);
}

// 2. Monthly quota evaluations
{
  const underQuota = evaluateAnalysisQuota('free', {
    billingCycleMonth: '2026-09',
    analysesCount: 3,
    tokensConsumed: 45000,
    lastAnalysisAt: null,
  });
  assert.equal(underQuota.allowed, true);
  assert.equal(underQuota.limit, 5);
  assert.equal(underQuota.remaining, 2);

  const atQuotaLimit = evaluateAnalysisQuota('free', {
    billingCycleMonth: '2026-09',
    analysesCount: 5,
    tokensConsumed: 120000,
    lastAnalysisAt: null,
  });
  assert.equal(atQuotaLimit.allowed, false);
  assert.equal(atQuotaLimit.remaining, 0);
  assert.equal(atQuotaLimit.upgradeRecommended, true);
  assert.ok(atQuotaLimit.reason);

  const institutionalUnlimited = evaluateAnalysisQuota('institutional', {
    billingCycleMonth: '2026-09',
    analysesCount: 9999,
    tokensConsumed: 50000000,
    lastAnalysisAt: null,
  });
  assert.equal(institutionalUnlimited.allowed, true);
  assert.equal(institutionalUnlimited.limit, Infinity);
  assert.equal(institutionalUnlimited.remaining, Infinity);
}

// 3. Portfolio holdings quota
{
  const freeHoldings = evaluateHoldingsQuota('free', 4);
  assert.equal(freeHoldings.allowed, true);
  assert.equal(freeHoldings.remaining, 1);

  const freeHoldingsExceeded = evaluateHoldingsQuota('free', 5);
  assert.equal(freeHoldingsExceeded.allowed, false);
  assert.equal(freeHoldingsExceeded.upgradeRecommended, true);

  const proHoldings = evaluateHoldingsQuota('pro', 25);
  assert.equal(proHoldings.allowed, true);
  assert.equal(proHoldings.remaining, 25);
}

// 4. Authorized model tests
{
  assert.equal(isModelAuthorized('free', 'gemini-3.8-flash'), true);
  assert.equal(isModelAuthorized('free', 'gemini-1.5-pro'), false);
  assert.equal(isModelAuthorized('pro', 'gemini-1.5-pro'), true);
  assert.equal(isModelAuthorized('institutional', 'gemini-2.5-pro'), true);
}

console.log('Entitlement engine checks passed');
