import assert from 'node:assert/strict';
import { buildSecCoverageDiagnostics } from './secCoverageDiagnostics';
import type { SecCompanyBundleLike } from './secFinancialMapper';

const instant = (conceptValue: number) => ({
  end: '2026-06-30', val: conceptValue, fy: 2026, fp: 'Q2', form: '10-Q', filed: '2026-08-01', accn: 'q2',
});
const duration = (start: string, end: string, val: number, fp: 'Q1' | 'Q2') => ({
  start, end, val, fy: 2026, fp, form: '10-Q', filed: '2026-08-01', accn: fp.toLowerCase(),
});
const usd = (facts: any[], label?: string) => ({ label, units: { USD: facts } });

const bundle: SecCompanyBundleLike = {
  identity: { cik: '0000000001', ticker: 'TEST', title: 'Test' },
  submissions: { cik: '0000000001' },
  retrievedAt: '2026-08-02T00:00:00.000Z',
  companyFacts: {
    cik: 1,
    facts: {
      'us-gaap': {
        LongTermDebtCurrent: usd([instant(12_000_000)], 'Current portion of long-term debt'),
        LongTermDebtNoncurrent: usd([instant(88_000_000)], 'Long-term debt, noncurrent'),
        AvailableForSaleSecuritiesDebtSecuritiesCurrent: usd([instant(25_000_000)], 'Current AFS debt securities'),
        NetCashProvidedByUsedInOperatingActivities: usd([
          duration('2026-01-01', '2026-03-31', 20_000_000, 'Q1'),
          duration('2026-01-01', '2026-06-30', 45_000_000, 'Q2'),
        ]),
        PaymentsToAcquireProductiveAssets: usd([
          duration('2026-01-01', '2026-03-31', 5_000_000, 'Q1'),
          duration('2026-01-01', '2026-06-30', 11_000_000, 'Q2'),
        ]),
      },
    },
  },
};

const diagnostics = buildSecCoverageDiagnostics(bundle);
const currentDebt = diagnostics.debt.find(item => item.concept === 'LongTermDebtCurrent');
assert.equal(currentDebt?.present, true);
assert.equal(currentDebt?.normalizedQuarterCount, 1);
assert.equal(currentDebt?.latestEnd, '2026-06-30');
assert.ok(diagnostics.debt.find(item => item.concept === 'DebtCurrent')?.present === false);
assert.equal(
  diagnostics.investments.find(item => item.concept === 'AvailableForSaleSecuritiesDebtSecuritiesCurrent')?.present,
  true,
);
assert.equal(diagnostics.cash_flow.find(item => item.concept === 'PaymentsToAcquireProductiveAssets')?.normalizedQuarterCount, 2);

console.log('SEC coverage diagnostic checks passed');
