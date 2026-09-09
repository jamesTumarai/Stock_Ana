import assert from 'node:assert/strict';
import { harmonizeReportData } from '../../metricsHarmonizer';

console.log('Running financial statement missing-data policy checks...');

const empty = harmonizeReportData({ ticker: 'TEST' } as any, 'TEST');
assert.equal(empty.financial_statements, undefined, 'Missing statements must remain missing');
assert.equal(empty.key_indicators, undefined, 'Missing indicators must remain missing');
assert.equal(empty.intrinsic_value, undefined, 'Missing valuation must remain missing');

const sourced = {
  ticker: 'TEST',
  financial_statements: {
    periods: ['Q1 2026'],
    income_statement: { revenue: [100], net_income: [10] },
    balance_sheet: { cash_and_equivalents: [20], total_debt: [5] },
    cash_flow: { operating_cash_flow: [15], capex: [-3], free_cash_flow: [12] },
  },
};
const preserved = harmonizeReportData(sourced as any, 'TEST');
assert.deepEqual(
  preserved.financial_statements,
  { ...sourced.financial_statements, validation_summary: undefined },
  'Sourced statements must be preserved without synthetic periods or values',
);

console.log('Financial statement missing-data policy checks passed');
