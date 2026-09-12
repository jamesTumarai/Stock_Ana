import type { RequestHandler } from 'express';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { SubscriptionTierId } from '../../src/domain/subscriptionTiers.ts';
import { resolveFirebaseAdminProjectId } from './firebaseProject.ts';

const ADMIN_APP_NAME = 'lumina-server-auth';

export interface VerifiedFirebaseIdentity {
  uid: string;
  email?: string;
  tier?: SubscriptionTierId;
}

export type FirebaseTokenVerifier = (idToken: string) => Promise<VerifiedFirebaseIdentity>;

export function extractBearerToken(header: unknown): string | null {
  if (typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}

function getFirebaseAdminApp() {
  const existing = getApps().find(app => app.name === ADMIN_APP_NAME);
  if (existing) return existing;
  const { projectId } = resolveFirebaseAdminProjectId();
  return initializeApp({ projectId }, ADMIN_APP_NAME);
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseIdentity> {
  const decoded = await getAuth(getFirebaseAdminApp()).verifyIdToken(idToken);
  const rawTier = decoded.tier || decoded.subscription_tier;
  const tier: SubscriptionTierId | undefined = (rawTier === 'pro' || rawTier === 'institutional') ? rawTier : (rawTier === 'free' ? 'free' : undefined);
  return { uid: decoded.uid, email: decoded.email, ...(tier ? { tier } : {}) };
}

export function createRequireFirebaseAuth(
  verifier: FirebaseTokenVerifier = verifyFirebaseIdToken,
): RequestHandler {
  return async (req, res, next) => {
    const idToken = extractBearerToken(req.headers.authorization);
    if (!idToken) {
      res.status(401).json({ code: 'AUTH_REQUIRED', error: 'Authentication required.' });
      return;
    }

    try {
      const identity = await verifier(idToken);
      if (!identity?.uid) throw new Error('Token did not contain a uid.');
      const resolvedTier: SubscriptionTierId = identity.tier === 'pro' || identity.tier === 'institutional' ? identity.tier : 'free';
      res.locals.authUser = {
        uid: identity.uid,
        email: identity.email ?? null,
        ...(identity.tier ? { tier: identity.tier } : {}),
      };
      (req as any).auth = {
        uid: identity.uid,
        email: identity.email ?? null,
        tier: resolvedTier,
      };
      next();
    } catch {
      res.status(401).json({ code: 'AUTH_INVALID', error: 'Invalid or expired authentication token.' });
    }
  };
}
