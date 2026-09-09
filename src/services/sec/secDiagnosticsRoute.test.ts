import assert from 'node:assert/strict';
import fs from 'node:fs';

const apiIndex = fs.readFileSync('api/index.js', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const handler = fs.readFileSync('server/secPreviewHandler.ts', 'utf8');

assert.match(apiIndex, /secConfigured:\s*Boolean\(process\.env\.SEC_USER_AGENT/);
assert.match(apiIndex, /\/api\/sec-preview/);
assert.match(apiIndex, /dist\/sec-preview\.cjs/);
assert.match(packageJson.scripts.build, /server\/secPreviewHandler\.ts/);
assert.match(packageJson.scripts.build, /dist\/sec-preview\.cjs/);
assert.match(handler, /SEC_USER_AGENT_MISSING/);
assert.match(handler, /fetchSecVerifiedIntegrationPackage/);
assert.doesNotMatch(handler, /GEMINI_API_KEY/);

console.log('SEC diagnostics route wiring checks passed');
