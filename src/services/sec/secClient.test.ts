import assert from 'node:assert/strict';
import { SecDataError, SecEdgarClient } from './secClient';

const makeJsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

{
  let called = false;
  const client = new SecEdgarClient({
    userAgent: '',
    fetchImpl: (async () => {
      called = true;
      return makeJsonResponse({});
    }) as typeof fetch,
  });
  assert.equal(client.isConfigured, false);
  await assert.rejects(
    () => client.fetchCompanyFacts('320193'),
    (error: unknown) => error instanceof SecDataError && error.code === 'SEC_USER_AGENT_MISSING',
  );
  assert.equal(called, false, 'Missing user agent must fail before any network request');
}

{
  const client = new SecEdgarClient({ userAgent: 'Lumina Test test@example.invalid' });
  await assert.rejects(
    () => client.fetchJson('https://example.com/not-sec.json'),
    (error: unknown) => error instanceof SecDataError && error.code === 'SEC_URL_NOT_ALLOWED',
  );
}

{
  const calls: Array<{ url: string; headers: Headers }> = [];
  let clock = 1_000;
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: new Headers(init?.headers) });
    if (url.includes('company_tickers.json')) {
      return makeJsonResponse({
        0: { cik_str: 320193, ticker: 'AAPL', title: 'Apple Inc.' },
        1: { cik_str: 789019, ticker: 'MSFT', title: 'Microsoft Corp' },
      });
    }
    if (url.includes('/submissions/')) {
      return makeJsonResponse({ cik: '0000320193', name: 'Apple Inc.', filings: { recent: {} } });
    }
    if (url.includes('/companyfacts/')) {
      return makeJsonResponse({ cik: 320193, entityName: 'Apple Inc.', facts: {} });
    }
    return makeJsonResponse({}, 404);
  }) as typeof fetch;

  const client = new SecEdgarClient({
    userAgent: 'Lumina Research engineering@example.invalid',
    fetchImpl,
    minIntervalMs: 125,
    now: () => clock,
    sleep: async (ms: number) => { clock += ms; },
  });

  const aapl = await client.resolveTicker(' aapl ');
  assert.deepEqual(aapl, { cik: '0000320193', ticker: 'AAPL', title: 'Apple Inc.' });
  const aaplAgain = await client.resolveTicker('AAPL');
  assert.deepEqual(aaplAgain, aapl);
  assert.equal(calls.filter(call => call.url.includes('company_tickers.json')).length, 1, 'Ticker index should be cached');

  const bundle = await client.fetchCompanyBundle('AAPL');
  assert.ok(bundle);
  assert.equal(bundle?.identity.cik, '0000320193');
  assert.equal(bundle?.companyFacts.cik, 320193);
  assert.equal(bundle?.submissions.cik, '0000320193');
  assert.equal(bundle?.retrievedAt, new Date(clock).toISOString());

  const submissionCall = calls.find(call => call.url.includes('/submissions/'));
  const factsCall = calls.find(call => call.url.includes('/companyfacts/'));
  assert.match(submissionCall?.url || '', /CIK0000320193\.json$/);
  assert.match(factsCall?.url || '', /CIK0000320193\.json$/);
  assert.equal(calls[0].headers.get('user-agent'), 'Lumina Research engineering@example.invalid');
  assert.equal(calls[0].headers.get('accept'), 'application/json');
  assert.ok(clock >= 1_250, 'SEC requests should be rate-spaced');
}

{
  const client = new SecEdgarClient({
    userAgent: 'Lumina Test test@example.invalid',
    fetchImpl: (async () => makeJsonResponse({ error: 'busy' }, 503)) as typeof fetch,
  });
  await assert.rejects(
    () => client.fetchCompanyFacts('320193'),
    (error: unknown) => error instanceof SecDataError && error.code === 'SEC_HTTP_ERROR' && error.status === 503,
  );
}

console.log('SEC EDGAR client checks passed');
