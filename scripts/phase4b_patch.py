from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}: {old!r}")
    p.write_text(text.replace(old, new, 1))

replace_once(
    'server.ts',
    'import { createRequireFirebaseAuth } from "./server/auth/firebaseAuth.ts";\n',
    'import { createRequireFirebaseAuth } from "./server/auth/firebaseAuth.ts";\nimport { createUserConcurrencyLimiter, createUserRateLimiter } from "./server/middleware/userRateLimit.ts";\n',
)

replace_once(
    'server.ts',
    "  const requireFirebaseAuth = createRequireFirebaseAuth();\n\n  app.use(express.json({ limit: '50mb' }));",
    "  const requireFirebaseAuth = createRequireFirebaseAuth();\n  const rateWindowMs = 15 * 60 * 1000;\n  const analyzeRateLimit = createUserRateLimiter({ scope: 'analyze', limit: 8, windowMs: rateWindowMs });\n  const analyzeConcurrencyLimit = createUserConcurrencyLimiter({ scope: 'analyze', maxConcurrent: 1 });\n  const dcfAssumptionRateLimit = createUserRateLimiter({ scope: 'dcf-assumptions', limit: 16, windowMs: rateWindowMs });\n  const metricRateLimit = createUserRateLimiter({ scope: 'analyze-metric', limit: 60, windowMs: rateWindowMs });\n  const ttsRateLimit = createUserRateLimiter({ scope: 'tts', limit: 30, windowMs: rateWindowMs });\n\n  app.use(express.json({ limit: '50mb' }));",
)

replacements = {
    '  app.post("/api/tts", requireFirebaseAuth, async (req, res) => {':
        '  app.post("/api/tts", requireFirebaseAuth, ttsRateLimit, async (req, res) => {',
    '  app.post("/api/analyze-metric", requireFirebaseAuth, async (req, res) => {':
        '  app.post("/api/analyze-metric", requireFirebaseAuth, metricRateLimit, async (req, res) => {',
    '  app.post("/api/dcf-assumptions", requireFirebaseAuth, async (req, res) => {':
        '  app.post("/api/dcf-assumptions", requireFirebaseAuth, dcfAssumptionRateLimit, async (req, res) => {',
    '  app.post("/api/analyze", requireFirebaseAuth, async (req, res) => {':
        '  app.post("/api/analyze", requireFirebaseAuth, analyzeRateLimit, analyzeConcurrencyLimit, async (req, res) => {',
}
for old, new in replacements.items():
    replace_once('server.ts', old, new)

p = Path('.env.example')
text = p.read_text()
if 'Rate limits are currently enforced' not in text:
    text += "\n# AI API abuse controls are enforced per authenticated Firebase UID on each running server instance.\n# Phase 4B defaults: Analyze 8/15m with 1 concurrent run; DCF assumptions 16/15m; metric insights 60/15m; TTS 30/15m.\n"
    p.write_text(text)
