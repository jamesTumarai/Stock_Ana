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

        const callerUid = (req as any).auth?.uid || (req as any).user?.uid;
        const safeUid = callerUid ? String(callerUid).replace(/[^a-zA-Z0-9_-]/g, '') : null;
        if (!safeUid) {
          return res.status(401).json({ code: 'UNAUTHORIZED_CALLER', error: 'Authenticated caller UID is required for artifact upload.' });
        }

        const localArtifactsDir = process.env.VERCEL === '1'
          ? path.join('/tmp', 'artifacts')
          : path.join(process.cwd(), 'workspace', 'artifacts');

        // Scope artifact storage by user UID to prevent cross-user overwrites and data leaks
        const userArtifactsDir = path.join(localArtifactsDir, safeUid);
        if (!fs.existsSync(userArtifactsDir)) {
            fs.mkdirSync(userArtifactsDir, { recursive: true });
        }
        const artifactPath = path.join(userArtifactsDir, fileName);
        if (path.dirname(artifactPath) !== userArtifactsDir) {
          return res.status(400).json({ code: 'INVALID_ARTIFACT_PATH', error: 'Invalid artifact path.' });
        }
        fs.writeFileSync(artifactPath, req.body);
        console.log(`[upload] Saved artifact ${fileName} for user ${safeUid} (${req.body.length} bytes)`);
        return res.json({ success: true, fileName });
    } catch (e: any) {
        console.error("[upload] Error:", e?.message || 'artifact write failed');
        return res.status(500).json({ error: 'Artifact upload failed.' });
    }
  });

  app.get("/api/download_jsonl", requireFirebaseAuth, (req, res) => {
    // Security Boundary: Raw JSONL log download is disabled in production unless explicitly authorized
    const isExplicitlyEnabled = process.env.ENABLE_RAW_LOG_DOWNLOAD === 'true';
    if (process.env.NODE_ENV === 'production' && !isExplicitlyEnabled) {
      return res.status(403).json({
        code: 'LOG_DOWNLOAD_DISABLED',
        error: 'Raw log download is disabled in production for security and privacy.',
      });
    }

    const callerUid = (req as any).auth?.uid || (req as any).user?.uid;
    const safeUid = callerUid ? String(callerUid).replace(/[^a-zA-Z0-9_-]/g, '') : null;
    if (!safeUid) {
      return res.status(401).json({ code: 'UNAUTHORIZED', error: 'Authenticated caller UID is required.' });
    }

    // Reject ticker-only requests to prevent cross-user interaction log leakage
    const ticker = normalizeTicker(req.query.ticker);
    const rawRunId = req.query.runId ? String(req.query.runId) : null;
    const safeRunId = rawRunId ? rawRunId.replace(/[^a-zA-Z0-9_-]/g, '') : null;

    if (!safeRunId) {
      return res.status(400).json({
        code: 'RUN_ID_REQUIRED',
        error: 'Download by ticker alone is prohibited to prevent cross-user data leakage. Specific owned runId is required.',
      });
    }

    const runLogsDir = process.env.VERCEL === '1' ? path.join('/tmp', 'run_logs') : path.join(process.cwd(), 'run_logs');
    if (!fs.existsSync(runLogsDir)) {
      return res.status(404).json({ code: 'NO_LOGS_FOUND', error: 'No logs found.' });
    }

    // Strictly authorize by owner UID prefix
    const ownedLogFilename = `run_log_${safeUid}_${safeRunId}.jsonl`;
    const ownedLogPath = path.join(runLogsDir, ownedLogFilename);

    if (fs.existsSync(ownedLogPath)) {
      if (path.dirname(ownedLogPath) !== runLogsDir) {
        return res.status(400).json({ code: 'INVALID_LOG_PATH', error: 'Invalid log path.' });
      }
      return res.download(ownedLogPath);
    }

    // Check if another user owns this runId
    const otherUserLog = fs.readdirSync(runLogsDir).find(f => f.endsWith(`_${safeRunId}.jsonl`) && f.startsWith('run_log_'));
    if (otherUserLog) {
      return res.status(403).json({
        code: 'FORBIDDEN_RUN_ACCESS',
        error: 'You are not authorized to download this run log.',
      });
    }

    return res.status(404).json({ code: 'LOG_NOT_FOUND', error: 'Run log not found for this runId.' });
  });
}
