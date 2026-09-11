import assert from 'node:assert/strict';
import { SecTtlCache } from './secCache';
import { SecEdgarClient } from './secClient';

// 1. Basic hit and miss behavior
{
  let mockTime = 1000;
  const cache = new SecTtlCache({ defaultTtlMs: 5000, maxSize: 3, now: () => mockTime });

  assert.equal(cache.get('ticker:AAPL'), null);
  assert.equal(cache.has('ticker:AAPL'), false);

  const statsAfterMiss = cache.getStats();
  assert.equal(statsAfterMiss.misses, 1);
  assert.equal(statsAfterMiss.hits, 0);
  assert.equal(statsAfterMiss.hitRate, 0);

  cache.set('ticker:AAPL', { cik: '0000320193' });
  assert.equal(cache.has('ticker:AAPL'), true);

  const hit = cache.get<{ cik: string }>('ticker:AAPL');
  assert.deepEqual(hit, { cik: '0000320193' });

  const statsAfterHit = cache.getStats();
  assert.equal(statsAfterHit.hits, 1);
  assert.equal(statsAfterHit.misses, 1);
  assert.equal(statsAfterHit.hitRate, 0.5);
  assert.equal(statsAfterHit.size, 1);
}

// 2. TTL Expiration
{
  let mockTime = 10_000;
  const cache = new SecTtlCache({ defaultTtlMs: 2000, now: () => mockTime });

  cache.set('key1', 'value1');
  assert.equal(cache.get('key1'), 'value1');

  // Advance time by 1500ms (still within TTL)
  mockTime += 1500;
  assert.equal(cache.has('key1'), true);
  assert.equal(cache.get('key1'), 'value1');

  // Advance time past 2000ms TTL
  mockTime += 1000;
  assert.equal(cache.has('key1'), false);
  assert.equal(cache.get('key1'), null);

  // Stats should register miss after expiration
  const stats = cache.getStats();
  assert.equal(stats.misses, 1);
}

// 3. LRU Eviction on capacity boundary
{
  let mockTime = 100;
  const cache = new SecTtlCache({ defaultTtlMs: 10_000, maxSize: 3, now: () => mockTime });

  cache.set('item1', 'A');
  mockTime += 10;
  cache.set('item2', 'B');
  mockTime += 10;
  cache.set('item3', 'C');
  mockTime += 10;

  assert.equal(cache.getStats().size, 3);

  // Access item1 to make it more recently accessed than item2
  cache.get('item1');
  mockTime += 10;

  // Insert item4: item2 should be evicted because it has the oldest access time
  cache.set('item4', 'D');

  const stats = cache.getStats();
  assert.equal(stats.size, 3);
  assert.equal(stats.evictions, 1);
  assert.equal(cache.has('item2'), false);
  assert.equal(cache.has('item1'), true);
  assert.equal(cache.has('item3'), true);
  assert.equal(cache.has('item4'), true);
}

// 4. Prune expired entries
{
  let mockTime = 1000;
  const cache = new SecTtlCache({ defaultTtlMs: 2000, now: () => mockTime });

  cache.set('exp1', 'val1', 1000);
  cache.set('exp2', 'val2', 3000);

  mockTime += 1500;
  const pruned = cache.pruneExpired();
  assert.equal(pruned, 1);
  assert.equal(cache.has('exp1'), false);
  assert.equal(cache.has('exp2'), true);
}

// 5. Integration with SecEdgarClient
{
  let networkCalls = 0;
  const mockFetch = (async () => {
    networkCalls++;
    return new Response(JSON.stringify({
      cik: 789019,
      entityName: 'MICROSOFT CORP',
      facts: {},
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  const testCache = new SecTtlCache();
  const client = new SecEdgarClient({
    userAgent: 'Lumina Test test@example.invalid',
    fetchImpl: mockFetch,
    cache: testCache,
  });

  // First call should hit network
  const facts1 = await client.fetchCompanyFacts('789019');
  assert.equal(facts1.cik, 789019);
  assert.equal(networkCalls, 1);

  // Second call should hit in-memory cache with 0 additional network calls
  const facts2 = await client.fetchCompanyFacts('789019');
  assert.equal(facts2.cik, 789019);
  assert.equal(networkCalls, 1);

  const stats = client.getCacheStats();
  assert.ok(stats);
  assert.equal(stats.hits, 1);
  assert.equal(stats.misses, 1);
}

console.log('SEC TTL cache checks passed');
