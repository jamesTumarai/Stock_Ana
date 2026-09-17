export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export type FirebaseConfigSource = 'environment' | 'legacy_production_fallback';

export interface FirebaseClientConfigResolution {
  config: FirebaseWebConfig;
  source: FirebaseConfigSource;
}

export const LEGACY_PRODUCTION_FIREBASE_PROJECT_ID = 'stock-analyze-a89d0';

export const LEGACY_PRODUCTION_FIREBASE_CONFIG: FirebaseWebConfig = Object.freeze({
  apiKey: 'AIzaSyCOoXe_HxUrdUgMMchwRtgBPb-Jvi91UR4',
  authDomain: 'stock-analyze-a89d0.firebaseapp.com',
  projectId: LEGACY_PRODUCTION_FIREBASE_PROJECT_ID,
  storageBucket: 'stock-analyze-a89d0.firebasestorage.app',
  messagingSenderId: '251448969613',
  appId: '1:251448969613:web:7678d9ec4649558f8195c4',
  measurementId: 'G-GSVXQJRSWN',
});

const REQUIRED_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

const OPTIONAL_ENV_KEYS = ['VITE_FIREBASE_MEASUREMENT_ID'] as const;
const ALL_FIREBASE_ENV_KEYS = [...REQUIRED_ENV_KEYS, ...OPTIONAL_ENV_KEYS] as const;

const KNOWN_PRODUCTION_HOSTS = new Set([
  'stock-ana.vercel.app',
  'stock-ana-ten.vercel.app',
  'stock-ana-jamestumarais-projects.vercel.app',
  'stock-ana-git-main-jamestumarais-projects.vercel.app',
]);

const readString = (env: Record<string, unknown>, key: string): string => {
  const value = env[key];
  return typeof value === 'string' ? value.trim() : '';
};

export function resolveFirebaseClientConfig(
  env: Record<string, unknown>,
): FirebaseClientConfigResolution {
  const provided = ALL_FIREBASE_ENV_KEYS.filter(key => readString(env, key));

  // Backward-compatible production path: when there is no Firebase client
  // override at all, preserve the historical project so existing users/history
  // remain attached to the same Authentication + Firestore project.
  if (provided.length === 0) {
    return {
      config: { ...LEGACY_PRODUCTION_FIREBASE_CONFIG },
      source: 'legacy_production_fallback',
    };
  }

  const missing = REQUIRED_ENV_KEYS.filter(key => !readString(env, key));
  if (missing.length > 0) {
    throw new Error(
      `Incomplete Firebase client environment configuration. Missing: ${missing.join(', ')}`,
    );
  }

  const measurementId = readString(env, 'VITE_FIREBASE_MEASUREMENT_ID');
  return {
    source: 'environment',
    config: {
      apiKey: readString(env, 'VITE_FIREBASE_API_KEY'),
      authDomain: readString(env, 'VITE_FIREBASE_AUTH_DOMAIN'),
      projectId: readString(env, 'VITE_FIREBASE_PROJECT_ID'),
      storageBucket: readString(env, 'VITE_FIREBASE_STORAGE_BUCKET'),
      messagingSenderId: readString(env, 'VITE_FIREBASE_MESSAGING_SENDER_ID'),
      appId: readString(env, 'VITE_FIREBASE_APP_ID'),
      ...(measurementId ? { measurementId } : {}),
    },
  };
}

export function isKnownProductionHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().trim().replace(/^www\./, '');
  if (KNOWN_PRODUCTION_HOSTS.has(normalized)) return true;
  if (normalized.endsWith('.vercel.app') && normalized.startsWith('stock-ana')) return true;
  return false;
}

export function isFirebaseDataAccessAllowed(
  resolution: FirebaseClientConfigResolution,
  hostname: string,
  allowProductionProjectOverride = false,
): boolean {
  if (resolution.config.projectId !== LEGACY_PRODUCTION_FIREBASE_PROJECT_ID) return true;
  if (allowProductionProjectOverride) return true;
  return isKnownProductionHost(hostname);
}
