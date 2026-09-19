import type { BusinessArchetype } from '../financialMetricContext';
import type { DataGapState, FactVerificationStatus } from '../dataCompleteness/types';
import type { FivePillarsData, PeerBenchmarkRow, PeerCompanyItem } from '../../types';

export type PeerRelationType = 'DIRECT_PEER' | 'CLOSE_COMPARABLE' | 'BROADER_SECTOR_REFERENCE';

export interface PeerBusinessFingerprint {
  ticker: string;
  companyName: string;
  archetype: BusinessArchetype;
  primaryArchetype?: BusinessArchetype;
  sector: string;
  industry: string;
  subIndustry?: string;
  revenueModels: string[];
  majorBusinessLines: string[];
  businessLines?: string[];
  productCategory?: string;
  customerType?: string;
  geography?: string;
  lifecycle: 'early_stage' | 'growth' | 'mature' | 'cyclical';
  profitabilityState: 'pre_profit' | 'breakeven' | 'profitable';
  capitalIntensity: 'asset_light' | 'moderate' | 'capital_intensive' | 'financial_intermediary';
  regulatoryType?: 'banking' | 'insurance' | 'reit' | 'utility' | 'unregulated' | 'standard';
  scaleTier?: 'mega' | 'large' | 'mid' | 'small';
}

export interface PeerMetricObservation {
  ticker: string;
  company: string;
  metric: string;
  value: number | null;
  unit: string;
  period: string;
  asOfDate?: string;
  source: string;
  reportedOrDerived: 'REPORTED' | 'DERIVED';
  status: FactVerificationStatus;
}

export interface PeerCandidate {
  ticker: string;
  companyName: string;
  fingerprint: PeerBusinessFingerprint;
  similarityScore: number;
  relationType: PeerRelationType;
  selectionRationale: string;
  selectionRationaleTh: string;
  metrics: Record<string, PeerMetricObservation>;
}

export type PeerUnavailableReason =
  | 'NO_CANDIDATES'
  | 'INSUFFICIENT_VERIFIED_METRICS'
  | 'BUSINESS_MODEL_AMBIGUOUS'
  | 'SOURCE_GAP';

export interface PeerDiscoveryResult {
  targetTicker: string;
  targetFingerprint: PeerBusinessFingerprint;
  peers: PeerCandidate[];
  peerCount: number;
  isLimitedSample: boolean;
  unavailableReason?: PeerUnavailableReason;
  unavailableMessageEn?: string;
  unavailableMessageTh?: string;
  medians: Record<string, number | null>;
  isBroadSectorUniverse: boolean;
  sectorMedians?: Record<string, number | null>;
  benchmarkRows: PeerBenchmarkRow[];
  peerCompanyItems: PeerCompanyItem[];
}

export interface AdaptivePillarMetric {
  key: string;
  labelEn: string;
  labelTh: string;
  value: number | null;
  formattedValue: string;
  unit?: string;
  prefix?: string;
  status: DataGapState;
  statusLabelEn?: string;
  statusLabelTh?: string;
  sourcePeriod?: string;
  isGuarded?: boolean;
  notes?: string;
}

export interface AdaptivePillarSection {
  id: 'growth' | 'profitability' | 'solvency' | 'yields' | 'peers';
  titleEn: string;
  titleTh: string;
  badgeLabel?: string;
  badgeValue?: string;
  metrics: AdaptivePillarMetric[];
  interpretationEn?: string;
  interpretationTh?: string;
  isGuarded?: boolean;
}

export interface AdaptiveFivePillarsResult {
  asOfDate?: string;
  archetype: BusinessArchetype;
  pillars: {
    growth: AdaptivePillarSection;
    profitability: AdaptivePillarSection;
    solvency: AdaptivePillarSection;
    yields: AdaptivePillarSection;
    peers: AdaptivePillarSection;
  };
  fivePillarsData: FivePillarsData;
  keyTakeawayEn: string;
  keyTakeawayTh: string;
}
