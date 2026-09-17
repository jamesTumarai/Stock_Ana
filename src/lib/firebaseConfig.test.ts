import assert from 'node:assert/strict';
import {
  LEGACY_PRODUCTION_FIREBASE_PROJECT_ID,
  isFirebaseDataAccessAllowed,
  resolveFirebaseClientConfig,
} from './firebaseConfig.ts';
import { resolveFirebaseAdminProjectId } from '../../server/auth/firebaseProject.ts';

const devClientEnv = {
  VITE_FIREBASE_API_KEY: 'dev-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'lumina-dev.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'lumina-dev',
  VITE_FIREBASE_STORAGE_BUCKET: 'lumina-dev.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '123456',
  VITE_FIREBASE_APP_ID: '1:123456:web:abcdef',
  VITE_FIREBASE_MEASUREMENT_ID: 'G-DEV123',
};

{
  const resolution = resolveFirebaseClientConfig({});
  assert.equal(resolution.source, 'legacy_production_fallback');
  assert.equal(resolution.config.projectId, LEGACY_PRODUCTION_FIREBASE_PROJECT_ID);
  assert.equal(isFirebaseDataAccessAllowed(resolution, 'stock-ana.vercel.app'), true);
  assert.equal(isFirebaseDataAccessAllowed(resolution, 'stock-ana-ten.vercel.app'), true);
  assert.equal(isFirebaseDataAccessAllowed(resolution, 'www.stock-ana-ten.vercel.app'), true);
  assert.equal(isFirebaseDataAccessAllowed(resolution, 'stock-ana-git-main-jamestumarais-projects.vercel.app'), true);
  assert.equal(isFirebaseDataAccessAllowed(resolution, 'stock-ana-preview-xyz.vercel.app'), true);
  assert.equal(isFirebaseDataAccessAllowed(resolution, 'localhost'), false);
  assert.equal(isFirebaseDataAccessAllowed(resolution, 'preview-123.vercel.app'), false);
  assert.equal(isFirebaseDataAccessAllowed(resolution, 'localhost', true), true);
}

{
  const resolution = resolveFirebaseClientConfig(devClientEnv);
  assert.equal(resolution.source, 'environment');
  assert.equal(resolution.config.projectId, 'lumina-dev');
  assert.equal(isFirebaseDataAccessAllowed(resolution, 'localhost'), true);
  assert.deepEqual(resolution.config, {
    apiKey: 'dev-api-key',
    authDomain: 'lumina-dev.firebaseapp.com',
    projectId: 'lumina-dev',
    storageBucket: 'lumina-dev.firebasestorage.app',
    messagingSenderId: '123456',
    appId: '1:123456:web:abcdef',
    measurementId: 'G-DEV123',
  });
}

assert.throws(
  () => resolveFirebaseClientConfig({ VITE_FIREBASE_PROJECT_ID: 'partial-only' }),
  /Incomplete Firebase client environment configuration/,
);
assert.throws(
  () => resolveFirebaseClientConfig({ VITE_FIREBASE_MEASUREMENT_ID: 'G-ONLY' }),
  /Incomplete Firebase client environment configuration/,
);

{
  const resolution = resolveFirebaseAdminProjectId({
    FIREBASE_PROJECT_ID: 'lumina-dev',
    VERCEL_ENV: 'preview',
  });
  assert.deepEqual(resolution, { projectId: 'lumina-dev', source: 'environment' });
}

assert.throws(
  () => resolveFirebaseAdminProjectId({ VERCEL_ENV: 'preview' }),
  /FIREBASE_PROJECT_ID must be explicitly configured/,
);
assert.throws(
  () => resolveFirebaseAdminProjectId({
    FIREBASE_PROJECT_ID: LEGACY_PRODUCTION_FIREBASE_PROJECT_ID,
    VERCEL_ENV: 'preview',
  }),
  /Production Firebase project is blocked/,
);
assert.throws(
  () => resolveFirebaseAdminProjectId({ NODE_ENV: 'development' }),
  /FIREBASE_PROJECT_ID must be explicitly configured/,
);
assert.equal(
  resolveFirebaseAdminProjectId({ VERCEL_ENV: 'production' }).projectId,
  LEGACY_PRODUCTION_FIREBASE_PROJECT_ID,
);
assert.equal(
  resolveFirebaseAdminProjectId({
    FIREBASE_PROJECT_ID: LEGACY_PRODUCTION_FIREBASE_PROJECT_ID,
    VERCEL_ENV: 'preview',
    FIREBASE_ALLOW_PRODUCTION_PROJECT_IN_NONPROD: 'true',
  }).projectId,
  LEGACY_PRODUCTION_FIREBASE_PROJECT_ID,
);

console.log('Firebase environment isolation tests passed');
