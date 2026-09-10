import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const dcf = fs.readFileSync('src/services/dcfAssumptionService.ts', 'utf8');
const statements = fs.readFileSync('src/components/FinancialStatementsTable.tsx', 'utf8');

for (const route of ['/api/tts', '/api/analyze-metric', '/api/dcf-assumptions', '/api/analyze']) {
  assert.ok(
    server.includes(`app.post("${route}", requireFirebaseAuth,`),
    `${route} must require verified Firebase auth`,
  );
}

assert.ok(app.includes("authenticatedFetch('/api/analyze'"), 'Analyze client call must send Firebase ID token');
assert.ok(dcf.includes("authenticatedFetch('/api/dcf-assumptions'"), 'DCF assumption call must send Firebase ID token');
assert.ok(statements.includes("authenticatedFetch('/api/analyze-metric'"), 'Metric insight call must send Firebase ID token');
assert.ok(app.includes('if (!user) {'), 'Analyze UI must block unauthenticated execution before API work starts');

console.log('Phase 4A auth boundary source checks passed');
