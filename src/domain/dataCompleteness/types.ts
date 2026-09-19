import type { FinancialUnit } from '../financialValue.js';
import type { BusinessArchetype, MetricApplicability, PeriodType } from '../financialMetricContext.js';

export const DataGapState = {
  VERIFIED_AVAILABLE: 'VERIFIED_AVAILABLE',
  VERIFIED_DERIVED: 'VERIFIED_DERIVED',
  NOT_REPORTED: 'NOT_REPORTED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  NOT_FOUND_YET: 'NOT_FOUND_YET',
  EXTRACTION_GAP: 'EXTRACTION_GAP',
  FOUND_UNVERIFIED: 'FOUND_UNVERIFIED',
  SOURCE_CONFLICT: 'SOURCE_CONFLICT',
  INSUFFICIENT_PERIOD_DATA: 'INSUFFICIENT_PERIOD_DATA',
  GUARDED_FOR_BUSINESS_MODEL: 'GUARDED_FOR_BUSINESS_MODEL',
} as const;

export type DataGapState = (typeof DataGapState)[keyof typeof DataGapState];

export const SourceAuthorityTier = {
  TIER_1_SEC_REGULATOR: 'TIER_1_SEC_REGULATOR',
  TIER_2_ISSUER_OFFICIAL: 'TIER_2_ISSUER_OFFICIAL',
  TIER_3_INDUSTRY_AUTHORITY: 'TIER_3_INDUSTRY_AUTHORITY',
  TIER_4_EXTERNAL_CROSSCHECK: 'TIER_4_EXTERNAL_CROSSCHECK',
} as const;

export type SourceAuthorityTier = (typeof SourceAuthorityTier)[keyof typeof SourceAuthorityTier];

export type BusinessRelevance = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type ReportingStandard =
  | 'GAAP'
  | 'NON_GAAP_COMPANY_REPORTED'
  | 'INDUSTRY_KPI'
  | 'VERIFIED_DERIVED'
  | 'REPORTED'
  | 'DERIVED';

export type ExtractionMethod =
  | 'STRUCTURED_XBRL'
  | 'XBRL_EXTENSION'
  | 'AI_DOCUMENT_EXTRACTION'
  | 'AI_STRUCTURED_EXTRACTION'
  | 'DETERMINISTIC_EXTRACTION'
  | 'DETERMINISTIC_FORMULA'
  | 'API_PROVIDER';

export type FactVerificationStatus =
  | 'VERIFIED'
  | 'SOURCE_LINKED'
  | 'CONFLICT'
  | 'UNVERIFIED'
  | DataGapState;

export interface DataGap {
  fieldKey: string;
  displayName: string;
  displayNameTh: string;
  businessRelevance: BusinessRelevance;
  expectedPeriod: string;
  expectedUnit: FinancialUnit;
  currentStatus: DataGapState;
  canonicalPath: string;
  sourceAttempts: string[];
  applicability: MetricApplicability;
  archetype: BusinessArchetype;
  definition?: string;
  userExplanationEn?: string;
  userExplanationTh?: string;
}

export interface VerifiedFact {
  metricKey: string;
  value: number | string | boolean | null;
  unit: FinancialUnit | string;
  originalUnit?: string;
  fiscalPeriod: string;
  periodStart?: string;
  periodEnd?: string;
  periodType: PeriodType | 'DURATION_QUARTER' | 'POINT_IN_TIME' | 'DERIVED_RATIO';
  sourceType: string;
  sourceTier?: SourceAuthorityTier;
  sourceUrl?: string;
  sourceDocument: string;
  sourcePublishedAt?: string;
  extractionMethod: ExtractionMethod;
  reportedOrDerived: ReportingStandard;
  formula?: string;
  definition?: string;
  verificationStatus: FactVerificationStatus;
  confidence: number;
  issuerIdentity: string;
  conflictDetails?: {
    candidates: any[];
  };
}

export interface DataCompletenessSummary {
  totalImportantFields: number;
  verifiedAvailable: number;
  verifiedDerived: number;
  notReported: number;
  notApplicable: number;
  extractionGaps: number;
  sourceConflicts: number;
  unresolved: number;
  completenessScorePct: number;
  gaps: DataGap[];
  verifiedFacts?: VerifiedFact[];
}
