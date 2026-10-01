import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditTechnicalSnapshot, type TechnicalInputSnapshot } from './technicalSnapshotIntegrity';
import type { TechnicalAnalysis } from '../types';

const basis: TechnicalInputSnapshot = { price: 100, timestamp: '2026-09-30T16:00:00-04:00', timezone: 'America/New_York', timeframe: '1d', sourceUrl: 'https://example.com/dated-chart' };
const technical = (patch: Partial<TechnicalAnalysis> = {}): Partial<TechnicalAnalysis> => ({
  input_snapshot: basis, key_levels: { current_price: 100, support: [], resistance: [] },
  section_basis: Object.fromEntries(['key_levels', 'trade_plan', 'trend_indicators', 'momentum_indicators', 'relative_strength']
    .map(key => [key, { ...basis, benchmark: key === 'relative_strength' ? 'S&P 500' : undefined }])), ...patch,
});
test('compatible dated multi-timeframe technical data is structurally consistent but never certified as verified bars', () => {
  const data = technical(); data.section_basis!.momentum_indicators = { ...basis, timeframe: '4h' };
  assert.deepEqual(auditTechnicalSnapshot(data), { status: 'STRUCTURALLY_COMPATIBLE', codes: [], verification: 'SOURCE_ASSERTED' });
});
test('unknown timestamps/timezones/benchmark stay unknown and new quotes cannot certify stale technical plans', () => {
  assert.equal(auditTechnicalSnapshot({}).status, 'UNVERIFIED');
  for (const patch of [{ timestamp: '2026-09-30T16:00:00' }, { timezone: null }, { timeframe: null }, { sourceUrl: null }]) {
    assert.ok(auditTechnicalSnapshot(technical({ input_snapshot: { ...basis, ...patch } })).codes.includes('TECHNICAL_SNAPSHOT_METADATA_UNAVAILABLE'));
  }
  assert.equal(auditTechnicalSnapshot(technical({ key_levels: { current_price: 110, support: [], resistance: [] } })).status, 'CONFLICT');
  const mixed = technical(); mixed.section_basis!.trade_plan = { ...basis, timestamp: '2026-09-29T16:00:00-04:00' };
  assert.ok(auditTechnicalSnapshot(mixed).codes.includes('TECHNICAL_SECTION_SNAPSHOT_CONFLICT'));
  const noBenchmark = technical(); delete noBenchmark.section_basis!.relative_strength!.benchmark;
  assert.ok(auditTechnicalSnapshot(noBenchmark).codes.includes('RELATIVE_STRENGTH_BENCHMARK_UNAVAILABLE'));
});
test('RSI 36 is not classic oversold; stochastic-only, negated claims and RSI 29 remain distinct', () => {
  assert.ok(auditTechnicalSnapshot(technical({ momentum_indicators: 'RSI 36 is oversold.' })).codes.includes('RSI_OVERSOLD_LABEL_CONFLICT'));
  for (const text of ['RSI 36 is not oversold.', 'RSI 36. Stochastic is oversold.', 'RSI 36 and stochastic is oversold.', 'RSI 29 is oversold.']) {
    assert.ok(!auditTechnicalSnapshot(technical({ momentum_indicators: text })).codes.includes('RSI_OVERSOLD_LABEL_CONFLICT'));
  }
});
