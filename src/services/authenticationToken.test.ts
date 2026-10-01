import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolveAuthenticationToken, AuthenticationTokenTimeoutError } from './authenticationToken';

test('normal and forced refresh preserve the SDK token and refresh mode', async () => {
  const calls: Array<boolean | undefined> = [];
  const user = { getIdToken: async (force?: boolean) => { calls.push(force); return 'test-only-token'; } };
  assert.equal(await resolveAuthenticationToken(user), 'test-only-token');
  assert.equal(await resolveAuthenticationToken(user, { forceRefresh: true }), 'test-only-token');
  assert.deepEqual(calls, [undefined, true]);
});

test('offline token retry has a deadline and a late token cannot start the request', async () => {
  let finish!: (token: string) => void;
  let requestStarted = false;
  const pending = resolveAuthenticationToken({ getIdToken: () => new Promise(resolve => { finish = resolve; }) }, { timeoutMs: 5 })
    .then(() => { requestStarted = true; });
  await assert.rejects(pending, AuthenticationTokenTimeoutError);
  finish('test-only-late-token');
  await Promise.resolve();
  assert.equal(requestStarted, false);
});

test('cancellation before or during token refresh never authorizes a request', async () => {
  let calls = 0;
  const controller = new AbortController();
  const user = { getIdToken: () => { calls++; return new Promise<string>(() => {}); } };
  controller.abort();
  await assert.rejects(resolveAuthenticationToken(user, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls, 0);
  const active = new AbortController();
  const pending = resolveAuthenticationToken(user, { signal: active.signal });
  active.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('SDK failures and empty tokens fail closed without exposing credentials', async () => {
  const failure = new Error('test-only SDK unavailable');
  await assert.rejects(resolveAuthenticationToken({ getIdToken: async () => { throw failure; } }), error => error === failure);
  await assert.rejects(resolveAuthenticationToken({ getIdToken: async () => '' }), /returned no token/);
});

test('authenticated API transport awaits bounded authentication for initial and 401 retry calls', () => {
  const source = readFileSync(new URL('./authenticatedFetch.ts', import.meta.url), 'utf8');
  assert.equal((source.match(/await resolveAuthenticationToken\(/g) ?? []).length, 2);
  assert.ok(source.includes("headers.set('Authorization', `Bearer ${idToken}`)"));
  assert.ok(source.includes('forceRefresh: true'));
  assert.ok(source.includes('if (!currentUser) throw new AuthenticationRequiredError()'));
});
