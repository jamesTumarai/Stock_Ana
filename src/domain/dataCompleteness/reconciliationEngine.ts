import { periodsMatch } from '../metricLineage.js';
import {
  DataGapState,
  SourceAuthorityTier,
  type ExtractionMethod,
  type ReportingStandard,
  type VerifiedFact,
} from './types.js';

export interface ReconciliationCandidate {
  metricKey: string;
  value: number | null;
  unit: string;
  fiscalPeriod: string;
  sourceType?: string;
  sourceTier?: SourceAuthorityTier;
  sourceDocument: string;
  sourceUrl?: string;
  reportedOrDerived?: ReportingStandard | string;
  extractionMethod?: ExtractionMethod | string;
  definition?: string;
  issuerIdentity?: string;
}

export type DataCandidate = ReconciliationCandidate;

export interface ReconciliationResult extends VerifiedFact {
  status: 'VERIFIED' | 'SOURCE_CONFLICT' | 'SINGLE_SOURCE' | 'PERIOD_MISMATCH' | 'FOUND_UNVERIFIED';
  resolvedValue: number | null;
  chosenCandidate?: ReconciliationCandidate;
  conflictingCandidates?: ReconciliationCandidate[];
  reconciliationNote: string;
}

const TIER_WEIGHTS: Record<SourceAuthorityTier, number> = {
  TIER_1_SEC_REGULATOR: 4,
  TIER_2_ISSUER_OFFICIAL: 3,
  TIER_3_INDUSTRY_AUTHORITY: 2,
  TIER_4_EXTERNAL_CROSSCHECK: 1,
};

function inferTierFromSourceType(sourceType?: string): SourceAuthorityTier {
  if (!sourceType) return SourceAuthorityTier.TIER_4_EXTERNAL_CROSSCHECK;
  const upper = sourceType.toUpperCase();
  if (upper.includes('SEC') || upper.includes('EDGAR') || upper.includes('REGULATOR') || upper.includes('FDIC') || upper.includes('FED')) {
    return SourceAuthorityTier.TIER_1_SEC_REGULATOR;
  }
  if (upper.includes('IR') || upper.includes('OFFICIAL') || upper.includes('EARNINGS') || upper.includes('PRESENTATION') || upper.includes('SUPPLEMENT')) {
    return SourceAuthorityTier.TIER_2_ISSUER_OFFICIAL;
  }
  if (upper.includes('INDUSTRY') || upper.includes('AUTHORITY')) {
    return SourceAuthorityTier.TIER_3_INDUSTRY_AUTHORITY;
  }
  return SourceAuthorityTier.TIER_4_EXTERNAL_CROSSCHECK;
}

/**
 * Reconciles multiple data candidates for a specific metric and period.
 * Fails closed if sources in the same authority tier conflict without an explanatory definition.
 */
export function reconcileMetricCandidates(
  metricKey: string,
  candidates: ReconciliationCandidate[],
  targetPeriod: string,
  tolerancePct?: number
): ReconciliationResult | null;
export function reconcileMetricCandidates(
  targetPeriod: string,
  candidates: ReconciliationCandidate[],
  tolerancePct?: number
): ReconciliationResult | null;
export function reconcileMetricCandidates(
  arg1: string,
  candidates: ReconciliationCandidate[],
  arg3?: string | number,
  arg4?: number
): ReconciliationResult | null {
  let metricKey = '';
  let targetPeriod = '';
  let tolerancePct = 0.5;

  if (typeof arg3 === 'string') {
    metricKey = arg1;
    targetPeriod = arg3;
    tolerancePct = typeof arg4 === 'number' ? arg4 : 0.5;
  } else {
    targetPeriod = arg1;
    metricKey = candidates[0]?.metricKey || '';
    tolerancePct = typeof arg3 === 'number' ? arg3 : 0.5;
  }

  if (!candidates || candidates.length === 0) {
    return null;
  }

  // Ensure every candidate has a sourceTier
  const normalizedCandidates = candidates.map((c) => ({
    ...c,
    sourceTier: c.sourceTier || inferTierFromSourceType(c.sourceType),
  }));

  // 1. Filter by period match
  const matchingPeriodCandidates = normalizedCandidates.filter((c) => periodsMatch(c.fiscalPeriod, targetPeriod));
  if (matchingPeriodCandidates.length === 0) {
    // Period mismatch -> fail closed (return null)
    return null;
  }

  // 2. Check for unverified conjecture (e.g. Tier 4 without issuer identity or corroborated proof)
  if (
    matchingPeriodCandidates.length === 1 &&
    matchingPeriodCandidates[0].sourceTier === SourceAuthorityTier.TIER_4_EXTERNAL_CROSSCHECK &&
    (!matchingPeriodCandidates[0].issuerIdentity || matchingPeriodCandidates[0].issuerIdentity === 'UNKNOWN')
  ) {
    const single = matchingPeriodCandidates[0];
    return {
      metricKey: single.metricKey || metricKey,
      value: null,
      unit: single.unit,
      fiscalPeriod: targetPeriod,
      periodType: 'DURATION_QUARTER',
      sourceType: single.sourceType || 'EXTERNAL_CROSS_CHECK',
      sourceTier: single.sourceTier,
      sourceUrl: single.sourceUrl,
      sourceDocument: single.sourceDocument,
      reportedOrDerived: (single.reportedOrDerived as ReportingStandard) || 'REPORTED',
      extractionMethod: (single.extractionMethod as ExtractionMethod) || 'AI_STRUCTURED_EXTRACTION',
      verificationStatus: DataGapState.FOUND_UNVERIFIED,
      status: 'FOUND_UNVERIFIED',
      resolvedValue: null,
      chosenCandidate: single,
      confidence: 0.3,
      issuerIdentity: single.issuerIdentity || 'UNKNOWN',
      reconciliationNote: 'Unverified external conjecture: Issuer identity unconfirmed.',
    };
  }

  if (matchingPeriodCandidates.length === 1) {
    const single = matchingPeriodCandidates[0];
    return {
      metricKey: single.metricKey || metricKey,
      value: single.value,
      unit: single.unit,
      fiscalPeriod: targetPeriod,
      periodType: 'DURATION_QUARTER',
      sourceType: single.sourceType || 'OFFICIAL_SOURCE',
      sourceTier: single.sourceTier,
      sourceUrl: single.sourceUrl,
      sourceDocument: single.sourceDocument,
      reportedOrDerived: (single.reportedOrDerived as ReportingStandard) || 'REPORTED',
      extractionMethod: (single.extractionMethod as ExtractionMethod) || 'DETERMINISTIC_EXTRACTION',
      verificationStatus: DataGapState.VERIFIED_AVAILABLE,
      status: 'SINGLE_SOURCE',
      resolvedValue: single.value,
      chosenCandidate: single,
      confidence: single.sourceTier === SourceAuthorityTier.TIER_1_SEC_REGULATOR ? 1.0 : 0.95,
      issuerIdentity: single.issuerIdentity || 'ISSUER',
      reconciliationNote: `Resolved from single ${single.sourceTier} source: ${single.sourceDocument}.`,
    };
  }

  // 3. Sort candidates by Tier weight descending
  const sorted = [...matchingPeriodCandidates].sort(
    (a, b) => TIER_WEIGHTS[b.sourceTier!] - TIER_WEIGHTS[a.sourceTier!]
  );

  const highestTier = sorted[0].sourceTier!;
  const topTierCandidates = sorted.filter((c) => c.sourceTier === highestTier);

  // Check if top tier candidates agree within tolerance
  if (topTierCandidates.length > 1) {
    const baseVal = topTierCandidates[0].value;
    const allAgree =
      baseVal !== null &&
      topTierCandidates.every((c) => {
        if (c.value === null) return false;
        if (baseVal === 0) return c.value === 0;
        const diffPct = Math.abs((c.value - baseVal) / baseVal) * 100;
        return diffPct <= tolerancePct;
      });

    if (allAgree) {
      const chosen = topTierCandidates[0];
      return {
        metricKey: chosen.metricKey || metricKey,
        value: chosen.value,
        unit: chosen.unit,
        fiscalPeriod: targetPeriod,
        periodType: 'DURATION_QUARTER',
        sourceType: chosen.sourceType || 'OFFICIAL_SOURCE',
        sourceTier: chosen.sourceTier,
        sourceUrl: chosen.sourceUrl,
        sourceDocument: chosen.sourceDocument,
        reportedOrDerived: (chosen.reportedOrDerived as ReportingStandard) || 'REPORTED',
        extractionMethod: (chosen.extractionMethod as ExtractionMethod) || 'DETERMINISTIC_EXTRACTION',
        verificationStatus: DataGapState.VERIFIED_AVAILABLE,
        status: 'VERIFIED',
        resolvedValue: chosen.value,
        chosenCandidate: chosen,
        confidence: 1.0,
        issuerIdentity: chosen.issuerIdentity || 'ISSUER',
        reconciliationNote: `Strongly verified across ${topTierCandidates.length} ${highestTier} sources.`,
      };
    }

    // Top tier candidates disagree! Check if one is GAAP and another is Non-GAAP
    const gaap = topTierCandidates.find((c) => c.reportedOrDerived === 'GAAP');
    const nonGaap = topTierCandidates.find((c) => c.reportedOrDerived === 'NON_GAAP_COMPANY_REPORTED');

    if (gaap && nonGaap && gaap.definition !== nonGaap.definition) {
      return {
        metricKey: gaap.metricKey || metricKey,
        value: gaap.value,
        unit: gaap.unit,
        fiscalPeriod: targetPeriod,
        periodType: 'DURATION_QUARTER',
        sourceType: gaap.sourceType || 'SEC_EDGAR',
        sourceTier: gaap.sourceTier,
        sourceUrl: gaap.sourceUrl,
        sourceDocument: gaap.sourceDocument,
        reportedOrDerived: 'GAAP',
        extractionMethod: (gaap.extractionMethod as ExtractionMethod) || 'DETERMINISTIC_EXTRACTION',
        verificationStatus: DataGapState.VERIFIED_AVAILABLE,
        status: 'VERIFIED',
        resolvedValue: gaap.value,
        chosenCandidate: gaap,
        confidence: 0.98,
        issuerIdentity: gaap.issuerIdentity || 'ISSUER',
        reconciliationNote: `Reconciled GAAP (${gaap.value}) vs Non-GAAP (${nonGaap.value}): Selected GAAP for canonical statement.`,
      };
    }

    // Genuine conflict within same tier -> FAIL CLOSED
    return {
      metricKey: topTierCandidates[0].metricKey || metricKey,
      value: null,
      unit: topTierCandidates[0].unit,
      fiscalPeriod: targetPeriod,
      periodType: 'DURATION_QUARTER',
      sourceType: topTierCandidates[0].sourceType || 'OFFICIAL_SOURCE',
      sourceTier: highestTier,
      sourceUrl: topTierCandidates[0].sourceUrl,
      sourceDocument: topTierCandidates.map((c) => c.sourceDocument).join(' vs '),
      reportedOrDerived: 'REPORTED',
      extractionMethod: 'AI_STRUCTURED_EXTRACTION',
      verificationStatus: DataGapState.SOURCE_CONFLICT,
      status: 'SOURCE_CONFLICT',
      resolvedValue: null,
      conflictingCandidates: topTierCandidates,
      conflictDetails: { candidates: topTierCandidates },
      confidence: 0,
      issuerIdentity: topTierCandidates[0].issuerIdentity || 'ISSUER',
      reconciliationNote: `Source conflict: Disagreement between ${topTierCandidates.length} sources in ${highestTier} (${topTierCandidates.map((c) => `${c.sourceDocument}: ${c.value}`).join(' vs ')}).`,
    };
  }

  // Exactly one candidate in the highest tier.
  const primary = topTierCandidates[0];
  return {
    metricKey: primary.metricKey || metricKey,
    value: primary.value,
    unit: primary.unit,
    fiscalPeriod: targetPeriod,
    periodType: 'DURATION_QUARTER',
    sourceType: primary.sourceType || 'OFFICIAL_SOURCE',
    sourceTier: primary.sourceTier,
    sourceUrl: primary.sourceUrl,
    sourceDocument: primary.sourceDocument,
    reportedOrDerived: (primary.reportedOrDerived as ReportingStandard) || 'REPORTED',
    extractionMethod: (primary.extractionMethod as ExtractionMethod) || 'DETERMINISTIC_EXTRACTION',
    verificationStatus: DataGapState.VERIFIED_AVAILABLE,
    status: 'SINGLE_SOURCE',
    resolvedValue: primary.value,
    chosenCandidate: primary,
    confidence: primary.sourceTier === SourceAuthorityTier.TIER_1_SEC_REGULATOR ? 1.0 : 0.95,
    issuerIdentity: primary.issuerIdentity || 'ISSUER',
    reconciliationNote: `Resolved from ${primary.sourceTier} (${primary.sourceDocument}).`,
  };
}
