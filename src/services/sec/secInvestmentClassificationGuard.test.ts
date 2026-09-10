import assert from 'node:assert/strict';
import type { CanonicalFinancialDataset } from '../../domain/financialValue';
import { attachVerifiedShortTermInvestmentsFromSec } from './secInvestmentResolver';
import type { SecCompanyBundleLike } from './secFinancialMapper';

const dataset: CanonicalFinancialDataset = {
  schemaVersion: 1,
  generatedBy: 'test',
  ticker: 'NVDA',
  currency: 'USD',
  periods: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
  values: {},
  provenanceStatus: 'verified',
  provenanceWarnings: [],
  sourceCoverage: { sourceLinkedValues: 0, verifiedValues: 0, nonNullValues: 0, missingValues: 0, totalValues: 0 },
};

const fact = (fp: 'Q1' | 'Q2' | 'Q3' | 'FY', val: number, accn: string) => ({
  end: fp === 'Q1' ? '2026-03-31' : fp === 'Q2' ? '2026-06-30' : fp === 'Q3' ? '2026-09-30' : '2026-12-31',
  val,
  fy: 2026,
  fp,
  form: fp === 'FY' ? '10-K' : '10-Q',
  filed: '2027-02-15',
  accn,
});

const bundle: SecCompanyBundleLike = {
  identity: { cik: '0000000123', ticker: 'NVDA', title: 'NVIDIA' },
  submissions: { cik: '0000000123' },
  retrievedAt: '2027-02-16T00:00:00.000Z',
  companyFacts: {
    cik: 123,
    facts: {
      'us-gaap': {
        AvailableForSaleSecuritiesDebtSecurities: {
          units: {
            USD: [
              fact('Q1', 30_000_000_000, 'q1'),
              fact('Q2', 31_000_000_000, 'q2'),
              fact('Q3', 32_000_000_000, 'q3'),
              fact('FY', 34_143_000_000, 'fy'),
            ],
          },
        },
      },
    },
  },
};

const resolved = attachVerifiedShortTermInvestmentsFromSec(dataset, bundle);
assert.equal(
  resolved.values['balance_sheet.short_term_investments'],
  undefined,
  'Generic available-for-sale debt securities do not prove current classification and must not be promoted to short-term investments.',
);

console.log('SEC investment classification guard checks passed');
