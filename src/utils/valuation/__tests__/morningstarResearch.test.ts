import assert from 'node:assert/strict';
import { harmonizeReportData } from '../../metricsHarmonizer';

console.log('Running Morningstar missing-data policy checks...');

for (const ticker of ['AAPL', 'NVDA', 'TSLA', 'SOFI', 'PLTR', 'MSFT', 'GOOGL', 'AMD', 'CRWD', 'EOSE']) {
  const harmonized = harmonizeReportData({ ticker } as any, ticker);
  assert.equal(harmonized.morningstar_research, undefined, `${ticker} must not receive fabricated Morningstar coverage`);
}

const sourcedMorningstar = {
  has_coverage: true,
  rating_stars: 4,
  fair_value_estimate: 210,
  analyst_name: 'Source Analyst',
  economic_moat: 'Narrow',
  uncertainty: 'High',
  capital_allocation: 'Standard',
};
const preserved = harmonizeReportData({ ticker: 'TEST', morningstar_research: sourcedMorningstar } as any, 'TEST');
assert.deepEqual(preserved.morningstar_research, sourcedMorningstar, 'Sourced Morningstar fields must be preserved unchanged');

console.log('Morningstar missing-data policy checks passed');
