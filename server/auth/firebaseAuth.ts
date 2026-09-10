import type { RequestHandler } from 'express';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const ADMIN_APP_NAME = 'lumina-server-auth';
const DEFAULT_FIREBASE_PROJECT_ID = 'stock-analyze-a89d0';

export interface VerifiedFirebaseIdentity {
  uid: string;
  email?: string;
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
  return initializeApp(
    { projectId: process.env.FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_PROJECT_ID },
    ADMIN_APP_NAME,
  );
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseIdentity> {
  const decoded = await getAuth(getFirebaseAdminApp()).verifyIdToken(idToken);
  return { uid: decoded.uid, email: decoded.email };
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
      res.locals.authUser = {
        uid: identity.uid,
        email: identity.email ?? null,
      };
      next();
    } catch {
      res.status(401).json({ code: 'AUTH_INVALID', error: 'Invalid or expired authentication token.' });
    }
  };
}
