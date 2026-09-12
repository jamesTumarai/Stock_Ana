import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let appPromise;
let secPreviewHandler;
let secCompareHandler;
let secDiffHandler;

function loadModule(distPath, srcPath) {
  try {
    return require(distPath);
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
  if ((req.url || '').startsWith('/api/sec-preview')) {
    if (!secPreviewHandler) {
      ({ handleSecPreview: secPreviewHandler } = loadModule('../dist/sec-preview.cjs', '../server/secPreviewHandler.ts'));
    }
    return secPreviewHandler(req, res);
  }

  if ((req.url || '').startsWith('/api/sec-compare')) {
    if (!secCompareHandler) {
      ({ handleSecCompare: secCompareHandler } = loadModule('../dist/sec-preview.cjs', '../server/secPreviewHandler.ts'));
    }
    return secCompareHandler(req, res);
  }

  if ((req.url || '').startsWith('/api/sec-diff')) {
    if (!secDiffHandler) {
      ({ handleSecDiff: secDiffHandler } = loadModule('../dist/sec-preview.cjs', '../server/secPreviewHandler.ts'));
    }
    return secDiffHandler(req, res);
  }

  if (!appPromise) {
    const { createApp } = loadModule('../dist/server.cjs', '../server.ts');
    appPromise = createApp({ serveFrontend: false });
  }

  const app = await appPromise;
  return app(req, res);
}
