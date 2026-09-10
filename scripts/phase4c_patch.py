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
    'import { createUserConcurrencyLimiter, createUserRateLimiter } from "./server/middleware/userRateLimit.ts";\n',
    'import { createUserConcurrencyLimiter, createUserRateLimiter } from "./server/middleware/userRateLimit.ts";\nimport {\n  normalizeAnalysisLanguage,\n  normalizeAnalysisType,\n  normalizeBoolean,\n  normalizeGeminiModel,\n  normalizeOptionalText,\n  normalizeTicker,\n  safeArtifactFilename,\n} from "./server/security/requestSecurity.ts";\n',
)

replace_once(
    'server.ts',
    "  app.use(express.json({ limit: '50mb' }));\n\n  app.post(\"/api/tts\", requireFirebaseAuth, ttsRateLimit, async (req, res) => {\n    try {\n      const { text } = req.body;\n      if (!text) {\n        return res.status(400).json({ error: \"Missing text.\" });\n      }",
    "  app.use(express.json({ limit: '1mb' }));\n  app.use((error: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {\n    if (error?.type === 'entity.too.large') {\n      return res.status(413).json({ code: 'PAYLOAD_TOO_LARGE', error: 'Request payload is too large.' });\n    }\n    if (error instanceof SyntaxError && 'body' in error) {\n      return res.status(400).json({ code: 'INVALID_JSON', error: 'Request body must contain valid JSON.' });\n    }\n    return next(error);\n  });\n\n  app.post(\"/api/tts\", requireFirebaseAuth, ttsRateLimit, async (req, res) => {\n    try {\n      const rawText = req.body?.text;\n      if (typeof rawText !== 'string' || !rawText.trim()) {\n        return res.status(400).json({ error: \"Missing text.\" });\n      }\n      const text = rawText.trim();\n      if (text.length > 8_000) {\n        return res.status(400).json({ code: 'TTS_TEXT_TOO_LONG', error: 'TTS text exceeds the 8,000 character limit.' });\n      }",
)

replace_once(
    'server.ts',
    '  app.post("/api/upload_artifact", express.raw({ type: \'*/*\', limit: \'50mb\' }), (req, res) => {\n    try {\n        const fileName = req.query.name || \'podcast_briefing.wav\';\n        const localArtifactsDir = path.join(process.cwd(), \'workspace\', \'artifacts\');\n        if (!fs.existsSync(localArtifactsDir)) {\n            fs.mkdirSync(localArtifactsDir, { recursive: true });\n        }\n        fs.writeFileSync(path.join(localArtifactsDir, fileName as string), req.body);\n        console.log(`[upload] Successfully saved ${fileName} (${req.body.length} bytes)`);\n        res.json({ success: true });\n    } catch (e) {\n        console.error("[upload] Error:", e);\n        res.status(500).json({ error: String(e) });\n    }\n  });',
    '  app.post("/api/upload_artifact", requireFirebaseAuth, express.raw({ type: \'*/*\', limit: \'20mb\' }), (req, res) => {\n    try {\n        const fileName = safeArtifactFilename(req.query.name);\n        if (!fileName) {\n          return res.status(400).json({ code: \'INVALID_ARTIFACT_NAME\', error: \'Artifact name must be a safe filename without path components.\' });\n        }\n        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {\n          return res.status(400).json({ code: \'EMPTY_ARTIFACT\', error: \'Artifact body is empty or invalid.\' });\n        }\n        const localArtifactsDir = process.env.VERCEL === \'1\'\n          ? path.join(\'/tmp\', \'artifacts\')\n          : path.join(process.cwd(), \'workspace\', \'artifacts\');\n        if (!fs.existsSync(localArtifactsDir)) {\n            fs.mkdirSync(localArtifactsDir, { recursive: true });\n        }\n        const artifactPath = path.join(localArtifactsDir, fileName);\n        if (path.dirname(artifactPath) !== localArtifactsDir) {\n          return res.status(400).json({ code: \'INVALID_ARTIFACT_PATH\', error: \'Invalid artifact path.\' });\n        }\n        fs.writeFileSync(artifactPath, req.body);\n        console.log(`[upload] Saved artifact ${fileName} (${req.body.length} bytes)`);\n        return res.json({ success: true });\n    } catch (e: any) {\n        console.error("[upload] Error:", e?.message || \'artifact write failed\');\n        return res.status(500).json({ error: \'Artifact upload failed.\' });\n    }\n  });',
)

replace_once(
    'server.ts',
    '  app.get("/api/download_jsonl", (req, res) => {\n    const ticker = req.query.ticker;\n    if (!ticker) {\n      return res.status(400).send("Missing ticker");\n    }',
    '  app.get("/api/download_jsonl", requireFirebaseAuth, (req, res) => {\n    const ticker = normalizeTicker(req.query.ticker);\n    if (!ticker) {\n      return res.status(400).send("Missing or invalid ticker");\n    }',
)

old_analyze = '''      const { ticker, instruction, origin, model, language, analysisType, useSelfConsistency } = req.body;\n      if (!ticker) {\n        return res.status(400).json({ error: "Missing ticker." });\n      }'''
new_analyze = '''      const body = req.body || {};\n      const ticker = normalizeTicker(body.ticker);\n      const instruction = normalizeOptionalText(body.instruction, 4000);\n      const model = normalizeGeminiModel(body.model);\n      const language = normalizeAnalysisLanguage(body.language);\n      const analysisType = normalizeAnalysisType(body.analysisType);\n      const useSelfConsistency = normalizeBoolean(body.useSelfConsistency, false);\n      if (!ticker || instruction === null || !model || !language || !analysisType || useSelfConsistency === null) {\n        return res.status(400).json({\n          code: 'INVALID_ANALYZE_REQUEST',\n          error: 'Invalid ticker, model, language, analysis type, instruction, or self-consistency setting.',\n        });\n      }'''
replace_once('server.ts', old_analyze, new_analyze)

replace_once(
    'server.ts',
    "      const host = req.get('host');\n      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';\n      const publicUrl = origin || `${protocol}://${host}`;\n\n",
    '',
)

replace_once(
    'server.ts',
    "          res.write(`data: ${JSON.stringify({ type: 'final_stats', duration: totalDurationSecs, tokens: totalTokens, jsonlLogUrl: '/run_logs/' + `run_log_${ticker}_${runId}.jsonl` })}\\n\\n`);",
    "          res.write(`data: ${JSON.stringify({ type: 'final_stats', duration: totalDurationSecs, tokens: totalTokens })}\\n\\n`);",
)

replace_once(
    'server.ts',
    "  app.use('/artifacts', express.static(path.join(process.cwd(), 'workspace', 'artifacts')));\n  app.use('/run_logs', express.static(path.join(process.cwd(), 'run_logs')));\n  app.use('/latest_log', express.static(process.cwd()));\n",
    '',
)

replace_once(
    'src/App.tsx',
    '                      fetch(evt.jsonlLogUrl)\n',
    '                      authenticatedFetch(evt.jsonlLogUrl)\n',
)
