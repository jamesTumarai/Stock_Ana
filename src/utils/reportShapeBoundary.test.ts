import assert from 'node:assert/strict';
import { validateAndPrepareReport } from './reportValidation';

const marketQuotes = {
  MSFT: { symbol: 'MSFT', price: 500, provider: 'test', asOf: new Date().toISOString(), retrievedAt: new Date().toISOString() },
};

const result = validateAndPrepareReport({
  ticker: 'MSFT',
  financial_statements: {
    source: { document_type: '10-K' },
    income_statement: { revenue: [1, 2, 3, 4], net_income: [1, 1, 1, 1] },
    balance_sheet: {},
    cash_flow_statement: { free_cash_flow: [1, 1, 1, 1] },
  },
  valuation_ratios: {
    trailing_pe: 27.4,
    forward_pe: 20.9,
    peg_ratio: 1.62,
  },
}, 'MSFT', { marketQuotes });

assert.ok(result.report);
assert.equal(result.validation.issues.some(i => i.code === 'INVALID_FISCAL_PERIODS'), false);
assert.equal(result.validation.issues.some(i => i.code === 'INVALID_VALUATION_RATIOS_SHAPE'), false);
assert.equal(result.validation.issues.some(i => i.code === 'REPORT_FINANCIAL_STATEMENTS_QUARANTINED'), true);
assert.equal(result.report?.financial_statements, undefined, 'unlabeled financial periods must never be inferred');
assert.deepEqual(
  result.report?.valuation_ratios?.map(r => [r.name, r.value]),
  [['trailing_pe', 27.4], ['forward_pe', 20.9], ['peg_ratio', 1.62]],
  'ratio normalization must preserve supplied numeric values exactly',
);

console.log('Report shape boundary checks passed');
