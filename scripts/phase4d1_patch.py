from pathlib import Path

SERVER = Path('server.ts')
text = SERVER.read_text()


def block(start: str, end: str) -> str:
    i = text.find(start)
    if i < 0:
        raise SystemExit(f'missing start marker: {start}')
    j = text.find(end, i)
    if j < 0:
        raise SystemExit(f'missing end marker after {start}: {end}')
    return text[i:j]


def replace_once(source: str, old: str, new: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'expected one match, found {count}: {old[:120]!r}')
    return source.replace(old, new, 1)


tts_start = '  app.post("/api/tts", requireFirebaseAuth, ttsRateLimit, async (req, res) => {'
metric_comment = '  // In-memory cache for Live AI Financial Analyst row insights\n'
dcf_start = '  app.post("/api/dcf-assumptions", requireFirebaseAuth, dcfAssumptionRateLimit, async (req, res) => {'
file_start = '  app.post("/api/upload_artifact", requireFirebaseAuth, express.raw({ type: \'*/*\', limit: \'20mb\' }), (req, res) => {'
market_start = '  app.get("/api/live-quotes", async (req, res) => {'
analyze_start = '  app.post("/api/analyze", requireFirebaseAuth, analyzeRateLimit, analyzeConcurrencyLimit, async (req, res) => {'

tts = block(tts_start, metric_comment)
metric = block(metric_comment, dcf_start)
dcf = block(dcf_start, file_start)
files = block(file_start, market_start)
market = block(market_start, analyze_start)

routes_dir = Path('server/routes')
routes_dir.mkdir(parents=True, exist_ok=True)

(routes_dir / 'ttsRoutes.ts').write_text(
    '''import type { Express, RequestHandler } from 'express';\nimport { GoogleGenAI } from '@google/genai';\n\nexport function registerTtsRoutes(\n  app: Express,\n  requireFirebaseAuth: RequestHandler,\n  ttsRateLimit: RequestHandler,\n) {\n''' + tts + '}\n'
)

(routes_dir / 'metricRoutes.ts').write_text(
    '''import type { Express, RequestHandler } from 'express';\nimport { GoogleGenAI } from '@google/genai';\n\nexport function registerMetricRoutes(\n  app: Express,\n  requireFirebaseAuth: RequestHandler,\n  metricRateLimit: RequestHandler,\n) {\n''' + metric + '}\n'
)

(routes_dir / 'dcfRoutes.ts').write_text(
    '''import type { Express, RequestHandler } from 'express';\nimport { GoogleGenAI } from '@google/genai';\nimport { validateDcfAssumptionModel } from '../../src/utils/valuation/dcfAssumptionProposal.ts';\n\nexport function registerDcfRoutes(\n  app: Express,\n  requireFirebaseAuth: RequestHandler,\n  dcfAssumptionRateLimit: RequestHandler,\n) {\n''' + dcf + '}\n'
)

(routes_dir / 'fileRoutes.ts').write_text(
    '''import express, { type Express, type RequestHandler } from 'express';\nimport fs from 'fs';\nimport path from 'path';\nimport { normalizeTicker, safeArtifactFilename } from '../security/requestSecurity.ts';\n\nexport function registerFileRoutes(\n  app: Express,\n  requireFirebaseAuth: RequestHandler,\n) {\n''' + files + '}\n'
)

(routes_dir / 'marketRoutes.ts').write_text(
    '''import type { Express } from 'express';\n\nexport function registerMarketRoutes(app: Express) {\n''' + market + '}\n'
)

for moved in (tts, metric, dcf, files, market):
    text = replace_once(text, moved, '')

text = replace_once(text, 'import { GoogleGenAI } from "@google/genai";\n', '')
text = replace_once(text, 'import { validateDcfAssumptionModel } from "./src/utils/valuation/dcfAssumptionProposal.ts";\n', '')
text = replace_once(text, '  safeArtifactFilename,\n', '')

security_import_end = '} from "./server/security/requestSecurity.ts";\n'
route_imports = '''} from "./server/security/requestSecurity.ts";\nimport { registerTtsRoutes } from "./server/routes/ttsRoutes.ts";\nimport { registerMetricRoutes } from "./server/routes/metricRoutes.ts";\nimport { registerDcfRoutes } from "./server/routes/dcfRoutes.ts";\nimport { registerFileRoutes } from "./server/routes/fileRoutes.ts";\nimport { registerMarketRoutes } from "./server/routes/marketRoutes.ts";\n'''
text = replace_once(text, security_import_end, route_imports)

anchor = "  app.use((error: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {\n"
start = text.find(anchor)
if start < 0:
    raise SystemExit('JSON error middleware anchor missing')
end_marker = "    return next(error);\n  });\n"
end = text.find(end_marker, start)
if end < 0:
    raise SystemExit('JSON error middleware end missing')
insert_at = end + len(end_marker)
registrations = '''\n\n  registerTtsRoutes(app, requireFirebaseAuth, ttsRateLimit);\n  registerMetricRoutes(app, requireFirebaseAuth, metricRateLimit);\n  registerDcfRoutes(app, requireFirebaseAuth, dcfAssumptionRateLimit);\n  registerFileRoutes(app, requireFirebaseAuth);\n  registerMarketRoutes(app);\n'''
text = text[:insert_at] + registrations + text[insert_at:]

SERVER.write_text(text)

Path('src/utils/serverRouteModularization.test.ts').write_text(r'''import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const movedRoutes = [
  ['/api/tts', 'server/routes/ttsRoutes.ts'],
  ['/api/analyze-metric', 'server/routes/metricRoutes.ts'],
  ['/api/dcf-assumptions', 'server/routes/dcfRoutes.ts'],
  ['/api/upload_artifact', 'server/routes/fileRoutes.ts'],
  ['/api/download_jsonl', 'server/routes/fileRoutes.ts'],
  ['/api/live-quotes', 'server/routes/marketRoutes.ts'],
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
assert.ok(server.includes('app.post("/api/analyze"'), 'Analyze stays in server.ts for Phase 4D1');
console.log('server route modularization tests passed');
''')

dcf_boundary = Path('src/utils/dcfAssumptionBoundary.test.ts')
dcf_text = dcf_boundary.read_text()
dcf_text = replace_once(
    dcf_text,
    "const serverSource = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');\n\nassert.match(serverSource, /app\\.post\\(\"\\/api\\/dcf-assumptions\"/);\nassert.match(serverSource, /validateDcfAssumptionModel\\(parsed\\)/);\nassert.match(serverSource, /fair_value_per_share MUST be null/);",
    "const dcfRouteSource = fs.readFileSync(path.join(root, 'server/routes/dcfRoutes.ts'), 'utf8');\n\nassert.match(dcfRouteSource, /app\\.post\\(\"\\/api\\/dcf-assumptions\"/);\nassert.match(dcfRouteSource, /requireFirebaseAuth, dcfAssumptionRateLimit/);\nassert.match(dcfRouteSource, /validateDcfAssumptionModel\\(parsed\\)/);\nassert.match(dcfRouteSource, /fair_value_per_share MUST be null/);",
)
dcf_boundary.write_text(dcf_text)

Path('src/utils/phase4ApiSecurityBoundary.test.ts').write_text(r'''import assert from 'node:assert/strict';
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
assert.ok(fileRoutes.includes('path.dirname(artifactPath) !== localArtifactsDir'), 'artifact path must remain confined to the artifact directory');
assert.ok(fileRoutes.includes('normalizeTicker(req.query.ticker)'), 'JSONL ticker must be canonicalized before file lookup');
assert.ok(server.includes('normalizeAnalysisType(body.analysisType)'), 'Analyze type must be normalized before prompt construction');
assert.ok(server.includes('normalizeAnalysisLanguage(body.language)'), 'Analyze language must be normalized before prompt construction');
assert.ok(server.includes('normalizeGeminiModel(body.model)'), 'Analyze model must be normalized before provider invocation');
assert.ok(server.includes('normalizeOptionalText(body.instruction, 4000)'), 'Analyze instruction must have a bounded length');
assert.equal(server.includes("app.use('/run_logs'"), false, 'raw run logs must not be publicly mounted');
assert.equal(server.includes("app.use('/latest_log'"), false, 'project root must not be publicly mounted');
assert.ok(app.includes('authenticatedFetch(evt.jsonlLogUrl)'), 'optional JSONL download must attach Firebase auth');

console.log('Phase 4C API security boundary source checks passed');
''')
