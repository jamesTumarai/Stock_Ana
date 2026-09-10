from pathlib import Path

report_path = Path('src/utils/reportValidation.ts')
text = report_path.read_text(encoding='utf-8')
start = text.index('const normalizeKnownReportShapeDrift =')
end = text.index('\n\nconst sanitizeTopLevelShapes', start)

replacement = r'''const ROW_STATEMENT_META_KEYS = new Set([
  'period',
  'period_ended',
  'period_end',
  'fiscal_period',
  'fiscal_period_end',
  'date',
  'as_of_date',
]);

const ROW_STATEMENT_ALIASES: Record<'income_statement' | 'balance_sheet' | 'cash_flow', Record<string, string>> = {
  income_statement: {
    cost_of_revenue: 'cogs',
    diluted_eps: 'eps_diluted',
  },
  balance_sheet: {
    cash_and_cash_equivalents: 'cash_and_equivalents',
    stockholders_equity: 'total_equity',
    shareholders_equity: 'total_equity',
  },
  cash_flow: {
    capital_expenditures: 'capex',
    capital_expenditure: 'capex',
  },
};

const exactArrayMatch = <T,>(left: T[], right: T[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const parseExplicitStatementRows = (value: unknown) => {
  if (!Array.isArray(value) || value.length === 0 || !value.every(isRecord)) return null;
  const rows = value as Record<string, any>[];
  const periods = rows.map(row => typeof row.period === 'string' ? row.period.trim() : '');
  if (periods.some(period => !period) || new Set(periods).size !== periods.length) return null;

  const rawPeriodEnds = rows.map(row => row.period_ended ?? row.period_end ?? null);
  const anyPeriodEnd = rawPeriodEnds.some(value => value !== null && value !== undefined);
  let periodEnds: string[] | null = null;
  if (anyPeriodEnd) {
    if (rawPeriodEnds.some(value => typeof value !== 'string' || !value.trim())) return null;
    periodEnds = rawPeriodEnds.map(value => String(value).trim());
  }

  return { rows, periods, periodEnds };
};

const transposeStatementRows = (
  rows: Record<string, any>[],
  sectionName: 'income_statement' | 'balance_sheet' | 'cash_flow',
) => {
  const aliases = ROW_STATEMENT_ALIASES[sectionName];
  const metricKeys = Array.from(new Set(
    rows.flatMap(row => Object.keys(row).filter(key => !ROW_STATEMENT_META_KEYS.has(key))),
  ));
  const output: Record<string, (number | null)[]> = {};

  for (const sourceKey of metricKeys) {
    const targetKey = aliases[sourceKey] ?? sourceKey;
    const values: (number | null)[] = [];
    for (const row of rows) {
      const raw = row[sourceKey];
      if (raw === undefined || raw === null) {
        values.push(null);
      } else if (isFiniteNumber(raw)) {
        values.push(raw);
      } else {
        return null;
      }
    }

    if (output[targetKey]) {
      if (!exactArrayMatch(output[targetKey], values)) return null;
      continue;
    }
    output[targetKey] = values;
  }

  return output;
};

const normalizeRowOrientedFinancialStatements = (fs: Record<string, any>) => {
  if (fs.cash_flow !== undefined && fs.cash_flow_statement !== undefined) return null;

  const income = parseExplicitStatementRows(fs.income_statement);
  const balance = parseExplicitStatementRows(fs.balance_sheet);
  const cash = parseExplicitStatementRows(fs.cash_flow ?? fs.cash_flow_statement);
  if (!income || !balance || !cash) return null;
  if (!exactArrayMatch(income.periods, balance.periods) || !exactArrayMatch(income.periods, cash.periods)) return null;

  const suppliedPeriods = fs.periods;
  if (suppliedPeriods !== undefined && suppliedPeriods !== null) {
    if (!Array.isArray(suppliedPeriods)
      || suppliedPeriods.some((period: unknown) => typeof period !== 'string' || !period.trim())) return null;
    const normalizedSuppliedPeriods = suppliedPeriods.map((period: string) => period.trim());
    if (!exactArrayMatch(income.periods, normalizedSuppliedPeriods)) return null;
  }

  const periodEndSets = [income.periodEnds, balance.periodEnds, cash.periodEnds];
  const anyPeriodEnds = periodEndSets.some(value => value !== null);
  let periodEndDates: string[] | null = null;
  if (anyPeriodEnds) {
    if (periodEndSets.some(value => value === null)) return null;
    const first = periodEndSets[0] as string[];
    if (!periodEndSets.every(value => exactArrayMatch(first, value as string[]))) return null;
    periodEndDates = first;
  }

  const incomeStatement = transposeStatementRows(income.rows, 'income_statement');
  const balanceSheet = transposeStatementRows(balance.rows, 'balance_sheet');
  const cashFlow = transposeStatementRows(cash.rows, 'cash_flow');
  if (!incomeStatement || !balanceSheet || !cashFlow) return null;

  const metadata = { ...fs };
  delete metadata.periods;
  delete metadata.income_statement;
  delete metadata.balance_sheet;
  delete metadata.cash_flow;
  delete metadata.cash_flow_statement;

  const normalized: Record<string, any> = {
    ...metadata,
    periods: income.periods,
    income_statement: incomeStatement,
    balance_sheet: balanceSheet,
    cash_flow: cashFlow,
  };
  if (periodEndDates) normalized.period_end_dates = periodEndDates;
  return normalized;
};

const normalizeKnownReportShapeDrift = (report: Record<string, any>, issues: ReportValidationIssue[]) => {
  const ratios = report.valuation_ratios;
  if (isRecord(ratios)) {
    const normalizedRatios = Object.entries(ratios).flatMap(([name, value]) => {
      if (value === null || isFiniteNumber(value)) return [{ name, value }];
      return [];
    });
    if (normalizedRatios.length > 0) {
      report.valuation_ratios = normalizedRatios;
      issue(
        issues,
        'VALUATION_RATIOS_SHAPE_NORMALIZED',
        'warning',
        'valuation',
        'Converted scalar valuation-ratio fields into the canonical ratio array without changing values.',
        'valuation_ratios',
      );
    }
  }

  const fs = report.financial_statements;
  if (!isRecord(fs)) return;

  const hasRowStatementShape = [
    fs.income_statement,
    fs.balance_sheet,
    fs.cash_flow,
    fs.cash_flow_statement,
  ].some(Array.isArray);

  if (hasRowStatementShape) {
    const normalized = normalizeRowOrientedFinancialStatements(fs);
    if (normalized) {
      report.financial_statements = normalized;
      issue(
        issues,
        'REPORT_FINANCIAL_STATEMENTS_ROW_SHAPE_NORMALIZED',
        'warning',
        'financial_statements',
        'Transposed explicitly labeled fiscal-period rows into canonical metric series without changing financial values.',
        'financial_statements',
      );
      return;
    }

    delete report.financial_statements;
    issue(
      issues,
      'REPORT_FINANCIAL_STATEMENTS_QUARANTINED',
      'warning',
      'financial_statements',
      'Row-oriented report financial statements were omitted because their explicit periods or numeric series could not be normalized losslessly.',
      'financial_statements',
    );
    return;
  }

  if (!Array.isArray(fs.periods) || fs.periods.length === 0) {
    delete report.financial_statements;
    issue(
      issues,
      'REPORT_FINANCIAL_STATEMENTS_QUARANTINED',
      'warning',
      'financial_statements',
      'Report financial statements were omitted because explicit fiscal period labels were unavailable; no periods were inferred.',
      'financial_statements.periods',
    );
  }
};'''

report_path.write_text(text[:start] + replacement + text[end:], encoding='utf-8')

test_path = Path('src/utils/reportRowShapeBoundary.test.ts')
test_path.write_text(r'''import assert from 'node:assert/strict';
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
''', encoding='utf-8')

# Do not leave temporary patch plumbing in the product diff.
for helper in [
    Path('.github/scripts/phase3v-row-statement-boundary.py'),
    Path('.github/workflows/phase3v-row-statement-boundary.yml'),
]:
    if helper.exists():
        helper.unlink()
