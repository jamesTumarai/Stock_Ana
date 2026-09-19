import type { ReportData, PeerBenchmarkRow, PeerCompanyItem } from '../../types.js';
import { resolveBusinessArchetype, type BusinessArchetype } from '../financialMetricContext.js';
import type {
  PeerBusinessFingerprint,
  PeerCandidate,
  PeerDiscoveryResult,
  PeerMetricObservation,
  PeerRelationType,
  PeerUnavailableReason,
} from './types.js';
import {
  type CandidateDefinition,
  FIXTURE_CANDIDATE_UNIVERSE,
  PUBLIC_CANDIDATE_UNIVERSE,
} from './__fixtures__/peerUniverse.js';

// Re-export for callers/tests that expect them here
export { type CandidateDefinition, FIXTURE_CANDIDATE_UNIVERSE, PUBLIC_CANDIDATE_UNIVERSE };

export interface PeerDiscoveryOptions {
  candidates?: (CandidateDefinition | PeerCompanyItem)[];
  disableFixtureFallback?: boolean;
  allowFixtureFallback?: boolean;
}

export interface PeerCandidateDiscoveryInput {
  ticker: string;
  primaryArchetype: BusinessArchetype;
  sector?: string;
  industry?: string;
  subIndustry?: string;
  businessLines?: string[];
  geography?: string;
  scaleTier?: string;
  lifecycle?: string;
}

/**
 * Bounded source-backed runtime peer candidate discovery service.
 * Discovers candidate public companies based on target's verified business fingerprint.
 * Enables peer discovery for unknown tickers without code deployment.
 */
export function discoverPeerCandidates(
  target: PeerBusinessFingerprint | PeerCandidateDiscoveryInput
): CandidateDefinition[] {
  const targetArchetype = 'archetype' in target ? target.archetype : target.primaryArchetype;
  const targetIndustry = (target.industry || '').toLowerCase().trim();
  const targetSubIndustry = (target.subIndustry || '').toLowerCase().trim();
  const targetSector = (target.sector || '').toLowerCase().trim();
  const targetTicker = (target.ticker || '').toUpperCase().trim();

  return PUBLIC_CANDIDATE_UNIVERSE.filter(cand => {
    if (cand.ticker.toUpperCase() === targetTicker) return false;

    // Archetype compatibility
    if (cand.archetype !== targetArchetype) {
      const financialArchetypes = new Set(['bank', 'lender', 'fintech']);
      if (!financialArchetypes.has(targetArchetype) || !financialArchetypes.has(cand.archetype)) {
        return false;
      }
    }

    const candIndustry = (cand.industry || '').toLowerCase().trim();
    const candSubIndustry = (cand.subIndustry || '').toLowerCase().trim();
    const candSector = (cand.sector || '').toLowerCase().trim();

    // High confidence: Sub-industry match
    if (targetSubIndustry && candSubIndustry === targetSubIndustry) return true;

    // Medium confidence: Industry match (exact or substring)
    if (targetIndustry && candIndustry && (candIndustry.includes(targetIndustry) || targetIndustry.includes(candIndustry))) {
      return true;
    }

    // Automotive sub-industry / keyword match
    if (
      (/auto|electric vehicle|car\b|vehicle/i.test(targetIndustry) || targetSubIndustry === 'automotive_manufacturing') &&
      (/auto|electric vehicle|car\b|vehicle/i.test(candIndustry) || candSubIndustry === 'automotive_manufacturing')
    ) {
      return true;
    }

    // Sector match when archetype aligns
    if (targetSector && candSector === targetSector && cand.archetype === targetArchetype) {
      return true;
    }

    return false;
  });
}

/**
 * In-memory cache for discovered peer results to avoid redundant recomputations.
 */
const peerDiscoveryCache = new Map<string, { timestamp: number; result: PeerDiscoveryResult }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Builds a PeerBusinessFingerprint for a given stock report.
 */
export function buildPeerBusinessFingerprint(
  report: Partial<ReportData>,
  ticker?: string
): PeerBusinessFingerprint {
  const sym = (ticker || report.ticker || (report as any)?.symbol || 'STOCK').toUpperCase().trim();
  const archetype = resolveBusinessArchetype(report, sym);
  const profile = report.company_profile;
  const sector = profile?.sector || profile?.overview?.sector || (report as any)?.sector || 'Unknown';
  const industry = profile?.industry || profile?.overview?.industry || (report as any)?.industry || report.peer_comparison?.industry_name || 'Unknown';
  const desc = (profile?.description || profile?.overview?.description || '').toLowerCase();

  // Sub-industry inference
  let subIndustry = 'general';
  if (archetype === 'fintech') {
    if (desc.includes('bnpl') || desc.includes('point-of-sale')) subIndustry = 'bnpl_consumer_finance';
    else if (desc.includes('ai') && desc.includes('lending')) subIndustry = 'ai_lending_marketplace';
    else subIndustry = 'digital_banking_lending';
  } else if (archetype === 'reit') {
    if (industry.includes('industrial') || desc.includes('logistics') || desc.includes('warehouse')) subIndustry = 'industrial_logistics_reit';
    else if (industry.includes('data center') || desc.includes('data center')) subIndustry = 'data_center_reit';
    else if (industry.includes('retail') || desc.includes('shopping') || desc.includes('mall')) subIndustry = 'retail_reit';
    else subIndustry = 'general_reit';
  } else if (archetype === 'semiconductor') {
    if (desc.includes('foundry') || desc.includes('wafer manufacturing')) subIndustry = 'foundry_manufacturing';
    else if (desc.includes('lithography') || desc.includes('equipment') || industry.includes('equipment')) subIndustry = 'equipment';
    else subIndustry = 'fabless_accelerator';
  } else if (archetype === 'energy_commodity') {
    if (desc.includes('refin') || industry.includes('refining')) subIndustry = 'refining';
    else if (desc.includes('oilfield') || industry.includes('oilfield')) subIndustry = 'oilfield_services';
    else subIndustry = 'oil_gas_ep';
  } else if (archetype === 'retail' || archetype === 'digital_marketplace') {
    if (desc.includes('marketplace') || desc.includes('e-commerce platform')) subIndustry = 'digital_marketplace_cloud';
    else subIndustry = 'physical_omnichannel_retail';
  } else if (archetype === 'industrial_manufacturing') {
    if (/auto\s*manufactur|electric\s*vehicle|automotive|car\s*manufactur/i.test(industry) || /electric\s*vehicle|ev\b|automotive|automobile/i.test(desc)) {
      subIndustry = 'automotive_manufacturing';
    } else if (/aerospace|defense/i.test(industry) || /aerospace|defense/i.test(desc)) {
      subIndustry = 'aerospace_defense';
    } else if (/machinery|equipment/i.test(industry)) {
      subIndustry = 'industrial_machinery';
    } else {
      subIndustry = 'industrial_manufacturing';
    }
  } else if (archetype === 'insurer') {
    if (/property|casualty|p&c/i.test(industry) || /property|casualty/i.test(desc)) {
      subIndustry = 'pc_insurance';
    } else if (/life/i.test(industry) || /life\s*insurance/i.test(desc)) {
      subIndustry = 'life_insurance';
    } else if (/reinsur/i.test(industry) || /reinsur/i.test(desc)) {
      subIndustry = 'reinsurance';
    } else {
      subIndustry = 'general_insurance';
    }
  }

  // Profitability inference
  const inc = report.financial_statements?.income_statement;
  const netIncomeArr = (inc?.net_income || []).filter(v => typeof v === 'number');
  const latestNetIncome = netIncomeArr[netIncomeArr.length - 1];
  const profitabilityState = typeof latestNetIncome === 'number' && latestNetIncome > 0
    ? 'profitable'
    : typeof latestNetIncome === 'number' && latestNetIncome < 0
      ? 'pre_profit'
      : 'breakeven';

  // Capital intensity
  const isFinancial = ['bank', 'lender', 'fintech', 'insurer', 'asset_manager', 'broker_exchange'].includes(archetype);
  const capitalIntensity = isFinancial
    ? 'financial_intermediary'
    : ['reit', 'energy_commodity', 'industrial_manufacturing'].includes(archetype)
      ? 'capital_intensive'
      : 'asset_light';

  const revenueModels = isFinancial
    ? ['net_interest_income', 'fee_based']
    : subIndustry === 'automotive_manufacturing'
      ? ['vehicle_sales', 'energy_storage', 'services']
      : ['product_sales', 'subscription'];

  return {
    ticker: sym,
    companyName: (profile as any)?.company_name || (profile as any)?.name || sym,
    archetype,
    primaryArchetype: archetype,
    sector,
    industry,
    subIndustry,
    revenueModels,
    majorBusinessLines: [industry],
    businessLines: [industry],
    geography: 'US',
    lifecycle: archetype === 'early_stage' ? 'early_stage' : 'mature',
    profitabilityState,
    capitalIntensity,
    regulatoryType: isFinancial ? 'banking' : archetype === 'reit' ? 'reit' : 'standard',
  };
}

/**
 * Calculates a deterministic similarity score between target and candidate fingerprints.
 */
export function calculatePeerSimilarity(
  target: PeerBusinessFingerprint,
  candidate: PeerBusinessFingerprint
): { score: number; relationType: PeerRelationType; rationaleEn: string; rationaleTh: string } {
  let score = 0;

  // 1. Business Archetype Match (Weight: 0.35)
  if (target.archetype === candidate.archetype) {
    score += 0.35;
  } else {
    // Partial credit for compatible financial intermediaries
    const financialArchetypes = new Set(['bank', 'lender', 'fintech']);
    if (financialArchetypes.has(target.archetype) && financialArchetypes.has(candidate.archetype)) {
      score += 0.22;
    }
  }

  // 2. Sub-Industry / Sector Match (Weight: 0.30)
  if (target.subIndustry && candidate.subIndustry && target.subIndustry === candidate.subIndustry) {
    score += 0.30;
  } else if (target.industry.toLowerCase() === candidate.industry.toLowerCase()) {
    score += 0.20;
  } else if (target.sector.toLowerCase() === candidate.sector.toLowerCase()) {
    score += 0.10;
  }

  // 3. Revenue Models Overlap (Weight: 0.15)
  const targetRev = new Set(target.revenueModels);
  const sharedRev = candidate.revenueModels.filter(r => targetRev.has(r)).length;
  if (sharedRev > 0) {
    score += Math.min(0.15, (sharedRev / Math.max(1, targetRev.size)) * 0.15);
  }

  // 4. Profitability & Lifecycle Match (Weight: 0.10)
  if (target.profitabilityState === candidate.profitabilityState) {
    score += 0.05;
  }
  if (target.lifecycle === candidate.lifecycle) {
    score += 0.05;
  }

  // 5. Capital Intensity & Regulatory Framework (Weight: 0.10)
  if (target.capitalIntensity === candidate.capitalIntensity) {
    score += 0.05;
  }
  if (target.regulatoryType === candidate.regulatoryType) {
    score += 0.05;
  }

  score = Math.round(score * 100) / 100;

  let relationType: PeerRelationType = 'BROADER_SECTOR_REFERENCE';
  if (score >= 0.78) {
    relationType = 'DIRECT_PEER';
  } else if (score >= 0.58) {
    relationType = 'CLOSE_COMPARABLE';
  }

  // Guard: Sub-industry mismatch in specialized sectors must NOT be promoted to DIRECT_PEER
  if (relationType === 'DIRECT_PEER') {
    if (
      (target.archetype === 'semiconductor' && target.subIndustry && candidate.subIndustry && target.subIndustry !== candidate.subIndustry) ||
      (target.archetype === 'reit' && target.subIndustry && candidate.subIndustry && target.subIndustry !== candidate.subIndustry) ||
      (target.archetype === 'energy_commodity' && target.subIndustry && candidate.subIndustry && target.subIndustry !== candidate.subIndustry) ||
      (target.subIndustry === 'automotive_manufacturing' && candidate.subIndustry !== 'automotive_manufacturing')
    ) {
      relationType = 'CLOSE_COMPARABLE';
    }
  }

  const rationaleEn = relationType === 'DIRECT_PEER'
    ? `Direct peer sharing identical ${target.archetype} business archetype and ${target.subIndustry || target.industry} operating model.`
    : relationType === 'CLOSE_COMPARABLE'
      ? `Close comparable with aligned economics in ${target.industry}.`
      : `Broader sector reference in ${target.sector}.`;

  const rationaleTh = relationType === 'DIRECT_PEER'
    ? `คู่แข่งตรงที่มีโครงสร้างธุรกิจแบบ ${target.archetype} และโมเดลการดำเนินงาน ${target.subIndustry || target.industry} เดียวกัน`
    : relationType === 'CLOSE_COMPARABLE'
      ? `กลุ่มบริษัทเทียบเคียงที่มีความใกล้เคียงเชิงเศรษฐศาสตร์ในกลุ่ม ${target.industry}`
      : `บริษัทอ้างอิงระดับอุตสาหกรรมในกลุ่ม ${target.sector}`;

  return { score, relationType, rationaleEn, rationaleTh };
}

/**
 * Validates candidate integrity before admission.
 */
function verifyCandidate(cand: any): { valid: boolean; reason?: string } {
  if (!cand || typeof cand !== 'object') return { valid: false, reason: 'NULL_OR_NON_OBJECT' };
  const ticker = (cand.ticker || cand.symbol || '').toUpperCase().trim();
  if (!ticker || !/^[A-Z0-9.\-_]{1,12}$/.test(ticker)) return { valid: false, reason: 'INVALID_TICKER_FORMAT' };

  // Reject ETF or Fund tickers
  if (/^(SPY|QQQ|IWM|XLF|XLK|XLE|VNQ|VTI|VOO|IVV|DIA|ARKK)$/i.test(ticker)) {
    return { valid: false, reason: 'ETF_OR_FUND' };
  }

  // Reject synthetic placeholder tickers
  if (/^(PEER_\d+|COMP_\d+|STOCK_\d+|TEST)$/i.test(ticker)) {
    return { valid: false, reason: 'SYNTHETIC_OR_PLACEHOLDER_TICKER' };
  }

  const name = cand.companyName || cand.company_name || cand.name;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return { valid: false, reason: 'MISSING_COMPANY_NAME' };
  }

  return { valid: true };
}

/**
 * Evaluates hard filters to prevent invalid or cross-archetype comparisons.
 */
function passesHardFilters(
  target: PeerBusinessFingerprint,
  candidate: CandidateDefinition | PeerBusinessFingerprint
): { passes: boolean; reason?: string } {
  // 1. Never compare company with itself
  if (candidate.ticker.toUpperCase() === target.ticker.toUpperCase()) {
    return { passes: false, reason: 'SELF_TARGET' };
  }

  // 2. Reject ETF or Fund tickers
  if (/^(SPY|QQQ|IWM|XLF|XLK|XLE|VNQ|VTI|VOO|IVV|DIA|ARKK)$/i.test(candidate.ticker)) {
    return { passes: false, reason: 'ETF_OR_FUND' };
  }

  // 3. Financial Sector Guard: Financial companies must NEVER be compared to non-financial operating companies
  const targetIsFinancial = ['bank', 'lender', 'fintech', 'insurer', 'asset_manager', 'broker_exchange'].includes(target.archetype);
  const candIsFinancial = ['bank', 'lender', 'fintech', 'insurer', 'asset_manager', 'broker_exchange'].includes(candidate.archetype);
  if (targetIsFinancial !== candIsFinancial) {
    return { passes: false, reason: 'CROSS_FINANCIAL_GUARD' };
  }

  // 4. Insurer vs Bank Guard: Insurers must not be compared to depository banks
  if (target.archetype === 'insurer' && candidate.archetype === 'bank') {
    return { passes: false, reason: 'INSURER_VS_BANK_GUARD' };
  }
  if (target.archetype === 'bank' && candidate.archetype === 'insurer') {
    return { passes: false, reason: 'BANK_VS_INSURER_GUARD' };
  }

  // 5. REIT Guard: REITs must only be compared to other REITs
  if ((target.archetype === 'reit') !== (candidate.archetype === 'reit')) {
    return { passes: false, reason: 'REIT_GUARD' };
  }

  // 6. REIT Sub-sector Guard: Sub-sector mismatch should not pass as direct peer
  if (target.archetype === 'reit' && target.subIndustry && candidate.subIndustry && target.subIndustry !== candidate.subIndustry) {
    return { passes: false, reason: 'REIT_SUBSECTOR_MISMATCH' };
  }

  // 7. Energy Guard: E&P must not be compared to refiners or oilfield services as direct peers
  if (target.archetype === 'energy_commodity') {
    if (target.subIndustry === 'oil_gas_ep' && candidate.subIndustry !== 'oil_gas_ep') {
      return { passes: false, reason: 'ENERGY_SUBSECTOR_MISMATCH' };
    }
  }

  // 8. Semiconductor Guard: Fabless must not be compared to foundries or equipment makers as direct peers
  if (target.archetype === 'semiconductor') {
    if (target.subIndustry && candidate.subIndustry && target.subIndustry !== candidate.subIndustry) {
      return { passes: false, reason: 'SEMICONDUCTOR_SUBSECTOR_MISMATCH' };
    }
  }

  // 9. Retail Guard: Traditional physical retail must not be compared to digital marketplaces indiscriminately
  if (target.archetype === 'retail' && candidate.archetype === 'digital_marketplace') {
    return { passes: false, reason: 'RETAIL_VS_MARKETPLACE_MISMATCH' };
  }
  if (target.archetype === 'digital_marketplace' && candidate.archetype === 'retail') {
    return { passes: false, reason: 'MARKETPLACE_VS_RETAIL_MISMATCH' };
  }

  // 10. Early-stage Guard: Pre-profit early stage companies must not be compared to mature giants as direct peers
  if (target.archetype === 'early_stage' && candidate.archetype !== 'early_stage') {
    return { passes: false, reason: 'EARLY_STAGE_LIFECYCLE_MISMATCH' };
  }

  // 11. Automotive Guard: Automotive manufacturers must not be compared to unrelated industrials as direct peers
  if (target.subIndustry === 'automotive_manufacturing' && candidate.subIndustry && candidate.subIndustry !== 'automotive_manufacturing') {
    return { passes: false, reason: 'AUTOMOTIVE_SUBSECTOR_MISMATCH' };
  }

  return { passes: true };
}

/**
 * Normalizes a raw candidate into a PeerBusinessFingerprint.
 */
function buildCandidateFingerprint(
  raw: CandidateDefinition | PeerCompanyItem,
  target: PeerBusinessFingerprint
): PeerBusinessFingerprint {
  if ('archetype' in raw && 'subIndustry' in raw && 'revenueModels' in raw) {
    // CandidateDefinition
    const cand = raw as CandidateDefinition;
    return {
      ticker: cand.ticker,
      companyName: cand.companyName,
      archetype: cand.archetype,
      primaryArchetype: cand.archetype,
      sector: cand.sector,
      industry: cand.industry,
      subIndustry: cand.subIndustry,
      revenueModels: cand.revenueModels,
      majorBusinessLines: cand.majorBusinessLines,
      geography: cand.geography,
      lifecycle: cand.lifecycle,
      profitabilityState: cand.profitabilityState,
      capitalIntensity: cand.capitalIntensity,
      regulatoryType: cand.regulatoryType,
      scaleTier: cand.scaleTier,
    };
  }

  // PeerCompanyItem or generic object
  const p = raw as PeerCompanyItem & Record<string, any>;
  const ticker = (p.ticker || p.symbol || '').toUpperCase().trim();
  const companyName = p.company_name || p.name || ticker;
  const sector = p.sector || (p as any)?.overview?.sector || target.sector;
  const industry = p.industry || (p as any)?.overview?.industry || target.industry;

  let archetype: BusinessArchetype = target.archetype;
  if (p.archetype) {
    archetype = p.archetype;
  } else if (p.sector || p.industry) {
    archetype = resolveBusinessArchetype({ company_profile: { sector, industry } } as any, ticker);
  }

  let subIndustry = p.subIndustry || 'general';
  if (/auto\s*manufactur|electric\s*vehicle|automotive/i.test(industry)) {
    subIndustry = 'automotive_manufacturing';
  } else if (archetype === 'semiconductor') {
    subIndustry = /foundry/i.test(industry) ? 'foundry_manufacturing' : 'fabless_accelerator';
  } else if (archetype === 'reit') {
    subIndustry = /industrial/i.test(industry) ? 'industrial_logistics_reit' : /office/i.test(industry) ? 'office_reit' : 'general_reit';
  } else if (archetype === 'energy_commodity') {
    subIndustry = /refin/i.test(industry) ? 'refining' : 'oil_gas_ep';
  } else if (archetype === 'retail') {
    subIndustry = 'physical_omnichannel_retail';
  } else if (archetype === 'saas_software') {
    subIndustry = 'enterprise_cloud_software';
  }

  const isFinancial = ['bank', 'lender', 'fintech', 'insurer'].includes(archetype);

  const revenueModels = p.revenueModels || (
    isFinancial
      ? ['net_interest_income', 'fee_based']
      : subIndustry === 'automotive_manufacturing'
        ? ['vehicle_sales', 'energy_storage']
        : archetype === 'semiconductor'
          ? ['chip_sales', 'wafer_manufacturing']
          : archetype === 'saas_software'
            ? ['subscription_software', 'cloud_services']
            : ['product_sales', 'services']
  );

  return {
    ticker,
    companyName,
    archetype,
    primaryArchetype: archetype,
    sector,
    industry,
    subIndustry,
    revenueModels,
    majorBusinessLines: p.majorBusinessLines || [industry],
    geography: p.geography || 'US',
    lifecycle: p.lifecycle || target.lifecycle,
    profitabilityState: p.profitabilityState || target.profitabilityState,
    capitalIntensity: p.capitalIntensity || (isFinancial ? 'financial_intermediary' : subIndustry === 'automotive_manufacturing' ? 'capital_intensive' : target.capitalIntensity),
    regulatoryType: p.regulatoryType || (isFinancial ? 'banking' : archetype === 'reit' ? 'reit' : 'standard'),
    scaleTier: p.scaleTier || 'large',
  };
}

/**
 * Extracts normalized metric observations from a candidate.
 */
function extractCandidateMetrics(
  raw: CandidateDefinition | PeerCompanyItem,
  ticker: string,
  companyName: string,
  asOfDate?: string
): Record<string, PeerMetricObservation> {
  const metricObservations: Record<string, PeerMetricObservation> = {};

  if ('metrics' in raw && raw.metrics && typeof raw.metrics === 'object') {
    for (const [mKey, mData] of Object.entries((raw as CandidateDefinition).metrics)) {
      metricObservations[mKey] = {
        ticker,
        company: companyName,
        metric: mKey,
        value: mData.value,
        unit: mData.unit,
        period: mData.period,
        asOfDate: (mData as any).asOfDate || asOfDate,
        source: mData.source,
        reportedOrDerived: mData.reportedOrDerived,
        status: mData.value !== null ? 'VERIFIED' : 'NOT_REPORTED',
      };
    }
    return metricObservations;
  }

  // Map from PeerCompanyItem
  const p = raw as PeerCompanyItem;
  const period = p.as_of_date || asOfDate || 'Latest';
  const source = 'Verified Peer Disclosure / Market Snapshot';

  const mapMetric = (key: string, val: number | null | undefined, unit: string) => {
    metricObservations[key] = {
      ticker,
      company: companyName,
      metric: key,
      value: typeof val === 'number' && Number.isFinite(val) ? val : null,
      unit,
      period,
      asOfDate: p.as_of_date || asOfDate,
      source,
      reportedOrDerived: 'REPORTED',
      status: typeof val === 'number' && Number.isFinite(val) ? 'VERIFIED' : 'NOT_REPORTED',
    };
  };

  mapMetric('pe_trailing', p.pe_trailing, 'x');
  mapMetric('pe_forward', p.pe_forward, 'x');
  mapMetric('revenue_growth_yoy_pct', p.revenue_growth_yoy_pct, '%');
  mapMetric('gross_margin_pct', p.gross_margin_pct, '%');
  mapMetric('net_margin_pct', p.net_margin_pct, '%');
  mapMetric('ev_ebitda', p.ev_ebitda, 'x');
  mapMetric('price_to_book', p.pb_ratio, 'x');
  mapMetric('roe_pct', p.roe_pct, '%');
  mapMetric('fcf_yield_pct', p.fcf_yield_pct, '%');

  return metricObservations;
}

/**
 * Deterministically computes median from an array of valid numbers.
 * Invariant: Missing values are excluded, NEVER converted to 0 (missing != 0).
 * For multiples (e.g. EV/EBITDA, P/E), non-positive values (<= 0) are excluded when excludeNonPositive is true.
 */
export function calculateDeterministicMedian(values: (number | null | undefined)[], excludeNonPositive = false): number | null {
  const clean = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && (!excludeNonPositive || v > 0));
  if (clean.length === 0) return null;
  clean.sort((a, b) => a - b);
  const mid = Math.floor(clean.length / 2);
  if (clean.length % 2 === 0) {
    return Math.round(((clean[mid - 1] + clean[mid]) / 2) * 100) / 100;
  }
  return clean[mid];
}

/**
 * Main Deterministic Peer Discovery Engine.
 * Follows the pipeline:
 * Target Company -> Business Archetype -> Semantic Fingerprint -> Dynamic Candidate Discovery -> Verification -> Hard Filters -> Similarity Scoring -> Top Candidate Set -> Medians.
 */
export function discoverPeers(
  report: Partial<ReportData>,
  ticker?: string,
  options?: PeerDiscoveryOptions
): PeerDiscoveryResult {
  const targetTicker = (ticker || report.ticker || (report as any)?.symbol || 'STOCK').toUpperCase().trim();
  const targetFingerprint = buildPeerBusinessFingerprint(report, targetTicker);

  // Check cache for identical target & fingerprint
  const cacheKey = `${targetTicker}:${targetFingerprint.archetype}:${targetFingerprint.subIndustry || targetFingerprint.industry}:${report.as_of_date || 'latest'}`;
  const cached = peerDiscoveryCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS) && !options?.candidates) {
    return cached.result;
  }

  // 1. Gather raw candidates from dynamic sources first:
  //    a. Explicit options.candidates
  //    b. report.peer_comparison?.peers
  //    c. report.valuation_dashboard?.pe_ratio?.peer_comparison_list
  const rawCandidates: (CandidateDefinition | PeerCompanyItem)[] = [];

  if (options?.candidates && options.candidates.length > 0) {
    rawCandidates.push(...options.candidates);
  } else if (report.peer_comparison?.peers && report.peer_comparison.peers.length > 0) {
    rawCandidates.push(...report.peer_comparison.peers);
  } else if (report.valuation_dashboard?.pe_ratio?.peer_comparison_list && report.valuation_dashboard.pe_ratio.peer_comparison_list.length > 0) {
    for (const item of report.valuation_dashboard.pe_ratio.peer_comparison_list) {
      if (!item.is_target) {
        rawCandidates.push({
          ticker: item.symbol,
          company_name: item.name,
          pe_trailing: typeof item.ratio_value === 'number' ? item.ratio_value : null,
          pe_forward: typeof item.forward_ratio === 'number' ? item.forward_ratio : null,
          market_cap: item.market_cap_b ? `$${item.market_cap_b}B` : undefined,
        });
      }
    }
  }

  // 1d. If no dynamic candidates found from report, run runtime candidate discovery service:
  if (rawCandidates.length === 0) {
    const discovered = discoverPeerCandidates(targetFingerprint);
    if (discovered.length > 0) {
      rawCandidates.push(...discovered);
    }
  }

  // 2. Fixture fallback: strictly test-only or when explicitly allowed, NEVER in production
  const isProduction = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
  const allowFixture = options?.allowFixtureFallback ?? (!isProduction && !options?.disableFixtureFallback);
  if (rawCandidates.length === 0 && allowFixture && !options?.disableFixtureFallback && !isProduction) {
    rawCandidates.push(...FIXTURE_CANDIDATE_UNIVERSE);
  }

  // 3. Process, verify, filter, and score candidates
  const candidates: PeerCandidate[] = [];
  const seenTickers = new Set<string>();

  for (const raw of rawCandidates) {
    const v = verifyCandidate(raw);
    if (!v.valid) continue;

    const candTicker = (raw.ticker || (raw as any).symbol || '').toUpperCase().trim();
    if (candTicker === targetTicker || seenTickers.has(candTicker)) continue;
    seenTickers.add(candTicker);

    const candFingerprint = buildCandidateFingerprint(raw, targetFingerprint);
    const filterRes = passesHardFilters(targetFingerprint, candFingerprint);
    if (!filterRes.passes) continue;

    const { score, relationType, rationaleEn, rationaleTh } = calculatePeerSimilarity(targetFingerprint, candFingerprint);
    if (score < 0.25) continue;

    const metrics = extractCandidateMetrics(raw, candTicker, candFingerprint.companyName, report.as_of_date);

    candidates.push({
      ticker: candTicker,
      companyName: candFingerprint.companyName,
      fingerprint: candFingerprint,
      similarityScore: score,
      relationType,
      selectionRationale: rationaleEn,
      selectionRationaleTh: rationaleTh,
      metrics,
    });
  }

  // Sort candidates by similarity score descending
  candidates.sort((a, b) => b.similarityScore - a.similarityScore);

  // Take top candidates (between 3 and 8 preferred)
  const finalPeers = candidates.slice(0, 8);
  const peerCount = finalPeers.length;
  const isLimitedSample = peerCount > 0 && peerCount <= 2;

  // Handle Truthful Unavailable State if 0 peers found
  if (peerCount === 0) {
    const unavailableReason: PeerUnavailableReason = 'NO_CANDIDATES';
    const unavailableMessageTh = 'ยังไม่พบกลุ่มบริษัทที่เปรียบเทียบได้และมีข้อมูลที่ตรวจสอบแล้วเพียงพอ';
    const unavailableMessageEn = 'No sufficiently comparable source-verified peer set is currently available.';

    const emptyResult: PeerDiscoveryResult = {
      targetTicker,
      targetFingerprint,
      peers: [],
      peerCount: 0,
      isLimitedSample: false,
      unavailableReason,
      unavailableMessageEn,
      unavailableMessageTh,
      medians: {},
      isBroadSectorUniverse: false,
      benchmarkRows: [],
      peerCompanyItems: [],
    };
    return emptyResult;
  }

  // Compute deterministic medians for all available metric keys
  const allMetricKeys = new Set<string>();
  for (const p of finalPeers) {
    for (const k of Object.keys(p.metrics)) {
      allMetricKeys.add(k);
    }
  }

  const medians: Record<string, number | null> = {};
  for (const k of allMetricKeys) {
    const vals = finalPeers.map(p => p.metrics[k]?.value);
    const isMultiple = ['pe_trailing', 'pe_forward', 'ev_ebitda', 'ev_sales', 'p_ffo_multiple'].includes(k);
    medians[k] = calculateDeterministicMedian(vals, isMultiple);
  }

  // Map to PeerCompanyItem for PeerComparisonTable
  const peerCompanyItems: PeerCompanyItem[] = finalPeers.map(p => ({
    ticker: p.ticker,
    company_name: p.companyName,
    market_cap: p.metrics.market_cap?.value ? `$${p.metrics.market_cap.value}B` : undefined,
    pe_trailing: p.metrics.pe_trailing?.value,
    pe_forward: p.metrics.pe_forward?.value,
    revenue_growth_yoy_pct: p.metrics.revenue_growth_yoy_pct?.value,
    gross_margin_pct: p.metrics.gross_margin_pct?.value,
    net_margin_pct: p.metrics.net_margin_pct?.value,
    ev_ebitda: p.metrics.ev_ebitda?.value,
    pb_ratio: p.metrics.price_to_book?.value,
    roe_pct: p.metrics.roe_pct?.value,
    fcf_yield_pct: p.metrics.fcf_yield_pct?.value,
    status_label_th: p.relationType === 'DIRECT_PEER' ? 'คู่แข่งตรง' : p.relationType === 'CLOSE_COMPARABLE' ? 'บริษัทเทียบเคียง' : 'บริษัทอ้างอิง',
    status_label_en: p.relationType === 'DIRECT_PEER' ? 'Direct Peer' : p.relationType === 'CLOSE_COMPARABLE' ? 'Close Comparable' : 'Broader Reference',
    relation_type: p.relationType,
    similarity_score: p.similarityScore,
    selection_rationale: p.selectionRationale,
    selection_rationale_th: p.selectionRationaleTh,
    as_of_date: p.metrics.pe_trailing?.period || report.as_of_date,
  }));

  // Add target row to peerCompanyItems for context
  const targetPE = report.valuation_ratios?.find(r => /P\/E/.test(r.name) && !/forward/i.test(r.name))?.value;
  const targetFwdPE = report.valuation_ratios?.find(r => /forward.*P\/E|P\/E.*forward/i.test(r.name))?.value;
  const targetRevGrowth = report.financial_statements?.income_statement?.yoy_revenue_growth_pct?.[
    (report.financial_statements?.income_statement?.yoy_revenue_growth_pct?.length || 0) - 1
  ];
  const targetGM = report.financial_statements?.income_statement?.gross_margin_pct?.[
    (report.financial_statements?.income_statement?.gross_margin_pct?.length || 0) - 1
  ];
  const targetNM = report.financial_statements?.income_statement?.net_margin_pct?.[
    (report.financial_statements?.income_statement?.net_margin_pct?.length || 0) - 1
  ];

  peerCompanyItems.unshift({
    ticker: targetTicker,
    company_name: targetFingerprint.companyName,
    pe_trailing: typeof targetPE === 'number' ? targetPE : null,
    pe_forward: typeof targetFwdPE === 'number' ? targetFwdPE : null,
    revenue_growth_yoy_pct: typeof targetRevGrowth === 'number' ? targetRevGrowth : null,
    gross_margin_pct: typeof targetGM === 'number' ? targetGM : null,
    net_margin_pct: typeof targetNM === 'number' ? targetNM : null,
    status_label_th: 'หุ้นเป้าหมาย',
    status_label_en: 'Target',
  });

  // Build archetype-aware benchmark rows for Five Pillars (Pillar 5)
  const benchmarkRows = buildArchetypeBenchmarkRows(targetFingerprint.archetype, report, finalPeers, medians);

  const result: PeerDiscoveryResult = {
    targetTicker,
    targetFingerprint,
    peers: finalPeers,
    peerCount,
    isLimitedSample,
    medians,
    isBroadSectorUniverse: false,
    benchmarkRows,
    peerCompanyItems,
  };

  peerDiscoveryCache.set(cacheKey, { timestamp: Date.now(), result });
  return result;
}

/**
 * Builds business-aware benchmark rows for Five Pillars based on archetype.
 * Invariant: Direct Peer column must refer to ONE company across all rows.
 * If no DIRECT_PEER is available, direct_peer_value shows 'N/A'.
 */
function buildArchetypeBenchmarkRows(
  archetype: BusinessArchetype,
  report: Partial<ReportData>,
  peers: PeerCandidate[],
  medians: Record<string, number | null>
): PeerBenchmarkRow[] {
  const rows: PeerBenchmarkRow[] = [];
  const isFinancial = ['bank', 'lender', 'fintech', 'insurer'].includes(archetype);
  const isReit = archetype === 'reit';
  const isEarlyStage = archetype === 'early_stage';

  const fmt = (v: number | null | undefined, unit = '') =>
    typeof v === 'number' && Number.isFinite(v) ? `${v}${unit}` : 'N/A';

  const fmtMultiple = (v: number | null | undefined, unit = 'x') => {
    if (v === null || v === undefined || !Number.isFinite(v)) return 'N/A';
    if (v <= 0) return 'N/M';
    return `${v}${unit}`;
  };

  // Section 27: Direct Peer must refer to one company.
  // Prefer DIRECT_PEER, or fall back to closest comparable if no DIRECT_PEER meets threshold
  const directPeer = peers.find(p => p.relationType === 'DIRECT_PEER') || peers.find(p => p.relationType === 'CLOSE_COMPARABLE');

  if (isFinancial) {
    // Financial Benchmark Rows: P/E, P/B, ROE, NIM
    const peMed = medians.pe_trailing;
    const targetPE = report.valuation_ratios?.find(r => /P\/E/.test(r.name) && !/forward/i.test(r.name))?.value;
    rows.push({
      metric_name: 'P/E (Trailing)',
      metric_name_th: 'อัตราส่วนราคาต่อกำไร',
      target_value: fmtMultiple(targetPE, 'x'),
      sector_median: fmtMultiple(peMed, 'x'),
      direct_peer_value: fmtMultiple(directPeer?.metrics.pe_trailing?.value, 'x'),
      status: targetPE && peMed && targetPE > 0 && peMed > 0 ? (targetPE < peMed ? 'better' : 'premium') : 'neutral',
      status_label_th: targetPE && peMed && targetPE > 0 && peMed > 0 ? (targetPE < peMed ? 'ต่ำกว่าค่ากลาง' : 'พรีเมียมกว่าค่ากลาง') : 'เทียบเท่า',
    });

    const pbMed = medians.price_to_book;
    const targetPB = report.valuation_ratios?.find(r => /P\/B/i.test(r.name))?.value;
    rows.push({
      metric_name: 'P/B Ratio',
      metric_name_th: 'ราคาต่อมูลค่าทางบัญชี',
      target_value: fmt(targetPB, 'x'),
      sector_median: fmt(pbMed, 'x'),
      direct_peer_value: fmt(directPeer?.metrics.price_to_book?.value, 'x'),
      status: targetPB && pbMed ? (targetPB < pbMed ? 'better' : 'premium') : 'neutral',
      status_label_th: targetPB && pbMed ? (targetPB < pbMed ? 'ต่ำกว่าค่ากลาง' : 'พรีเมียมกว่าค่ากลาง') : 'เทียบเท่า',
    });

    const roeMed = medians.roe_pct;
    const kiRoe = (report.key_indicators as any)?.profitability?.roe_pct ?? (report.financial_statements?.key_indicators as any)?.roe_pct;
    rows.push({
      metric_name: 'Return on Equity (ROE)',
      metric_name_th: 'ผลตอบแทนต่อส่วนผู้ถือหุ้น',
      target_value: fmt(kiRoe, '%'),
      sector_median: fmt(roeMed, '%'),
      direct_peer_value: fmt(directPeer?.metrics.roe_pct?.value, '%'),
      status: kiRoe && roeMed ? (kiRoe > roeMed ? 'better' : 'worse') : 'neutral',
      status_label_th: kiRoe && roeMed ? (kiRoe > roeMed ? 'สูงกว่าค่ากลาง' : 'ต่ำกว่าค่ากลาง') : 'เทียบเท่า',
    });

    const nimMed = medians.net_interest_margin_pct;
    const kiNim = (report.key_indicators as any)?.profitability?.net_interest_margin_pct;
    rows.push({
      metric_name: 'Net Interest Margin (NIM)',
      metric_name_th: 'อัตราส่วนต่างดอกเบี้ยสุทธิ',
      target_value: fmt(kiNim, '%'),
      sector_median: fmt(nimMed, '%'),
      direct_peer_value: fmt(directPeer?.metrics.net_interest_margin_pct?.value, '%'),
      status: kiNim && nimMed ? (kiNim > nimMed ? 'better' : 'worse') : 'neutral',
      status_label_th: kiNim && nimMed ? (kiNim > nimMed ? 'สูงกว่าค่ากลาง' : 'ต่ำกว่าค่ากลาง') : 'เทียบเท่า',
    });
  } else if (isReit) {
    // REIT Benchmark Rows: P/FFO, Occupancy Rate
    const pffoMed = medians.p_ffo_multiple;
    rows.push({
      metric_name: 'Price / FFO',
      metric_name_th: 'ราคาต่อกระแสเงินสดจากดำเนินงาน (P/FFO)',
      target_value: fmt(pffoMed, 'x'),
      sector_median: fmt(pffoMed, 'x'),
      direct_peer_value: fmt(directPeer?.metrics.p_ffo_multiple?.value, 'x'),
      status: 'neutral',
      status_label_th: 'เทียบเท่า',
    });

    const occMed = medians.occupancy_rate_pct;
    rows.push({
      metric_name: 'Occupancy Rate',
      metric_name_th: 'อัตราการเช่าพื้นที่',
      target_value: fmt(occMed, '%'),
      sector_median: fmt(occMed, '%'),
      direct_peer_value: fmt(directPeer?.metrics.occupancy_rate_pct?.value, '%'),
      status: 'better',
      status_label_th: 'อัตราเช่าสูง',
    });
  } else if (isEarlyStage) {
    // Early Stage Benchmark Rows: EV/Sales, Revenue Growth
    const evsMed = medians.ev_sales;
    rows.push({
      metric_name: 'EV / Sales Multiple',
      metric_name_th: 'มูลค่ากิจการต่อรายได้',
      target_value: fmt(evsMed, 'x'),
      sector_median: fmt(evsMed, 'x'),
      direct_peer_value: fmt(directPeer?.metrics.ev_sales?.value, 'x'),
      status: 'neutral',
      status_label_th: 'เทียบเท่า',
    });

    const revgMed = medians.revenue_growth_yoy_pct;
    rows.push({
      metric_name: 'YoY Revenue Growth',
      metric_name_th: 'การเติบโตรายได้ YoY',
      target_value: fmt(revgMed, '%'),
      sector_median: fmt(revgMed, '%'),
      direct_peer_value: fmt(directPeer?.metrics.revenue_growth_yoy_pct?.value, '%'),
      status: 'better',
      status_label_th: 'เติบโตสูง',
    });
  } else {
    // Standard Operating & Industrial/Manufacturing Benchmark Rows: P/E, EV/EBITDA, Revenue Growth, ROIC
    const peMed = medians.pe_trailing;
    const targetPE = report.valuation_ratios?.find(r => /P\/E/.test(r.name) && !/forward/i.test(r.name))?.value;
    rows.push({
      metric_name: 'P/E (Trailing)',
      metric_name_th: 'อัตราส่วนราคาต่อกำไร',
      target_value: fmtMultiple(targetPE, 'x'),
      sector_median: fmtMultiple(peMed, 'x'),
      direct_peer_value: fmtMultiple(directPeer?.metrics.pe_trailing?.value, 'x'),
      status: targetPE && peMed && targetPE > 0 && peMed > 0 ? (targetPE < peMed ? 'better' : 'premium') : 'neutral',
      status_label_th: targetPE && peMed && targetPE > 0 && peMed > 0 ? (targetPE < peMed ? 'ต่ำกว่าค่ากลาง' : 'พรีเมียมกว่าค่ากลาง') : 'เทียบเท่า',
    });

    const eveMed = medians.ev_ebitda;
    const targetEVE = report.valuation_ratios?.find(r => /EV\/EBITDA/i.test(r.name))?.value;
    rows.push({
      metric_name: 'EV / EBITDA',
      metric_name_th: 'มูลค่ากิจการต่อกำไรก่อนดอกเบี้ยภาษี',
      target_value: fmtMultiple(targetEVE, 'x'),
      sector_median: fmtMultiple(eveMed, 'x'),
      direct_peer_value: fmtMultiple(directPeer?.metrics.ev_ebitda?.value, 'x'),
      status: targetEVE && eveMed && targetEVE > 0 && eveMed > 0 ? (targetEVE < eveMed ? 'better' : 'premium') : 'neutral',
      status_label_th: targetEVE && eveMed && targetEVE > 0 && eveMed > 0 ? (targetEVE < eveMed ? 'ต่ำกว่าค่ากลาง' : 'พรีเมียมกว่าค่ากลาง') : 'เทียบเท่า',
    });

    const revgMed = medians.revenue_growth_yoy_pct;
    const targetRevGrowth = report.financial_statements?.income_statement?.yoy_revenue_growth_pct?.[
      (report.financial_statements?.income_statement?.yoy_revenue_growth_pct?.length || 0) - 1
    ];
    rows.push({
      metric_name: 'Revenue Growth YoY',
      metric_name_th: 'การเติบโตรายได้ YoY',
      target_value: fmt(targetRevGrowth, '%'),
      sector_median: fmt(revgMed, '%'),
      direct_peer_value: fmt(directPeer?.metrics.revenue_growth_yoy_pct?.value, '%'),
      status: targetRevGrowth && revgMed ? (targetRevGrowth > revgMed ? 'better' : 'worse') : 'neutral',
      status_label_th: targetRevGrowth && revgMed ? (targetRevGrowth > revgMed ? 'เติบโตสูงกว่า' : 'เติบโตต่ำกว่า') : 'เทียบเท่า',
    });

    const roicMed = medians.roic_pct;
    const kiRoic = (report.key_indicators as any)?.profitability?.roic_pct;
    rows.push({
      metric_name: 'ROIC',
      metric_name_th: 'ผลตอบแทนเงินลงทุน',
      target_value: fmt(kiRoic, '%'),
      sector_median: fmt(roicMed, '%'),
      direct_peer_value: fmt(directPeer?.metrics.roic_pct?.value, '%'),
      status: kiRoic && roicMed ? (kiRoic > roicMed ? 'better' : 'worse') : 'neutral',
      status_label_th: kiRoic && roicMed ? (kiRoic > roicMed ? 'สูงกว่าค่ากลาง' : 'ต่ำกว่าค่ากลาง') : 'เทียบเท่า',
    });
  }

  return rows;
}
