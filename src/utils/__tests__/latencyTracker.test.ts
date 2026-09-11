import assert from 'node:assert/strict';
import { LatencyTracker } from '../latencyTracker';

// 1. Stage timing and total duration
{
  let mockTime = 1000;
  const tracker = new LatencyTracker({ now: () => mockTime });

  const stopSec = tracker.startStage('sec_envelope_fetch');
  mockTime += 450;
  const secDuration = stopSec();
  assert.equal(secDuration, 450);

  const stopMarket = tracker.startStage('market_snapshot');
  mockTime += 200;
  const marketDuration = stopMarket();
  assert.equal(marketDuration, 200);

  tracker.recordStage('gemini_stream', 3500);
  mockTime += 3500;

  const breakdown = tracker.getTimingBreakdown();
  assert.equal(breakdown.stages['sec_envelope_fetch'], 450);
  assert.equal(breakdown.stages['market_snapshot'], 200);
  assert.equal(breakdown.stages['gemini_stream'], 3500);
  assert.equal(breakdown.totalMs, 4150);

  const summary = tracker.formatSummary();
  assert.match(summary, /Total: 4\.15s/);
  assert.match(summary, /sec_envelope_fetch: 450ms/);
}

// 2. Empty / zero latency handling
{
  const tracker = new LatencyTracker({ now: () => 5000 });
  const breakdown = tracker.getTimingBreakdown();
  assert.deepEqual(breakdown.stages, {});
  assert.equal(breakdown.totalMs, 0);
  assert.match(tracker.formatSummary(), /no stage data/);
}

console.log('Latency tracker checks passed');
