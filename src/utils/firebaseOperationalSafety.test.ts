import assert from 'node:assert/strict';
import fs from 'node:fs';

const firebaseJson = JSON.parse(fs.readFileSync('firebase.json', 'utf8'));
const firebaseClient = fs.readFileSync('src/lib/firebase.ts', 'utf8');
const firebaseConfig = fs.readFileSync('src/lib/firebaseConfig.ts', 'utf8');
const envExample = fs.readFileSync('.env.example', 'utf8');
const runbook = fs.readFileSync('docs/firebase-operations.md', 'utf8');

assert.equal(firebaseJson.firestore.database, '(default)');
assert.equal(firebaseJson.firestore.rules, 'firestore.rules');
assert.equal('databaseId' in firebaseJson.firestore, false, 'firebase.json must use the supported database key');

assert.match(firebaseClient, /getFirestore\(app\)/, 'production client must continue using the default Firestore database');
assert.match(firebaseClient, /resolveFirebaseConfig\(viteEnv\)/);
assert.match(firebaseConfig, /projectId: 'stock-analyze-a89d0'/, 'legacy production project must remain the fallback');
assert.match(firebaseConfig, /Incomplete Firebase client configuration/);

assert.match(envExample, /FIREBASE_PROJECT_ID=stock-analyze-a89d0/);
assert.match(envExample, /VITE_FIREBASE_PROJECT_ID/);
assert.match(runbook, /firebase deploy --only firestore:rules --project stock-analyze-a89d0/);
assert.match(runbook, /Do not create a database as part of a rules deployment/);
assert.match(runbook, /\[skip ci\]/);

console.log('Firebase operational safety boundary checks passed');
