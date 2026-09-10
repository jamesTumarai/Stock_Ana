import assert from 'node:assert/strict';
import fs from 'node:fs';

const firebaseJson = JSON.parse(fs.readFileSync('firebase.json', 'utf8'));
const firebaseClient = fs.readFileSync('src/lib/firebase.ts', 'utf8');
const firebaseConfig = fs.readFileSync('src/lib/firebaseConfig.ts', 'utf8');
const serverAuth = fs.readFileSync('server/auth/firebaseAuth.ts', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const envExample = fs.readFileSync('.env.example', 'utf8');
const runbook = fs.readFileSync('docs/firebase-operations.md', 'utf8');
const workflow = fs.readFileSync('.github/workflows/verify.yml', 'utf8');

assert.equal(firebaseJson.firestore.database, '(default)');
assert.equal(firebaseJson.firestore.rules, 'firestore.rules');
assert.equal('databaseId' in firebaseJson.firestore, false, 'firebase.json must use the supported database key');

assert.match(firebaseClient, /getFirestore\(app\)/, 'production client must continue using the default Firestore database');
assert.match(firebaseClient, /resolveFirebaseClientConfig\(viteEnv\)/);
assert.match(firebaseClient, /firebaseDataAccessAllowed/);
assert.match(firebaseConfig, /stock-analyze-a89d0/, 'legacy production project must remain the fallback');
assert.match(firebaseConfig, /Incomplete Firebase client environment configuration/);
assert.match(firebaseConfig, /KNOWN_PRODUCTION_HOSTS/);
assert.match(serverAuth, /resolveFirebaseAdminProjectId/);
assert.match(app, /if \(!firebaseDataAccessAllowed\)/);
assert.match(app, /if \(!user \|\| !firebaseDataAccessAllowed\) return;/);

assert.match(envExample, /FIREBASE_PROJECT_ID=stock-analyze-a89d0/);
assert.match(envExample, /VITE_FIREBASE_PROJECT_ID/);
assert.match(envExample, /VITE_FIREBASE_ALLOW_PRODUCTION_PROJECT=true/);
assert.match(envExample, /FIREBASE_ALLOW_PRODUCTION_PROJECT_IN_NONPROD=true/);
assert.match(runbook, /firebase deploy --only firestore:rules --project stock-analyze-a89d0/);
assert.match(runbook, /Do not create a database as part of a rules deployment/);
assert.match(runbook, /production Firebase project is blocked/);
assert.match(runbook, /branch protection or ruleset/i);
assert.match(runbook, /\[skip ci\]/);
assert.match(workflow, /node-version: 24/);

console.log('Firebase operational safety boundary checks passed');
