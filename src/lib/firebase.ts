import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { resolveFirebaseConfig } from './firebaseConfig';

const viteEnv = (import.meta as ImportMeta & {
  env?: Record<string, string | undefined>;
}).env ?? {};

const app = initializeApp(resolveFirebaseConfig(viteEnv));
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
