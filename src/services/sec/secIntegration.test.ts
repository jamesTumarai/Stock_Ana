import assert from 'node:assert/strict';
import { buildSecVerifiedIntegrationPackage } from './secIntegration';
import type { SecCompanyBundleLike } from './secFinancialMapper';

const instant = (fy: number, fp: 'Q1' | 'Q2' | 'Q3' | 'FY', val: number, accn: string) => ({
  end: fp === 'Q1' ? `${fy}-03-31` : fp === 'Q2' ? `${fy}-06-30` : fp === 'Q3' ? `${fy}-09-30` : `${fy}-12-31`,
  val, fy, fp, form: fp === 'FY' ? '10-K' : '10-Q', filed: `${fy}-12-31`, accn,
});
const duration = (fy: number, fp: 'Q1' | 'Q2' | 'Q3' | 'FY', val: number, accn: string) => ({
  start: `${fy}-01-01`,
  end: fp === 'Q1' ? `${fy}-03-31` : fp === 'Q2' ? `${fy}-06-30` : fp === 'Q3' ? `${fy}-09-30` : `${fy}-12-31`,
  val, fy, fp, form: fp === 'FY' ? '10-K' : '10-Q', filed: `${fy}-12-31`, accn,
});
const usd = (facts: any[]) => ({ units: { USD: facts } });
const shares = (facts: any[]) => ({ units: { shares: facts } });

const bundle: SecCompanyBundleLike = {
  identity: { cik: '0000000123', ticker: 'TEST', title: 'Test Corp' },
  submissions: {
    cik: '0000000123',
    filings: { recent: {
      accessionNumber: ['q1', 'q2', 'q3', 'fy'],
      primaryDocument: ['q1.htm', 'q2.htm', 'q3.htm', 'fy.htm'],
      form: ['10-Q', '10-Q', '10-Q', '10-K'],
      filingDate: ['2026-05-01', '2026-08-01', '2026-11-01', '2027-02-01'],
    } },
  },
  companyFacts: {
    cik: 123,
    facts: {
      dei: {
        EntityCommonStockSharesOutstanding: shares([
          { ...instant(2026, 'FY', 100_000_000, 'fy'), end: '2027-01-20', filed: '2027-02-01' },
        ]),
      },
      'us-gaap': {
        RevenueFromContractWithCustomerExcludingAssessedTax: usd([
          duration(2026, 'Q1', 100_000_000, 'q1'),
          duration(2026, 'Q2', 220_000_000, 'q2'),
          duration(2026, 'Q3', 360_000_000, 'q3'),
          duration(2026, 'FY', 520_000_000, 'fy'),
        ]),
        NetIncomeLoss: usd([
          duration(2026, 'Q1', 10_000_000, 'q1'),
          duration(2026, 'Q2', 22_000_000, 'q2'),
          duration(2026, 'Q3', 36_000_000, 'q3'),
          duration(2026, 'FY', 52_000_000, 'fy'),
        ]),
        NetCashProvidedByUsedInOperatingActivities: usd([
          duration(2026, 'Q1', 20_000_000, 'q1'),
          duration(2026, 'Q2', 45_000_000, 'q2'),
          duration(2026, 'Q3', 73_000_000, 'q3'),
          duration(2026, 'FY', 105_000_000, 'fy'),
        ]),
        PaymentsToAcquirePropertyPlantAndEquipment: usd([
          duration(2026, 'Q1', 5_000_000, 'q1'),
          duration(2026, 'Q2', 11_000_000, 'q2'),
          duration(2026, 'Q3', 18_000_000, 'q3'),
          duration(2026, 'FY', 26_000_000, 'fy'),
        ]),
        CashAndCashEquivalentsAtCarryingValue: usd([
          instant(2026, 'Q1', 20_000_000, 'q1'), instant(2026, 'Q2', 21_000_000, 'q2'),
          instant(2026, 'Q3', 22_000_000, 'q3'), instant(2026, 'FY', 23_000_000, 'fy'),
        ]),
        ShortTermInvestments: usd([
          instant(2026, 'Q1', 5_000_000, 'q1'), instant(2026, 'Q2', 5_000_000, 'q2'),
          instant(2026, 'Q3', 6_000_000, 'q3'), instant(2026, 'FY', 6_000_000, 'fy'),
        ]),
        DebtCurrent: usd([
          instant(2026, 'Q1', 10_000_000, 'q1'), instant(2026, 'Q2', 10_000_000, 'q2'),
          instant(2026, 'Q3', 9_000_000, 'q3'), instant(2026, 'FY', 9_000_000, 'fy'),
        ]),
        LongTermDebtNoncurrent: usd([
          instant(2026, 'Q1', 40_000_000, 'q1'), instant(2026, 'Q2', 39_000_000, 'q2'),
          instant(2026, 'Q3', 39_000_000, 'q3'), instant(2026, 'FY', 38_000_000, 'fy'),
        ]),
        WeightedAverageNumberOfDilutedSharesOutstanding: shares([
          duration(2026, 'FY', 105_000_000, 'fy'),
        ]),
      },
    },
  },
  retrievedAt: '2027-02-02T00:00:00.000Z',
};

{
  const result = buildSecVerifiedIntegrationPackage(bundle);
  assert.equal(result.ticker, 'TEST');
  assert.ok(result.canonicalFinancials);
  assert.ok(result.financialStatements);
  assert.ok(result.shareSnapshot);
  assert.deepEqual(result.canonicalFinancials!.values['income_statement.revenue'].map(v => v.value), [100, 120, 140, 160]);
  assert.deepEqual(result.canonicalFinancials!.values['cash_flow.free_cash_flow'].map(v => v.value), [15, 19, 21, 24]);
  assert.deepEqual(result.canonicalFinancials!.values['balance_sheet.total_debt'].map(v => v.value), [50, 49, 48, 47]);
  assert.equal(result.shareSnapshot!.currentCommonSharesOutstanding?.sharesM, 100);
  assert.equal(result.shareSnapshot!.latestDilutedWeightedAverageShares?.sharesM, 105);
  assert.equal(result.dcfCoverage.eligible, true);
}

{
  const missing = structuredClone(bundle) as any;
  delete missing.companyFacts.facts['us-gaap'].ShortTermInvestments;
  const result = buildSecVerifiedIntegrationPackage(missing);
  assert.equal(result.dcfCoverage.eligible, false);
  assert.ok(result.dcfCoverage.issues.some(item => item.code === 'SEC_SHORT_TERM_INVESTMENTS_UNAVAILABLE'));
}

{
  const unavailable = buildSecVerifiedIntegrationPackage(null);
  assert.equal(unavailable.dcfCoverage.eligible, false);
  assert.equal(unavailable.canonicalFinancials, null);
  assert.equal(unavailable.financialStatements, null);
}

console.log('SEC integration package checks passed');
