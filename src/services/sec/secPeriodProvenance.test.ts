import assert from 'node:assert/strict';
import { mapSecBundleToCanonicalFinancials } from './secFinancialMapper';
import { adaptSecCanonicalToFinancialStatements } from './secLegacyAdapter';

const bundle = {
  identity: { cik: '0000000123', ticker: 'TEST', title: 'Test Corp' },
  submissions: {
    cik: '0000000123',
    filings: { recent: {
      accessionNumber: ['q2'],
      primaryDocument: ['test-20260630.htm'],
      form: ['10-Q'],
      filingDate: ['2026-08-01'],
    } },
  },
  companyFacts: {
    cik: 123,
    facts: {
      'us-gaap': {
        RevenueFromContractWithCustomerExcludingAssessedTax: {
          units: { USD: [
            { start: '2026-01-01', end: '2026-03-31', val: 100_000_000, fy: 2026, fp: 'Q1', form: '10-Q', filed: '2026-05-01', accn: 'q1' },
            { start: '2026-01-01', end: '2026-06-30', val: 220_000_000, fy: 2026, fp: 'Q2', form: '10-Q', filed: '2026-08-01', accn: 'q2' },
            { start: '2025-01-01', end: '2025-06-30', val: 190_000_000, fy: 2026, fp: 'Q2', form: '10-Q', filed: '2026-08-01', accn: 'q2' },
          ] },
        },
        NetIncomeLoss: {
          units: { USD: [
            { start: '2026-01-01', end: '2026-03-31', val: 10_000_000, fy: 2026, fp: 'Q1', form: '10-Q', filed: '2026-05-01', accn: 'q1' },
            { start: '2026-01-01', end: '2026-06-30', val: 22_000_000, fy: 2026, fp: 'Q2', form: '10-Q', filed: '2026-08-01', accn: 'q2' },
            { start: '2025-01-01', end: '2025-06-30', val: 18_000_000, fy: 2026, fp: 'Q2', form: '10-Q', filed: '2026-08-01', accn: 'q2' },
          ] },
        },
      },
    },
  },
  retrievedAt: '2026-09-10T00:00:00.000Z',
};

const canonical = mapSecBundleToCanonicalFinancials(bundle as any, { maxQuarters: 4 });
assert.ok(canonical);
const revenue = canonical!.values['income_statement.revenue'];
assert.equal(revenue.at(-1)?.period, 'Q2 2026');
assert.equal(revenue.at(-1)?.periodEnd, '2026-06-30');
assert.equal(revenue.at(-1)?.source?.periodEnd, '2026-06-30');

const legacy = adaptSecCanonicalToFinancialStatements(canonical!);
assert.ok(legacy);
assert.equal(legacy!.as_of_date, '2026-06-30');
assert.equal(legacy!.source?.period_end, '2026-06-30');

console.log('SEC current-period provenance date checks passed');
