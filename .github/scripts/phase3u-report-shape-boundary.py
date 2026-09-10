from pathlib import Path

p = Path('src/utils/reportValidation.ts')
s = p.read_text()
anchor = "const sanitizeTopLevelShapes = (report: Record<string, any>, issues: ReportValidationIssue[]) => {\n"
insert = r'''const normalizeKnownReportShapeDrift = (report: Record<string, any>, issues: ReportValidationIssue[]) => {
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
  if (isRecord(fs) && (!Array.isArray(fs.periods) || fs.periods.length === 0)) {
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
};

'''
if 'const normalizeKnownReportShapeDrift' not in s:
    if anchor not in s:
        raise SystemExit('anchor not found')
    s = s.replace(anchor, insert + anchor, 1)
call_anchor = "  report.generated_by_version = CURRENT_GENERATED_BY_VERSION;\n\n  sanitizeTopLevelShapes(report, issues);"
replacement = "  report.generated_by_version = CURRENT_GENERATED_BY_VERSION;\n\n  normalizeKnownReportShapeDrift(report, issues);\n  sanitizeTopLevelShapes(report, issues);"
if 'normalizeKnownReportShapeDrift(report, issues);' not in s:
    if call_anchor not in s:
        raise SystemExit('call anchor not found')
    s = s.replace(call_anchor, replacement, 1)
p.write_text(s)

Path('src/utils/reportShapeBoundary.test.ts').write_text(r'''import assert from 'node:assert/strict';
import { validateAndPrepareReport } from './reportValidation';

const marketQuotes = {
  MSFT: { symbol: 'MSFT', price: 500, provider: 'test', asOf: new Date().toISOString(), retrievedAt: new Date().toISOString() },
};

const result = validateAndPrepareReport({
  ticker: 'MSFT',
  financial_statements: {
    source: { document_type: '10-K' },
    income_statement: { revenue: [1, 2, 3, 4], net_income: [1, 1, 1, 1] },
    balance_sheet: {},
    cash_flow_statement: { free_cash_flow: [1, 1, 1, 1] },
  },
  valuation_ratios: {
    trailing_pe: 27.4,
    forward_pe: 20.9,
    peg_ratio: 1.62,
  },
}, 'MSFT', { marketQuotes });

assert.ok(result.report);
assert.equal(result.validation.issues.some(i => i.code === 'INVALID_FISCAL_PERIODS'), false);
assert.equal(result.validation.issues.some(i => i.code === 'INVALID_VALUATION_RATIOS_SHAPE'), false);
assert.equal(result.validation.issues.some(i => i.code === 'REPORT_FINANCIAL_STATEMENTS_QUARANTINED'), true);
assert.equal(result.report?.financial_statements, undefined, 'unlabeled financial periods must never be inferred');
assert.deepEqual(
  result.report?.valuation_ratios?.map(r => [r.name, r.value]),
  [['trailing_pe', 27.4], ['forward_pe', 20.9], ['peg_ratio', 1.62]],
  'ratio normalization must preserve supplied numeric values exactly',
);

console.log('Report shape boundary checks passed');
''')
