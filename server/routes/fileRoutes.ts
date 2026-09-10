import express, { type Express, type RequestHandler } from 'express';
import fs from 'fs';
import path from 'path';
import { normalizeTicker, safeArtifactFilename } from '../security/requestSecurity.ts';

export function registerFileRoutes(
  app: Express,
  requireFirebaseAuth: RequestHandler,
) {
  app.post("/api/upload_artifact", requireFirebaseAuth, express.raw({ type: '*/*', limit: '20mb' }), (req, res) => {
    try {
        const fileName = safeArtifactFilename(req.query.name);
        if (!fileName) {
          return res.status(400).json({ code: 'INVALID_ARTIFACT_NAME', error: 'Artifact name must be a safe filename without path components.' });
        }
        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
          return res.status(400).json({ code: 'EMPTY_ARTIFACT', error: 'Artifact body is empty or invalid.' });
        }
        const localArtifactsDir = process.env.VERCEL === '1'
          ? path.join('/tmp', 'artifacts')
          : path.join(process.cwd(), 'workspace', 'artifacts');
        if (!fs.existsSync(localArtifactsDir)) {
            fs.mkdirSync(localArtifactsDir, { recursive: true });
        }
        const artifactPath = path.join(localArtifactsDir, fileName);
        if (path.dirname(artifactPath) !== localArtifactsDir) {
          return res.status(400).json({ code: 'INVALID_ARTIFACT_PATH', error: 'Invalid artifact path.' });
        }
        fs.writeFileSync(artifactPath, req.body);
        console.log(`[upload] Saved artifact ${fileName} (${req.body.length} bytes)`);
        return res.json({ success: true });
    } catch (e: any) {
        console.error("[upload] Error:", e?.message || 'artifact write failed');
        return res.status(500).json({ error: 'Artifact upload failed.' });
    }
  });

  app.get("/api/download_jsonl", requireFirebaseAuth, (req, res) => {
    const ticker = normalizeTicker(req.query.ticker);
    if (!ticker) {
      return res.status(400).send("Missing or invalid ticker");
    }

    const runLogsDir = process.env.VERCEL === '1' ? path.join('/tmp', 'run_logs') : path.join(process.cwd(), 'run_logs');
    if (!fs.existsSync(runLogsDir)) {
      return res.status(404).send("No logs found");
    }

    const files = fs.readdirSync(runLogsDir)
      .filter(f => f.startsWith(`run_log_${ticker}_`) && f.endsWith('.jsonl'))
      .sort((a, b) => {
        // extract timestamp
        const aMatch = a.match(/_(\d+)\.jsonl$/);
        const bMatch = b.match(/_(\d+)\.jsonl$/);
        if (aMatch && bMatch) {
          return parseInt(bMatch[1]) - parseInt(aMatch[1]);
        }
        return 0;
      });

    if (files.length === 0) {
      return res.status(404).send("No JSONL log found for ticker");
    }

    const latestFile = path.join(runLogsDir, files[0]);
    res.download(latestFile);
  });

}
