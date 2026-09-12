import type { Request, Response, NextFunction, RequestHandler } from 'express';
import {
  type SubscriptionTierId,
  getTierDefinition,
} from '../../src/domain/subscriptionTiers.ts';

export function getCurrentBillingMonth(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

interface MonthlyUsageRecord {
  analysesCount: number;
}

const userMonthlyUsageStore = new Map<string, MonthlyUsageRecord>();

function getUsageKey(uid: string, month: string): string {
  return `${uid}:${month}`;
}

export function getUserMonthlyUsage(uid: string, month: string = getCurrentBillingMonth()): number {
  if (!uid) return 0;
  const key = getUsageKey(uid, month);
  return userMonthlyUsageStore.get(key)?.analysesCount ?? 0;
}

export function recordUserAnalysis(uid: string, month: string = getCurrentBillingMonth()): number {
  if (!uid) return 0;
  const key = getUsageKey(uid, month);
  const current = userMonthlyUsageStore.get(key)?.analysesCount ?? 0;
  const updated = current + 1;
  userMonthlyUsageStore.set(key, { analysesCount: updated });
  return updated;
}

export function resetUsageStoreForTesting(): void {
  userMonthlyUsageStore.clear();
}

export function resolveUserTier(req: Request, res: Response): SubscriptionTierId {
  const localsTier = res.locals.authUser?.tier;
  const reqTier = (req as any).auth?.tier;
  const rawTier = localsTier || reqTier;
  if (rawTier === 'pro' || rawTier === 'institutional') {
    return rawTier;
  }
  return 'free';
}

/**
 * Authoritative server-side middleware for /api/analyze.
 * Strictly gates Model access, Deep Think feature, and Monthly Analysis Quota.
 * Never alters canonical financial valuations or SEC data.
 */
export const enforceAnalyzeEntitlements: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const tier = resolveUserTier(req, res);
  const tierDef = getTierDefinition(tier);
  const body = req.body || {};

  // 1. Model Access Gate
  const requestedModel = typeof body.model === 'string' && body.model.trim()
    ? body.model.trim()
    : 'gemini-3.8-flash';

  if (!tierDef.allowedModels.includes(requestedModel)) {
    return res.status(403).json({
      code: 'MODEL_NOT_ENTITLED',
      error: `Model ${requestedModel} requires a Pro or Institutional subscription.`,
      model: requestedModel,
      tier: tierDef.id,
    });
  }

  // 2. Feature Access Gate: Deep Think / Self-Consistency
  const useSelfConsistency = body.useSelfConsistency === true;
  if (useSelfConsistency && !tierDef.features.deep_think) {
    return res.status(403).json({
      code: 'FEATURE_NOT_ENTITLED',
      error: 'Deep Think (Self-Consistency) requires a Pro or Institutional subscription.',
      feature: 'deep_think',
      tier: tierDef.id,
    });
  }

  // 3. Monthly Analysis Quota Gate
  const uid = res.locals.authUser?.uid || (req as any).auth?.uid;
  if (uid) {
    const month = getCurrentBillingMonth();
    const currentUsage = getUserMonthlyUsage(uid, month);

    if (Number.isFinite(tierDef.monthlyAnalysisQuota) && currentUsage >= tierDef.monthlyAnalysisQuota) {
      return res.status(429).json({
        code: 'ANALYSIS_QUOTA_EXCEEDED',
        error: `Monthly analysis quota (${tierDef.monthlyAnalysisQuota}) exceeded for your subscription tier.`,
        tier: tierDef.id,
        limit: tierDef.monthlyAnalysisQuota,
        currentUsage,
      });
    }

    // Increment usage for successful analysis initialization
    recordUserAnalysis(uid, month);
  }

  next();
};
