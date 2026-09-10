import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { isFirebaseDataAccessAllowed, resolveFirebaseClientConfig } from './firebaseConfig';

type ViteEnv = Record<string, string | boolean | undefined>;
const viteEnv = (((import.meta as ImportMeta & { env?: ViteEnv }).env) ?? {}) as ViteEnv;
const firebaseResolution = resolveFirebaseClientConfig(viteEnv);
const runtimeHostname = typeof window === 'undefined' ? '' : window.location.hostname;
const allowProductionProjectOverride = viteEnv.VITE_FIREBASE_ALLOW_PRODUCTION_PROJECT === 'true';

export const firebaseConfigSource = firebaseResolution.source;
export const firebaseProjectId = firebaseResolution.config.projectId;
export const firebaseDataAccessAllowed = isFirebaseDataAccessAllowed(
  firebaseResolution,
  runtimeHostname,
  allowProductionProjectOverride,
);

const app = initializeApp(firebaseResolution.config);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
