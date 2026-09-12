import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const fileRoutes = fs.readFileSync('server/routes/fileRoutes.ts', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');

assert.ok(server.includes("express.json({ limit: '1mb' })"), 'global JSON body limit must remain 1MB');
assert.ok(
  fileRoutes.includes('app.post("/api/upload_artifact", requireFirebaseAuth, express.raw'),
  'artifact upload must require Firebase authentication',
);
assert.ok(
  fileRoutes.includes('app.get("/api/download_jsonl", requireFirebaseAuth,'),
  'JSONL download must require Firebase authentication',
);
assert.ok(fileRoutes.includes('safeArtifactFilename(req.query.name)'), 'artifact filename must be validated before filesystem use');
assert.ok(fileRoutes.includes("path.join('/tmp', 'artifacts')"), 'Vercel artifact writes must use writable /tmp');
assert.ok(fileRoutes.includes('path.dirname(artifactPath) !== userArtifactsDir'), 'artifact path must remain confined to the user artifact directory');
assert.ok(fileRoutes.includes('normalizeTicker(req.query.ticker)'), 'JSONL ticker must be canonicalized before file lookup');
assert.ok(server.includes('normalizeAnalysisType(body.analysisType)'), 'Analyze type must be normalized before prompt construction');
assert.ok(server.includes('normalizeAnalysisLanguage(body.language)'), 'Analyze language must be normalized before prompt construction');
assert.ok(server.includes('normalizeGeminiModel(body.model)'), 'Analyze model must be normalized before provider invocation');
assert.ok(server.includes('normalizeOptionalText(body.instruction, 4000)'), 'Analyze instruction must have a bounded length');
assert.equal(server.includes("app.use('/run_logs'"), false, 'raw run logs must not be publicly mounted');
assert.equal(server.includes("app.use('/latest_log'"), false, 'project root must not be publicly mounted');
assert.equal(app.includes('authenticatedFetch(evt.jsonlLogUrl)'), false, 'automatic raw JSONL download is retired from frontend');

console.log('Phase 4C API security boundary source checks passed');
