#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const EXPECTED_PROJECT_ID = 'stock-analyze-a89d0';
const EXPECTED_DATABASE = '(default)';
const EXPECTED_RULES_PATH = 'firestore.rules';

function fail(message) {
  console.error(`Firebase rules preflight failed: ${message}`);
  process.exit(1);
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) fail(`${name} requires a value`);
  return value;
}

const projectId = readArg('--project');
if (!projectId) fail('explicit --project is required');
if (projectId !== EXPECTED_PROJECT_ID) {
  fail(`refusing project ${projectId}; expected ${EXPECTED_PROJECT_ID}`);
}

const root = process.cwd();
const firebaseJsonPath = path.join(root, 'firebase.json');
if (!fs.existsSync(firebaseJsonPath)) fail('firebase.json is missing');

let firebaseJson;
try {
  firebaseJson = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf8'));
} catch (error) {
  fail(`firebase.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
}

const firestore = firebaseJson?.firestore;
if (!firestore || Array.isArray(firestore) || typeof firestore !== 'object') {
  fail('firebase.json must contain a single firestore object');
}
if (firestore.database !== EXPECTED_DATABASE) {
  fail(`firebase.json firestore.database must be ${EXPECTED_DATABASE}`);
}
if ('databaseId' in firestore) {
  fail('firebase.json must not use legacy/unsupported firestore.databaseId');
}
if (firestore.rules !== EXPECTED_RULES_PATH) {
  fail(`firebase.json firestore.rules must be ${EXPECTED_RULES_PATH}`);
}

const rulesPath = path.join(root, firestore.rules);
if (!fs.existsSync(rulesPath)) fail(`${firestore.rules} is missing`);
const rulesSource = fs.readFileSync(rulesPath, 'utf8');
if (!rulesSource.trim()) fail(`${firestore.rules} is empty`);
if (!/rules_version\s*=\s*['"]2['"]\s*;/.test(rulesSource)) {
  fail(`${firestore.rules} must declare rules_version = '2'`);
}
if (!/service\s+cloud\.firestore/.test(rulesSource)) {
  fail(`${firestore.rules} does not define a Cloud Firestore rules service`);
}

console.log(`Firebase rules preflight passed for ${EXPECTED_PROJECT_ID} / ${EXPECTED_DATABASE}`);
console.log(`Rules source: ${firestore.rules}`);
console.log('This validates the repository deployment target only; live Firebase identity still requires the runbook CLI checks before deploy.');
