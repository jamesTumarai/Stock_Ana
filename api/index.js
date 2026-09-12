import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let appPromise;
let secPreviewHandler;
let secCompareHandler;
let secDiffHandler;
let healthHandler;

function loadModule(distPath, srcPath, requiredExport) {
  try {
    const mod = require(distPath);
    if (requiredExport && !mod[requiredExport] && srcPath) {
      return require(srcPath);
    }
    return mod;
  } catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND' && srcPath) {
      return require(srcPath);
    }
    throw err;
  }
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

  if (!appPromise) {
    const { createApp } = loadModule('../dist/server.cjs', '../server.ts', 'createApp');
    appPromise = createApp({ serveFrontend: false });
  }

  const app = await appPromise;
  return app(req, res);
}
