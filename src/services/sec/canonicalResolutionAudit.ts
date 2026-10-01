import type { CanonicalFinancialDataset } from '../../domain/financialValue';
import { CANONICAL_METRIC_DEFINITIONS, PRIMARY_STATEMENT_LABELS } from './canonicalMetricDefinitions';
import type { SecCompanyFactsResponse } from './secClient';
import { hasDimensionalContext, normalizeDurationFactsToStandaloneQuarters, normalizeInstantFactsToFiscalQuarters } from './xbrlNormalizer';

export type ResolutionFailure = 'NOT_DISCLOSED' | 'NOT_APPLICABLE' | 'REJECTED_ALL_CANDIDATES' | 'SOURCE_FETCH_FAILED' | 'PERIOD_NOT_RESOLVED' | 'NO_SEMANTIC_MAPPING';
export interface ResolutionCandidate {
  concept: string; period?: string; unit: string; start?: string; end?: string;
  reason?: string; compatible: boolean;
}
export interface CanonicalResolutionDiagnostic {
  metricKey: string; period: string; archetype: string;
  sourceCandidates: ResolutionCandidate[]; rejectedCandidates: ResolutionCandidate[];
  status: ResolutionFailure; firstFailingBoundary: string; falseNegativeCandidate: boolean;
}
export interface CanonicalResolutionAudit {
  trueUnavailableCount: number; falseNegativeCandidateCount: number; rejectedCandidateCount: number;
  diagnostics: CanonicalResolutionDiagnostic[];
  health: 'OK' | 'CORE_SOURCE_COVERAGE_ANOMALY';
  coreFactsExpected?: number; coreFactsResolved?: number;
  sourceFailureCount?: number; notApplicableCount?: number;
}

/** Uses the mapper's corrected fiscal identities/cohorts, never raw filing fy
 * alone. Valid YTD with missing predecessor is PERIOD_NOT_RESOLVED, not a false
 * standalone fact. Evidence is compact; raw financial trees are not duplicated.
 */
export function auditCanonicalResolution(facts: SecCompanyFactsResponse, dataset: CanonicalFinancialDataset, archetype = 'unclassified', instantFacts = facts): CanonicalResolutionAudit {
  const result: CanonicalResolutionAudit = {trueUnavailableCount:0,falseNegativeCandidateCount:0,rejectedCandidateCount:0,diagnostics:[],health:'OK'};
  const latest = dataset.periods.at(-1);
  if (!latest) return result;
  const anchor = Object.values(dataset.values).flat().find(v => v.period === latest && v.periodEnd);
  const end = anchor?.periodEnd;
  for (const def of CANONICAL_METRIC_DEFINITIONS) {
    if (dataset.values[def.key]?.find(v => v.period === latest)?.value != null) continue;
    const candidates: ResolutionCandidate[] = [];
    let eligible = false;
    for (const conceptName of def.concepts) {
      const concept = (def.factKind === 'instant' ? instantFacts : facts).facts?.['us-gaap']?.[conceptName];
      for (const [unit, source] of Object.entries(concept?.units || {})) {
        const normalized = unit === def.unit ? (def.factKind === 'instant'
          ? normalizeInstantFactsToFiscalQuarters(source)
          : normalizeDurationFactsToStandaloneQuarters(source,{additive:def.canonicalUnit === 'USD_M'})) : [];
        const compatible = normalized.some(f => f.end === end && f.fiscalYear === anchor?.fiscalYear && f.fiscalQuarter === anchor?.fiscalQuarter);
        for (const fact of source.filter(f => f.end === end)) {
          const reason = unit !== def.unit ? 'UNIT_MISMATCH' : hasDimensionalContext(fact) ? 'DIMENSIONAL_CONTEXT'
            : typeof fact.val !== 'number' || !Number.isFinite(fact.val) ? 'NON_FINITE'
            : Boolean(fact.start) !== (def.factKind === 'duration') ? 'INSTANT_DURATION_MISMATCH'
            : fact.form && !['10-Q','10-Q/A','10-K','10-K/A'].includes(fact.form) ? 'UNSUPPORTED_FORM'
            : !compatible ? 'STANDALONE_PERIOD_PREREQUISITE_MISSING' : undefined;
          candidates.push({concept:`us-gaap:${conceptName}`,period:latest,unit,start:fact.start,end:fact.end,reason,compatible:!reason});
          eligible ||= !reason;
        }
      }
    }
    // An exact extension label is discovery evidence, not acceptance evidence.
    // Without its primary statement/context definition it stays unresolved and
    // diagnosable; no substring match or unknown extension enters accounting.
    const row = PRIMARY_STATEMENT_LABELS.find(r => r.metric === def.metric);
    if (row) for (const [namespace,concepts] of Object.entries(facts.facts || {})) {
      if (['us-gaap','dei'].includes(namespace)) continue;
      for (const [name,concept] of Object.entries(concepts)) {
        if (!row.pattern.test(concept.label || '')) continue;
        for (const [unit,source] of Object.entries(concept.units || {})) for (const f of source.filter(f => f.end === end)) {
          candidates.push({concept:`${namespace}:${name}`,period:latest,unit,start:f.start,end:f.end,compatible:false,reason:'EXTENSION_REQUIRES_PRIMARY_SEMANTIC_EVIDENCE'});
        }
      }
    }
    const applicable = archetype === 'unclassified' || def.archetypeApplicability === 'ALL' || def.archetypeApplicability.includes(archetype);
    const status: ResolutionFailure = !applicable && candidates.length === 0 ? 'NOT_APPLICABLE' : !end ? 'PERIOD_NOT_RESOLVED' : eligible ? 'REJECTED_ALL_CANDIDATES'
      : candidates.some(c => c.reason === 'STANDALONE_PERIOD_PREREQUISITE_MISSING') ? 'PERIOD_NOT_RESOLVED'
      : candidates.some(c => c.reason === 'EXTENSION_REQUIRES_PRIMARY_SEMANTIC_EVIDENCE') ? 'NO_SEMANTIC_MAPPING'
      : candidates.length ? 'REJECTED_ALL_CANDIDATES' : 'NOT_DISCLOSED';
    const rejected = candidates.filter(c => !c.compatible);
    result.rejectedCandidateCount += rejected.length;
    if (eligible) result.falseNegativeCandidateCount++; else result.trueUnavailableCount++;
    result.diagnostics.push({metricKey:def.key,period:latest,archetype,sourceCandidates:candidates,rejectedCandidates:rejected,status,
      firstFailingBoundary:eligible?'CANONICAL_POPULATION':status==='PERIOD_NOT_RESOLVED'?'STANDALONE_PERIOD_RESOLUTION':candidates.length?'SEMANTIC_VALIDATION':'CONCEPT_CANDIDATE',falseNegativeCandidate:eligible});
  }
  const core = ['income_statement.revenue','balance_sheet.total_assets','cash_flow.operating_cash_flow'];
  if (core.every(key => dataset.values[key]?.at(-1)?.value == null) || result.falseNegativeCandidateCount > 0) result.health = 'CORE_SOURCE_COVERAGE_ANOMALY';
  return result;
}

/** Completion may fill an investment/debt fact after the initial mapper audit.
 * Remove resolved gaps without losing rejected-source evidence for remaining gaps.
 */
export function finalizeResolutionAudit(dataset: CanonicalFinancialDataset, archetype: string): void {
  const audit = dataset.resolutionAudit;
  if (!audit) return;
  audit.diagnostics = audit.diagnostics.filter(d => dataset.values[d.metricKey]?.find(v => v.period === d.period)?.value == null)
    .map(d => {
      const def = CANONICAL_METRIC_DEFINITIONS.find(x => x.key === d.metricKey);
      const applicable = !def || def.archetypeApplicability === 'ALL' || def.archetypeApplicability.includes(archetype) || archetype === 'unclassified';
      return {...d,archetype,status:!applicable && !d.sourceCandidates.length ? 'NOT_APPLICABLE' as const : d.status};
    });
  audit.falseNegativeCandidateCount = audit.diagnostics.filter(d => d.falseNegativeCandidate).length;
  audit.trueUnavailableCount = audit.diagnostics.length - audit.falseNegativeCandidateCount;
  audit.rejectedCandidateCount = audit.diagnostics.reduce((sum,d) => sum+d.rejectedCandidates.length,0);
  const core = [['income_statement.revenue'],['income_statement.net_income','income_statement.net_income_parent','income_statement.net_income_common','income_statement.net_income_including_noncontrolling'],['balance_sheet.total_assets'],['balance_sheet.total_liabilities'],['balance_sheet.total_equity','balance_sheet.stockholders_equity'],['cash_flow.operating_cash_flow']];
  audit.coreFactsExpected=core.length;
  audit.coreFactsResolved=core.filter(group=>group.some(key=>dataset.values[key]?.at(-1)?.value != null)).length;
  audit.notApplicableCount=audit.diagnostics.filter(d=>d.status==='NOT_APPLICABLE').length;
  audit.health = audit.falseNegativeCandidateCount || audit.coreFactsResolved <= 1 ? 'CORE_SOURCE_COVERAGE_ANOMALY' : 'OK';
  for (const value of Object.values(dataset.values).flat()) value.mappingKind ||= value.value == null ? 'UNRESOLVED' : value.type === 'derived' ? 'DERIVED' : value.mappingType === 'ISSUER_EXTENSION' ? 'ISSUER_EXTENSION_VERIFIED' : value.mappingType === 'ALIAS' ? 'STANDARD_ALIAS' : 'STANDARD_EXACT';
}

export function unavailableResolutionAudit(status: 'SOURCE_FETCH_FAILED' | 'NO_SEMANTIC_MAPPING' | 'PERIOD_NOT_RESOLVED', archetype = 'unclassified'): CanonicalResolutionAudit {
  return {trueUnavailableCount:CANONICAL_METRIC_DEFINITIONS.length,falseNegativeCandidateCount:0,rejectedCandidateCount:0,health:'CORE_SOURCE_COVERAGE_ANOMALY',
    diagnostics:CANONICAL_METRIC_DEFINITIONS.map(d => ({metricKey:d.key,period:'UNRESOLVED',archetype,sourceCandidates:[],rejectedCandidates:[],status,
      firstFailingBoundary:status === 'SOURCE_FETCH_FAILED' ? 'SOURCE_RETRIEVAL' : status === 'NO_SEMANTIC_MAPPING' ? 'SEMANTIC_MAPPING' : 'FISCAL_RESOLUTION',falseNegativeCandidate:false}))};
}
