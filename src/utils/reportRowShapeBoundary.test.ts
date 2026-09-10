import assert from 'node:assert/strict';
import { validateAndPrepareReport } from './reportValidation';

const periods = ['Q1 FY26', 'Q2 FY26', 'Q3 FY26', 'Q4 FY26'];
const ends = ['2025-09-30', '2025-12-31', '2026-03-31', '2026-06-30'];

const makeRowReport = () => ({
  ticker: 'MSFT',
  financial_statements: {
    units: 'USD millions',
    income_statement: periods.map((period, index) => ({
      period,
      period_ended: ends[index],
      revenue: 100 + index,
      cost_of_revenue: 40 + index,
      gross_profit: 60,
      operating_income: 30,
      net_income: 20 + index,
      diluted_eps: 2 + index * 0.1,
    })),
    balance_sheet: periods.map((period, index) => ({
      period,
      period_ended: ends[index],
      cash_and_cash_equivalents: 20 + index,
      total_assets: 100 + index,
      total_liabilities: 60 + index,
      stockholders_equity: 40,
    })),
    cash_flow_statement: periods.map((period, index) => ({
      period,
      period_ended: ends[index],
      operating_cash_flow: 10 + index,
      capital_expenditures: 2,
      free_cash_flow: 8 + index,
    })),
  },
});

{
  const prepared = validateAndPrepareReport(makeRowReport(), 'MSFT');
  const fs = prepared.report?.financial_statements as any;
  assert.ok(fs, 'row-oriented statements should remain available when they normalize losslessly');
  assert.deepEqual(fs.periods, periods);
  assert.deepEqual(fs.period_end_dates, ends);
  assert.deepEqual(fs.income_statement.revenue, [100, 101, 102, 103]);
  assert.deepEqual(fs.income_statement.cogs, [40, 41, 42, 43]);
  assert.deepEqual(fs.income_statement.eps_diluted, [2, 2.1, 2.2, 2.3]);
  assert.deepEqual(fs.balance_sheet.cash_and_equivalents, [20, 21, 22, 23]);
  assert.deepEqual(fs.balance_sheet.total_equity, [40, 40, 40, 40]);
  assert.deepEqual(fs.cash_flow.capex, [2, 2, 2, 2]);
  assert.deepEqual(fs.cash_flow.free_cash_flow, [8, 9, 10, 11]);
  assert.ok(prepared.validation.issues.some(issue => issue.code === 'REPORT_FINANCIAL_STATEMENTS_ROW_SHAPE_NORMALIZED'));
  assert.ok(!prepared.validation.issues.some(issue => issue.code === 'INVALID_FISCAL_PERIODS'));
  assert.ok(!prepared.validation.issues.some(issue => issue.code === 'INVALID_STATEMENT_SERIES'));
}

{
  const mismatched = makeRowReport();
  mismatched.financial_statements.balance_sheet[1].period = 'Q2 WRONG';
  const prepared = validateAndPrepareReport(mismatched, 'MSFT');
  assert.equal(prepared.report?.financial_statements, undefined);
  assert.ok(prepared.validation.issues.some(issue => issue.code === 'REPORT_FINANCIAL_STATEMENTS_QUARANTINED'));
  assert.ok(!prepared.validation.issues.some(issue => issue.code === 'INVALID_STATEMENT_SERIES'));
}

{
  const nonNumeric = makeRowReport() as any;
  nonNumeric.financial_statements.income_statement[0].revenue = '100';
  const prepared = validateAndPrepareReport(nonNumeric, 'MSFT');
  assert.equal(prepared.report?.financial_statements, undefined);
  assert.ok(prepared.validation.issues.some(issue => issue.code === 'REPORT_FINANCIAL_STATEMENTS_QUARANTINED'));
}

console.log('reportRowShapeBoundary.test.ts passed');
