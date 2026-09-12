import assert from 'node:assert/strict';
import { buildHealthReport } from '../../../server/routes/healthRoutes';

// 1. Build health report in default environment
{
  const report = buildHealthReport('express-server');
  assert.equal(report.ok, report.status === 'healthy');
  assert.equal(report.service, 'lumina');
  assert.equal(report.runtime, 'express-server');
  assert.ok(typeof report.uptimeSecs === 'number');
  assert.ok(report.timestamp);
  assert.ok(['healthy', 'degraded'].includes(report.status));

  // Services
  assert.ok(report.services);
  assert.ok(typeof report.services.gemini.configured === 'boolean');
  assert.equal(report.services.gemini.modelDefault, 'gemini-3.8-flash');
  assert.ok(typeof report.services.sec.configured === 'boolean');
  assert.ok(typeof report.services.firebase.configured === 'boolean');

  // SEC Cache stats
  assert.ok(report.services.sec.cache);
  assert.ok(typeof report.services.sec.cache.hits === 'number');
  assert.ok(typeof report.services.sec.cache.misses === 'number');
  assert.ok(typeof report.services.sec.cache.size === 'number');
  assert.ok(typeof report.services.sec.cache.maxSize === 'number');
}

// 2. Vercel runtime flag
{
  const vercelReport = buildHealthReport('vercel-function');
  assert.equal(vercelReport.runtime, 'vercel-function');
  assert.equal(vercelReport.ok, vercelReport.status === 'healthy');
  assert.equal(vercelReport.service, 'lumina');
}

console.log('Health route checks passed');
