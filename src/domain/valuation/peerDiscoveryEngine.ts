import type { ReportData, PeerBenchmarkRow, PeerCompanyItem } from '../../types.js';
import { resolveBusinessArchetype, type BusinessArchetype } from '../financialMetricContext.js';
import { resolveFundamentalMetrics, type ResolvedFundamentalMetrics } from './metricRegistry.js';
import { calculateCanonicalRoic, calculateInvestedCapital } from './canonicalRoic.js';
import type {
  FactVerificationStatus,
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
  targetMetrics?: ResolvedFundamentalMetrics;
  candidateDiscoverer?: (target: PeerBusinessFingerprint | PeerCandidateDiscoveryInput) => CandidateDefinition[];
}

export type PeerCandidateDiscoverer = (
  target: PeerBusinessFingerprint | PeerCandidateDiscoveryInput
) => CandidateDefinition[];

let globalRuntimeDiscoverer: PeerCandidateDiscoverer | null = null;

export function setRuntimePeerDiscoverer(discoverer: PeerCandidateDiscoverer | null) {
  globalRuntimeDiscoverer = discoverer;
}

export function getRuntimePeerDiscoverer(): PeerCandidateDiscoverer | null {
  return globalRuntimeDiscoverer;
}

export interface PeerCandidateDiscoveryInput {
  ticker: string;
  companyName?: string;
  primaryArchetype: BusinessArchetype;
  sector?: string;
  industry?: string;
  subIndustry?: string;
  businessDescription?: string;
  businessLines?: string[];
  geography?: string;
  scaleTier?: string;
  lifecycle?: string;
}

export function filterCandidateUniverse(
  universe: CandidateDefinition[],
  target: PeerBusinessFingerprint | PeerCandidateDiscoveryInput
): CandidateDefinition[] {
  const targetArchetype = 'archetype' in target ? target.archetype : target.primaryArchetype;
  const targetIndustry = (target.industry || '').toLowerCase().trim();
  const targetSubIndustry = (target.subIndustry || '').toLowerCase().trim();
  const targetSector = (target.sector || '').toLowerCase().trim();
  const targetTicker = (target.ticker || '').toUpperCase().trim();

  return universe.filter(cand => {
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
 * Bounded source-backed runtime peer candidate discovery service.
 * Discovers candidate public companies based on target's verified business fingerprint.
 * Enables peer discovery for unknown tickers without code deployment.
 */
export function discoverPeerCandidates(
  target: PeerBusinessFingerprint | PeerCandidateDiscoveryInput,
  options?: PeerDiscoveryOptions
): CandidateDefinition[] {
  if (options?.candidateDiscoverer) {
    return options.candidateDiscoverer(target);
  }
  if (globalRuntimeDiscoverer) {
    return globalRuntimeDiscoverer(target);
  }
  const isProduction = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
  if (isProduction || options?.disableFixtureFallback) {
    return [];
  }
  return filterCandidateUniverse(PUBLIC_CANDIDATE_UNIVERSE, target);
}

/**
 * In-memory cache for discovered peer results to avoid redundant recomputations.
 */
const peerDiscoveryCache = new Map<string, { timestamp: number; result: PeerDiscoveryResult }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const scaleRank: Record<NonNullable<PeerBusinessFingerprint['scaleTier']>, number> = { small: 0, mid: 1, large: 2, mega: 3 };
const inferScaleTier = (marketCap: unknown, revenueM?: number): NonNullable<PeerBusinessFingerprint['scaleTier']> | undefined => {
  let marketCapB: number | undefined;
  if (typeof marketCap === 'number' && Number.isFinite(marketCap)) marketCapB = marketCap > 1_000_000 ? marketCap / 1_000_000_000 : marketCap;
  if (typeof marketCap === 'string') {
    const match = marketCap.replace(/[$,]/g, '').match(/([0-9.]+)\s*([TBM])?/i);
    if (match) {
      const raw = Number(match[1]);
      marketCapB = match[2]?.toUpperCase() === 'T' ? raw * 1000 : match[2]?.toUpperCase() === 'M' ? raw / 1000 : raw;
    }
  }
  const basisB = marketCapB ?? (Number.isFinite(revenueM) ? revenueM! / 1000 : undefined);
  if (basisB === undefined) return undefined;
  return basisB >= 100 ? 'mega' : basisB >= 10 ? 'large' : basisB >= 2 ? 'mid' : 'small';
};

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
  const latestRevenue = (inc?.revenue || []).filter(v => typeof v === 'number').at(-1) as number | undefined;
  const scaleTier = inferScaleTier((profile as any)?.market_cap || (profile as any)?.overview?.market_cap, latestRevenue);
  const lifecycle = archetype === 'early_stage'
    ? 'early_stage'
    : profitabilityState === 'pre_profit'
      ? 'growth'
      : 'mature';

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
    lifecycle,
    profitabilityState,
    capitalIntensity,
    regulatoryType: isFinancial ? 'banking' : archetype === 'reit' ? 'reit' : 'standard',
    scaleTier,
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

  // 1. Business Archetype Match (Weight: 0.30)
  if (target.archetype === candidate.archetype) {
    score += 0.30;
  } else {
    // Partial credit for compatible financial intermediaries
    const financialArchetypes = new Set(['bank', 'lender', 'fintech']);
    if (financialArchetypes.has(target.archetype) && financialArchetypes.has(candidate.archetype)) {
      score += 0.18;
    }
  }

  // 2. Sub-Industry / Sector Match (Weight: 0.25)
  if (target.subIndustry && candidate.subIndustry && target.subIndustry === candidate.subIndustry) {
    score += 0.25;
  } else if (target.industry.toLowerCase() === candidate.industry.toLowerCase()) {
    score += 0.17;
  } else if (target.sector.toLowerCase() === candidate.sector.toLowerCase()) {
    score += 0.08;
  }

  // 3. Revenue Models Overlap (Weight: 0.10)
  const targetRev = new Set(target.revenueModels);
  const sharedRev = candidate.revenueModels.filter(r => targetRev.has(r)).length;
  if (sharedRev > 0) {
    score += Math.min(0.10, (sharedRev / Math.max(1, targetRev.size)) * 0.10);
  }

  // 4. Profitability & Lifecycle Match (Weight: 0.15)
  if (target.profitabilityState === candidate.profitabilityState) {
    score += 0.075;
  }
  if (target.lifecycle === candidate.lifecycle) {
    score += 0.075;
  }

  // 5. Capital Intensity & Regulatory Framework (Weight: 0.10)
  if (target.capitalIntensity === candidate.capitalIntensity) {
    score += 0.05;
  }
  if (target.regulatoryType === candidate.regulatoryType) {
    score += 0.05;
  }

  // 6. Scale compatibility (Weight: 0.10). Unknown scale earns no points.
  const scaleDistance = target.scaleTier && candidate.scaleTier
    ? Math.abs(scaleRank[target.scaleTier] - scaleRank[candidate.scaleTier])
    : undefined;
  if (scaleDistance === 0) score += 0.10;
  else if (scaleDistance === 1) score += 0.05;

  score = Math.round(score * 100) / 100;

  let relationType: PeerRelationType = 'BROADER_SECTOR_REFERENCE';
  if (score >= 0.80) {
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
    if (target.lifecycle !== candidate.lifecycle || target.profitabilityState !== candidate.profitabilityState || (scaleDistance !== undefined && scaleDistance > 1)) {
      relationType = 'CLOSE_COMPARABLE';
    }
  }

  const rationaleEn = relationType === 'DIRECT_PEER'
    ? `Direct peer sharing identical ${target.archetype} business archetype and ${target.subIndustry || target.industry} operating model.`
    : relationType === 'CLOSE_COMPARABLE'
      ? `Close comparable with aligned core economics in ${target.industry}, but a material lifecycle, profitability, scale, or product-mix difference.`
      : `Broader sector reference in ${target.sector}.`;

  const rationaleTh = relationType === 'DIRECT_PEER'
    ? `คู่แข่งตรงที่มีโครงสร้างธุรกิจแบบ ${target.archetype} และโมเดลการดำเนินงาน ${target.subIndustry || target.industry} เดียวกัน`
    : relationType === 'CLOSE_COMPARABLE'
      ? `บริษัทเทียบเคียงในกลุ่ม ${target.industry} ที่โมเดลธุรกิจใกล้เคียง แต่ต่างกันอย่างมีนัยสำคัญด้านวงจรธุรกิจ กำไร ขนาด หรือส่วนผสมสินค้า`
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

  // 9. Retail Guard: Traditional physical retail must not be compared to digital marketplaces indiscriminately
  if (target.archetype === 'retail' && candidate.archetype === 'digital_marketplace') {
    return { passes: false, reason: 'RETAIL_VS_MARKETPLACE_MISMATCH' };
  }
  if (target.archetype === 'digital_marketplace' && candidate.archetype === 'retail') {
    return { passes: false, reason: 'MARKETPLACE_VS_RETAIL_MISMATCH' };
  }

  // 10. Lifecycle, profitability and scale are similarity inputs, not hard filters.
  // A younger or smaller company can remain a truthful CLOSE_COMPARABLE.

  // 11. Automotive Guard: reject an explicitly different industrial business model.
  // Unknown/general metadata is allowed through for scoring instead of becoming a false hard rejection.
  const knownNonAutomotiveIndustrialModels = new Set([
    'aerospace_defense', 'industrial_machinery', 'fabless_accelerator',
    'foundry_manufacturing', 'equipment', 'oil_gas_ep', 'refining',
    'oilfield_services', 'physical_omnichannel_retail', 'digital_marketplace',
    'enterprise_cloud_software',
  ]);
  if (
    target.subIndustry === 'automotive_manufacturing'
    && (candidate.archetype !== 'industrial_manufacturing'
      || knownNonAutomotiveIndustrialModels.has(candidate.subIndustry || ''))
  ) {
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

  const suppliedSubIndustry = typeof p.subIndustry === 'string'
    ? p.subIndustry.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    : '';
  const businessIdentityText = `${suppliedSubIndustry} ${industry} ${(p as any).description || ''}`.toLowerCase();
  let subIndustry = suppliedSubIndustry || 'general';
  if (
    archetype === 'industrial_manufacturing'
    && /automotive|automaker|auto[_\s-]*manufact|electric[_\s-]*vehicle|vehicle[_\s-]*manufact|(^|[_\s-])ev([_\s-]|$)|car[_\s-]*manufact/.test(businessIdentityText)
  ) {
    subIndustry = 'automotive_manufacturing';
  } else if (/property.*casualty|casualty.*property|p_c_insurance/.test(suppliedSubIndustry)) {
    subIndustry = 'pc_insurance';
  } else if (/industrial.*reit|logistics.*reit/.test(suppliedSubIndustry)) {
    subIndustry = 'industrial_logistics_reit';
  } else if (/office.*reit/.test(suppliedSubIndustry)) {
    subIndustry = 'office_reit';
  } else if (/data.*center.*reit/.test(suppliedSubIndustry)) {
    subIndustry = 'data_center_reit';
  } else if (/physical.*retail|omnichannel.*retail/.test(suppliedSubIndustry)) {
    subIndustry = 'physical_omnichannel_retail';
  } else if (/digital.*marketplace|online.*marketplace/.test(suppliedSubIndustry)) {
    subIndustry = 'digital_marketplace';
  }
  if (!suppliedSubIndustry) {
    if (/auto\s*manufactur|electric\s*vehicle|automotive/i.test(industry)) {
      subIndustry = 'automotive_manufacturing';
    } else if (archetype === 'semiconductor') {
      const text = `${industry} ${companyName} ${(p as any).description || ''}`;
      subIndustry = /foundry|wafer\s*fab/i.test(text) ? 'foundry_manufacturing' : 'fabless_accelerator';
    } else if (archetype === 'reit') {
      subIndustry = /industrial/i.test(industry) ? 'industrial_logistics_reit' : /office/i.test(industry) ? 'office_reit' : 'general_reit';
    } else if (archetype === 'energy_commodity') {
      subIndustry = /refin/i.test(industry) ? 'refining' : 'oil_gas_ep';
    } else if (archetype === 'retail') {
      subIndustry = 'physical_omnichannel_retail';
    } else if (archetype === 'saas_software') {
      subIndustry = 'enterprise_cloud_software';
    }
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
    scaleTier: p.scaleTier || inferScaleTier(p.market_cap),
  };
}

export const GENERATED_FALLBACK_SOURCE_STRING = 'Verified Peer Disclosure / Market Snapshot';
const GENERATED_FALLBACK_SOURCE_REGEX = /Verified Peer Disclosure \/ Market Snapshot/i;

const MARKET_METRICS = new Set([
  'pe_trailing',
  'pe_forward',
  'market_cap',
  'ev_ebitda',
  'ev_sales',
  'price_to_book',
  'price_to_tbv',
  'p_ffo_multiple',
  'p_affo_multiple',
  'fcf_yield_pct',
  'occupancy_rate_pct',
]);

export function isFilingGradeSource(source?: string | null): boolean {
  if (!source || typeof source !== 'string') return false;
  const s = source.trim();
  if (!s || GENERATED_FALLBACK_SOURCE_REGEX.test(s)) return false;
  return /SEC|10-K|10-Q|20-F|8-K|EDGAR|XBRL|issuer|filing|official|earnings release|annual report|quarterly report|source-backed|disclosure/i.test(s);
}

export function isMarketGradeSource(source?: string | null): boolean {
  if (!source || typeof source !== 'string') return false;
  const s = source.trim();
  if (!s || GENERATED_FALLBACK_SOURCE_REGEX.test(s)) return false;
  if (isFilingGradeSource(s)) return true;
  return /market|provider|bloomberg|factset|s&p|refinitiv|morningstar|yahoo|google|exchange|nasdaq|nyse|fmp|financial modeling prep|lseg|snapshot/i.test(s);
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

  const completeDerivedMetrics = () => {
    if (metricObservations.roic_pct?.value !== null && metricObservations.roic_pct?.status === 'VERIFIED') return;
    const requiredKeys = ['operating_income', 'income_before_tax', 'income_tax_expense', 'total_debt', 'total_equity', 'cash_and_equivalents'];
    const facts = requiredKeys.map(key => metricObservations[key]);
    if (facts.some(fact => !fact || fact.value === null || fact.status !== 'VERIFIED')) return;
    if (facts.some(fact => !isFilingGradeSource(fact.source))) return;
    const periods = new Set(facts.map(fact => fact.period));
    if (periods.size !== 1) return;
    const [operating, pretax, tax, debt, equity, cash] = facts.map(fact => fact.value as number);
    const shortInvestments = metricObservations.short_term_investments?.value ?? 0;

    const investedCapital = calculateInvestedCapital(equity, debt, cash, shortInvestments);
    if (investedCapital === null || investedCapital <= 0) {
      metricObservations.roic_pct = {
        ticker,
        company: companyName,
        metric: 'roic_pct',
        value: null,
        unit: '%',
        period: facts[0].period,
        asOfDate,
        source: `Derived from ${[...new Set(facts.map(fact => fact.source))].join(' + ')}`,
        reportedOrDerived: 'DERIVED',
        status: 'NOT_REPORTED',
        reason: 'Invested capital is non-positive',
        reasonTh: 'เงินลงทุนดำเนินงานสุทธิ (Invested Capital) มีค่าติดลบหรือไม่เป็นบวก',
      };
      return;
    }

    const periodStr = facts[0].period || '';
    const periodBasis: 'TTM' | 'ANNUAL' | 'QUARTERLY' = /TTM|trailing/i.test(periodStr)
      ? 'TTM'
      : /FY\d{4}|annual|10-K/i.test(periodStr)
        ? 'ANNUAL'
        : 'QUARTERLY';

    const roicResult = calculateCanonicalRoic({
      operatingIncome: operating,
      incomeBeforeTax: pretax,
      incomeTaxExpense: tax,
      endingInvestedCapital: investedCapital,
      periodBasis,
      periodLabel: facts[0].period,
      source: `Derived from ${[...new Set(facts.map(fact => fact.source))].join(' + ')}`,
    });

    if (roicResult.status === 'CALCULATED' && typeof roicResult.value === 'number') {
      metricObservations.roic_pct = {
        ticker,
        company: companyName,
        metric: 'roic_pct',
        value: roicResult.value,
        unit: '%',
        period: facts[0].period,
        asOfDate,
        source: roicResult.source || `Derived from ${facts[0].source}`,
        reportedOrDerived: 'DERIVED',
        status: 'VERIFIED',
        basis: roicResult.basis,
        periodBasis: roicResult.periodBasis,
      };
    } else {
      metricObservations.roic_pct = {
        ticker,
        company: companyName,
        metric: 'roic_pct',
        value: null,
        unit: '%',
        period: facts[0].period,
        asOfDate,
        source: roicResult.source || `Derived from ${facts[0].source}`,
        reportedOrDerived: 'DERIVED',
        status: 'NOT_REPORTED',
        reason: roicResult.reason || 'Insufficient verified TTM operating history',
        reasonTh: roicResult.reasonTh,
      };
    }
  };

  if ('metrics' in raw && raw.metrics && typeof raw.metrics === 'object') {
    for (const [mKey, mData] of Object.entries((raw as CandidateDefinition).metrics)) {
      let status: FactVerificationStatus = 'NOT_REPORTED';
      if (mData.value !== null && Number.isFinite(mData.value)) {
        if (mKey === 'roic_pct') {
          status = isFilingGradeSource(mData.source) ? 'VERIFIED' : 'FOUND_UNVERIFIED';
        } else if (MARKET_METRICS.has(mKey)) {
          const isUnverified = !mData.source || GENERATED_FALLBACK_SOURCE_REGEX.test(mData.source) || /unverified/i.test(mData.source);
          status = isUnverified ? 'FOUND_UNVERIFIED' : 'VERIFIED';
        } else {
          status = isFilingGradeSource(mData.source) ? 'VERIFIED' : 'FOUND_UNVERIFIED';
        }
      }
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
        status,
        basis: (mData as any).basis,
        periodBasis: (mData as any).periodBasis,
        reason: (mData as any).reason,
        reasonTh: (mData as any).reasonTh,
      };
    }
    completeDerivedMetrics();
    return metricObservations;
  }

  // Map from PeerCompanyItem
  const p = raw as PeerCompanyItem;
  const period = p.financial_period || p.as_of_date || asOfDate || 'Latest';
  const rawSource = p.financial_source?.trim();
  const source = rawSource && !GENERATED_FALLBACK_SOURCE_REGEX.test(rawSource)
    ? rawSource
    : '';

  const normalizePeerNumber = (value: unknown): number | null => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    const normalized = value.trim().replace(/,/g, '').replace(/[x%]$/i, '').trim();
    if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const mapMetric = (key: string, val: unknown, unit: string) => {
    const normalizedValue = normalizePeerNumber(val);
    let status: FactVerificationStatus = 'NOT_REPORTED';
    if (normalizedValue !== null) {
      if (key === 'roic_pct') {
        // Pre-computed raw ROIC requires underlying filing derivation or verified provenance flag
        status = ((p as any).roic_verified && isFilingGradeSource(source)) ? 'VERIFIED' : 'FOUND_UNVERIFIED';
      } else if (MARKET_METRICS.has(key)) {
        const isUnverified = GENERATED_FALLBACK_SOURCE_REGEX.test(p.financial_source || '') || /unverified/i.test(p.financial_source || '');
        status = isUnverified ? 'FOUND_UNVERIFIED' : 'VERIFIED';
      } else {
        // Fundamental filing facts: strictly require genuine filing-grade provenance
        status = isFilingGradeSource(source) ? 'VERIFIED' : 'FOUND_UNVERIFIED';
      }
    } else if (key === 'pe_trailing' && (val === 'N/M' || p.profitabilityState === 'pre_profit' || (typeof p.net_margin_pct === 'number' && p.net_margin_pct < 0))) {
      status = 'VERIFIED';
    }
    metricObservations[key] = {
      ticker,
      company: companyName,
      metric: key,
      value: normalizedValue,
      unit,
      period,
      asOfDate: p.as_of_date || asOfDate,
      source: source || (MARKET_METRICS.has(key) ? 'Market disclosure' : 'Unverified source'),
      reportedOrDerived: (p as any).reportedOrDerived || 'REPORTED',
      status,
      periodBasis: (p as any)[`${key}_period_basis`] || (p as any).periodBasis || (key === 'roic_pct' ? 'TTM' : /Q[1-4]/i.test(period) ? 'QUARTERLY' : undefined),
      basis: (p as any)[`${key}_basis`] || (p as any).basis,
      reason: (p as any)[`${key}_reason`],
      reasonTh: (p as any)[`${key}_reason_th`],
    };
  };

  mapMetric('pe_trailing', p.pe_trailing, 'x');
  mapMetric('pe_forward', p.pe_forward, 'x');
  mapMetric('revenue_growth_yoy_pct', p.revenue_growth_yoy_pct, '%');
  mapMetric('gross_margin_pct', p.gross_margin_pct, '%');
  mapMetric('operating_margin_pct', p.operating_margin_pct, '%');
  mapMetric('net_margin_pct', p.net_margin_pct, '%');
  mapMetric('ev_ebitda', p.ev_ebitda, 'x');
  mapMetric('ev_sales', p.ev_sales, 'x');
  mapMetric('price_to_book', p.pb_ratio, 'x');
  mapMetric('price_to_tbv', p.ptbv_ratio, 'x');
  mapMetric('roe_pct', p.roe_pct, '%');
  mapMetric('roa_pct', p.roa_pct, '%');
  mapMetric('roic_pct', (p as any).roic_pct, '%');
  mapMetric('net_interest_margin_pct', p.net_interest_margin_pct, '%');
  mapMetric('combined_ratio_pct', p.combined_ratio_pct, '%');
  mapMetric('p_ffo_multiple', p.p_ffo_multiple, 'x');
  mapMetric('p_affo_multiple', p.p_affo_multiple, 'x');
  mapMetric('occupancy_rate_pct', p.occupancy_rate_pct, '%');
  mapMetric('noi_growth_yoy_pct', p.noi_growth_yoy_pct, '%');
  mapMetric('fcf_yield_pct', p.fcf_yield_pct, '%');
  mapMetric('operating_income', p.operating_income, 'USD_M');
  mapMetric('income_before_tax', p.income_before_tax, 'USD_M');
  mapMetric('income_tax_expense', p.income_tax_expense, 'USD_M');
  mapMetric('total_debt', p.total_debt, 'USD_M');
  mapMetric('total_equity', p.total_equity, 'USD_M');
  mapMetric('cash_and_equivalents', p.cash_and_equivalents, 'USD_M');
  mapMetric('short_term_investments', p.short_term_investments, 'USD_M');

  completeDerivedMetrics();

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

export type PeerMetricCoverageStatus = 'SUFFICIENT' | 'LIMITED' | 'INSUFFICIENT';

/**
 * Explicit metric-level sample policy. Two observations provide limited context;
 * one observation is a comparison, not a median.
 */
export function resolvePeerMetricCoverage(sampleSize: number): {
  status: PeerMetricCoverageStatus;
  canPublishMedian: boolean;
} {
  if (sampleSize >= 3) return { status: 'SUFFICIENT', canPublishMedian: true };
  if (sampleSize === 2) return { status: 'LIMITED', canPublishMedian: true };
  return { status: 'INSUFFICIENT', canPublishMedian: false };
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
  const peerListSig = (report.peer_comparison?.peers || []).map(p => p.ticker).sort().join(',');
  const cacheKey = `${targetTicker}:${targetFingerprint.archetype}:${targetFingerprint.subIndustry || targetFingerprint.industry}:${report.as_of_date || 'latest'}:${peerListSig}`;
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
    const discovered = discoverPeerCandidates(targetFingerprint, options);
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

  // 3. Process, verify, filter, and score candidates. Candidate relevance and
  // metric availability are deliberately separate: a relevant company remains
  // eligible even when one or more benchmark metrics are unavailable.
  const candidates: PeerCandidate[] = [];
  const seenTickers = new Set<string>();
  const rejectionCounts: Record<string, number> = {};
  const recordRejection = (reason: string) => {
    rejectionCounts[reason] = (rejectionCounts[reason] || 0) + 1;
  };

  const processCandidates = (items: (CandidateDefinition | PeerCompanyItem)[]) => {
    for (const raw of items) {
      const v = verifyCandidate(raw);
      if (!v.valid) {
        recordRejection(v.reason || 'INVALID_IDENTITY');
        continue;
      }

      const candTicker = (raw.ticker || (raw as any).symbol || '').toUpperCase().trim();
      if (candTicker === targetTicker || seenTickers.has(candTicker)) {
        recordRejection(candTicker === targetTicker ? 'SELF_TARGET' : 'DUPLICATE_TICKER');
        continue;
      }

      const candFingerprint = buildCandidateFingerprint(raw, targetFingerprint);
      const filterRes = passesHardFilters(targetFingerprint, candFingerprint);
      if (!filterRes.passes) {
        recordRejection(filterRes.reason || 'BUSINESS_MODEL_MISMATCH');
        continue;
      }

      const similarity = calculatePeerSimilarity(targetFingerprint, candFingerprint);
      const suppliedRelation = (raw as any).relation_type || (raw as any).relationType;
      const relationType = suppliedRelation === 'CLOSE_COMPARABLE' && similarity.relationType === 'DIRECT_PEER'
        ? 'CLOSE_COMPARABLE'
        : suppliedRelation === 'BROADER_SECTOR_REFERENCE'
          ? 'BROADER_SECTOR_REFERENCE'
          : similarity.relationType;
      const score = similarity.score;
      if (score < 0.25) {
        recordRejection('BELOW_RELEVANCE_THRESHOLD');
        continue;
      }

      const metrics = extractCandidateMetrics(raw, candTicker, candFingerprint.companyName, report.as_of_date);
      const verifiedMetricCount = Object.values(metrics).filter(metric => metric.status === 'VERIFIED' && metric.value !== null).length;
      if (verifiedMetricCount === 0) {
        recordRejection('NO_VERIFIED_METRICS');
        continue;
      }

      seenTickers.add(candTicker);
      candidates.push({
        ticker: candTicker,
        companyName: candFingerprint.companyName,
        fingerprint: candFingerprint,
        similarityScore: score,
        relationType,
        selectionRationale: relationType === similarity.relationType ? similarity.rationaleEn : `Upstream comparability evidence caps this candidate at ${relationType}; ${similarity.rationaleEn}`,
        selectionRationaleTh: relationType === similarity.relationType ? similarity.rationaleTh : `หลักฐานเปรียบเทียบจากต้นทางกำหนดเพดานความสัมพันธ์เป็น ${relationType}; ${similarity.rationaleTh}`,
        metrics,
      });
    }
  };

  processCandidates(rawCandidates);

  // If the supplied set is exhausted or too narrow after verification, ask the
  // runtime discoverer for a broader source-backed universe. Production never
  // falls back to the frozen fixture list.
  if (candidates.length < 3) {
    processCandidates(discoverPeerCandidates(targetFingerprint, options));
  }

  // Sort within truthful relationship tiers, then progressively widen the set.
  candidates.sort((a, b) => b.similarityScore - a.similarityScore);
  const finalPeers = [
    ...candidates.filter(candidate => candidate.relationType === 'DIRECT_PEER'),
    ...candidates.filter(candidate => candidate.relationType === 'CLOSE_COMPARABLE'),
    ...candidates.filter(candidate => candidate.relationType === 'BROADER_SECTOR_REFERENCE'),
  ].slice(0, 8);
  const peerCount = finalPeers.length;
  const isLimitedSample = peerCount > 0 && peerCount <= 2;

  // Handle Truthful Unavailable State if 0 peers found
  if (peerCount === 0) {
    const hasRawCandidates = rawCandidates.length > 0;
    const lacksVerifiedMetrics = Boolean(rejectionCounts.NO_VERIFIED_METRICS);
    const unavailableReason: PeerUnavailableReason = !hasRawCandidates
      ? 'SOURCE_GAP'
      : lacksVerifiedMetrics
        ? 'INSUFFICIENT_VERIFIED_METRICS'
        : 'BUSINESS_MODEL_AMBIGUOUS';
    const rejectionSummary = Object.entries(rejectionCounts)
      .filter(([reason]) => reason !== 'SELF_TARGET' && reason !== 'DUPLICATE_TICKER')
      .map(([reason, count]) => `${reason} (${count})`)
      .join(', ');
    const unavailableMessageTh = !hasRawCandidates
      ? 'ยังไม่พบข้อมูลบริษัทอ้างอิงจากแหล่งข้อมูลที่เชื่อถือได้'
      : lacksVerifiedMetrics
        ? 'พบบริษัทที่เกี่ยวข้อง แต่ยังไม่มีตัวเลขเปรียบเทียบที่ตรวจสอบได้'
        : `บริษัทที่พบยังไม่ผ่านเกณฑ์ความสอดคล้องของโมเดลธุรกิจ${rejectionSummary ? `: ${rejectionSummary}` : ''}`;
    const unavailableMessageEn = !hasRawCandidates
      ? 'No source-backed comparable company data was supplied.'
      : lacksVerifiedMetrics
        ? 'Relevant companies were found, but no source-verified benchmark observations were available.'
        : `Candidates did not satisfy the business-model comparability guard${rejectionSummary ? `: ${rejectionSummary}` : ''}.`;

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
      metricSampleCounts: {},
      isBroadSectorUniverse: false,
      benchmarkRows: [],
      peerCompanyItems: [],
    };
    return emptyResult;
  }

  // Compute deterministic medians per metric with progressive relationship
  // widening. Broader references participate only when stronger tiers do not
  // Resolve target metrics from canonical resolver if not provided in options
  const targetResolvedMetrics = options?.targetMetrics || resolveFundamentalMetrics(report, targetTicker);

  // Compute deterministic medians per metric with progressive relationship
  // widening. Broader references participate only when stronger tiers do not
  // provide the normal three-observation sample.
  const allMetricKeys = new Set<string>();
  for (const p of finalPeers) {
    for (const k of Object.keys(p.metrics)) {
      allMetricKeys.add(k);
    }
  }

  const medians: Record<string, number | null> = {};
  const metricSampleCounts: Record<string, number> = {};
  for (const k of allMetricKeys) {
    const selectedValues: number[] = [];
    for (const tier of ['DIRECT_PEER', 'CLOSE_COMPARABLE', 'BROADER_SECTOR_REFERENCE'] as const) {
      const tierValues = finalPeers
        .filter(peer => peer.relationType === tier)
        .map(peer => peer.metrics[k])
        .filter(metric => {
          if (!metric || metric.status !== 'VERIFIED' || typeof metric.value !== 'number' || !Number.isFinite(metric.value)) {
            return false;
          }
          if (k === 'roic_pct') {
            // Target-peer ROIC period and definition compatibility guard
            const targetRoic = targetResolvedMetrics?.roic;
            if (targetRoic && targetRoic.status === 'CALCULATED') {
              const targetIsQuarterly = targetRoic.periodBasis === 'QUARTERLY' || targetRoic.basis?.includes('Quarterly');
              const peerIsQuarterly = metric.periodBasis === 'QUARTERLY' || (/Q[1-4]/i.test(metric.period || '') && !/TTM|annual|FY\d{4}/i.test(metric.period || ''));
              if (!targetIsQuarterly && peerIsQuarterly) {
                return false; // Standalone quarter ROIC excluded from TTM target median
              }
              if (targetIsQuarterly && !peerIsQuarterly) {
                return false;
              }
            }
          }
          if (['operating_margin_pct', 'gross_margin_pct', 'net_margin_pct'].includes(k)) {
            const targetMetric = targetResolvedMetrics ? (
              k === 'operating_margin_pct' ? targetResolvedMetrics.operatingMargin :
              k === 'gross_margin_pct' ? targetResolvedMetrics.grossMargin :
              targetResolvedMetrics.netMargin
            ) : undefined;
            if (targetMetric && typeof targetMetric.value === 'number') {
              const targetBasis = targetMetric.basis || '';
              const targetPeriod = targetMetric.period || '';
              const targetPeriodBasis = (targetMetric as any).periodBasis;
              const targetIsQuarterly = targetPeriodBasis === 'QUARTERLY'
                || ((/Q[1-4]/i.test(targetBasis) || /Q[1-4]/i.test(targetPeriod) || /quarter/i.test(targetBasis)) && !/TTM|annual|FY\d{4}/i.test(targetBasis) && !/TTM|annual|FY\d{4}/i.test(targetPeriod));
              const peerPeriod = metric.period || '';
              const peerBasis = metric.basis || '';
              const peerPeriodBasis = metric.periodBasis;
              const peerIsQuarterly = peerPeriodBasis === 'QUARTERLY'
                || ((/Q[1-4]/i.test(peerPeriod) || /quarter/i.test(peerBasis)) && !/TTM|annual|FY\d{4}/i.test(peerPeriod) && !/TTM|annual/i.test(peerBasis));
              if (targetIsQuarterly !== peerIsQuarterly) {
                return false; // Exclude period basis mismatch (e.g. Target standalone quarter vs Peer TTM/annual)
              }
            }
          }
          return true;
        })
        .map(metric => metric.value as number);
      selectedValues.push(...tierValues);
      if (selectedValues.length >= 3) break;
    }
    const isMultiple = ['pe_trailing', 'pe_forward', 'ev_ebitda', 'ev_sales', 'p_ffo_multiple', 'p_affo_multiple', 'price_to_book', 'price_to_tbv'].includes(k);
    const eligibleValues = selectedValues.filter(value => !isMultiple || value > 0);
    medians[k] = calculateDeterministicMedian(eligibleValues, isMultiple);
    metricSampleCounts[k] = eligibleValues.length;
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
    operating_margin_pct: p.metrics.operating_margin_pct?.value,
    net_margin_pct: p.metrics.net_margin_pct?.value,
    roic_pct: p.metrics.roic_pct?.status === 'VERIFIED' ? p.metrics.roic_pct?.value : null,
    ev_ebitda: p.metrics.ev_ebitda?.value,
    ev_sales: p.metrics.ev_sales?.value,
    pb_ratio: p.metrics.price_to_book?.value,
    ptbv_ratio: p.metrics.price_to_tbv?.value,
    roe_pct: p.metrics.roe_pct?.value,
    roa_pct: p.metrics.roa_pct?.value,
    net_interest_margin_pct: p.metrics.net_interest_margin_pct?.value,
    combined_ratio_pct: p.metrics.combined_ratio_pct?.value,
    p_ffo_multiple: p.metrics.p_ffo_multiple?.value,
    p_affo_multiple: p.metrics.p_affo_multiple?.value,
    occupancy_rate_pct: p.metrics.occupancy_rate_pct?.value,
    noi_growth_yoy_pct: p.metrics.noi_growth_yoy_pct?.value,
    fcf_yield_pct: p.metrics.fcf_yield_pct?.value,
    status_label_th: p.relationType === 'DIRECT_PEER' ? 'คู่แข่งตรง' : p.relationType === 'CLOSE_COMPARABLE' ? 'บริษัทเทียบเคียง' : 'บริษัทอ้างอิง',
    status_label_en: p.relationType === 'DIRECT_PEER' ? 'Direct Peer' : p.relationType === 'CLOSE_COMPARABLE' ? 'Close Comparable' : 'Broader Reference',
    relation_type: p.relationType,
    similarity_score: p.similarityScore,
    selection_rationale: p.selectionRationale,
    selection_rationale_th: p.selectionRationaleTh,
    as_of_date: p.metrics.pe_trailing?.period || report.as_of_date,
    financial_period: p.metrics.roic_pct?.period || p.metrics.operating_margin_pct?.period || report.as_of_date,
    financial_source: p.metrics.roic_pct?.source || p.metrics.operating_margin_pct?.source,
    subIndustry: p.fingerprint.subIndustry,
    lifecycle: p.fingerprint.lifecycle,
    profitabilityState: p.fingerprint.profitabilityState,
    scaleTier: p.fingerprint.scaleTier,
  }));

  // Add target row to peerCompanyItems for context
  const targetPE = targetResolvedMetrics.peTrailing.value;
  const targetFwdPE = targetResolvedMetrics.peForward.value;
  const targetRevGrowth = targetResolvedMetrics.revenueGrowthYoY.value;
  const targetGM = targetResolvedMetrics.grossMargin.value;
  const targetNM = targetResolvedMetrics.netMargin.value;

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
  const benchmarkRows = buildArchetypeBenchmarkRows(targetFingerprint.archetype, report, finalPeers, medians, metricSampleCounts, targetResolvedMetrics);

  const result: PeerDiscoveryResult = {
    targetTicker,
    targetFingerprint,
    peers: finalPeers,
    peerCount,
    isLimitedSample,
    medians,
    metricSampleCounts,
    isBroadSectorUniverse: finalPeers.some(peer => peer.relationType === 'BROADER_SECTOR_REFERENCE'),
    benchmarkRows,
    peerCompanyItems,
  };

  peerDiscoveryCache.set(cacheKey, { timestamp: Date.now(), result });
  return result;
}

/**
 * Builds business-aware benchmark rows for Five Pillars based on archetype.
 * Invariant: Direct Peer column must refer to ONE company across all rows.
 * If no DIRECT_PEER is available, the column uses the strongest truthful
 * CLOSE_COMPARABLE or INDUSTRY_REFERENCE candidate.
 */
function buildArchetypeBenchmarkRows(
  archetype: BusinessArchetype,
  report: Partial<ReportData>,
  peers: PeerCandidate[],
  medians: Record<string, number | null>,
  metricSampleCounts: Record<string, number>,
  targetMetrics?: ResolvedFundamentalMetrics
): PeerBenchmarkRow[] {
  const rows: PeerBenchmarkRow[] = [];
  const isFinancial = ['bank', 'lender', 'fintech', 'insurer'].includes(archetype);
  const isInsurer = archetype === 'insurer';
  const isReit = archetype === 'reit';
  const isEarlyStage = archetype === 'early_stage';

  const fmt = (v: number | null | undefined, unit = '') =>
    typeof v === 'number' && Number.isFinite(v) ? `${v}${unit}` : 'N/A';

  const fmtMultiple = (v: number | null | undefined, unit = 'x') => {
    if (v === null || v === undefined || !Number.isFinite(v)) return 'N/A';
    if (v <= 0) return 'N/M';
    return `${v}${unit}`;
  };
  const requiredPeerSample = 2;
  const benchmarkMedian = (key: string) => resolvePeerMetricCoverage(metricSampleCounts[key] || 0).canPublishMedian ? medians[key] : null;
  const verifiedPeerValue = (peer: PeerCandidate | undefined, key: string) =>
    peer?.metrics[key]?.status === 'VERIFIED' ? peer.metrics[key]?.value : null;

  const resolvePeerPeDisplay = (peer: PeerCandidate | undefined) => {
    const val = verifiedPeerValue(peer, 'pe_trailing');
    const obs = peer?.metrics['pe_trailing'];
    const hasNegativeEarnings = Boolean(
      peer && (
        (typeof val === 'number' && val <= 0) ||
        obs?.reason === 'NEGATIVE_EARNINGS' ||
        obs?.value === -1 ||
        peer.fingerprint.profitabilityState === 'pre_profit' ||
        (peer.metrics['net_margin_pct']?.status === 'VERIFIED' && typeof peer.metrics['net_margin_pct']?.value === 'number' && peer.metrics['net_margin_pct'].value < 0) ||
        (peer.metrics['operating_income']?.status === 'VERIFIED' && typeof peer.metrics['operating_income']?.value === 'number' && peer.metrics['operating_income'].value < 0)
      )
    );
    if (typeof val === 'number' && val > 0) {
      return { display: `${val}x`, reason: undefined, reasonTh: undefined };
    }
    if (hasNegativeEarnings) {
      return { display: 'N/M', reason: 'Negative earnings (Not Meaningful)', reasonTh: 'ผลประกอบการขาดทุนสุทธิ (Not Meaningful)' };
    }
    return { display: 'N/A', reason: obs?.reason, reasonTh: obs?.reasonTh };
  };

  // Section 27: Direct Peer must refer to one company.
  // Prefer DIRECT_PEER, or fall back to closest comparable if no DIRECT_PEER meets threshold
  const directPeer = peers.find(p => p.relationType === 'DIRECT_PEER')
    || peers.find(p => p.relationType === 'CLOSE_COMPARABLE')
    || peers.find(p => p.relationType === 'BROADER_SECTOR_REFERENCE');
  const isDirect = directPeer?.relationType === 'DIRECT_PEER';
  const isClose = directPeer?.relationType === 'CLOSE_COMPARABLE';
  const directHeaderTh = directPeer
    ? (isDirect ? `คู่แข่งตรง: ${directPeer.ticker} — ${directPeer.companyName}` : isClose ? `บริษัทเทียบเคียงที่ใกล้ที่สุด: ${directPeer.ticker} — ${directPeer.companyName}` : `บริษัทอ้างอิงอุตสาหกรรม: ${directPeer.ticker} — ${directPeer.companyName}`)
    : 'คู่แข่งตรง (Direct Peer)';
  const directHeaderEn = directPeer
    ? (isDirect ? `Direct Peer: ${directPeer.ticker} — ${directPeer.companyName}` : isClose ? `Closest Comparable: ${directPeer.ticker} — ${directPeer.companyName}` : `Industry Reference: ${directPeer.ticker} — ${directPeer.companyName}`)
    : 'Direct Peer';

  if (isInsurer) {
    const insurerRows = [
      { key: 'price_to_book', name: 'P/B Ratio', nameTh: 'ราคาต่อมูลค่าทางบัญชี', target: report.valuation_ratios?.find(r => /P\/B/i.test(r.name))?.value, unit: 'x', lowerIsBetter: true },
      { key: 'pe_trailing', name: 'P/E (Trailing)', nameTh: 'อัตราส่วนราคาต่อกำไร', target: targetMetrics?.peTrailing.value, unit: 'x', lowerIsBetter: true },
      { key: 'roe_pct', name: 'Return on Equity (ROE)', nameTh: 'ผลตอบแทนต่อส่วนผู้ถือหุ้น', target: targetMetrics?.roe.value, unit: '%', lowerIsBetter: false },
      { key: 'combined_ratio_pct', name: 'Combined Ratio', nameTh: 'อัตราส่วนรวมธุรกิจประกัน', target: (report.key_indicators as any)?.profitability?.combined_ratio_pct, unit: '%', lowerIsBetter: true },
    ];
    for (const metric of insurerRows) {
      const median = benchmarkMedian(metric.key);
      const hasComparison = typeof metric.target === 'number' && typeof median === 'number';
      const better = hasComparison && (metric.lowerIsBetter ? metric.target! < median! : metric.target! > median!);
      rows.push({
        metric_name: metric.name,
        metric_name_th: metric.nameTh,
        target_value: metric.unit === 'x' ? fmtMultiple(metric.target, metric.unit) : fmt(metric.target, metric.unit),
        sector_median: metric.unit === 'x' ? fmtMultiple(median, metric.unit) : fmt(median, metric.unit),
        direct_peer_value: metric.unit === 'x'
          ? fmtMultiple(verifiedPeerValue(directPeer, metric.key), metric.unit)
          : fmt(verifiedPeerValue(directPeer, metric.key), metric.unit),
        status: hasComparison ? (better ? 'better' : metric.lowerIsBetter ? 'premium' : 'worse') : 'neutral',
        status_label_th: hasComparison ? (better ? 'ดีกว่าค่ากลาง' : 'ด้อยกว่าค่ากลาง') : 'ข้อมูลเทียบเคียงไม่เพียงพอ',
        direct_peer_ticker: directPeer?.ticker,
        direct_peer_name: directPeer?.companyName,
        direct_peer_relation: directPeer?.relationType,
        direct_peer_header_th: directHeaderTh,
        direct_peer_header_en: directHeaderEn,
      });
    }
  } else if (isFinancial) {
    // Financial Benchmark Rows: P/E, P/B, ROE, NIM
    const peMed = benchmarkMedian('pe_trailing');
    const targetPE = targetMetrics?.peTrailing.value ?? report.valuation_ratios?.find(r => /P\/E/.test(r.name) && !/forward/i.test(r.name))?.value;
    const directPE = resolvePeerPeDisplay(directPeer);
    rows.push({
      metric_name: 'P/E (Trailing)',
      metric_name_th: 'อัตราส่วนราคาต่อกำไร',
      target_value: fmtMultiple(targetPE, 'x'),
      sector_median: fmtMultiple(peMed, 'x'),
      direct_peer_value: directPE.display,
      status: targetPE && peMed && targetPE > 0 && peMed > 0 ? (targetPE < peMed ? 'better' : 'premium') : 'neutral',
      status_label_th: targetPE && peMed && targetPE > 0 && peMed > 0 ? (targetPE < peMed ? 'ต่ำกว่าค่ากลาง' : 'พรีเมียมกว่าค่ากลาง') : 'เทียบเท่า',
      direct_peer_ticker: directPeer?.ticker,
      direct_peer_name: directPeer?.companyName,
      direct_peer_relation: directPeer?.relationType,
      direct_peer_header_th: directHeaderTh,
      direct_peer_header_en: directHeaderEn,
      direct_peer_reason: directPE.reason,
      direct_peer_reason_th: directPE.reasonTh,
    });

    const pbMed = benchmarkMedian('price_to_book');
    const targetPB = report.valuation_ratios?.find(r => /P\/B/i.test(r.name))?.value;
    rows.push({
      metric_name: 'P/B Ratio',
      metric_name_th: 'ราคาต่อมูลค่าทางบัญชี',
      target_value: fmt(targetPB, 'x'),
      sector_median: fmt(pbMed, 'x'),
      direct_peer_value: fmt(verifiedPeerValue(directPeer, 'price_to_book'), 'x'),
      status: targetPB && pbMed ? (targetPB < pbMed ? 'better' : 'premium') : 'neutral',
      status_label_th: targetPB && pbMed ? (targetPB < pbMed ? 'ต่ำกว่าค่ากลาง' : 'พรีเมียมกว่าค่ากลาง') : 'เทียบเท่า',
      direct_peer_ticker: directPeer?.ticker,
      direct_peer_name: directPeer?.companyName,
      direct_peer_relation: directPeer?.relationType,
      direct_peer_header_th: directHeaderTh,
      direct_peer_header_en: directHeaderEn,
    });

    const roeMed = benchmarkMedian('roe_pct');
    const targetROE = targetMetrics?.roe.value ?? (report.key_indicators as any)?.profitability?.roe_pct ?? (report.financial_statements?.key_indicators as any)?.roe_pct;
    rows.push({
      metric_name: 'Return on Equity (ROE)',
      metric_name_th: 'ผลตอบแทนต่อส่วนผู้ถือหุ้น',
      target_value: fmt(targetROE, '%'),
      sector_median: fmt(roeMed, '%'),
      direct_peer_value: fmt(verifiedPeerValue(directPeer, 'roe_pct'), '%'),
      status: targetROE && roeMed ? (targetROE > roeMed ? 'better' : 'worse') : 'neutral',
      status_label_th: targetROE && roeMed ? (targetROE > roeMed ? 'สูงกว่าค่ากลาง' : 'ต่ำกว่าค่ากลาง') : 'เทียบเท่า',
      direct_peer_ticker: directPeer?.ticker,
      direct_peer_name: directPeer?.companyName,
      direct_peer_relation: directPeer?.relationType,
      direct_peer_header_th: directHeaderTh,
      direct_peer_header_en: directHeaderEn,
    });

    const nimMed = benchmarkMedian('net_interest_margin_pct');
    const kiNim = (report.key_indicators as any)?.profitability?.net_interest_margin_pct;
    rows.push({
      metric_name: 'Net Interest Margin (NIM)',
      metric_name_th: 'อัตราส่วนต่างดอกเบี้ยสุทธิ',
      target_value: fmt(kiNim, '%'),
      sector_median: fmt(nimMed, '%'),
      direct_peer_value: fmt(verifiedPeerValue(directPeer, 'net_interest_margin_pct'), '%'),
      status: kiNim && nimMed ? (kiNim > nimMed ? 'better' : 'worse') : 'neutral',
      status_label_th: kiNim && nimMed ? (kiNim > nimMed ? 'สูงกว่าค่ากลาง' : 'ต่ำกว่าค่ากลาง') : 'เทียบเท่า',
      direct_peer_ticker: directPeer?.ticker,
      direct_peer_name: directPeer?.companyName,
      direct_peer_relation: directPeer?.relationType,
      direct_peer_header_th: directHeaderTh,
      direct_peer_header_en: directHeaderEn,
    });
  } else if (isReit) {
    // REIT Benchmark Rows: P/FFO, Occupancy Rate
    const pffoMed = benchmarkMedian('p_ffo_multiple');
    rows.push({
      metric_name: 'Price / FFO',
      metric_name_th: 'ราคาต่อกระแสเงินสดจากดำเนินงาน (P/FFO)',
      target_value: fmt(pffoMed, 'x'),
      sector_median: fmt(pffoMed, 'x'),
      direct_peer_value: fmt(verifiedPeerValue(directPeer, 'p_ffo_multiple'), 'x'),
      status: 'neutral',
      status_label_th: 'เทียบเท่า',
      direct_peer_ticker: directPeer?.ticker,
      direct_peer_name: directPeer?.companyName,
      direct_peer_relation: directPeer?.relationType,
      direct_peer_header_th: directHeaderTh,
      direct_peer_header_en: directHeaderEn,
    });

    const occMed = benchmarkMedian('occupancy_rate_pct');
    rows.push({
      metric_name: 'Occupancy Rate',
      metric_name_th: 'อัตราการเช่าพื้นที่',
      target_value: fmt(occMed, '%'),
      sector_median: fmt(occMed, '%'),
      direct_peer_value: fmt(verifiedPeerValue(directPeer, 'occupancy_rate_pct'), '%'),
      status: 'better',
      status_label_th: 'อัตราเช่าสูง',
      direct_peer_ticker: directPeer?.ticker,
      direct_peer_name: directPeer?.companyName,
      direct_peer_relation: directPeer?.relationType,
      direct_peer_header_th: directHeaderTh,
      direct_peer_header_en: directHeaderEn,
    });
  } else if (isEarlyStage) {
    // Early Stage Benchmark Rows: EV/Sales, Revenue Growth
    const evsMed = benchmarkMedian('ev_sales');
    rows.push({
      metric_name: 'EV / Sales Multiple',
      metric_name_th: 'มูลค่ากิจการต่อรายได้',
      target_value: fmt(evsMed, 'x'),
      sector_median: fmt(evsMed, 'x'),
      direct_peer_value: fmt(verifiedPeerValue(directPeer, 'ev_sales'), 'x'),
      status: 'neutral',
      status_label_th: 'เทียบเท่า',
      direct_peer_ticker: directPeer?.ticker,
      direct_peer_name: directPeer?.companyName,
      direct_peer_relation: directPeer?.relationType,
      direct_peer_header_th: directHeaderTh,
      direct_peer_header_en: directHeaderEn,
    });

    const revgMed = benchmarkMedian('revenue_growth_yoy_pct');
    const targetRevGrowth = targetMetrics?.revenueGrowthYoY.value ?? report.financial_statements?.income_statement?.yoy_revenue_growth_pct?.[
      (report.financial_statements?.income_statement?.yoy_revenue_growth_pct?.length || 0) - 1
    ];
    rows.push({
      metric_name: 'YoY Revenue Growth',
      metric_name_th: 'การเติบโตรายได้ YoY',
      target_value: fmt(targetRevGrowth ?? revgMed, '%'),
      sector_median: fmt(revgMed, '%'),
      direct_peer_value: fmt(verifiedPeerValue(directPeer, 'revenue_growth_yoy_pct'), '%'),
      status: 'better',
      status_label_th: 'เติบโตสูง',
      direct_peer_ticker: directPeer?.ticker,
      direct_peer_name: directPeer?.companyName,
      direct_peer_relation: directPeer?.relationType,
      direct_peer_header_th: directHeaderTh,
      direct_peer_header_en: directHeaderEn,
    });
  } else {
    // Standard Operating & Industrial/Manufacturing Benchmark Rows: P/E, EV/EBITDA, Revenue Growth, ROIC
    const peMed = benchmarkMedian('pe_trailing');
    const targetPE = targetMetrics?.peTrailing.value ?? report.valuation_ratios?.find(r => /P\/E/.test(r.name) && !/forward/i.test(r.name))?.value;
    const directPE = resolvePeerPeDisplay(directPeer);
    rows.push({
      metric_name: 'P/E (Trailing)',
      metric_name_th: 'อัตราส่วนราคาต่อกำไร',
      target_value: fmtMultiple(targetPE, 'x'),
      sector_median: fmtMultiple(peMed, 'x'),
      direct_peer_value: directPE.display,
      status: targetPE && peMed && targetPE > 0 && peMed > 0 ? (targetPE < peMed ? 'better' : 'premium') : 'neutral',
      status_label_th: targetPE && peMed && targetPE > 0 && peMed > 0 ? (targetPE < peMed ? 'ต่ำกว่าค่ากลาง' : 'พรีเมียมกว่าค่ากลาง') : 'เทียบเท่า',
      direct_peer_ticker: directPeer?.ticker,
      direct_peer_name: directPeer?.companyName,
      direct_peer_relation: directPeer?.relationType,
      direct_peer_header_th: directHeaderTh,
      direct_peer_header_en: directHeaderEn,
      direct_peer_reason: directPE.reason,
      direct_peer_reason_th: directPE.reasonTh,
    });

    const eveMed = benchmarkMedian('ev_ebitda');
    const targetEVE = report.valuation_ratios?.find(r => /EV\/EBITDA/i.test(r.name))?.value;
    rows.push({
      metric_name: 'EV / EBITDA',
      metric_name_th: 'มูลค่ากิจการต่อกำไรก่อนดอกเบี้ยภาษี',
      target_value: fmtMultiple(targetEVE, 'x'),
      sector_median: fmtMultiple(eveMed, 'x'),
      direct_peer_value: fmtMultiple(verifiedPeerValue(directPeer, 'ev_ebitda'), 'x'),
      status: targetEVE && eveMed && targetEVE > 0 && eveMed > 0 ? (targetEVE < eveMed ? 'better' : 'premium') : 'neutral',
      status_label_th: targetEVE && eveMed && targetEVE > 0 && eveMed > 0 ? (targetEVE < eveMed ? 'ต่ำกว่าค่ากลาง' : 'พรีเมียมกว่าค่ากลาง') : 'เทียบเท่า',
      direct_peer_ticker: directPeer?.ticker,
      direct_peer_name: directPeer?.companyName,
      direct_peer_relation: directPeer?.relationType,
      direct_peer_header_th: directHeaderTh,
      direct_peer_header_en: directHeaderEn,
    });

    const revgMed = benchmarkMedian('revenue_growth_yoy_pct');
    const targetRevGrowth = targetMetrics?.revenueGrowthYoY.value ?? report.financial_statements?.income_statement?.yoy_revenue_growth_pct?.[
      (report.financial_statements?.income_statement?.yoy_revenue_growth_pct?.length || 0) - 1
    ];
    rows.push({
      metric_name: 'Revenue Growth YoY',
      metric_name_th: 'การเติบโตรายได้ YoY',
      target_value: fmt(targetRevGrowth, '%'),
      sector_median: fmt(revgMed, '%'),
      direct_peer_value: fmt(verifiedPeerValue(directPeer, 'revenue_growth_yoy_pct'), '%'),
      status: targetRevGrowth && revgMed ? (targetRevGrowth > revgMed ? 'better' : 'worse') : 'neutral',
      status_label_th: targetRevGrowth && revgMed ? (targetRevGrowth > revgMed ? 'เติบโตสูงกว่า' : 'เติบโตต่ำกว่า') : 'เทียบเท่า',
      direct_peer_ticker: directPeer?.ticker,
      direct_peer_name: directPeer?.companyName,
      direct_peer_relation: directPeer?.relationType,
      direct_peer_header_th: directHeaderTh,
      direct_peer_header_en: directHeaderEn,
    });

    const targetROIC = targetMetrics?.roic.value ?? (report.key_indicators as any)?.profitability?.roic_pct;
    const profitabilityOptions = [
      { key: 'roic_pct', name: 'ROIC', nameTh: 'ผลตอบแทนเงินลงทุน', target: targetROIC, unit: '%', basis: targetMetrics?.roic.basis },
      { key: 'operating_margin_pct', name: 'Operating Margin', nameTh: 'อัตรากำไรจากการดำเนินงาน', target: targetMetrics?.operatingMargin.value, unit: '%', basis: targetMetrics?.operatingMargin.basis },
      { key: 'net_margin_pct', name: 'Net Margin', nameTh: 'อัตรากำไรสุทธิ', target: targetMetrics?.netMargin.value, unit: '%', basis: targetMetrics?.netMargin.basis },
      { key: 'roe_pct', name: 'Return on Equity (ROE)', nameTh: 'ผลตอบแทนต่อส่วนผู้ถือหุ้น', target: targetMetrics?.roe.value, unit: '%', basis: targetMetrics?.roe.basis },
    ];
    const selectedProfitability = profitabilityOptions.find(option => typeof option.target === 'number' && (metricSampleCounts[option.key] || 0) >= requiredPeerSample)
      || profitabilityOptions[0];
    const directPeerProfitMetric = directPeer?.metrics[selectedProfitability.key];
    const directPeerProfitVal = verifiedPeerValue(directPeer, selectedProfitability.key);
    const profitabilityMedian = benchmarkMedian(selectedProfitability.key);
    rows.push({
      metric_name: selectedProfitability.name,
      metric_name_th: selectedProfitability.nameTh,
      target_value: fmt(selectedProfitability.target, selectedProfitability.unit),
      sector_median: profitabilityMedian === null ? 'Insufficient Comparable Peer Data' : fmt(profitabilityMedian, selectedProfitability.unit),
      direct_peer_value: fmt(directPeerProfitVal, selectedProfitability.unit),
      status: selectedProfitability.target && profitabilityMedian ? (selectedProfitability.target > profitabilityMedian ? 'better' : 'worse') : 'neutral',
      status_label_th: selectedProfitability.target && profitabilityMedian ? (selectedProfitability.target > profitabilityMedian ? 'สูงกว่าค่ากลาง' : 'ต่ำกว่าค่ากลาง') : 'ข้อมูลเทียบเคียงไม่เพียงพอ',
      direct_peer_ticker: directPeer?.ticker,
      direct_peer_name: directPeer?.companyName,
      direct_peer_relation: directPeer?.relationType,
      direct_peer_header_th: directHeaderTh,
      direct_peer_header_en: directHeaderEn,
      metric_basis: selectedProfitability.basis,
      direct_peer_reason: directPeerProfitVal === null ? (directPeerProfitMetric?.reason || 'Filing data not available for ROIC derivation') : undefined,
      direct_peer_reason_th: directPeerProfitVal === null ? (directPeerProfitMetric?.reasonTh || 'ไม่มีข้อมูลงบการเงินที่ตรวจสอบแล้วสำหรับคำนวณ ROIC') : undefined,
    });
  }

  const metricKeyByName: Record<string, string> = {
    'P/E (Trailing)': 'pe_trailing', 'P/B Ratio': 'price_to_book', 'Price to Tangible Book (P/TBV)': 'price_to_tbv', 'Return on Equity (ROE)': 'roe_pct',
    'Net Interest Margin (NIM)': 'net_interest_margin_pct', 'Efficiency Ratio': 'efficiency_ratio_pct', 'Combined Ratio': 'combined_ratio_pct', 'Underwriting Margin': 'underwriting_margin_pct',
    'Price / FFO': 'p_ffo_multiple', 'Occupancy Rate': 'occupancy_rate_pct', 'EV / Sales Multiple': 'ev_sales', 'YoY Revenue Growth': 'revenue_growth_yoy_pct',
    'EV / EBITDA': 'ev_ebitda', 'Revenue Growth YoY': 'revenue_growth_yoy_pct', ROIC: 'roic_pct',
    'Operating Margin': 'operating_margin_pct', 'Net Margin': 'net_margin_pct', 'Gross Margin': 'gross_margin_pct', 'Free Cash Flow Margin': 'fcf_margin_pct',
  };
  return rows.map(row => {
    const key = metricKeyByName[row.metric_name];
    if (!key) return row;
    const count = metricSampleCounts[key] || 0;
    const coverage = resolvePeerMetricCoverage(count);
    const directMetric = directPeer?.metrics[key];
    return {
      ...row,
      metric_key: key,
      median_value: coverage.canPublishMedian ? (medians[key] ?? null) : null,
      sector_median: coverage.canPublishMedian ? row.sector_median : 'Insufficient Comparable Peer Data',
      peer_sample_size: count,
      peer_required_sample_size: requiredPeerSample,
      peer_coverage_status: coverage.status,
      peer_coverage_reason: coverage.status === 'SUFFICIENT'
        ? undefined
        : coverage.status === 'LIMITED'
          ? `Limited benchmark: ${count} verified comparable observations.`
          : `Comparable observations ${count}/${peers.length}; minimum required ${requiredPeerSample}.`,
      status: coverage.canPublishMedian ? row.status : 'neutral',
      status_label_th: coverage.canPublishMedian
        ? (coverage.status === 'LIMITED' && row.status_label_th && !row.status_label_th.includes('ตัวอย่างจำกัด') && row.status_label_th !== 'เทียบเท่า' && row.status_label_th !== 'ข้อมูลเทียบเคียงไม่เพียงพอ'
            ? `${row.status_label_th} (ตัวอย่างจำกัด)`
            : row.status_label_th)
        : 'ข้อมูลเทียบเคียงไม่เพียงพอ',
      direct_peer_status: directMetric?.status,
      direct_peer_basis: directMetric?.basis,
      direct_peer_period: directMetric?.period,
    };
  });
}
