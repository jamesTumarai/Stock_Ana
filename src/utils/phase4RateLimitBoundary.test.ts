import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const ttsRoute = fs.readFileSync('server/routes/ttsRoutes.ts', 'utf8');
const metricRoute = fs.readFileSync('server/routes/metricRoutes.ts', 'utf8');
const dcfRoute = fs.readFileSync('server/routes/dcfRoutes.ts', 'utf8');

assert.ok(server.includes('createUserRateLimiter'), 'server must create authenticated user rate limiters');
assert.ok(server.includes('createUserConcurrencyLimiter'), 'server must create Analyze concurrency limiter');
assert.ok(
  server.includes('app.post("/api/analyze", requireFirebaseAuth, analyzeRateLimit, analyzeConcurrencyLimit,'),
  'Analyze must authenticate before rate/concurrency limiting',
);
assert.ok(
  dcfRoute.includes('app.post("/api/dcf-assumptions", requireFirebaseAuth, dcfAssumptionRateLimit,'),
  'DCF assumption endpoint must be user-rate-limited',
);
assert.ok(
  metricRoute.includes('app.post("/api/analyze-metric", requireFirebaseAuth, metricRateLimit,'),
  'Metric endpoint must be user-rate-limited',
);
assert.ok(
  ttsRoute.includes('app.post("/api/tts", requireFirebaseAuth, ttsRateLimit,'),
  'TTS endpoint must be user-rate-limited',
);
assert.ok(server.includes('registerDcfRoutes(app, requireFirebaseAuth, dcfAssumptionRateLimit);'));
assert.ok(server.includes('registerMetricRoutes(app, requireFirebaseAuth, metricRateLimit);'));
assert.ok(server.includes('registerTtsRoutes(app, requireFirebaseAuth, ttsRateLimit);'));

console.log('Phase 4B rate-limit boundary source checks passed');
