import assert from 'node:assert/strict';
import { createRequireFirebaseAuth, extractBearerToken } from '../../server/auth/firebaseAuth.ts';

const makeResponse = () => {
  const res: any = { locals: {}, statusCode: 200, body: null };
  res.status = (statusCode: number) => { res.statusCode = statusCode; return res; };
  res.json = (body: unknown) => { res.body = body; return res; };
  return res;
};

assert.equal(extractBearerToken(undefined), null);
assert.equal(extractBearerToken('Basic abc'), null);
assert.equal(extractBearerToken('Bearer'), null);
assert.equal(extractBearerToken('Bearer token-value'), 'token-value');
assert.equal(extractBearerToken('bearer token-value'), 'token-value');

{
  const middleware = createRequireFirebaseAuth(async () => ({ uid: 'unused' }));
  const req: any = { headers: {} };
  const res = makeResponse();
  let nextCalled = false;
  await middleware(req, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'AUTH_REQUIRED');
  assert.equal(nextCalled, false);
}

{
  const middleware = createRequireFirebaseAuth(async () => { throw new Error('invalid'); });
  const req: any = { headers: { authorization: 'Bearer invalid-token' } };
  const res = makeResponse();
  let nextCalled = false;
  await middleware(req, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'AUTH_INVALID');
  assert.equal(nextCalled, false);
}

{
  let verifiedToken = '';
  const middleware = createRequireFirebaseAuth(async token => {
    verifiedToken = token;
    return { uid: 'user-123', email: 'user@example.com' };
  });
  const req: any = { headers: { authorization: 'Bearer valid-token' } };
  const res = makeResponse();
  let nextCalled = false;
  await middleware(req, res, () => { nextCalled = true; });
  assert.equal(verifiedToken, 'valid-token');
  assert.equal(nextCalled, true);
  assert.deepEqual(res.locals.authUser, { uid: 'user-123', email: 'user@example.com' });
}

console.log('server Firebase auth middleware tests passed');
