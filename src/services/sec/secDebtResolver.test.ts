import assert from 'node:assert/strict';
import type { CanonicalFinancialDataset } from '../../domain/financialValue';
import { attachVerifiedTotalDebtFromSec } from './secDebtResolver';
import type { SecCompanyBundleLike } from './secFinancialMapper';

const baseDataset = (): CanonicalFinancialDataset => ({
  schemaVersion: 1,
  generatedBy: 'lumina-financial-provenance-v1+sec-xbrl-v1',
  ticker: 'TEST',
  currency: 'USD',
  periods: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
  values: {},
  sourceCoverage: {
    sourceLinkedValues: 0,
    verifiedValues: 0,
    totalValues: 0,
    nonNullValues: 0,
    missingValues: 0,
  },
  provenanceStatus: 'verified',
  provenanceWarnings: [],
});

const fact = (fy: number, fp: 'Q1' | 'Q2' | 'Q3' | 'FY', val: number, accn: string) => ({
  end: fp === 'Q1' ? `${fy}-03-31` : fp === 'Q2' ? `${fy}-06-30` : fp === 'Q3' ? `${fy}-09-30` : `${fy}-12-31`,
  val,
  fy,
  fp,
  form: fp === 'FY' ? '10-K' : '10-Q',
  filed: `${fy}-${fp === 'Q1' ? '05-01' : fp === 'Q2' ? '08-01' : fp === 'Q3' ? '11-01' : '12-31'}`,
  accn,
});

const bundle = (facts: Record<string, any>): SecCompanyBundleLike => ({
  identity: { cik: '0000000123', ticker: 'TEST', title: 'Test Corp' },
  submissions: {
    cik: '0000000123',
    filings: { recent: {
      accessionNumber: ['a1', 'a2', 'a3', 'a4'],
      primaryDocument: ['q1.htm', 'q2.htm', 'q3.htm', 'fy.htm'],
      form: ['10-Q', '10-Q', '10-Q', '10-K'],
      filingDate: ['2026-05-01', '2026-08-01', '2026-11-01', '2026-12-31'],
    } },
  },
  companyFacts: { cik: 123, facts: { 'us-gaap': facts } },
  retrievedAt: '2026-09-10T00:00:00.000Z',
});

const unit = (items: any[]) => ({ units: { USD: items } });
const four = (values: [number, number, number, number], prefix: string) => [
  fact(2026, 'Q1', values[0], 'a1'),
  fact(2026, 'Q2', values[1], 'a2'),
  fact(2026, 'Q3', values[2], 'a3'),
  fact(2026, 'FY', values[3], 'a4'),
].map((item, index) => ({ ...item, accn: `${prefix}-${index + 1}` }));

{
  const resolved = attachVerifiedTotalDebtFromSec(baseDataset(), bundle({
    DebtAndFinanceLeaseObligations: unit([
      fact(2026, 'Q1', 100_000_000, 'a1'),
      fact(2026, 'Q2', 110_000_000, 'a2'),
      fact(2026, 'Q3', 120_000_000, 'a3'),
      fact(2026, 'FY', 130_000_000, 'a4'),
    ]),
    DebtCurrent: unit([fact(2026, 'FY', 40_000_000, 'a4')]),
    LongTermDebtNoncurrent: unit([fact(2026, 'FY', 90_000_000, 'a4')]),
  }));
  const total = resolved.values['balance_sheet.total_debt'];
  assert.deepEqual(total.map(item => item.value), [100, 110, 120, 130]);
  assert.ok(total.every(item => item.verification === 'verified'));
  assert.match(total[3].derivation || '', /Direct SEC/);
  assert.doesNotMatch(total[3].derivation || '', /DebtCurrent \+/);
}

{
  const resolved = attachVerifiedTotalDebtFromSec(baseDataset(), bundle({
    DebtCurrent: unit([
      fact(2026, 'Q1', 20_000_000, 'a1'),
      fact(2026, 'Q2', 21_000_000, 'a2'),
      fact(2026, 'Q3', 22_000_000, 'a3'),
      fact(2026, 'FY', 23_000_000, 'a4'),
    ]),
    LongTermDebtNoncurrent: unit([
      fact(2026, 'Q1', 80_000_000, 'a1'),
      fact(2026, 'Q2', 79_000_000, 'a2'),
      fact(2026, 'Q3', 78_000_000, 'a3'),
      fact(2026, 'FY', 77_000_000, 'a4'),
    ]),
    // This must not be added on top of DebtCurrent because it may overlap with it.
    ShortTermBorrowings: unit([fact(2026, 'FY', 10_000_000, 'a4')]),
  }));
  const total = resolved.values['balance_sheet.total_debt'];
  assert.deepEqual(total.map(item => item.value), [100, 100, 100, 100]);
  assert.match(total[3].derivation || '', /DebtCurrent \+ us-gaap:LongTermDebtNoncurrent/);
  assert.doesNotMatch(total[3].derivation || '', /ShortTermBorrowings/);
}

{
  const resolved = attachVerifiedTotalDebtFromSec(baseDataset(), bundle({
    LongTermDebtCurrent: unit(four([10_000_000, 11_000_000, 12_000_000, 13_000_000], 'ltc')),
    LongTermDebtNoncurrent: unit(four([90_000_000, 89_000_000, 88_000_000, 87_000_000], 'ltnc')),
    LongTermDebt: unit(four([100_000_000, 100_000_000, 100_000_000, 100_000_000], 'lta')),
    CommercialPaper: unit(four([5_000_000, 6_000_000, 7_000_000, 8_000_000], 'cp')),
  }));
  const total = resolved.values['balance_sheet.total_debt'];
  assert.deepEqual(total.map(item => item.value), [105, 106, 107, 108]);
  assert.ok(total.every(item => item.verification === 'verified'));
  assert.match(total[3].derivation || '', /reconciled us-gaap:LongTermDebt \+ separately reported us-gaap:CommercialPaper/);
  assert.match(total[3].derivation || '', /LongTermDebtCurrent \+ LongTermDebtNoncurrent/);
}

{
  const resolved = attachVerifiedTotalDebtFromSec(baseDataset(), bundle({
    LongTermDebtCurrent: unit(four([10_000_000, 11_000_000, 12_000_000, 13_000_000], 'ltc')),
    LongTermDebtNoncurrent: unit(four([90_000_000, 89_000_000, 88_000_000, 87_000_000], 'ltnc')),
    LongTermDebt: unit(four([100_000_000, 100_000_000, 100_000_000, 100_000_000], 'lta')),
    CommercialPaper: unit(four([5_000_000, 6_000_000, 7_000_000, 8_000_000], 'cp')),
    ShortTermBorrowings: unit([fact(2026, 'FY', 9_000_000, 'a4')]),
  }));
  const total = resolved.values['balance_sheet.total_debt'];
  assert.equal(total[3].value, null, 'Same-period ShortTermBorrowings makes CommercialPaper overlap ambiguous');
  assert.equal(total[3].verification, 'unverified');
}

{
  const resolved = attachVerifiedTotalDebtFromSec(baseDataset(), bundle({
    LongTermDebtCurrent: unit(four([10_000_000, 11_000_000, 12_000_000, 13_000_000], 'ltc')),
    LongTermDebtNoncurrent: unit(four([90_000_000, 89_000_000, 88_000_000, 87_000_000], 'ltnc')),
    LongTermDebt: unit(four([100_000_000, 100_000_000, 100_000_000, 100_000_000], 'lta')),
    CommercialPaper: unit(four([5_000_000, 6_000_000, 7_000_000, 8_000_000], 'cp')),
    FinanceLeaseLiabilityCurrent: unit([fact(2026, 'FY', 2_000_000, 'a4')]),
  }));
  const total = resolved.values['balance_sheet.total_debt'];
  assert.equal(total[3].value, null, 'Separate same-period lease debt keeps borrowing-only family fail-closed');
}

{
  const resolved = attachVerifiedTotalDebtFromSec(baseDataset(), bundle({
    LongTermDebtCurrent: unit(four([10_000_000, 11_000_000, 12_000_000, 13_000_000], 'ltc')),
    LongTermDebtNoncurrent: unit(four([90_000_000, 89_000_000, 88_000_000, 87_000_000], 'ltnc')),
    LongTermDebt: unit(four([100_000_000, 100_000_000, 100_000_000, 101_000_000], 'lta')),
    CommercialPaper: unit(four([5_000_000, 6_000_000, 7_000_000, 8_000_000], 'cp')),
  }));
  const total = resolved.values['balance_sheet.total_debt'];
  assert.equal(total[3].value, null, 'LongTermDebt must reconcile to current plus noncurrent components');
}

{
  const paperFacts = four([5_000_000, 6_000_000, 7_000_000, 8_000_000], 'cp');
  paperFacts[3] = { ...paperFacts[3], end: '2026-12-30' };
  const resolved = attachVerifiedTotalDebtFromSec(baseDataset(), bundle({
    LongTermDebtCurrent: unit(four([10_000_000, 11_000_000, 12_000_000, 13_000_000], 'ltc')),
    LongTermDebtNoncurrent: unit(four([90_000_000, 89_000_000, 88_000_000, 87_000_000], 'ltnc')),
    LongTermDebt: unit(four([100_000_000, 100_000_000, 100_000_000, 100_000_000], 'lta')),
    CommercialPaper: unit(paperFacts),
  }));
  const total = resolved.values['balance_sheet.total_debt'];
  assert.equal(total[3].value, null, 'Debt-family components must share the exact same balance-sheet instant');
}

{
  const resolved = attachVerifiedTotalDebtFromSec(baseDataset(), bundle({
    LongTermDebtNoncurrent: unit([fact(2026, 'FY', 77_000_000, 'a4')]),
    ShortTermBorrowings: unit([fact(2026, 'FY', 10_000_000, 'a4')]),
  }));
  assert.equal(resolved.values['balance_sheet.total_debt'], undefined, 'Incomplete/overlapping components must not synthesize total debt');
}

console.log('SEC total debt resolution checks passed');
