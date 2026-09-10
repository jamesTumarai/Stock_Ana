import assert from 'node:assert/strict';
import {
  LEGACY_PRODUCTION_FIREBASE_CONFIG,
  resolveFirebaseConfig,
} from './firebaseConfig.ts';

{
  const config = resolveFirebaseConfig({});
  assert.equal(config.projectId, 'stock-analyze-a89d0');
  assert.deepEqual(config, LEGACY_PRODUCTION_FIREBASE_CONFIG);
  assert.notEqual(config, LEGACY_PRODUCTION_FIREBASE_CONFIG, 'resolver should return a copy');
}

{
  const config = resolveFirebaseConfig({
    VITE_FIREBASE_API_KEY: 'dev-api-key',
    VITE_FIREBASE_AUTH_DOMAIN: 'lumina-dev.firebaseapp.com',
    VITE_FIREBASE_PROJECT_ID: 'lumina-dev',
    VITE_FIREBASE_STORAGE_BUCKET: 'lumina-dev.firebasestorage.app',
    VITE_FIREBASE_MESSAGING_SENDER_ID: '123456',
    VITE_FIREBASE_APP_ID: '1:123456:web:abcdef',
    VITE_FIREBASE_MEASUREMENT_ID: 'G-DEV123',
  });

  assert.deepEqual(config, {
    apiKey: 'dev-api-key',
    authDomain: 'lumina-dev.firebaseapp.com',
    projectId: 'lumina-dev',
    storageBucket: 'lumina-dev.firebasestorage.app',
    messagingSenderId: '123456',
    appId: '1:123456:web:abcdef',
    measurementId: 'G-DEV123',
  });
}

{
  assert.throws(
    () => resolveFirebaseConfig({ VITE_FIREBASE_PROJECT_ID: 'lumina-dev' }),
    /Incomplete Firebase client configuration/,
  );
}

{
  assert.throws(
    () => resolveFirebaseConfig({ VITE_FIREBASE_MEASUREMENT_ID: 'G-ONLY' }),
    /Incomplete Firebase client configuration/,
  );
}

console.log('Firebase client configuration tests passed');
