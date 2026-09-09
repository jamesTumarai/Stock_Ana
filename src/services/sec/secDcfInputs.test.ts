import assert from 'node:assert/strict';
import type { CanonicalFinancialDataset, CanonicalFinancialValue } from '../../domain/financialValue';
import { buildSecDcfFinancialInputs } from './secDcfInputs';
import type { SecDcfCoverageAssessment } from './secLegacyAdapter';
import type { SecShareSnapshot } from './secShareSnapshot';

const periods = ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'];

const series = (
  metric: string,
  statement: CanonicalFinancialValue['statement'],
  values: number[],
  options: { periodEnds?: Array<string | undefined>; verification?: CanonicalFinancialValue['verification'] } = {},
): CanonicalFinancialValue[] => values.map((value, index) => ({
  metric,
  statement,
  value,
  unit: 'USD_M',
  period: periods[index],
  periodEnd: options.periodEnds?.[index],
  type: metric === 'free_cash_flow' ? 'derived' : 'reported',
  verification: options.verification ?? 'verified',
  source: {
    provider: 'SEC EDGAR XBRL',
    periodEnd: options.periodEnds?.[index],
    retrievedAt: '2026-09-10T00:00:00.000Z',
  },
}));

const dataset = (): CanonicalFinancialDataset => ({
  schemaVersion: 1,
  generatedBy: 'lumina-financial-provenance-v1+sec-xbrl-v1',
  ticker: 'TEST',
  currency: 'USD',
  periods: [...periods],
  values: {
    'income_statement.revenue': series('revenue', 'income_statement', [100, 120, 140, 160]),
    'cash_flow.free_cash_flow': series('free_cash_flow', 'cash_flow', [15, 19, 21, 24]),
    'balance_sheet.cash_and_equivalents': series('cash_and_equivalents', 'balance_sheet', [20, 21, 22, 23], {
      periodEnds: ['2026-03-31', '2026-06-30', '2026-09-30', '2026-12-31'],
    }),
    'balance_sheet.short_term_investments': series('short_term_investments', 'balance_sheet', [5, 5, 6, 6], {
      periodEnds: ['2026-03-31', '2026-06-30', '2026-09-30', '2026-12-31'],
    }),
    'balance_sheet.total_debt': series('total_debt', 'balance_sheet', [50, 49, 48, 47], {
      periodEnds: ['2026-03-31', '2026-06-30', '2026-09-30', '2026-12-31'],
    }),
  },
  provenanceStatus: 'verified',
  provenanceWarnings: [],
  sourceCoverage: {
    sourceLinkedValues: 0,
    verifiedValues: 20,
    nonNullValues: 20,
    missingValues: 0,
    totalValues: 20,
  },
});

const shareSnapshot = (): SecShareSnapshot => ({
  ticker: 'TEST',
  currentCommonSharesOutstanding: {
    sharesM: 100,
    end: '2027-01-20',
    filed: '2027-02-01',
    source: {
      provider: 'SEC EDGAR XBRL',
      periodEnd: '2027-01-20',
      retrievedAt: '2027-02-02T00:00:00.000Z',
    },
  },
  latestDilutedWeightedAverageShares: null,
  fullyDilutedSharesM: null,
  verification: 'partial',
  caveats: [],
  retrievedAt: '2027-02-02T00:00:00.000Z',
});

const coverage = (): SecDcfCoverageAssessment => ({
  eligible: true,
  periods: [...periods],
  currentSharesOutstandingM: 100,
  issues: [],
});

{
  const result = buildSecDcfFinancialInputs(dataset(), shareSnapshot(), coverage());
  assert.equal(result.eligible, true);
  assert.equal(result.startingRevenueM, 520);
  assert.equal(result.trailingFourFreeCashFlowM, 79);
  assert.equal(result.historicalFcfMarginPct, 15.192308);
  assert.equal(result.cashAndEquivalentsM, 23);
  assert.equal(result.shortTermInvestmentsM, 6);
  assert.equal(result.totalDebtM, 47);
  assert.equal(result.netCashM, -18);
  assert.equal(result.currentSharesOutstandingM, 100);
  assert.equal(result.latestBalanceSheetPeriodEnd, '2026-12-31');
  assert.equal(result.shareAsOf, '2027-01-20');
  assert.equal(result.sourcePeriod, 'Q1 2026–Q4 2026');
  assert.deepEqual(result.issues, []);
}

{
  const mismatched = dataset();
  mismatched.values['balance_sheet.short_term_investments'][3].periodEnd = '2026-12-30';
  const result = buildSecDcfFinancialInputs(mismatched, shareSnapshot(), coverage());
  assert.equal(result.eligible, false);
  assert.equal(result.netCashM, null);
  assert.ok(result.issues.some(issue => issue.code === 'SEC_DCF_INPUT_BALANCE_SHEET_INSTANT_MISMATCH'));
}

{
  const unverifiedDebt = dataset();
  unverifiedDebt.values['balance_sheet.total_debt'][3].verification = 'unverified';
  const result = buildSecDcfFinancialInputs(unverifiedDebt, shareSnapshot(), coverage());
  assert.equal(result.eligible, false);
  assert.equal(result.totalDebtM, null);
  assert.ok(result.issues.some(issue => issue.code === 'SEC_DCF_INPUT_DEBT_UNAVAILABLE'));
}

{
  const failedCoverage = coverage();
  failedCoverage.eligible = false;
  failedCoverage.issues.push({
    code: 'SEC_TOTAL_DEBT_UNAVAILABLE',
    field: 'balance_sheet.total_debt',
    message: 'Verified current-period total debt is required.',
  });
  const result = buildSecDcfFinancialInputs(dataset(), shareSnapshot(), failedCoverage);
  assert.equal(result.eligible, false);
  assert.ok(result.issues.some(issue => issue.code === 'SEC_TOTAL_DEBT_UNAVAILABLE'));
}

{
  const mismatchedShares = shareSnapshot();
  mismatchedShares.ticker = 'OTHER';
  const result = buildSecDcfFinancialInputs(dataset(), mismatchedShares, coverage());
  assert.equal(result.eligible, false);
  assert.ok(result.issues.some(issue => issue.code === 'SEC_DCF_INPUT_TICKER_MISMATCH'));
}

console.log('SEC DCF financial input checks passed');
