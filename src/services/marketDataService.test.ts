import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchLiveQuotes } from './marketDataService';

test('quote observation dates/providers remain separate from response retrieval metadata', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    provider: 'Yahoo Finance', asOf: '2026-09-30T12:00:00Z',
    quotes: {
      NEW: { symbol: 'NEW', price: 100, provider: 'Yahoo Finance chart', asOf: '2026-09-29T20:00:00Z', retrievedAt: '2026-09-30T11:59:59Z' },
      UNKNOWN: { symbol: 'UNKNOWN', price: 20 },
    },
  })));
  const result = await fetchLiveQuotes(['NEW', 'UNKNOWN']);
  assert.equal(result!.quotes.NEW.asOf, '2026-09-29T20:00:00Z');
  assert.equal(result!.quotes.NEW.provider, 'Yahoo Finance chart');
  assert.equal(result!.quotes.NEW.retrievedAt, '2026-09-30T11:59:59Z');
  assert.equal(result!.quotes.UNKNOWN.asOf, undefined);
  assert.equal(result!.asOf, '2026-09-30T12:00:00Z');
  assert.equal(result!.isRealtime, false);
});
