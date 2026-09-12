import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import http from 'node:http';
import { registerFileRoutes } from '../fileRoutes.ts';

describe('fileRoutes security boundary and cross-user isolation (P0-4)', () => {
  const testDir = path.join(process.cwd(), 'scratch', 'test_security_env');
  const runLogsDir = path.join(testDir, 'run_logs');
  const artifactsDir = path.join(testDir, 'artifacts');

  let server: http.Server;
  let port: number;
  let currentAuthUid: string | null = null;

  before(async () => {
    // Setup clean test sandbox directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(runLogsDir, { recursive: true });
    fs.mkdirSync(artifactsDir, { recursive: true });

    // Mock environment directories to point to our test sandbox
    process.env.VERCEL = '0';

    // Create test run logs: User A owns run_101
    fs.writeFileSync(
      path.join(runLogsDir, 'run_log_userA_run101.jsonl'),
      JSON.stringify({ user: 'userA', ticker: 'MSFT', event: 'analysis_complete' }) + '\n'
    );

    const app = express();
    // Mock requireFirebaseAuth that populates req.auth.uid from currentAuthUid
    const mockAuthMiddleware = (req: any, res: any, next: any) => {
      if (!currentAuthUid) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      req.auth = { uid: currentAuthUid };
      next();
    };

    // Override process.cwd() or directory logic for test server
    registerFileRoutes(app, mockAuthMiddleware);

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
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('rejects download by ticker alone with 400 RUN_ID_REQUIRED', async () => {
    currentAuthUid = 'userA';
    const res = await fetch(`http://127.0.0.1:${port}/api/download_jsonl?ticker=MSFT`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'RUN_ID_REQUIRED');
  });

  it('blocks unauthenticated requests with 401', async () => {
    currentAuthUid = null;
    const res = await fetch(`http://127.0.0.1:${port}/api/download_jsonl?runId=run101`);
    assert.equal(res.status, 401);
  });

  it('blocks raw log download in production when not explicitly enabled', async () => {
    currentAuthUid = 'userA';
    const oldNodeEnv = process.env.NODE_ENV;
    const oldEnabled = process.env.ENABLE_RAW_LOG_DOWNLOAD;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.ENABLE_RAW_LOG_DOWNLOAD;

      const res = await fetch(`http://127.0.0.1:${port}/api/download_jsonl?runId=run101`);
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.code, 'LOG_DOWNLOAD_DISABLED');
    } finally {
      process.env.NODE_ENV = oldNodeEnv;
      process.env.ENABLE_RAW_LOG_DOWNLOAD = oldEnabled;
    }
  });

  it('blocks User B from downloading User A owned run log (returns 403 FORBIDDEN_RUN_ACCESS)', async () => {
    // Ensure run log is in actual run_logs directory used by route
    const actualRunLogsDir = path.join(process.cwd(), 'run_logs');
    if (!fs.existsSync(actualRunLogsDir)) {
      fs.mkdirSync(actualRunLogsDir, { recursive: true });
    }
    const testLogName = 'run_log_userA_runSecTest999.jsonl';
    const testLogPath = path.join(actualRunLogsDir, testLogName);
    fs.writeFileSync(testLogPath, '{"owner":"userA","data":"confidential"}\n');

    try {
      // User B attempts to access User A's run log
      currentAuthUid = 'userB';
      const res = await fetch(`http://127.0.0.1:${port}/api/download_jsonl?runId=runSecTest999`);
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.code, 'FORBIDDEN_RUN_ACCESS');

      // User A accesses their own run log
      currentAuthUid = 'userA';
      const successRes = await fetch(`http://127.0.0.1:${port}/api/download_jsonl?runId=runSecTest999`);
      assert.equal(successRes.status, 200);
      const content = await successRes.text();
      assert.ok(content.includes('confidential'));
    } finally {
      if (fs.existsSync(testLogPath)) {
        fs.unlinkSync(testLogPath);
      }
    }
  });

  it('scopes artifact uploads to caller UID directory to prevent overwrites', async () => {
    currentAuthUid = 'userA';
    const resA = await fetch(`http://127.0.0.1:${port}/api/upload_artifact?name=test_artifact.txt`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'User A artifact payload',
    });
    assert.equal(resA.status, 200);

    currentAuthUid = 'userB';
    const resB = await fetch(`http://127.0.0.1:${port}/api/upload_artifact?name=test_artifact.txt`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'User B artifact payload',
    });
    assert.equal(resB.status, 200);

    // Verify files exist in separate scoped UID directories
    const userADir = path.join(process.cwd(), 'workspace', 'artifacts', 'userA');
    const userBDir = path.join(process.cwd(), 'workspace', 'artifacts', 'userB');

    assert.ok(fs.existsSync(path.join(userADir, 'test_artifact.txt')));
    assert.ok(fs.existsSync(path.join(userBDir, 'test_artifact.txt')));

    const contentA = fs.readFileSync(path.join(userADir, 'test_artifact.txt'), 'utf8');
    const contentB = fs.readFileSync(path.join(userBDir, 'test_artifact.txt'), 'utf8');

    assert.equal(contentA, 'User A artifact payload');
    assert.equal(contentB, 'User B artifact payload');

    // Clean up test files
    fs.rmSync(userADir, { recursive: true, force: true });
    fs.rmSync(userBDir, { recursive: true, force: true });
  });
});
