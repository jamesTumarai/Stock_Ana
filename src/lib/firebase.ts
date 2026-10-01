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
// Storage is optional: initialize only during an oversized-part save/read so a
// missing bucket/SDK provider cannot prevent the main app or auth from booting.
export async function getReportBlobStorage() {
  const { getStorage } = await import('firebase/storage');
  const storage = getStorage(app);
  storage.maxUploadRetryTime = 10000;
  storage.maxOperationRetryTime = 10000;
  return storage;
}
export const googleProvider = new GoogleAuthProvider();
