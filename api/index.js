import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let appPromise;
let secPreviewHandler;
let secCompareHandler;
let secDiffHandler;

export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
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

  if ((req.url || '').startsWith('/api/sec-diff')) {
    if (!secDiffHandler) {
      ({ handleSecDiff: secDiffHandler } = require('../dist/sec-preview.cjs'));
    }
    return secDiffHandler(req, res);
  }

  if (!appPromise) {
    const { createApp } = require('../dist/server.cjs');
    appPromise = createApp({ serveFrontend: false });
  }

  const app = await appPromise;
  return app(req, res);
}
