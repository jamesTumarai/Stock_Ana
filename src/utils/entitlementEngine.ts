import {
  type SubscriptionTierId,
  type FeatureKey,
  type TierDefinition,
  getTierDefinition,
} from '../domain/subscriptionTiers';

export interface UserUsage {
  billingCycleMonth: string; // YYYY-MM format
  analysesCount: number;
  tokensConsumed: number;
  lastAnalysisAt: string | null;
}

export interface EntitlementDecision {
  allowed: boolean;
  reason?: string;
  upgradeRecommended?: boolean;
  tier: SubscriptionTierId;
  feature: FeatureKey;
}

export interface QuotaCheckResult {
  allowed: boolean;
  limit: number;
  currentUsage: number;
  remaining: number;
  resetDate: string;
  upgradeRecommended?: boolean;
  tier: SubscriptionTierId;
  reason?: string;
}

/**
 * Pure deterministic evaluation of user feature access based on subscription tier.
 * Never interacts with or mutates canonical financial valuations.
 */
export function evaluateFeatureEntitlement(
  tierId: SubscriptionTierId = 'free',
  feature: FeatureKey,
  isThai = false,
): EntitlementDecision {
  const tier = getTierDefinition(tierId);
  const allowed = Boolean(tier.features[feature]);

  if (allowed) {
    return {
      allowed: true,
      tier: tier.id,
      feature,
    };
  }

  const reason = isThai
    ? `ฟีเจอร์นี้ต้องใช้แพ็กเกจ ${tier.id === 'free' ? 'Pro หรือ Institutional' : 'Institutional'}`
    : `This feature requires a ${tier.id === 'free' ? 'Pro or Institutional' : 'Institutional'} subscription.`;

  return {
    allowed: false,
    reason,
    upgradeRecommended: true,
    tier: tier.id,
    feature,
  };
}

/**
 * Evaluates monthly analysis quota against active subscription tier limits.
 */
export function evaluateAnalysisQuota(
  tierId: SubscriptionTierId = 'free',
  usage: UserUsage,
  isThai = false,
): QuotaCheckResult {
  const tier = getTierDefinition(tierId);
  const limit = tier.monthlyAnalysisQuota;
  const currentUsage = Math.max(0, usage.analysesCount || 0);

  // Compute next billing cycle reset (1st of next calendar month)
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const resetDate = nextMonth.toISOString().split('T')[0];

  if (!Number.isFinite(limit)) {
    return {
      allowed: true,
      limit: Infinity,
      currentUsage,
      remaining: Infinity,
      resetDate,
      tier: tier.id,
    };
  }

  const remaining = Math.max(0, limit - currentUsage);
  const allowed = remaining > 0;

  const reason = allowed
    ? undefined
    : isThai
    ? `คุณใช้งานโควตาวิเคราะห์หุ้นครบ ${limit} ครั้งในรอบเดือนนี้แล้ว (รีเซ็ต ${resetDate})`
    : `You have reached your monthly analysis limit of ${limit} reports (resets on ${resetDate}).`;

  return {
    allowed,
    limit,
    currentUsage,
    remaining,
    resetDate,
    upgradeRecommended: !allowed,
    tier: tier.id,
    reason,
  };
}

/**
 * Evaluates whether current portfolio holding count exceeds tier capacity.
 */
export function evaluateHoldingsQuota(
  tierId: SubscriptionTierId = 'free',
  currentHoldingsCount: number,
  isThai = false,
): QuotaCheckResult {
  const tier = getTierDefinition(tierId);
  const limit = tier.maxHoldings;
  const count = Math.max(0, currentHoldingsCount);

  if (!Number.isFinite(limit)) {
    return {
      allowed: true,
      limit: Infinity,
      currentUsage: count,
      remaining: Infinity,
      resetDate: 'never',
      tier: tier.id,
    };
  }

  const remaining = Math.max(0, limit - count);
  const allowed = count < limit;

  const reason = allowed
    ? undefined
    : isThai
    ? `คุณมีหุ้นในพอร์ตครบตามโควตาของแพ็กเกจ ${tier.name.th} แล้ว (${limit} ตัว)`
    : `You have reached the maximum portfolio holdings limit (${limit}) for the ${tier.name.en} tier.`;

  return {
    allowed,
    limit,
    currentUsage: count,
    remaining,
    resetDate: 'never',
    upgradeRecommended: !allowed,
    tier: tier.id,
    reason,
  };
}

/**
 * Checks if model is authorized under the active subscription tier.
 */
export function isModelAuthorized(tierId: SubscriptionTierId = 'free', modelName?: string): boolean {
  if (!modelName) return true;
  const tier = getTierDefinition(tierId);
  const normalized = modelName.trim().toLowerCase();
  return tier.allowedModels.some(allowed => normalized.includes(allowed) || allowed.includes(normalized));
}
