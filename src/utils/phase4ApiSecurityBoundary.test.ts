import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');

assert.ok(server.includes("express.json({ limit: '1mb' })"), 'global JSON body limit must be reduced to 1MB');
assert.ok(
  server.includes('app.post("/api/upload_artifact", requireFirebaseAuth, express.raw'),
  'artifact upload must require Firebase authentication',
);
assert.ok(
  server.includes('app.get("/api/download_jsonl", requireFirebaseAuth,'),
  'JSONL download must require Firebase authentication',
);
assert.ok(server.includes('safeArtifactFilename(req.query.name)'), 'artifact filename must be validated before filesystem use');
assert.ok(server.includes("path.join('/tmp', 'artifacts')"), 'Vercel artifact writes must use writable /tmp');
assert.ok(server.includes('normalizeTicker(req.query.ticker)'), 'JSONL ticker must be canonicalized before file lookup');
assert.ok(server.includes('normalizeAnalysisType(body.analysisType)'), 'Analyze type must be normalized before prompt construction');
assert.ok(server.includes('normalizeAnalysisLanguage(body.language)'), 'Analyze language must be normalized before prompt construction');
assert.ok(server.includes('normalizeGeminiModel(body.model)'), 'Analyze model must be normalized before provider invocation');
assert.ok(server.includes('normalizeOptionalText(body.instruction, 4000)'), 'Analyze instruction must have a bounded length');
assert.ok(app.includes('authenticatedFetch(evt.jsonlLogUrl)'), 'optional JSONL download must attach Firebase auth');

console.log('Phase 4C API security boundary source checks passed');
