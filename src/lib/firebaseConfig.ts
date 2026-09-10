import type { FirebaseOptions } from 'firebase/app';

export const LEGACY_PRODUCTION_FIREBASE_CONFIG: FirebaseOptions = Object.freeze({
  apiKey: 'AIzaSyCOoXe_HxUrdUgMMchwRtgBPb-Jvi91UR4',
  authDomain: 'stock-analyze-a89d0.firebaseapp.com',
  projectId: 'stock-analyze-a89d0',
  storageBucket: 'stock-analyze-a89d0.firebasestorage.app',
  messagingSenderId: '251448969613',
  appId: '1:251448969613:web:7678d9ec4649558f8195c4',
  measurementId: 'G-GSVXQJRSWN',
});

export type FirebaseClientEnvironment = Record<string, string | undefined>;

const REQUIRED_CLIENT_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

const OPTIONAL_CLIENT_ENV_KEYS = ['VITE_FIREBASE_MEASUREMENT_ID'] as const;
const ALL_CLIENT_ENV_KEYS = [...REQUIRED_CLIENT_ENV_KEYS, ...OPTIONAL_CLIENT_ENV_KEYS] as const;

function readNonEmpty(env: FirebaseClientEnvironment, key: string): string | undefined {
  const value = env[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function resolveFirebaseConfig(env: FirebaseClientEnvironment): FirebaseOptions {
  const configuredKeys = ALL_CLIENT_ENV_KEYS.filter(key => readNonEmpty(env, key));

  // Backward-compatible rollout: no Firebase Vite overrides means keep using the
  // historical production project so existing Authentication users and report
  // history continue to resolve exactly as before.
  if (configuredKeys.length === 0) {
    return { ...LEGACY_PRODUCTION_FIREBASE_CONFIG };
  }

  const missingKeys = REQUIRED_CLIENT_ENV_KEYS.filter(key => !readNonEmpty(env, key));
  if (missingKeys.length > 0) {
    throw new Error(
      `Incomplete Firebase client configuration. Set all required VITE_FIREBASE_* variables together. Missing: ${missingKeys.join(', ')}`,
    );
  }

  const measurementId = readNonEmpty(env, 'VITE_FIREBASE_MEASUREMENT_ID');
  return {
    apiKey: readNonEmpty(env, 'VITE_FIREBASE_API_KEY')!,
    authDomain: readNonEmpty(env, 'VITE_FIREBASE_AUTH_DOMAIN')!,
    projectId: readNonEmpty(env, 'VITE_FIREBASE_PROJECT_ID')!,
    storageBucket: readNonEmpty(env, 'VITE_FIREBASE_STORAGE_BUCKET')!,
    messagingSenderId: readNonEmpty(env, 'VITE_FIREBASE_MESSAGING_SENDER_ID')!,
    appId: readNonEmpty(env, 'VITE_FIREBASE_APP_ID')!,
    ...(measurementId ? { measurementId } : {}),
  };
}
