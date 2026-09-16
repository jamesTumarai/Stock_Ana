import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { registerMaterialNewsRoutes } from '../materialNewsRoutes';

describe('Material News & Events API Routes (/api/material-events)', () => {
  let server: http.Server;
  let port: number;

  before(async () => {
    const app = express();
    app.use(express.json());
    registerMaterialNewsRoutes(app);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        port = addr.port;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('GET /api/material-events without symbols parameter returns HTTP 400 with MISSING_SYMBOLS', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/material-events`);
    assert.equal(res.status, 400);
    const body: any = await res.json();
    assert.equal(body.code, 'MISSING_SYMBOLS');
    assert.deepEqual(body.events, []);
    assert.deepEqual(body.recentNews, []);
  });

  it('GET /api/material-events with invalid symbols returns HTTP 400 with INVALID_SYMBOLS', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/material-events?symbols=$$$invalid@@@`);
    assert.equal(res.status, 400);
    const body: any = await res.json();
    assert.equal(body.code, 'INVALID_SYMBOLS');
    assert.deepEqual(body.events, []);
    assert.deepEqual(body.recentNews, []);
  });

  it('POST /api/material-events with valid symbols returns structured contract with sourceStatus and recentNews', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/material-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbols: ['MSFT', 'AAPL'],
        refresh: false
      })
    });

    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.ok(Array.isArray(body.events));
    assert.ok(Array.isArray(body.recentNews));
    assert.ok(typeof body.checkedAt === 'string');
    assert.ok(Array.isArray(body.requestedSymbols));
    assert.ok(Array.isArray(body.successfulSymbols));
    assert.ok(Array.isArray(body.failedSymbols));
    assert.ok(body.sourceStatus !== undefined);
    assert.ok(['OK', 'PARTIAL', 'ERROR', 'UNAVAILABLE'].includes(body.sourceStatus.sec));
    assert.ok(['OK', 'PARTIAL', 'ERROR', 'UNAVAILABLE'].includes(body.sourceStatus.news));
    assert.ok(['HIT', 'MISS', 'PARTIAL'].includes(body.cacheStatus));
  });
});
