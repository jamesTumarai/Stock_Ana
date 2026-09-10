export const LEGACY_PRODUCTION_FIREBASE_PROJECT_ID = 'stock-analyze-a89d0';

export interface FirebaseAdminProjectResolution {
  projectId: string;
  source: 'environment' | 'legacy_production_fallback';
}

const clean = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

export function resolveFirebaseAdminProjectId(
  env: Record<string, string | undefined> = process.env,
): FirebaseAdminProjectResolution {
  const explicitProjectId = clean(env.FIREBASE_PROJECT_ID);
  const vercelEnvironment = clean(env.VERCEL_ENV).toLowerCase();
  const nodeEnvironment = clean(env.NODE_ENV).toLowerCase();
  const knownNonProduction = vercelEnvironment === 'preview'
    || vercelEnvironment === 'development'
    || nodeEnvironment === 'development';
  const allowProductionProject = clean(env.FIREBASE_ALLOW_PRODUCTION_PROJECT_IN_NONPROD).toLowerCase() === 'true';

  if (explicitProjectId) {
    if (
      explicitProjectId === LEGACY_PRODUCTION_FIREBASE_PROJECT_ID
      && knownNonProduction
      && !allowProductionProject
    ) {
      throw new Error('Production Firebase project is blocked in preview/development without an explicit override.');
    }
    return { projectId: explicitProjectId, source: 'environment' };
  }

  if (knownNonProduction) {
    throw new Error('FIREBASE_PROJECT_ID must be explicitly configured for preview/development.');
  }

  return {
    projectId: LEGACY_PRODUCTION_FIREBASE_PROJECT_ID,
    source: 'legacy_production_fallback',
  };
}
