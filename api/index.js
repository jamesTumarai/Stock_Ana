import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let appPromise;

export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  if (req.method === 'GET' && (req.url || '').startsWith('/api/health')) {
    return res.status(200).json({
      ok: true,
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      runtime: 'vercel-function',
    });
  }

  if (!appPromise) {
    const { createApp } = require('../dist/server.cjs');
    appPromise = createApp({ serveFrontend: false });
  }

  const app = await appPromise;
  return app(req, res);
}
