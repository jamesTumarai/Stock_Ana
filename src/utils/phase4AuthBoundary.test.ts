import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const ttsRoute = fs.readFileSync('server/routes/ttsRoutes.ts', 'utf8');
const metricRoute = fs.readFileSync('server/routes/metricRoutes.ts', 'utf8');
const dcfRoute = fs.readFileSync('server/routes/dcfRoutes.ts', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const dcf = fs.readFileSync('src/services/dcfAssumptionService.ts', 'utf8');
const statements = fs.readFileSync('src/components/FinancialStatementsTable.tsx', 'utf8');
const metricClient = fs.readFileSync('src/services/metricAiClient.ts', 'utf8');

assert.ok(
  server.includes('app.post("/api/analyze", requireFirebaseAuth,'),
  '/api/analyze must require verified Firebase auth',
);
assert.ok(
  ttsRoute.includes('app.post("/api/tts", requireFirebaseAuth,'),
  '/api/tts must require verified Firebase auth',
);
assert.ok(
  metricRoute.includes('app.post("/api/analyze-metric", requireFirebaseAuth,'),
  '/api/analyze-metric must require verified Firebase auth',
);
assert.ok(
  dcfRoute.includes('app.post("/api/dcf-assumptions", requireFirebaseAuth,'),
  '/api/dcf-assumptions must require verified Firebase auth',
);

assert.ok(server.includes('registerTtsRoutes(app, requireFirebaseAuth, ttsRateLimit);'));
assert.ok(server.includes('registerMetricRoutes(app, requireFirebaseAuth, metricRateLimit);'));
assert.ok(server.includes('registerDcfRoutes(app, requireFirebaseAuth, dcfAssumptionRateLimit);'));
assert.ok(app.includes("authenticatedFetch('/api/analyze'"), 'Analyze client call must send Firebase ID token');
assert.ok(dcf.includes("authenticatedFetch('/api/dcf-assumptions'"), 'DCF assumption call must send Firebase ID token');
assert.ok(statements.includes('fetcher: authenticatedFetch') && metricClient.includes("options.fetcher('/api/analyze-metric'"), 'Metric insight adapter must use the authenticated Firebase fetcher');
assert.ok(app.includes('if (!user) {'), 'Analyze UI must block unauthenticated execution before API work starts');

console.log('Phase 4A auth boundary source checks passed');
