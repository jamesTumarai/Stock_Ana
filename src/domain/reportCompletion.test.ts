import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canFinalizeReport, canMarkQualityPassed, resolveReportCompletion,
} from './reportCompletion';

const validation = (issues: any[] = []) => ({ status: issues.length ? 'warning' : 'valid',
  issues, checked_at: '2026-09-30T00:00:00Z', schema_version: 3 }) as any;
const report = (runStatus: string = 'AVAILABLE') => ({
  ticker: 'GENERIC', analysis_type: 'fundamental',
  financial_statements: { periods: ['Q2 2026'],
    income_statement: { revenue: [100], net_income: [10] },
    balance_sheet: {}, cash_flow: {}, quality_status: 'partial' },
  intrinsic_value: { summary: { base_case_fair_value: runStatus === 'AVAILABLE' ? 50 : null },
    canonical_run: { status: runStatus, primaryMethod: 'SOTP', missingInputs: [] } },
  verdict: { conviction_score: 65 },
}) as any;

test('a completed primary report without validator review is saveable with an explicit warning', () => {
  const input=report(); input.generation_review={status:'PRIMARY_ONLY',reason:'VALIDATOR_OUTPUT_UNAVAILABLE'};
  const result=resolveReportCompletion(input,validation());
  assert.equal(canFinalizeReport(result),true);
  assert.equal(result.executionStatus,'COMPLETED');
  assert.equal(result.coverageStatus,'PARTIAL');
  assert.equal(result.qualityStatus,'WARNING');
  assert.ok(result.missingSections.includes('ai_review'));
  assert.ok(result.diagnosticCodes.includes('AI_REVIEW_INCOMPLETE'));
});

test('completed partial research is finalizable but does not claim a quality PASS', () => {
  const result = resolveReportCompletion(report(), validation([{
    code: 'OPTIONAL_HISTORY_MISSING', severity: 'warning', section: 'financial_statements',
  }]));
  assert.equal(result.executionStatus, 'COMPLETED');
  assert.equal(result.coverageStatus, 'PARTIAL');
  assert.equal(result.qualityStatus, 'WARNING');
  assert.equal(result.persistenceStatus, 'PENDING');
  assert.equal(canFinalizeReport(result), true);
  assert.equal(canMarkQualityPassed(result), false);
});

test('rejected source cost signs remain visible in report health without failing execution', () => {
  const input = report();
  input.canonical_financials = { periods: [], values: {
    'income_statement.operating_expenses': [{value:null,verification:'unverified',
      derivation:'COST_SIGN_CONVENTION_MISMATCH: rejected cumulative signs.'}],
  }, sourceCoverage: { verifiedValues: 1 },
    provenanceWarnings: [{ code: 'COST_SIGN_CONVENTION_MISMATCH', severity: 'warning',
      message: 'Annual and YTD cost source observations use opposite signs.' }] };
  const result = resolveReportCompletion(input, validation());
  assert.equal(result.executionStatus, 'COMPLETED');
  assert.equal(result.coverageStatus, 'PARTIAL');
  assert.equal(result.qualityStatus, 'WARNING');
  assert.ok(result.diagnosticCodes.includes('COST_SIGN_CONVENTION_MISMATCH'));
  assert.ok(result.missingSections.includes('source_reconciliation'));
});

test('retained-source reconciliation warnings do not create missing statement coverage', () => {
  const input = report();
  input.canonical_financials = { periods: [], values: {}, sourceCoverage: { verifiedValues: 1 },
    provenanceWarnings: [{ code: 'DEBT_PRESENTATION_DISAGREEMENT', severity: 'warning',
      message: 'Accepted verified debt retained; alternate presentation disagrees.' }] };
  const result = resolveReportCompletion(input, validation());
  assert.equal(result.coverageStatus, 'COMPLETE');
  assert.equal(result.qualityStatus, 'WARNING');
  assert.equal(result.consistencyStatus, 'PASS');
  assert.ok(result.diagnosticCodes.includes('DEBT_PRESENTATION_DISAGREEMENT'));
  assert.ok(!result.missingSections.includes('source_reconciliation'));
});

test('cross-section contradiction fails quality while partial research remains identifiable', () => {
  const result = resolveReportCompletion(report(), validation([{
    code: 'CROSS_SECTION_VALUE_MISMATCH', severity: 'critical', section: 'cross_section',
  }]));
  assert.equal(result.consistencyStatus, 'FAIL');
  assert.equal(result.qualityStatus, 'FAIL');
  assert.equal(canMarkQualityPassed(result), false);
});

test('same-input valuation nondeterminism fails finalization', () => {
  const result = resolveReportCompletion(report('NON_DETERMINISTIC'), validation([{
    code: 'VALUATION_NON_DETERMINISTIC_OUTPUT', severity: 'critical', section: 'valuation',
  }]));
  assert.equal(result.valuationStatus, 'FAIL');
  assert.equal(result.executionStatus, 'FAILED');
  assert.equal(canFinalizeReport(result), false);
});

test('legacy fair-value text without a canonical run cannot receive a quality PASS', () => {
  const legacy = report();
  delete legacy.intrinsic_value.canonical_run;
  const result = resolveReportCompletion(legacy, validation());
  assert.equal(result.valuationStatus, 'UNAVAILABLE');
  assert.equal(result.qualityStatus, 'WARNING');
  assert.ok(result.diagnosticCodes.includes('CANONICAL_VALUATION_RUN_MISSING'));
  assert.equal(canFinalizeReport(result), true);
});
