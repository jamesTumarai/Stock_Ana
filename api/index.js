import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let appPromise;
let secPreviewHandler;
let secCompareHandler;

export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  if (req.method === 'GET' && (req.url || '').startsWith('/api/health')) {
    const geminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
    const secConfigured = Boolean(process.env.SEC_USER_AGENT?.trim());
    const isHealthy = geminiConfigured && secConfigured;
    const urlObj = new URL(req.url, 'http://localhost');
    const isDetailed = urlObj.searchParams.get('detailed') === 'true';

    if (!isDetailed) {
      return res.status(200).json({
        status: isHealthy ? 'healthy' : 'degraded',
        ok: isHealthy,
        service: 'lumina',
        timestamp: new Date().toISOString(),
      });
    }

    const mem = typeof process !== 'undefined' && process.memoryUsage ? process.memoryUsage() : null;
    const firebaseConfigured = Boolean(process.env.FIREBASE_PROJECT_ID?.trim() || process.env.VITE_FIREBASE_PROJECT_ID?.trim());
    return res.status(200).json({
      status: isHealthy ? 'healthy' : 'degraded',
      ok: isHealthy,
      service: 'lumina',
      timestamp: new Date().toISOString(),
      uptimeSecs: typeof process !== 'undefined' && process.uptime ? Math.round(process.uptime()) : 0,
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      secConfigured: Boolean(process.env.SEC_USER_AGENT?.trim()),
      runtime: 'vercel-function',
      services: {
        gemini: { configured: geminiConfigured, modelDefault: 'gemini-3.8-flash' },
        sec: { configured: secConfigured },
        firebase: { configured: firebaseConfigured },
      },
      system: mem ? {
        memoryRssMb: Number((mem.rss / (1024 * 1024)).toFixed(1)),
        memoryHeapUsedMb: Number((mem.heapUsed / (1024 * 1024)).toFixed(1)),
      } : undefined,
    });
  }

  if ((req.url || '').startsWith('/api/sec-preview')) {
    if (!secPreviewHandler) {
      ({ handleSecPreview: secPreviewHandler } = require('../dist/sec-preview.cjs'));
    }
    return secPreviewHandler(req, res);
  }

  if ((req.url || '').startsWith('/api/sec-compare')) {
    if (!secCompareHandler) {
      ({ handleSecCompare: secCompareHandler } = require('../dist/sec-preview.cjs'));
    }
    return secCompareHandler(req, res);
  }

  if (!appPromise) {
    const { createApp } = require('../dist/server.cjs');
    appPromise = createApp({ serveFrontend: false });
  }

  const app = await appPromise;
  return app(req, res);
}
