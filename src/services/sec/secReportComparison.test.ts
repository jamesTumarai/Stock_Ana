import assert from 'node:assert/strict';
import type { CanonicalFinancialDataset, CanonicalFinancialValue } from '../../domain/financialValue';
import type { ReportData } from '../../types';
import { compareSecCanonicalToReport } from './secReportComparison';

const periods = ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'];
const makeSeries = (
  key: string,
  statement: CanonicalFinancialValue['statement'],
  values: number[],
): CanonicalFinancialValue[] => periods.map((period, index) => ({
  metric: key,
  statement,
  value: values[index],
  unit: key === 'eps_diluted' ? 'per_share' : 'USD_M',
  period,
  type: key === 'free_cash_flow' ? 'derived' : 'reported',
  verification: 'verified',
  source: { provider: 'SEC EDGAR XBRL', documentUrl: 'https://www.sec.gov/test', periodEnd: '2026-12-31' },
}));

const dataset = (): CanonicalFinancialDataset => ({
  schemaVersion: 1,
  generatedBy: 'lumina-financial-provenance-v1+sec-xbrl-v1',
  ticker: 'TEST',
  currency: 'USD',
  periods,
  values: {
    'income_statement.revenue': makeSeries('revenue', 'income_statement', [100, 110, 120, 130]),
    'income_statement.net_income': makeSeries('net_income', 'income_statement', [10, 11, 12, 13]),
    'income_statement.eps_diluted': makeSeries('eps_diluted', 'income_statement', [0.10, 0.11, 0.12, 0.13]),
    'balance_sheet.cash_and_equivalents': makeSeries('cash_and_equivalents', 'balance_sheet', [20, 21, 22, 23]),
    'balance_sheet.total_debt': makeSeries('total_debt', 'balance_sheet', [50, 49, 48, 47]),
    'cash_flow.operating_cash_flow': makeSeries('operating_cash_flow', 'cash_flow', [20, 22, 24, 26]),
    'cash_flow.capex': makeSeries('capex', 'cash_flow', [5, 5, 6, 6]),
    'cash_flow.free_cash_flow': makeSeries('free_cash_flow', 'cash_flow', [15, 17, 18, 20]),
  },
  sourceCoverage: { sourceLinkedValues: 0, verifiedValues: 32, totalValues: 32, nonNullValues: 32, missingValues: 0 },
  provenanceStatus: 'verified',
  provenanceWarnings: [],
});

const report = (): ReportData => ({
  generated_at: '2026-09-10T00:00:00Z',
  ticker: 'TEST',
  summary: 'fixture',
  financial_statements: {
    currency: 'USD',
    fiscal_period_type: 'quarterly',
    periods,
    income_statement: {
      revenue: [100, 110, 120, 130],
      net_income: [10, 11, 12, 13],
      eps_diluted: [0.10, 0.11, 0.12, 0.13],
    },
    balance_sheet: {
      cash_and_equivalents: [20, 21, 22, 23],
      total_debt: [50, 49, 48, 47],
    },
    cash_flow: {
      operating_cash_flow: [20, 22, 24, 26],
      capex: [-5, -5, -6, -6],
      free_cash_flow: [15, 17, 18, 20],
    },
  },
});

{
  const result = compareSecCanonicalToReport(dataset(), report());
  assert.equal(result.periodAlignment, 'aligned');
  assert.equal(result.hasMaterialConflicts, false);
  assert.equal(result.summary.mismatched, 0);
  assert.ok(result.summary.matched > 0);
  const capex = result.comparisons.filter(item => item.key === 'cash_flow.capex');
  assert.ok(capex.every(item => item.status === 'match'), 'Capex sign convention should compare by absolute outflow');
}

{
  const changed = report();
  changed.financial_statements!.income_statement.revenue[3] = 160;
  const result = compareSecCanonicalToReport(dataset(), changed);
  assert.equal(result.hasMaterialConflicts, true);
  const conflict = result.comparisons.find(item => item.key === 'income_statement.revenue' && item.period === 'Q4 2026');
  assert.equal(conflict?.status, 'mismatch');
  assert.ok((conflict?.relativeDifferencePct ?? 0) > 1);
}

{
  const unverified = dataset();
  unverified.values['income_statement.revenue'][2].verification = 'source_linked';
  const result = compareSecCanonicalToReport(unverified, report());
  const row = result.comparisons.find(item => item.key === 'income_statement.revenue' && item.period === 'Q3 2026');
  assert.equal(row?.status, 'report_only');
  assert.equal(row?.secVerification, 'source_linked');
}

{
  const missingReport = report();
  missingReport.financial_statements!.cash_flow.free_cash_flow![1] = null;
  const result = compareSecCanonicalToReport(dataset(), missingReport);
  const row = result.comparisons.find(item => item.key === 'cash_flow.free_cash_flow' && item.period === 'Q2 2026');
  assert.equal(row?.status, 'sec_only');
}

{
  const shifted = report();
  shifted.financial_statements!.periods = ['Q2 2026', 'Q3 2026', 'Q4 2026', 'Q1 2027'];
  const result = compareSecCanonicalToReport(dataset(), shifted);
  assert.equal(result.periodAlignment, 'partial');
  assert.deepEqual(result.comparedPeriods, ['Q2 2026', 'Q3 2026', 'Q4 2026']);
}

{
  const result = compareSecCanonicalToReport(null, report());
  assert.equal(result.periodAlignment, 'none');
  assert.equal(result.comparisons.length, 0);
}

console.log('SEC versus report comparison checks passed');
