import assert from 'node:assert/strict';
import type { SecCompanyFactsResponse } from './secClient';
import { mapSecBundleToCanonicalFinancials } from './secFinancialMapper';

const companyFacts: SecCompanyFactsResponse = {
  cik: 123456,
  entityName: 'Restricted Cash Test',
  facts: {
    'us-gaap': {
      Revenues: {
        units: {
          USD: [
            { start: '2026-01-01', end: '2026-03-31', val: 100_000_000, fy: 2026, fp: 'Q1', form: '10-Q', filed: '2026-05-01', accn: 'rev-q1' },
          ],
        },
      },
      CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents: {
        units: {
          USD: [
            { end: '2026-03-31', val: 90_000_000, fy: 2026, fp: 'Q1', form: '10-Q', filed: '2026-05-01', accn: 'restricted-q1' },
          ],
        },
      },
    },
  },
};

const dataset = mapSecBundleToCanonicalFinancials({
  identity: { cik: '0000123456', ticker: 'TEST', title: 'Restricted Cash Test' },
  submissions: { cik: '0000123456', filings: { recent: {} } },
  companyFacts,
  retrievedAt: '2026-05-02T00:00:00.000Z',
});

assert.ok(dataset);
assert.ok(dataset?.values['income_statement.revenue']);
assert.equal(
  dataset?.values['balance_sheet.cash_and_equivalents'],
  undefined,
  'Restricted-cash aggregate must never be substituted for available cash and cash equivalents.',
);

console.log('SEC restricted-cash integrity check passed');
