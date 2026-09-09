import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let appPromise;
let secPreviewHandler;

export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  if (req.method === 'GET' && (req.url || '').startsWith('/api/health')) {
    return res.status(200).json({
      ok: true,
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      secConfigured: Boolean(process.env.SEC_USER_AGENT?.trim()),
      runtime: 'vercel-function',
    });
  }

  if ((req.url || '').startsWith('/api/sec-preview')) {
    if (!secPreviewHandler) {
      ({ handleSecPreview: secPreviewHandler } = require('../dist/sec-preview.cjs'));
    }
    return secPreviewHandler(req, res);
  }

  if (!appPromise) {
    const { createApp } = require('../dist/server.cjs');
    appPromise = createApp({ serveFrontend: false });
  }

  const app = await appPromise;
  return app(req, res);
}
