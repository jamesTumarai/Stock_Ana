import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import handler from '../../../api/index.js';

function createMockReqRes(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
}) {
  const req: any = new EventEmitter();
  req.method = options.method || 'GET';
  req.url = options.url || '/api/health';
  req.headers = options.headers || {};

  const res: any = new EventEmitter();
  res.statusCode = 200;
  res._headers = {};
  res._data = '';
  res._jsonBody = null;

  res.setHeader = (key: string, value: string) => {
    res._headers[key.toLowerCase()] = value;
  };
  res.getHeader = (key: string) => res._headers[key.toLowerCase()];

  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };

  res.json = (body: any) => {
    res._jsonBody = body;
    res._data = JSON.stringify(body);
    res.emit('finish');
    return res;
  };

  res.send = (data: any) => {
    res._data = data;
    if (typeof data === 'string') {
      try {
        res._jsonBody = JSON.parse(data);
      } catch {
        // raw string
      }
    }
    res.emit('finish');
    return res;
  };

  res.end = (chunk?: any) => {
    if (chunk) res._data += chunk;
    res.emit('finish');
    return res;
  };

  const waitForFinish = () =>
    new Promise<any>((resolve) => {
      if (res._data || res._jsonBody) {
        return resolve({ status: res.statusCode, body: res._jsonBody, headers: res._headers });
      }
      res.once('finish', () => {
        let body = res._jsonBody;
        if (!body && res._data) {
          try {
            body = JSON.parse(res._data);
          } catch {
            body = res._data;
          }
        }
        resolve({ status: res.statusCode, body, headers: res._headers });
      });
    });

  return { req, res, waitForFinish };
}

describe('Vercel API Adapter & Parity (api/index.js)', () => {
  const originalEnv = { ...process.env };

  before(() => {
    process.env.VERCEL = '1';
    process.env.ADMIN_SECRET = 'test-secret-vercel-123';
  });

  after(() => {
    process.env = { ...originalEnv };
  });

  it('GET /api/health -> returns minimal public payload via api/index.js', async () => {
    const { req, res, waitForFinish } = createMockReqRes({
      method: 'GET',
      url: '/api/health',
    });

    await handler(req, res);
    const result = await waitForFinish();

    assert.equal(result.status, 200);
    assert.equal(result.body.service, 'lumina');
    assert.ok(typeof result.body.ok === 'boolean');
    assert.ok(['healthy', 'degraded'].includes(result.body.status));
    assert.equal(result.body.services, undefined, 'Must not leak services telemetry');
    assert.equal(result.body.system, undefined, 'Must not leak system telemetry');
  });

  it('GET /api/health?detailed=true unauthenticated -> returns minimal payload (parity with Express)', async () => {
    const { req, res, waitForFinish } = createMockReqRes({
      method: 'GET',
      url: '/api/health?detailed=true',
    });

    await handler(req, res);
    const result = await waitForFinish();

    assert.equal(result.status, 200);
    assert.equal(result.body.service, 'lumina');
    assert.equal(result.body.services, undefined, 'Must not leak services telemetry without authorization');
  });

  it('GET /api/health/detailed unauthenticated -> returns 401 Unauthorized (parity with Express)', async () => {
    const { req, res, waitForFinish } = createMockReqRes({
      method: 'GET',
      url: '/api/health/detailed',
    });

    await handler(req, res);
    const result = await waitForFinish();

    assert.equal(result.status, 401);
    assert.ok(result.body.error !== undefined);
  });

  it('GET /api/health/detailed authorized -> returns detailed telemetry with runtime: vercel-function', async () => {
    const { req, res, waitForFinish } = createMockReqRes({
      method: 'GET',
      url: '/api/health/detailed',
      headers: {
        'x-admin-key': 'test-secret-vercel-123',
      },
    });

    await handler(req, res);
    const result = await waitForFinish();

    assert.equal(result.status, 200);
    assert.equal(result.body.service, 'lumina');
    assert.equal(result.body.runtime, 'vercel-function');
    assert.ok(result.body.services !== undefined);
    assert.ok(result.body.services.gemini !== undefined);
    assert.ok(result.body.services.sec !== undefined);
    assert.ok(result.body.services.firebase !== undefined);
  });

  it('canonical Firebase readiness: fails closed in preview without explicit FIREBASE_PROJECT_ID', async () => {
    const savedProjectId = process.env.FIREBASE_PROJECT_ID;
    const savedVercelEnv = process.env.VERCEL_ENV;

    try {
      delete process.env.FIREBASE_PROJECT_ID;
      process.env.VERCEL_ENV = 'preview';

      const { req, res, waitForFinish } = createMockReqRes({
        method: 'GET',
        url: '/api/health/detailed',
        headers: {
          'x-admin-key': 'test-secret-vercel-123',
        },
      });

      await handler(req, res);
      const result = await waitForFinish();

      assert.equal(result.status, 200);
      assert.equal(
        result.body.services.firebase.configured,
        false,
        'Firebase must be false in preview when FIREBASE_PROJECT_ID is unset'
      );
      assert.equal(result.body.status, 'degraded');
      assert.equal(result.body.ok, false);
    } finally {
      if (savedProjectId) process.env.FIREBASE_PROJECT_ID = savedProjectId;
      if (savedVercelEnv) process.env.VERCEL_ENV = savedVercelEnv;
      else delete process.env.VERCEL_ENV;
    }
  });
});
