import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createUserConcurrencyLimiter, createUserRateLimiter } from '../../server/middleware/userRateLimit.ts';

const makeResponse = (uid = 'user-a') => {
  const emitter = new EventEmitter() as any;
  emitter.locals = { authUser: { uid } };
  emitter.statusCode = 200;
  emitter.body = null;
  emitter.headers = new Map<string, string>();
  emitter.setHeader = (name: string, value: string) => emitter.headers.set(name.toLowerCase(), String(value));
  emitter.status = (statusCode: number) => { emitter.statusCode = statusCode; return emitter; };
  emitter.json = (body: unknown) => { emitter.body = body; return emitter; };
  return emitter;
};

const run = async (middleware: any, uid: string, ip = '127.0.0.1') => {
  const req: any = { ip };
  const res = makeResponse(uid);
  let nextCalled = false;
  await middleware(req, res, () => { nextCalled = true; });
  return { req, res, nextCalled };
};

{
  let timestamp = 1_000;
  const limiter = createUserRateLimiter({
    scope: 'test',
    limit: 2,
    windowMs: 10_000,
    now: () => timestamp,
  });

  const first = await run(limiter, 'user-a');
  assert.equal(first.nextCalled, true);
  assert.equal(first.res.headers.get('x-ratelimit-remaining'), '1');

  const second = await run(limiter, 'user-a');
  assert.equal(second.nextCalled, true);
  assert.equal(second.res.headers.get('x-ratelimit-remaining'), '0');

  const blocked = await run(limiter, 'user-a');
  assert.equal(blocked.nextCalled, false);
  assert.equal(blocked.res.statusCode, 429);
  assert.equal(blocked.res.body.code, 'RATE_LIMITED');
  assert.equal(blocked.res.headers.get('retry-after'), '10');

  const otherUser = await run(limiter, 'user-b');
  assert.equal(otherUser.nextCalled, true, 'different authenticated UIDs must have independent limits');

  timestamp = 11_001;
  const reset = await run(limiter, 'user-a');
  assert.equal(reset.nextCalled, true, 'window must reset deterministically after expiry');
}

{
  const limiter = createUserConcurrencyLimiter({ scope: 'analyze', maxConcurrent: 1 });
  const req: any = { ip: '127.0.0.1' };
  const firstRes = makeResponse('user-a');
  let firstNext = false;
  await limiter(req, firstRes, () => { firstNext = true; });
  assert.equal(firstNext, true);

  const blockedRes = makeResponse('user-a');
  let blockedNext = false;
  await limiter(req, blockedRes, () => { blockedNext = true; });
  assert.equal(blockedNext, false);
  assert.equal(blockedRes.statusCode, 429);
  assert.equal(blockedRes.body.code, 'CONCURRENT_LIMIT');

  const otherRes = makeResponse('user-b');
  let otherNext = false;
  await limiter(req, otherRes, () => { otherNext = true; });
  assert.equal(otherNext, true);
  otherRes.emit('finish');

  firstRes.emit('close');
  firstRes.emit('finish');
  const afterRelease = makeResponse('user-a');
  let afterReleaseNext = false;
  await limiter(req, afterRelease, () => { afterReleaseNext = true; });
  assert.equal(afterReleaseNext, true, 'finish/close release must be idempotent and free the user slot');
}

console.log('user rate limit middleware tests passed');
