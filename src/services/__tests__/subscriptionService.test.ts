import assert from 'node:assert/strict';
import {
  getCurrentBillingCycleMonth,
  getStoredUserUsage,
  recordAnalysisUsage,
  getActiveSubscriptionTier,
  setActiveSubscriptionTier,
  resetUsageForTesting,
} from '../subscriptionService';

// Setup mock window.localStorage for node environment
const storage = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, val: string) => storage.set(key, String(val)),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  },
};

// 1. Current billing cycle format
{
  const cycle = getCurrentBillingCycleMonth(new Date('2026-09-12T01:00:00Z'));
  assert.equal(cycle, '2026-09');
}

// 2. Default tier and usage
{
  resetUsageForTesting();
  assert.equal(getActiveSubscriptionTier(), 'free');

  const usage = getStoredUserUsage();
  assert.equal(usage.analysesCount, 0);
  assert.equal(usage.tokensConsumed, 0);
  assert.equal(usage.lastAnalysisAt, null);
}

// 3. Record analysis usage
{
  const updated1 = recordAnalysisUsage(15000);
  assert.equal(updated1.analysesCount, 1);
  assert.equal(updated1.tokensConsumed, 15000);
  assert.ok(updated1.lastAnalysisAt);

  const updated2 = recordAnalysisUsage(25000);
  assert.equal(updated2.analysesCount, 2);
  assert.equal(updated2.tokensConsumed, 40000);

  const persisted = getStoredUserUsage();
  assert.equal(persisted.analysesCount, 2);
  assert.equal(persisted.tokensConsumed, 40000);
}

// 4. Set subscription tier
{
  setActiveSubscriptionTier('pro');
  assert.equal(getActiveSubscriptionTier(), 'pro');

  setActiveSubscriptionTier('institutional');
  assert.equal(getActiveSubscriptionTier(), 'institutional');
}

console.log('Subscription service checks passed');
