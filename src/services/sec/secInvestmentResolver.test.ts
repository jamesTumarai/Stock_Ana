import assert from 'node:assert/strict';
import type { CanonicalFinancialDataset } from '../../domain/financialValue';
import { attachVerifiedShortTermInvestmentsFromSec } from './secInvestmentResolver';
import type { SecCompanyBundleLike } from './secFinancialMapper';

const dataset = (): CanonicalFinancialDataset => ({
  schemaVersion: 1,
  generatedBy: 'test',
  ticker: 'TEST',
  currency: 'USD',
  periods: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
  values: {},
  provenanceStatus: 'verified',
  provenanceWarnings: [],
  sourceCoverage: { sourceLinkedValues: 0, verifiedValues: 0, nonNullValues: 0, missingValues: 0, totalValues: 0 },
});

const instant = (fp: 'Q1' | 'Q2' | 'Q3' | 'FY', val: number, accn: string, endOverride?: string) => ({
  end: endOverride ?? (fp === 'Q1' ? '2026-03-31' : fp === 'Q2' ? '2026-06-30' : fp === 'Q3' ? '2026-09-30' : '2026-12-31'),
  val,
  fy: 2026,
  fp,
  form: fp === 'FY' ? '10-K' : '10-Q',
  filed: '2027-02-15',
  accn,
});
const unit = (facts: any[]) => ({ units: { USD: facts } });
const bundle = (facts: Record<string, any>): SecCompanyBundleLike => ({
  identity: { cik: '0000000123', ticker: 'TEST', title: 'Test' },
  submissions: { cik: '0000000123', filings: { recent: {
    accessionNumber: ['q1', 'q2', 'q3', 'fy'],
    primaryDocument: ['q1.htm', 'q2.htm', 'q3.htm', 'fy.htm'],
    form: ['10-Q', '10-Q', '10-Q', '10-K'],
    filingDate: ['2026-05-01', '2026-08-01', '2026-11-01', '2027-02-15'],
  } } },
  companyFacts: { cik: 123, facts: { 'us-gaap': facts } },
  retrievedAt: '2027-02-16T00:00:00.000Z',
});

{
  const resolved = attachVerifiedShortTermInvestmentsFromSec(dataset(), bundle({
    CashCashEquivalentsAndShortTermInvestments: unit([
      instant('Q1', 80_000_000, 'q1'), instant('Q2', 90_000_000, 'q2'),
      instant('Q3', 100_000_000, 'q3'), instant('FY', 120_000_000, 'fy'),
    ]),
    CashAndCashEquivalentsAtCarryingValue: unit([
      instant('Q1', 50_000_000, 'q1'), instant('Q2', 55_000_000, 'q2'),
      instant('Q3', 60_000_000, 'q3'), instant('FY', 70_000_000, 'fy'),
    ]),
  }));
  const values = resolved.values['balance_sheet.short_term_investments'];
  assert.deepEqual(values.map(item => item.value), [30, 35, 40, 50]);
  assert.ok(values.every(item => item.verification === 'verified'));
  assert.match(values[3].derivation || '', /CashCashEquivalentsAndShortTermInvestments/);
}

{
  const base = dataset();
  base.values['balance_sheet.short_term_investments'] = base.periods.map((period, index) => ({
    metric: 'short_term_investments', statement: 'balance_sheet', value: 10 + index, unit: 'USD_M', period,
    type: 'reported', verification: 'verified',
  }));
  const resolved = attachVerifiedShortTermInvestmentsFromSec(base, bundle({
    CashCashEquivalentsAndShortTermInvestments: unit([instant('FY', 120_000_000, 'fy')]),
    CashAndCashEquivalentsAtCarryingValue: unit([instant('FY', 70_000_000, 'fy')]),
  }));
  assert.deepEqual(resolved.values['balance_sheet.short_term_investments'].map(item => item.value), [10, 11, 12, 13], 'Direct verified values must win');
}

{
  const resolved = attachVerifiedShortTermInvestmentsFromSec(dataset(), bundle({
    CashCashEquivalentsAndShortTermInvestments: unit([instant('Q2', 50_000_000, 'q2')]),
    CashAndCashEquivalentsAtCarryingValue: unit([instant('Q2', 55_000_000, 'q2')]),
  }));
  assert.equal(resolved.values['balance_sheet.short_term_investments'], undefined, 'Negative derived investment must fail closed');
}

console.log('SEC short-term investment resolver checks passed');
