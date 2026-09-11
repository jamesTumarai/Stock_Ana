import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const movedRoutes = [
  ['/api/tts', 'server/routes/ttsRoutes.ts'],
  ['/api/analyze-metric', 'server/routes/metricRoutes.ts'],
  ['/api/dcf-assumptions', 'server/routes/dcfRoutes.ts'],
  ['/api/upload_artifact', 'server/routes/fileRoutes.ts'],
  ['/api/download_jsonl', 'server/routes/fileRoutes.ts'],
  ['/api/live-quotes', 'server/routes/marketRoutes.ts'],
  ['/api/sec-preview', 'server/routes/secRoutes.ts'],
  ['/api/sec-compare', 'server/routes/secRoutes.ts'],
] as const;

for (const [route, file] of movedRoutes) {
  assert.equal(server.includes(`app.post("${route}"`), false, `${route} POST must not remain in server.ts`);
  assert.equal(server.includes(`app.get("${route}"`), false, `${route} GET must not remain in server.ts`);
  assert.ok(fs.readFileSync(file, 'utf8').includes(route), `${route} must live in ${file}`);
}

assert.ok(server.includes('registerTtsRoutes(app, requireFirebaseAuth, ttsRateLimit);'));
assert.ok(server.includes('registerMetricRoutes(app, requireFirebaseAuth, metricRateLimit);'));
assert.ok(server.includes('registerDcfRoutes(app, requireFirebaseAuth, dcfAssumptionRateLimit);'));
assert.ok(server.includes('registerFileRoutes(app, requireFirebaseAuth);'));
assert.ok(server.includes('registerMarketRoutes(app);'));
assert.ok(server.includes('registerSecRoutes(app);'));
assert.ok(server.includes('app.post("/api/analyze"'), 'Analyze stays in server.ts for Phase 4D1');
console.log('server route modularization tests passed');
