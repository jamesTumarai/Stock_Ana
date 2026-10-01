import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withDeadline } from './asyncDeadline';

test('a quota/offline stall rejects instead of leaving foreground work pending forever', async () => {
  await assert.rejects(withDeadline(new Promise(()=>{}), 'Report write', 10), /saving has not been confirmed/);
});
test('cloud acknowledgement and actual SDK errors retain their original outcomes', async () => {
  assert.equal(await withDeadline(Promise.resolve('acknowledged'), 'Report write', 10), 'acknowledged');
  const quota = new Error('resource-exhausted');
  await assert.rejects(withDeadline(Promise.reject(quota), 'Report write', 10), error => error === quota);
});
