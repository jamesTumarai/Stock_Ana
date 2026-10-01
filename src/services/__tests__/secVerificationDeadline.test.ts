import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchSecVerificationEnvelope, SEC_VERIFICATION_TIMEOUT_MS } from '../secVerificationService';

test('cold verified SEC data survives the old deadline; bounded timeout and parent cancellation remain effective', async () => {
  const originalWindow = (globalThis as any).window, originalFetch = globalThis.fetch;
  let elapsed = 0, deadline = 0, abortDeadline: (() => void) | undefined, cleared = 0, requests = 0;
  (globalThis as any).window = {
    setTimeout(callback: () => void, ms: number) { abortDeadline = callback; deadline = ms; return 1; },
    clearTimeout() { cleared++; },
  };
  const reply = { ticker: 'MSFT', provenanceStatus: 'verified',
    dcfCoverage: { eligible: false, periods: ['Q4 2026'], issues: [] },
    canonicalFinancials: { ticker: 'MSFT', generatedBy: 'lumina-sec-xbrl-v1', periods: ['Q4 2026'],
      values: { 'income_statement.revenue': [{ period: 'Q4 2026', value: 90007, verification: 'verified' }] } } };
  try {
    globalThis.fetch = (async (_input, init) => {
      requests++; elapsed = 13_538;
      if (elapsed >= deadline) abortDeadline?.();
      assert.equal(init?.signal?.aborted, false, 'A valid 13.5-second cold result must not be discarded');
      return new Response(JSON.stringify(reply), { status: 200 });
    }) as typeof fetch;
    const result = await fetchSecVerificationEnvelope('MSFT');
    assert.equal(deadline, SEC_VERIFICATION_TIMEOUT_MS);
    assert.equal(result?.status, 'verified_partial');
    assert.equal(result?.canonical_financials?.values['income_statement.revenue'][0].value, 90007);
    assert.equal(cleared, 1);

    globalThis.fetch = ((_input, init) => new Promise((_resolve, reject) => {
      requests++;
      init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' })), { once: true });
    })) as typeof fetch;
    const timed = fetchSecVerificationEnvelope('MSFT');
    elapsed = deadline; abortDeadline?.();
    assert.equal((await timed)?.error?.code, 'SEC_VERIFICATION_TIMEOUT');

    const parent = new AbortController();
    const cancelled = fetchSecVerificationEnvelope('MSFT', parent.signal);
    parent.abort();
    assert.equal(await cancelled, null);
    const callsBefore = requests;
    assert.equal(await fetchSecVerificationEnvelope('MSFT', parent.signal), null);
    assert.equal(requests, callsBefore, 'Already-cancelled research must not issue a request');
    assert.equal(cleared, 3);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete (globalThis as any).window;
    else (globalThis as any).window = originalWindow;
  }
});
