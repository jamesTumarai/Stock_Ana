import type { ReportData, ReportValidationIssue, ReportValidationResult } from '../types';
import { buildVerifiedStatementPeriods } from './verifiedFinancialStatements';
import type { CanonicalFinancialDataset } from './financialValue';

export interface ReportCompletion {
  executionStatus: 'COMPLETED' | 'FAILED';
  coverageStatus: 'COMPLETE' | 'PARTIAL';
  consistencyStatus: 'PASS' | 'WARNING' | 'FAIL';
  valuationStatus: 'PASS' | 'UNAVAILABLE' | 'FAIL';
  qualityStatus: 'PASS' | 'WARNING' | 'FAIL';
  persistenceStatus: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  freshnessStatus?: 'CURRENT' | 'STALE' | 'UNVERIFIED';
  sourceSnapshotDate?: string | null;
  coreFactsResolved?: number | null;
  coreFactsExpected?: number | null;
  unexpectedFalseNaCandidates?: number | null;
  diagnosticCodes: string[];
  missingSections: string[];
  fatalIssueCodes: string[];
}

/** Optional sections remain quarantined by validation. Only identity/accounting
 * structural failures prevent saving the otherwise completed research report.
 * Unknown critical rules fail closed until their dependency is classified. */
export function isFatalReportIssue(item: ReportValidationIssue): boolean {
  if (item.severity !== 'critical') return false;
  if (item.code === 'VALUATION_NON_DETERMINISTIC_OUTPUT') return true;
  if (['valuation', 'market_data', 'conviction'].includes(item.section)) return false;
  if (item.code === 'CURRENT_PRICE_CONFLICT') return false;
  return true;
}

export function resolveReportCompletion(report: ReportData, validation: ReportValidationResult): ReportCompletion {
  const missing = new Set<string>();
  if(report.generation_review?.status==='PRIMARY_ONLY')missing.add('ai_review');
  const fs = report.financial_statements;
  const ds = (report.canonical_financials ?? fs?.verified_dataset) as CanonicalFinancialDataset | undefined;
  // Source reconciliation diagnostics survive normalization and persistence. A
  // rejected optional observation is partial coverage, not failed execution.
  const sourceWarnings = ds?.provenanceWarnings.filter(item => item.severity !== 'info') ?? [];
  const unresolvedSourceObservations = sourceWarnings.some(warning =>
    Object.values(ds?.values ?? {}).some(series => series.some(value =>
      value.value === null && value.verification !== 'verified' && value.derivation?.includes(warning.code))));
  const audit = ds?.resolutionAudit;
  const latestPeriod = ds?.periods.at(-1);
  const ends = new Set(Object.values(ds?.values ?? {}).flat().filter(f => f.period === latestPeriod
    && f.verification === 'verified' && f.periodEnd).map(f => f.periodEnd!));
  const sourceSnapshotDate = ends.size === 1 ? [...ends][0] : null;
  const reference = Date.parse(report.generated_at || report.as_of_date || '');
  const age = sourceSnapshotDate ? (reference - Date.parse(sourceSnapshotDate)) / 86400000 : NaN;
  const freshnessStatus = !Number.isFinite(age) || age < 0 ? 'UNVERIFIED'
    : age > (fs?.fiscal_period_type === 'annual' ? 460 : 200) ? 'STALE' : 'CURRENT';
  if (report.analysis_type !== 'technical') {
    if (!fs || fs.quality_status === 'unavailable') missing.add('financial_statements');
    const latest = fs?.verified_dataset ? buildVerifiedStatementPeriods(fs.verified_dataset).at(-1) : undefined;
    if (fs?.verified_dataset && (!latest || Object.keys(latest.rejected).length > 0
      || Object.values(fs.verified_dataset.values).some(series => !series.some(v => v.period === latest.label && v.value !== null)))) {
      missing.add('financial_statements');
    }
    if (report.intrinsic_value?.canonical_run?.status !== 'AVAILABLE') missing.add('valuation');
    if (report.verdict?.conviction_score == null) missing.add('conviction');
    if (!ds?.sourceCoverage?.verifiedValues) missing.add('verified_financial_sources');
    if (audit?.falseNegativeCandidateCount) missing.add('source_resolution');
    if (unresolvedSourceObservations) missing.add('source_reconciliation');
  }
  for (const item of validation.issues) if (item.severity !== 'info') missing.add(item.section);
  const fatalIssueCodes = [...new Set(validation.issues.filter(isFatalReportIssue).map(item => item.code))];
  const run = report.intrinsic_value?.canonical_run;
  const contradiction = validation.issues.some(item => item.severity === 'critical'
    && ['cross_section', 'schema', 'financial_statements'].includes(item.section));
  const consistencyStatus = contradiction ? 'FAIL'
    : validation.issues.some(item => item.section === 'cross_section' || item.code === 'CROSS_SECTION_VALUE_MISMATCH')
      ? 'WARNING' : 'PASS';
  const valuationStatus = run?.status === 'NON_DETERMINISTIC' ? 'FAIL'
    : run ? run.status === 'AVAILABLE' ? 'PASS' : 'UNAVAILABLE'
      : 'UNAVAILABLE';
  const executionStatus = fatalIssueCodes.length ? 'FAILED' : 'COMPLETED';
  const coverageStatus = missing.size ? 'PARTIAL' : 'COMPLETE';
  const qualityStatus = executionStatus === 'FAILED' || consistencyStatus === 'FAIL'
    || valuationStatus === 'FAIL' ? 'FAIL'
    : consistencyStatus === 'WARNING' || sourceWarnings.length > 0 || valuationStatus === 'UNAVAILABLE' || freshnessStatus === 'STALE'
      || coverageStatus === 'PARTIAL' ? 'WARNING' : 'PASS';
  return { executionStatus: fatalIssueCodes.length ? 'FAILED' : 'COMPLETED',
    coverageStatus, consistencyStatus, valuationStatus, qualityStatus,
    persistenceStatus: 'PENDING',
    freshnessStatus, sourceSnapshotDate,
    coreFactsResolved: audit?.coreFactsResolved ?? null, coreFactsExpected: audit?.coreFactsExpected ?? null,
    unexpectedFalseNaCandidates: audit?.falseNegativeCandidateCount ?? null,
    diagnosticCodes: [...new Set(validation.issues.map(item => item.code)
      .concat(sourceWarnings.map(item => item.code))
      .concat(run?.missingInputs ?? (report.analysis_type === 'technical' ? [] : ['CANONICAL_VALUATION_RUN_MISSING']))
      .concat(report.generation_review?.status==='PRIMARY_ONLY'?['AI_REVIEW_INCOMPLETE']:[]))].sort(),
    missingSections: [...missing].sort(), fatalIssueCodes };
}

/** A valid partial report may finalize, while a quality PASS requires stronger evidence. */
export function canFinalizeReport(completion: ReportCompletion): boolean {
  return completion.executionStatus === 'COMPLETED';
}

export function canMarkQualityPassed(completion: ReportCompletion): boolean {
  return completion.qualityStatus === 'PASS'
    && completion.consistencyStatus === 'PASS'
    && completion.valuationStatus === 'PASS';
}
