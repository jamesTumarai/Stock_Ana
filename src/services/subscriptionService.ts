import type { SubscriptionTierId } from '../domain/subscriptionTiers';
import type { UserUsage } from '../utils/entitlementEngine';

const SUBSCRIPTION_STORAGE_KEY = 'lumina_subscription_tier';
const USAGE_STORAGE_KEY = 'lumina_user_monthly_usage';

export function getCurrentBillingCycleMonth(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage;
    }
  } catch { /* no-op */ }
  return null;
}

export function getActiveSubscriptionTier(): SubscriptionTierId {
  const storage = getStorage();
  if (!storage) return 'free';
  try {
    const raw = storage.getItem(SUBSCRIPTION_STORAGE_KEY);
    if (raw === 'pro' || raw === 'institutional') return raw;
  } catch (e) {
    console.warn('[subscription] Unable to read subscription tier from storage:', e);
  }
  return 'free';
}

export function setActiveSubscriptionTier(tier: SubscriptionTierId): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(SUBSCRIPTION_STORAGE_KEY, tier);
  } catch (e) {
    console.error('[subscription] Unable to save subscription tier to storage:', e);
  }
}

export function getStoredUserUsage(): UserUsage {
  const currentCycle = getCurrentBillingCycleMonth();
  const defaultUsage: UserUsage = {
    billingCycleMonth: currentCycle,
    analysesCount: 0,
    tokensConsumed: 0,
    lastAnalysisAt: null,
  };

  const storage = getStorage();
  if (!storage) {
    return defaultUsage;
  }

  try {
    const raw = storage.getItem(USAGE_STORAGE_KEY);
    if (!raw) return defaultUsage;

    const parsed = JSON.parse(raw);
    // Automatic monthly reset if billing cycle changed
    if (parsed && parsed.billingCycleMonth === currentCycle) {
      return {
        billingCycleMonth: currentCycle,
        analysesCount: Math.max(0, Number(parsed.analysesCount) || 0),
        tokensConsumed: Math.max(0, Number(parsed.tokensConsumed) || 0),
        lastAnalysisAt: typeof parsed.lastAnalysisAt === 'string' ? parsed.lastAnalysisAt : null,
      };
    }
  } catch (e) {
    console.warn('[subscription] Error reading usage storage:', e);
  }

  return defaultUsage;
}

export function recordAnalysisUsage(tokensConsumed = 0): UserUsage {
  const currentCycle = getCurrentBillingCycleMonth();
  const current = getStoredUserUsage();

  const updated: UserUsage = {
    billingCycleMonth: currentCycle,
    analysesCount: current.analysesCount + 1,
    tokensConsumed: current.tokensConsumed + Math.max(0, tokensConsumed),
    lastAnalysisAt: new Date().toISOString(),
  };

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(USAGE_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[subscription] Failed to persist usage:', e);
    }
  }

  return updated;
}

export function resetUsageForTesting(): void {
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(USAGE_STORAGE_KEY);
      storage.removeItem(SUBSCRIPTION_STORAGE_KEY);
    } catch { /* no-op */ }
  }
}
