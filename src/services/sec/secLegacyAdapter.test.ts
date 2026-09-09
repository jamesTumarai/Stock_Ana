import assert from 'node:assert/strict';
import type { CanonicalFinancialDataset, CanonicalFinancialValue } from '../../domain/financialValue';
import { adaptSecCanonicalToFinancialStatements, assessSecDcfCoverage } from './secLegacyAdapter';
import type { SecShareSnapshot } from './secShareSnapshot';

const periods = ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'];
const source = {
  provider: 'SEC EDGAR XBRL',
  documentUrl: 'https://www.sec.gov/Archives/edgar/data/123/abc/test.htm',
  documentType: '10-K',
  filingDate: '2027-02-01',
  periodEnd: '2026-12-31',
  accessionNumber: '0000000123-27-000001',
  retrievedAt: '2027-02-02T00:00:00Z',
};

const series = (
  metric: string,
  statement: CanonicalFinancialValue['statement'],
  values: Array<number | null>,
): CanonicalFinancialValue[] => periods.map((period, index) => ({
  metric,
  statement,
  value: values[index],
  unit: metric === 'eps_diluted' ? 'per_share' : 'USD_M',
  period,
  periodEnd: index === 3 ? '2026-12-31' : undefined,
  type: metric === 'free_cash_flow' ? 'derived' : 'reported',
  verification: values[index] === null ? 'unverified' : 'verified',
  source: values[index] === null ? undefined : source,
}));

const dataset = (): CanonicalFinancialDataset => {
  const values: Record<string, CanonicalFinancialValue[]> = {
    'income_statement.revenue': series('revenue', 'income_statement', [100, 110, 120, 130]),
    'income_statement.net_income': series('net_income', 'income_statement', [10, 11, 12, 13]),
    'income_statement.eps_diluted': series('eps_diluted', 'income_statement', [0.1, 0.11, 0.12, 0.13]),
    'balance_sheet.cash_and_equivalents': series('cash_and_equivalents', 'balance_sheet', [20, 21, 22, 23]),
    'balance_sheet.short_term_investments': series('short_term_investments', 'balance_sheet', [5, 5, 6, 6]),
    'balance_sheet.total_debt': series('total_debt', 'balance_sheet', [50, 49, 48, 47]),
    'cash_flow.operating_cash_flow': series('operating_cash_flow', 'cash_flow', [20, 22, 24, 26]),
    'cash_flow.capex': series('capex', 'cash_flow', [5, 5, 6, 6]),
    'cash_flow.free_cash_flow': series('free_cash_flow', 'cash_flow', [15, 17, 18, 20]),
  };
  const flat = Object.values(values).flat();
  return {
    schemaVersion: 1,
    generatedBy: 'lumina-financial-provenance-v1+sec-xbrl-v1',
    ticker: 'TEST',
    currency: 'USD',
    periods,
    values,
    sourceCoverage: {
      sourceLinkedValues: 0,
      verifiedValues: flat.filter(item => item.value !== null).length,
      totalValues: flat.length,
      nonNullValues: flat.filter(item => item.value !== null).length,
      missingValues: flat.filter(item => item.value === null).length,
    },
    provenanceStatus: 'verified',
    provenanceWarnings: [],
  };
};

const shares: SecShareSnapshot = {
  ticker: 'TEST',
  currentCommonSharesOutstanding: {
    sharesM: 100,
    end: '2027-01-20',
    filed: '2027-02-01',
    source: { ...source, provider: 'SEC EDGAR XBRL', concept: 'EntityCommonStockSharesOutstanding' } as any,
  },
  latestDilutedWeightedAverageShares: {
    sharesM: 105,
    start: '2026-01-01',
    end: '2026-12-31',
    filed: '2027-02-01',
    source: { ...source, provider: 'SEC EDGAR XBRL', concept: 'WeightedAverageNumberOfDilutedSharesOutstanding' } as any,
  },
  fullyDilutedSharesM: null,
  verification: 'verified',
  caveats: [],
  retrievedAt: '2027-02-02T00:00:00Z',
};

{
  const fs = adaptSecCanonicalToFinancialStatements(dataset());
  assert.ok(fs);
  assert.deepEqual(fs!.income_statement.revenue, [100, 110, 120, 130]);
  assert.deepEqual(fs!.cash_flow.capex, [-5, -5, -6, -6], 'Legacy cash-flow convention must show capex as an outflow');
  assert.deepEqual(fs!.balance_sheet.total_debt, [50, 49, 48, 47]);
  assert.equal(fs!.source?.document_url, source.documentUrl);
}

{
  const gate = assessSecDcfCoverage(dataset(), shares);
  assert.equal(gate.eligible, true);
  assert.equal(gate.currentSharesOutstandingM, 100);
  assert.deepEqual(gate.issues, []);
}

{
  const missingInvestments = dataset();
  missingInvestments.values['balance_sheet.short_term_investments'][3].value = null;
  missingInvestments.values['balance_sheet.short_term_investments'][3].verification = 'unverified';
  const gate = assessSecDcfCoverage(missingInvestments, shares);
  assert.equal(gate.eligible, false);
  assert.ok(gate.issues.some(item => item.code === 'SEC_SHORT_TERM_INVESTMENTS_UNAVAILABLE'));
}

{
  const missingDebt = dataset();
  delete missingDebt.values['balance_sheet.total_debt'];
  const gate = assessSecDcfCoverage(missingDebt, shares);
  assert.equal(gate.eligible, false);
  assert.ok(gate.issues.some(item => item.code === 'SEC_TOTAL_DEBT_UNAVAILABLE'));
}

{
  const wrongShares = structuredClone(shares);
  wrongShares.currentCommonSharesOutstanding!.source.provider = 'AI';
  const gate = assessSecDcfCoverage(dataset(), wrongShares);
  assert.equal(gate.eligible, false);
  assert.ok(gate.issues.some(item => item.code === 'SEC_CURRENT_SHARES_UNAVAILABLE'));
}

{
  const incompleteFcf = dataset();
  incompleteFcf.values['cash_flow.free_cash_flow'][2].value = null;
  incompleteFcf.values['cash_flow.free_cash_flow'][2].verification = 'unverified';
  const gate = assessSecDcfCoverage(incompleteFcf, shares);
  assert.equal(gate.eligible, false);
  assert.ok(gate.issues.some(item => item.code === 'SEC_FCF_INCOMPLETE'));
}

console.log('SEC legacy adapter and DCF coverage checks passed');
