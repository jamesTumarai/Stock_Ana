import assert from 'node:assert/strict';
import { normalizeDurationFactsToStandaloneQuarters, normalizeInstantFactsToFiscalQuarters } from './xbrlNormalizer';

const duration = normalizeDurationFactsToStandaloneQuarters([
  { start: '2026-01-01', end: '2026-03-31', val: 100, fy: 2026, fp: 'Q1', form: '10-Q', filed: '2026-05-01', accn: 'q1' },
  { start: '2026-01-01', end: '2026-06-30', val: 220, fy: 2026, fp: 'Q2', form: '10-Q', filed: '2026-08-01', accn: 'q2-current' },
  { start: '2025-01-01', end: '2025-06-30', val: 190, fy: 2026, fp: 'Q2', form: '10-Q', filed: '2026-08-01', accn: 'q2-comparative' },
]);
assert.equal(duration.find(item => item.fiscalQuarter === 2)?.end, '2026-06-30');
assert.equal(duration.find(item => item.fiscalQuarter === 2)?.value, 120);

const instant = normalizeInstantFactsToFiscalQuarters([
  { end: '2026-06-30', val: 55, fy: 2026, fp: 'Q2', form: '10-Q', filed: '2026-08-01', accn: 'i-current' },
  { end: '2025-06-30', val: 44, fy: 2026, fp: 'Q2', form: '10-Q', filed: '2026-08-01', accn: 'i-comparative' },
]);
assert.equal(instant[0]?.end, '2026-06-30');
assert.equal(instant[0]?.value, 55);

console.log('SEC comparative period selection integrity checks passed');
