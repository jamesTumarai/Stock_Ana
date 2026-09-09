import assert from 'node:assert/strict';
import { buildUsdThbFxSnapshot } from './fxSnapshot';

{
  const snapshot = buildUsdThbFxSnapshot({
    symbol: 'THB=X',
    price: 32.9,
    shortName: 'USD/THB',
    provider: 'Yahoo Finance',
    asOf: '2026-09-09T19:48:45.384Z',
    retrievedAt: '2026-09-09T19:48:46.000Z',
  });
  assert.ok(snapshot);
  assert.equal(snapshot?.pair, 'USD/THB');
  assert.equal(snapshot?.rate, 32.9);
  assert.equal(snapshot?.provider, 'Yahoo Finance');
  assert.equal(snapshot?.isRealtime, false);
}

assert.equal(buildUsdThbFxSnapshot({ symbol: 'THB=X', price: 0 }), null);
assert.equal(buildUsdThbFxSnapshot({ symbol: 'THB=X', price: Number.NaN }), null);
assert.equal(buildUsdThbFxSnapshot({ symbol: 'AAPL', price: 250 }), null);
assert.equal(buildUsdThbFxSnapshot(null), null);

{
  const snapshot = buildUsdThbFxSnapshot({ shortName: 'USD/THB', price: 33.1 });
  assert.ok(snapshot, 'Recognized USD/THB display name should be accepted even if provider symbol is omitted');
  assert.equal(snapshot?.rate, 33.1);
}

console.log('USD/THB FX snapshot checks passed');
