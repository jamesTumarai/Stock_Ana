import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { buildHealthReport, registerHealthRoutes } from '../healthRoutes.ts';

describe('Health & Observability Routes (P1-10)', () => {
  let server: http.Server;
  let port: number;

  before(async () => {
    const app = express();
    registerHealthRoutes(app);

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

  it('buildHealthReport returns structured operational telemetry', () => {
    const report = buildHealthReport('express-server');
    assert.equal(report.ok, true);
    assert.equal(report.runtime, 'express-server');
    assert.ok(typeof report.uptimeSecs === 'number');
    assert.ok(typeof report.timestamp === 'string');
    assert.ok(report.services !== undefined);
    assert.ok(typeof report.services.gemini.configured === 'boolean');
    assert.ok(typeof report.services.sec.configured === 'boolean');
    assert.ok(typeof report.services.firebase.configured === 'boolean');
    if (report.system) {
      assert.ok(typeof report.system.memoryRssMb === 'number');
      assert.ok(typeof report.system.memoryHeapUsedMb === 'number');
      assert.ok(typeof report.system.nodeVersion === 'string');
    }
  });

  it('GET /api/health returns HTTP 200 with structured JSON', async () => {
    const resp = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(resp.status, 200);
    const data: any = await resp.json();
    assert.equal(data.ok, true);
    assert.equal(data.runtime, 'express-server');
    assert.ok(data.services.gemini !== undefined);
    assert.ok(data.services.sec !== undefined);
    assert.ok(data.services.firebase !== undefined);
  });
});
