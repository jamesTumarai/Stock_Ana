import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import type { CanonicalFinancialDataset } from '../domain/financialValue';
import { adaptSecCanonicalToFinancialStatements } from '../services/sec/secLegacyAdapter';
import { validateAndPrepareReport } from './reportValidation';

const capture = (): CanonicalFinancialDataset => JSON.parse(gunzipSync(readFileSync(new URL(
  '../services/sec/fixtures/historical-balance-public-2026-10-01.json.gz', import.meta.url,
))).toString('utf8')).canonicalFinancials;

const report = (dataset: CanonicalFinancialDataset) => ({
  ticker: dataset.ticker,
  generated_at: '2026-10-01T07:00:00Z',
  analysis_type: 'fundamental',
  company_profile: { sector: 'Financial Services', industry: 'Multi-Sector Holdings', currency: 'USD' },
  verdict: { summary: 'Scoped source test; no modeled value asserted.', key_takeaways: [] },
  canonical_financials: dataset,
  financial_statements: adaptSecCanonicalToFinancialStatements(dataset),
});

test('actual historical source imbalance remains visible without failing a reconciled current report', () => {
  const prepared = validateAndPrepareReport(report(capture()), 'BRK.B');
  assert.equal(prepared.canPersist, true);
  assert.equal(prepared.report?.report_completion?.executionStatus, 'COMPLETED');
  assert.notEqual(prepared.report?.report_completion?.qualityStatus, 'PASS');
  const historical = prepared.validation.issues.filter(issue => issue.code === 'HISTORICAL_BALANCE_SHEET_IMBALANCE');
  assert.equal(historical.length, 2);
  assert.ok(historical.every(issue => issue.severity === 'warning'));
  const summary = prepared.report!.financial_statements!.validation_summary!;
  assert.equal(summary.reconciliation_status, 'failed');
  assert.ok(summary.failed_guards?.some(guard => guard.includes('Q3 2023')));
  assert.ok(summary.passed_guards?.some(guard => guard === 'BALANCE_SHEET_IDENTITY_OK: Q2 2026'));
  assert.equal(summary.discrepancy_amount?.at(-1), 0);
});

test('current and comparative opening-balance conflicts still block persistence', () => {
  for (const period of ['Q2 2024', 'Q2 2025', 'Q2 2026']) {
    const dataset = capture();
    dataset.values['balance_sheet.total_assets'].find(value => value.period === period)!.value! += 100000;
    const prepared = validateAndPrepareReport(report(dataset), dataset.ticker);
    assert.equal(prepared.canPersist, false, period);
    assert.ok(prepared.validation.issues.some(issue => issue.code === 'BALANCE_SHEET_IMBALANCE'
      && issue.severity === 'critical' && issue.message.includes(period)), period);
  }
});

test('the historical warning does not manufacture a balanced or complete statement', () => {
  const dataset = capture();
  const original = structuredClone(dataset.values);
  const prepared = validateAndPrepareReport(report(dataset), dataset.ticker);
  for (const [key, observations] of Object.entries(original)) {
    assert.deepEqual(prepared.report?.canonical_financials?.values[key], observations);
  }
  assert.equal(prepared.report?.report_completion?.coverageStatus, 'PARTIAL');
  assert.ok(prepared.report?.report_completion?.diagnosticCodes.includes('HISTORICAL_BALANCE_SHEET_IMBALANCE'));
  assert.equal(prepared.report?.report_completion?.persistenceStatus, 'PENDING');
});
