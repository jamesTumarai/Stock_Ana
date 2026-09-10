import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  LEGACY_PRODUCTION_FIREBASE_PROJECT_ID,
  isFirebaseDataAccessAllowed,
  resolveFirebaseClientConfig,
} from '../lib/firebaseConfig.ts';
import { resolveFirebaseAdminProjectId } from '../../server/auth/firebaseProject.ts';

const fullClientEnv = {
  VITE_FIREBASE_API_KEY: 'dev-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'lumina-dev.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'lumina-dev',
  VITE_FIREBASE_STORAGE_BUCKET: 'lumina-dev.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '123',
  VITE_FIREBASE_APP_ID: '1:123:web:abc',
};

{
  const resolution = resolveFirebaseClientConfig({});
  assert.equal(resolution.source, 'legacy_production_fallback');
  assert.equal(resolution.config.projectId, LEGACY_PRODUCTION_FIREBASE_PROJECT_ID);
  assert.equal(isFirebaseDataAccessAllowed(resolution, 'stock-ana-ten.vercel.app'), true);
  assert.equal(isFirebaseDataAccessAllowed(resolution, 'preview-123.vercel.app'), false);
  assert.equal(isFirebaseDataAccessAllowed(resolution, 'localhost'), false);
}

{
  const resolution = resolveFirebaseClientConfig(fullClientEnv);
  assert.equal(resolution.source, 'environment');
  assert.equal(resolution.config.projectId, 'lumina-dev');
  assert.equal(isFirebaseDataAccessAllowed(resolution, 'localhost'), true);
}

assert.throws(
  () => resolveFirebaseClientConfig({ VITE_FIREBASE_PROJECT_ID: 'partial-only' }),
  /Incomplete Firebase client environment configuration/,
);

{
  const explicit = resolveFirebaseAdminProjectId({ FIREBASE_PROJECT_ID: 'lumina-dev', VERCEL_ENV: 'preview' });
  assert.deepEqual(explicit, { projectId: 'lumina-dev', source: 'environment' });
}

assert.throws(
  () => resolveFirebaseAdminProjectId({ VERCEL_ENV: 'preview' }),
  /FIREBASE_PROJECT_ID must be explicitly configured/,
);
assert.throws(
  () => resolveFirebaseAdminProjectId({ FIREBASE_PROJECT_ID: LEGACY_PRODUCTION_FIREBASE_PROJECT_ID, VERCEL_ENV: 'preview' }),
  /Production Firebase project is blocked/,
);
assert.equal(
  resolveFirebaseAdminProjectId({ VERCEL_ENV: 'production' }).projectId,
  LEGACY_PRODUCTION_FIREBASE_PROJECT_ID,
);

const app = fs.readFileSync('src/App.tsx', 'utf8');
const firebaseRuntime = fs.readFileSync('src/lib/firebase.ts', 'utf8');
const serverAuth = fs.readFileSync('server/auth/firebaseAuth.ts', 'utf8');
const envExample = fs.readFileSync('.env.example', 'utf8');
const docs = fs.readFileSync('docs/FIREBASE_ENVIRONMENTS.md', 'utf8');
const ci = fs.readFileSync('.github/workflows/verify.yml', 'utf8');

assert.match(firebaseRuntime, /resolveFirebaseClientConfig/);
assert.match(firebaseRuntime, /firebaseDataAccessAllowed/);
assert.match(app, /if \(!firebaseDataAccessAllowed\)/);
assert.match(app, /if \(!user \|\| !firebaseDataAccessAllowed\) return;/);
assert.match(serverAuth, /resolveFirebaseAdminProjectId/);
assert.match(envExample, /VITE_FIREBASE_PROJECT_ID=/);
assert.match(envExample, /FIREBASE_PROJECT_ID=/);
assert.match(docs, /repository intentionally has no active `firebase\.json`/);
assert.match(ci, /node-version: 24/);
assert.equal(fs.existsSync('firebase.json'), false, 'stale Firebase CLI config must not remain active');
assert.equal(fs.existsSync('firebase-applet-config.json'), false, 'stale AI Studio applet config must be quarantined');
assert.equal(fs.existsSync('firebase.legacy-ai-studio.json'), true);
assert.equal(fs.existsSync('firebase-applet-config.legacy.json'), true);

console.log('Firebase environment boundary checks passed');
