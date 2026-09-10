import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');

assert.ok(server.includes('createUserRateLimiter'), 'server must create authenticated user rate limiters');
assert.ok(server.includes('createUserConcurrencyLimiter'), 'server must create Analyze concurrency limiter');
assert.ok(
  server.includes('app.post("/api/analyze", requireFirebaseAuth, analyzeRateLimit, analyzeConcurrencyLimit,'),
  'Analyze must authenticate before rate/concurrency limiting',
);
assert.ok(
  server.includes('app.post("/api/dcf-assumptions", requireFirebaseAuth, dcfAssumptionRateLimit,'),
  'DCF assumption endpoint must be user-rate-limited',
);
assert.ok(
  server.includes('app.post("/api/analyze-metric", requireFirebaseAuth, metricRateLimit,'),
  'Metric endpoint must be user-rate-limited',
);
assert.ok(
  server.includes('app.post("/api/tts", requireFirebaseAuth, ttsRateLimit,'),
  'TTS endpoint must be user-rate-limited',
);

console.log('Phase 4B rate-limit boundary source checks passed');
