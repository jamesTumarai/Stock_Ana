import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
// Statically import core server dependencies so Vercel NFT bundles them into the lambda
import 'dotenv';
import 'dotenv/config';
import 'express';
import 'firebase-admin/app';
import 'firebase-admin/auth';
import '@google/genai';

const require = createRequire(import.meta.url);
let appPromise;
let secPreviewHandler;
let secCompareHandler;
let secDiffHandler;
let healthHandler;
let liveQuotesHandler;
let materialEventsHandler;

function loadModule(distPath, srcPath, requiredExport) {
  let primaryErr = null;
  try {
    const mod = require(distPath);
    if (!requiredExport || mod[requiredExport]) {
      return mod;
    }
  } catch (err) {
    primaryErr = err;
  }

  try {
    const cwdDistPath = path.resolve(process.cwd(), 'dist', path.basename(distPath));
    if (fs.existsSync(cwdDistPath)) {
      const mod = require(cwdDistPath);
      if (!requiredExport || mod[requiredExport]) {
        return mod;
      }
    }
  } catch {
    // continue
  }

  if (process.env.NODE_ENV !== 'production' && srcPath) {
    try {
      return require(srcPath);
    } catch {
      // ignore
    }
  }

  console.error(`[api/index] Failed to load module ${distPath} (requiredExport: ${requiredExport}):`, primaryErr);
  if (primaryErr) throw primaryErr;
  throw new Error(`Module ${distPath} does not export ${requiredExport}`);
}

export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  if ((req.url || '').startsWith('/api/health')) {
    if (!healthHandler) {
      ({ handleHealthCheck: healthHandler } = loadModule('../dist/sec-preview.cjs', '../server/routes/healthRoutes.ts', 'handleHealthCheck'));
    }
    return healthHandler(req, res);
  }

  if ((req.url || '').startsWith('/api/live-quotes')) {
    if (!liveQuotesHandler) {
      ({ handleLiveQuotes: liveQuotesHandler } = loadModule('../dist/sec-preview.cjs', '../server/routes/marketRoutes.ts', 'handleLiveQuotes'));
    }
    return liveQuotesHandler(req, res);
  }

  if ((req.url || '').startsWith('/api/sec-preview')) {
    if (!secPreviewHandler) {
      ({ handleSecPreview: secPreviewHandler } = loadModule('../dist/sec-preview.cjs', '../server/secPreviewHandler.ts', 'handleSecPreview'));
    }
    return secPreviewHandler(req, res);
  }

  if ((req.url || '').startsWith('/api/sec-compare')) {
    if (!secCompareHandler) {
      ({ handleSecCompare: secCompareHandler } = loadModule('../dist/sec-preview.cjs', '../server/secPreviewHandler.ts', 'handleSecCompare'));
    }
    return secCompareHandler(req, res);
  }

  if ((req.url || '').startsWith('/api/sec-diff')) {
    if (!secDiffHandler) {
      ({ handleSecDiff: secDiffHandler } = loadModule('../dist/sec-preview.cjs', '../server/secPreviewHandler.ts', 'handleSecDiff'));
    }
    return secDiffHandler(req, res);
  }

  if ((req.url || '').startsWith('/api/material-events')) {
    if (!materialEventsHandler) {
      ({ handleMaterialEvents: materialEventsHandler } = loadModule('../dist/sec-preview.cjs', '../server/routes/materialNewsRoutes.ts', 'handleMaterialEvents'));
    }
    return materialEventsHandler(req, res);
  }

  try {
    if (!appPromise) {
      const { createApp } = loadModule('../dist/server.cjs', '../server.ts', 'createApp');
      appPromise = createApp({ serveFrontend: false });
    }

    const app = await appPromise;
    return app(req, res);
  } catch (err) {
    console.error('[api/index] Error running server app:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Serverless execution failed',
        message: err?.message,
        code: err?.code,
      });
    }
  }
}
