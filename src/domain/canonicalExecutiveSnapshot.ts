import type { ReportData, ConvictionBreakdown } from '../types';
import { resolveBusinessArchetype, type BusinessArchetype } from './financialMetricContext';
import { resolveFundamentalMetrics, type ResolvedFundamentalMetrics } from './valuation/metricRegistry';
import { resolveAdaptiveFivePillars } from './valuation/fivePillarsResolver';
import { detectValuationModel } from '../utils/valuation/modelSelector';
import { resolveCurrentBalanceSheetSnapshot, type CurrentBalanceSheetSnapshot } from './currentBalanceSheetSnapshot';
import { resolveReportTtmFlow } from './canonicalTtmFlow';
import { reconcileCashTerminology } from './cashTerminology';
import { resolveValuationPriceMetrics } from './valuation/valuationPriceMetrics';

export type NumericClaimFactStatus =
  | 'SEC_VERIFIED'
  | 'ISSUER_VERIFIED'
  | 'PROVIDER_REPORTED'
  | 'CANONICAL_DERIVED'
  | 'FOUND_UNVERIFIED'
  | 'UNAVAILABLE'
  | 'NOT_APPLICABLE';

export interface NumericClaimFact {
  metricKey: string;
  value: number | null;
  formattedValue: string;
  unit: string;
  basis: string;
  period: string;
  source: string;
  asOf?: string;
  status: NumericClaimFactStatus;
}

export interface SotpComponent {
  name: string;
  value: number;
  methodology?: string;
  source?: string;
  assumptions?: string;
}

export interface SotpModel {
  components: SotpComponent[];
  corporateAdjustments?: number;
  netDebtOrCash?: number;
  equityValue?: number;
  dilutedShares?: number;
  valuePerShare?: number;
}

export interface StructuredTechnicalPlan {
  hasStructuredPlan: boolean;
  strategy: string;
  strategyTh: string;
  entryZone: string;
  stopLoss: string;
  target1: string;
  target2?: string;
  riskRewardRatio?: string;
  timeframe?: string;
  marketPriceAsOf?: string;
  analysisAsOf?: string;
  supportResistanceBasis?: string;
  strategySource: 'TECHNICAL_STRATEGY' | 'CANONICAL_RECOMMENDATION_ENGINE' | 'AI_INTERPRETATION';
}

export interface StructuredQualitativeEvidence {
  hasVerifiedMarketLeadership: boolean;
  marketPositionEvidence?: string;
  competitiveMoatEvidence?: string;
  leadershipSources?: string[];
}

export interface CanonicalValuationResult {
  modelType: string;
  valuationRunId?: string;
  financialSnapshotId?: string;
  inputHash?: string;
  assumptionHash?: string;
  modelVersion?: string;
  eligibility?: string;
  modelName: string;
  modelNameTh: string;
  baseFairValue: number | null;
  bearFairValue?: number | null;
  bullFairValue?: number | null;
  currentPrice: number | null;
  marginOfSafetyPct: number | null;
  premiumToFairValuePct: number | null;
  asOf?: string;
  valuationAsOf?: string;
  assumptionSetId?: string;
  assumptions?: Record<string, any>;
  provenance: string;
  canonicalLabelEn?: string;
  canonicalLabelTh?: string;
  structuredValuationSummaryEn?: string;
  structuredValuationSummaryTh?: string;
}

export type RecommendationTargetType =
  | 'VALUATION_BASE_CASE'
  | 'TECHNICAL_TARGET'
  | 'CONSENSUS_TARGET'
  | 'NONE';

export interface RecommendationSnapshot {
  stance: string;
  targetValue: number | null;
  targetType: RecommendationTargetType;
  source: 'CANONICAL_VALUATION' | 'TECHNICAL_ANALYSIS' | 'ANALYST_CONSENSUS' | 'AI_INTERPRETATION' | 'NONE';
  basis: string;
  asOf?: string;
}

export interface FinalSection1Snapshot {
  reportAsOf?: string;
  marketAsOf?: string;
  currentPrice: number | null;
  fairValue: number | null;
  valuationModel: {
    modelType: string;
    modelName: string;
    modelNameTh: string;
    asOf?: string;
    valuationAsOf?: string;
    assumptionSetId?: string;
  };
  canonicalValuation?: CanonicalValuationResult;
  recommendation?: RecommendationSnapshot;
  convictionScore: number | null;
  growthFacts: Record<string, NumericClaimFact>;
  profitabilityFacts: Record<string, NumericClaimFact>;
  cashFlowFacts: Record<string, NumericClaimFact>;
  balanceSheetFacts: Record<string, NumericClaimFact>;
  marketMultiples: Record<string, NumericClaimFact>;
  technicalPlan?: StructuredTechnicalPlan | null;
  facts: Record<string, NumericClaimFact>;
  evidence?: StructuredQualitativeEvidence;
}

export interface CanonicalExecutiveSnapshot {
  reportAsOf?: string;
  marketAsOf?: string;
  identity: {
    ticker: string;
    companyName?: string;
    sector?: string;
    archetype: BusinessArchetype;
  };
  market: {
    currentPrice?: number | null;
    marketCap?: string | number | null;
    peTrailing?: number | null;
    peForward?: number | null;
    evEbitda?: number | null;
    asOf?: string;
    provider?: string;
    status: NumericClaimFactStatus;
  };
  growth: {
    revenueTtm?: number | null;
    revenueLatestQuarter?: number | null;
    revenueGrowthYoY?: number | null;
    revenueGrowthPeriod?: string;
    revenueGrowthBasis?: string;
    epsGrowthYoY?: number | null;
    status: NumericClaimFactStatus;
  };
  profitability: {
    grossMargin?: number | null;
    operatingMargin?: number | null;
    netMargin?: number | null;
    roic?: number | null;
    roe?: number | null;
    period?: string;
    status: NumericClaimFactStatus;
  };
  cashFlow: {
    fcfLatest?: number | null;
    fcfMargin?: number | null;
    fcfTtm?: number | null;
    period?: string;
    status: NumericClaimFactStatus;
  };
  balanceSheet: {
    totalCashAndInvestments?: number | null;
    totalDebt?: number | null;
    netCashOrDebt?: number | null;
    isNetCash?: boolean;
    debtToEquity?: number | null;
    currentRatio?: number | null;
    netDebtToEbitda?: number | null;
    netDebtToEbitdaStatus?: ResolvedFundamentalMetrics['netDebtToEbitda']['status'];
    period?: string;
    status: NumericClaimFactStatus;
  };
  currentBalanceSheetSnapshot?: CurrentBalanceSheetSnapshot;
  valuation: {
    modelType: string;
    modelName: string;
    modelNameTh: string;
    fairValue?: number | null;
    currentPrice?: number | null;
    marginOfSafetyPct?: number | null;
    premiumToFairValuePct?: number | null;
    sotpModel?: SotpModel;
    valuationAsOf?: string;
    assumptionSetId?: string;
    status: NumericClaimFactStatus;
  };
  conviction: {
    score?: number | null;
    scoreVersion?: string;
    inputsAsOf?: string;
    breakdown?: ConvictionBreakdown;
  };
  growthFacts: Record<string, NumericClaimFact>;
  profitabilityFacts: Record<string, NumericClaimFact>;
  cashFlowFacts: Record<string, NumericClaimFact>;
  balanceSheetFacts: Record<string, NumericClaimFact>;
  marketMultiples: Record<string, NumericClaimFact>;
  technicalPlan?: StructuredTechnicalPlan | null;
  evidence?: StructuredQualitativeEvidence;
  canonicalValuation?: CanonicalValuationResult;
  recommendation?: RecommendationSnapshot;
  facts: Record<string, NumericClaimFact>;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const rounded = (v: number) => Math.sign(v) * Math.round((Math.abs(v) + Number.EPSILON) * 100) / 100;

/** Reject stale current-period liquidity claims before either Section 1 text surface renders. */
export function reconcileCurrentBalanceSheetNarrative(
  text: string,
  snapshot: CanonicalExecutiveSnapshot,
  isThai = true,
): string {
  const current = snapshot.currentBalanceSheetSnapshot;
  if (!text || !current) return text;
  const combined = current.cashPlusShortTermInvestments;
  const claim = /((?:cash\s*(?:and|\+|&)\s*(?:(?:cash\s*)?equivalents\s*(?:and|\+|&)\s*)?short[ -]term\s+investments|cash\s*\+\s*(?:short[ -]term\s+)?investments|เงินสด(?:และรายการเทียบเท่าเงินสด)?(?:และ|รวม|\s*\+\s*)เงินลงทุนระยะสั้น)[^;\n]{0,50}?)(\$?\s*\d[\d,]*(?:\.\d+)?)\s*(billion|million|bn|B|M|พันล้าน|ล้าน)/gi;
  let result = reconcileCashTerminology(text, current).replace(claim, (full, prefix: string, amount: string, unit: string) => {
    const stated = Number(amount.replace(/[$,\s]/g, '')) * (/^(?:billion|bn|b|พันล้าน)$/i.test(unit) ? 1000 : 1);
    if (combined !== null && Math.abs(stated - combined) <= Math.max(1, combined * 0.005)) return full;
    if ((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV) {
      console.warn('STALE_BALANCE_SHEET_VALUE_REJECTED', { period: current.period, periodEnd: current.periodEnd, stated, canonical: combined });
    }
    if (combined === null) return isThai
      ? 'เงินสดรวมเงินลงทุนระยะสั้นของงวดปัจจุบันยังยืนยันไม่ได้'
      : 'Current-period cash plus short-term investments are unavailable';
    const figure = /^(?:billion|bn|b|พันล้าน)$/i.test(unit)
      ? (combined / 1000).toLocaleString('en-US', { maximumFractionDigits: 2 })
      : combined.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return `${prefix}${isThai ? '' : '$'}${figure} ${unit}`;
  });
  const debtClaim = /((?:long[ -]term debt|total debt|หนี้สินระยะยาว|หนี้สินทางการเงินรวม)[^;\n]{0,35}?)(\$?\s*\d[\d,]*(?:\.\d+)?)\s*(billion|million|bn|B|M|พันล้าน|ล้าน)/gi;
  result = result.replace(debtClaim, (full, prefix: string, amount: string, unit: string) => {
    const isLongTerm = /long[ -]term|ระยะยาว/i.test(prefix);
    const canonical = isLongTerm ? current.longTermDebt : current.totalDebt;
    const stated = Number(amount.replace(/[$,\s]/g, '')) * (/^(?:billion|bn|b|พันล้าน)$/i.test(unit) ? 1000 : 1);
    if (canonical !== null && Math.abs(stated - canonical) <= Math.max(1, canonical * 0.005)) return full;
    if ((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV) {
      console.warn('STALE_BALANCE_SHEET_VALUE_REJECTED', { field: isLongTerm ? 'long_term_debt' : 'total_debt', periodEnd: current.periodEnd, stated, canonical });
    }
    if (canonical === null) return isThai ? 'หนี้สินงวดปัจจุบันยังยืนยันไม่ได้' : 'Current-period debt is unavailable';
    const figure = /^(?:billion|bn|b|พันล้าน)$/i.test(unit)
      ? (canonical / 1000).toLocaleString('en-US', { maximumFractionDigits: 2 })
      : canonical.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return `${prefix}${isThai ? '' : '$'}${figure} ${unit}`;
  });
  return result;
}

/**
 * Validates a structured SOTP model.
 * A Sum-of-the-Parts valuation number must NOT appear in Section 1 unless:
 * 1. a structured SOTP model exists
 * 2. component values are present and positive
 * 3. the total reconciles mathematically
 */
export function validateStructuredSotpModel(sotp?: SotpModel | null): { isValid: boolean; valuePerShare?: number; reason?: string } {
  if (!sotp || !Array.isArray(sotp.components) || sotp.components.length === 0) {
    return { isValid: false, reason: 'No structured SOTP components found' };
  }

  const sumComponents = sotp.components.reduce(
    (acc, c) => acc + (typeof c.value === 'number' && Number.isFinite(c.value) ? c.value : 0),
    0
  );
  if (sumComponents <= 0) {
    return { isValid: false, reason: 'Component values sum to non-positive' };
  }

  const equityValue = sotp.equityValue ?? (sumComponents + (sotp.corporateAdjustments ?? 0) + (sotp.netDebtOrCash ?? 0));
  const shares = sotp.dilutedShares;

  if (typeof shares === 'number' && shares > 0 && typeof sotp.valuePerShare === 'number' && sotp.valuePerShare > 0) {
    const calculatedPerShare = equityValue / shares;
    const discrepancy = Math.abs(calculatedPerShare - sotp.valuePerShare) / sotp.valuePerShare;
    if (discrepancy > 0.05) {
      return { isValid: false, reason: 'Mathematical reconciliation mismatch between equity value and valuePerShare' };
    }
  }

  const finalPerShare = typeof sotp.valuePerShare === 'number' && sotp.valuePerShare > 0
    ? sotp.valuePerShare
    : typeof shares === 'number' && shares > 0
      ? rounded(equityValue / shares)
      : undefined;

  if (!finite(finalPerShare)) {
    return { isValid: false, reason: 'Cannot determine valuePerShare from SOTP model' };
  }

  return { isValid: true, valuePerShare: finalPerShare };
}

/**
 * Extracts a normalized, structured technical trade plan if present in TechnicalAnalysis.
 * Section 6-9: Technical Takeaways must come strictly from the final structured Technical Analysis result.
 */
export function extractStructuredTechnicalPlan(
  report: Partial<ReportData>,
  marketPriceAsOf?: string
): StructuredTechnicalPlan | null {
  const ta = report.technical_analysis;
  if (!ta) return null;

  const tradePlan = ta.trade_plan;
  const signalSummary = ta.signal_summary;
  const statusRaw = signalSummary?.status || '';

  const entryRaw = tradePlan?.entry_zone?.trim() || '';
  const stopRaw = tradePlan?.stop_loss?.trim() || '';
  const target1Raw = tradePlan?.target_1?.trim() || '';
  const target2Raw = tradePlan?.target_2?.trim() || '';
  const rrRaw = tradePlan?.risk_reward_ratio?.trim() || '';

  const hasNumbers = /[0-9]+/.test(entryRaw) && /[0-9]+/.test(stopRaw);
  if (!hasNumbers) {
    return {
      hasStructuredPlan: false,
      strategy: 'Neutral',
      strategyTh: 'เป็นกลาง / รอดูความชัดเจน',
      entryZone: '',
      stopLoss: '',
      target1: '',
      target2: '',
      riskRewardRatio: '',
      timeframe: 'Daily / 4H',
      marketPriceAsOf,
      analysisAsOf: report.report_provenance?.generated_at || (report as any).report_date,
      strategySource: 'AI_INTERPRETATION',
    };
  }

  let strategy = 'Neutral';
  let strategyTh = 'เป็นกลาง';
  const upperStatus = statusRaw.toUpperCase();
  if (upperStatus.includes('DIP') || upperStatus.includes('PULLBACK')) {
    strategy = 'Buy on Dip';
    strategyTh = 'ซื้อเมื่อย่อตัว (Buy on Dip)';
  } else if (upperStatus.includes('BREAKOUT')) {
    strategy = 'Breakout';
    strategyTh = 'ซื้อเมื่อทะลุผ่าน (Breakout)';
  } else if (upperStatus.includes('ACCUMULATE') || upperStatus.includes('BULLISH')) {
    strategy = 'Accumulate';
    strategyTh = 'ทยอยสะสม (Accumulate)';
  } else if (upperStatus.includes('AVOID') || upperStatus.includes('BEARISH')) {
    strategy = 'Avoid';
    strategyTh = 'หลีกเลี่ยง / ชะลอการลงทุน';
  } else if (upperStatus.includes('HOLD') || upperStatus.includes('WAIT')) {
    strategy = 'Wait';
    strategyTh = 'รอความชัดเจน';
  }

  const cleanNum = (s: string) => s.replace(/\$/g, '').trim();

  return {
    hasStructuredPlan: true,
    strategy,
    strategyTh,
    entryZone: cleanNum(entryRaw),
    stopLoss: cleanNum(stopRaw),
    target1: cleanNum(target1Raw),
    target2: target2Raw ? cleanNum(target2Raw) : undefined,
    riskRewardRatio: rrRaw || undefined,
    timeframe: ta.signal_summary?.trend_daily ? 'Daily' : 'Swing / Daily',
    marketPriceAsOf,
    analysisAsOf: report.report_provenance?.generated_at || (report as any).report_date,
    supportResistanceBasis: ta.key_levels?.support?.length ? `Support: ${ta.key_levels.support.join(', ')}` : undefined,
    strategySource: 'TECHNICAL_STRATEGY',
  };
}

/**
 * Extracts structured qualitative evidence for leadership/superlative claims.
 * Section 3-5: Ranking/superlative claims (global leader, market leader, best-in-class)
 * require explicit verified market share, rank #1, or SEC/issuer disclosure.
 */
export function extractStructuredQualitativeEvidence(
  report: Partial<ReportData>
): StructuredQualitativeEvidence {
  const profile = report.company_profile as any;
  const peer = report.peer_comparison as any;
  const sec = report.sec_verification as any;
  const findings = report.findings as any[];
  const rawEv = (report as any).evidence;

  let hasVerifiedMarketLeadership = false;
  let marketPositionEvidence: string | undefined;

  // 1. Explicit verified leadership flag
  if (rawEv?.hasVerifiedMarketLeadership === true || sec?.verifiedLeadership === true) {
    hasVerifiedMarketLeadership = true;
    marketPositionEvidence = rawEv?.marketPositionEvidence || 'Verified market leadership disclosure';
  }

  // 2. Peer comparison verified rank
  if (peer?.market_position_rank === 1 || peer?.market_leader === true) {
    hasVerifiedMarketLeadership = true;
    marketPositionEvidence = peer?.market_share_disclosure || `Rank #1 market share in ${peer?.industry_name || 'industry'}`;
  }

  // 3. Company profile verified market share
  if (profile?.market_position === 'LEADER' || (typeof profile?.market_share_pct === 'number' && profile.market_share_pct >= 35)) {
    hasVerifiedMarketLeadership = true;
    marketPositionEvidence = `Documented market share of ${profile.market_share_pct}% in sector`;
  }

  // 4. Structured findings with market_position category verified
  if (Array.isArray(findings)) {
    const leaderFinding = findings.find(f =>
      (f.category === 'market_position' || f.category === 'competitive_advantage') &&
      f.verified === true &&
      /(?:market\s+share\s+leader|rank\s+#?1|เบอร์\s*1|ผู้นำตลาดอันดับ\s*1)/i.test(f.description || '')
    );
    if (leaderFinding) {
      hasVerifiedMarketLeadership = true;
      marketPositionEvidence = leaderFinding.description;
    }
  }

  return {
    hasVerifiedMarketLeadership,
    marketPositionEvidence,
  };
}

/**
 * Resolves a structured recommendation snapshot (Section 5 & 6).
 * Narrative may only mention a price target when this structure exists.
 */
export function resolveRecommendationSnapshot(
  report: Partial<ReportData>,
  canonicalFv: number | null,
  technicalPlan?: StructuredTechnicalPlan | null,
  marketPrice?: number | null
): RecommendationSnapshot {
  let stance = 'NEUTRAL';
  const taStatus = report.technical_analysis?.signal_summary?.status || '';
  const verdictSummary = report.verdict?.summary || '';
  const asOf = report.report_provenance?.generated_at || (report as any).report_date;

  const upperSummary = verdictSummary.toUpperCase();
  const upperTa = taStatus.toUpperCase();

  if (upperSummary.includes('STRONG BUY') || upperTa.includes('STRONG BUY')) {
    stance = 'STRONG BUY';
  } else if (upperSummary.includes('BUY ON DIP') || upperTa.includes('BUY ON DIP') || upperTa.includes('DIP')) {
    stance = 'BUY ON DIP';
  } else if (upperSummary.includes('BUY') || upperTa.includes('BUY') || upperTa.includes('ACCUMULATE')) {
    stance = 'BUY';
  } else if (upperSummary.includes('HOLD') || upperTa.includes('HOLD')) {
    stance = 'HOLD';
  } else if (upperSummary.includes('AVOID') || upperTa.includes('AVOID') || upperTa.includes('SELL')) {
    stance = 'AVOID';
  } else if (upperSummary.includes('WAIT') || upperTa.includes('WAIT')) {
    stance = 'WAIT';
  }

  // Check structured technical target
  if (technicalPlan && technicalPlan.hasStructuredPlan && technicalPlan.target1) {
    const tVal = parseFloat(technicalPlan.target1.replace(/[^0-9.]/g, ''));
    if (finite(tVal)) {
      return {
        stance,
        targetValue: tVal,
        targetType: 'TECHNICAL_TARGET',
        source: 'TECHNICAL_ANALYSIS',
        basis: `Technical trade plan target 1 (${technicalPlan.strategy})`,
        asOf,
      };
    }
  }

  // Canonical Valuation base fair value
  if (finite(canonicalFv)) {
    return {
      stance,
      targetValue: canonicalFv,
      targetType: 'VALUATION_BASE_CASE',
      source: 'CANONICAL_VALUATION',
      basis: 'Canonical valuation base case fair value',
      asOf,
    };
  }

  // Analyst consensus
  const consensusTarget = (report.forecast_dashboard as any)?.analyst_consensus?.price_target?.mean ?? null;
  if (finite(consensusTarget)) {
    return {
      stance,
      targetValue: consensusTarget,
      targetType: 'CONSENSUS_TARGET',
      source: 'ANALYST_CONSENSUS',
      basis: 'Analyst consensus mean price target',
      asOf,
    };
  }

  return {
    stance,
    targetValue: null,
    targetType: 'NONE',
    source: 'NONE',
    basis: 'No structured price target available',
    asOf,
  };
}

/**
 * Resolves the canonical base valuation labels according to model family and business archetype.
 * Ensures non-DCF archetypes never manufacture or retain a "DCF" label.
 */
export function resolveCanonicalValuationLabels(
  modelType: string,
  archetype?: string,
  modelNameEn?: string,
  modelNameTh?: string
): {
  modelFamily: string;
  canonicalLabelEn: string;
  canonicalLabelTh: string;
} {
  const isFinancial = archetype === 'bank' || archetype === 'lender' || archetype === 'insurer';
  const isReit = archetype === 'reit';
  const isPreProfit = archetype === 'early_stage';

  if (modelType === 'RESIDUAL_INCOME') return {
    modelFamily: 'residual_income', canonicalLabelEn: 'Residual Income Base Case',
    canonicalLabelTh: 'มูลค่าพื้นฐานจากกำไรส่วนเกิน',
  };
  if (modelType === 'SOTP') return {
    modelFamily: 'sotp', canonicalLabelEn: 'Sum-of-the-Parts Base Case',
    canonicalLabelTh: 'มูลค่าพื้นฐานรวมแต่ละธุรกิจ',
  };
  if (modelType === 'AFFO_MULTIPLE') return {
    modelFamily: 'reit_affo', canonicalLabelEn: 'AFFO Multiple Base Case',
    canonicalLabelTh: 'มูลค่าพื้นฐานจาก AFFO',
  };
  if (modelType === 'PEER_EV_SALES') return {
    modelFamily: 'relative_only', canonicalLabelEn: 'Peer EV/Sales Base Case',
    canonicalLabelTh: 'มูลค่าพื้นฐานเทียบ EV/Sales',
  };
  if (modelType === 'UNAVAILABLE') return {
    modelFamily: 'unavailable', canonicalLabelEn: 'Fair value unavailable',
    canonicalLabelTh: 'ยังประเมินมูลค่ายุติธรรมไม่ได้',
  };
  if (modelType === 'FCFF_DCF') return {
    modelFamily: 'dcf', canonicalLabelEn: 'FCFF DCF Base Case',
    canonicalLabelTh: 'มูลค่าพื้นฐาน FCFF DCF',
  };
  if (modelType === 'DIVIDEND_DISCOUNT' || modelType === 'ddm' || isFinancial) {
    return {
      modelFamily: 'ddm',
      canonicalLabelEn: 'Canonical DDM Base Case',
      canonicalLabelTh: 'มูลค่าพื้นฐาน DDM (Base Case)',
    };
  }
  if (modelType === 'reit_affo' || isReit) {
    return {
      modelFamily: 'reit_affo',
      canonicalLabelEn: 'Canonical AFFO Base Case',
      canonicalLabelTh: 'มูลค่าพื้นฐาน AFFO (Base Case)',
    };
  }
  if (modelType === 'fintech_pe') {
    return {
      modelFamily: 'fintech_pe',
      canonicalLabelEn: 'Canonical FinTech Platform Base Case',
      canonicalLabelTh: 'มูลค่าพื้นฐาน FinTech Platform (Base Case)',
    };
  }
  if (modelType === 'relative_only' || isPreProfit) {
    return {
      modelFamily: 'relative_only',
      canonicalLabelEn: 'Canonical Relative Valuation Base Case',
      canonicalLabelTh: 'มูลค่าประเมินเชิงเปรียบเทียบ (Relative Valuation)',
    };
  }

  return {
    modelFamily: 'dcf',
    canonicalLabelEn: 'Canonical DCF Base Case',
    canonicalLabelTh: 'มูลค่าพื้นฐาน DCF (Base Case)',
  };
}

// Current Lumina valuation claims only. External targets and archived source
// quotations keep their original numbers and attribution.
const currentBaseClaimPattern=(global=false)=>new RegExp(
  String.raw`((?:มูลค่า\s*(?:พื้นฐาน|ที่แท้จริง|ยุติธรรม|เหมาะสม)?\s*(?:DCF|DDM|AFFO|SOTP)?\s*(?:ใน\s*)?(?:กรณีฐาน|กรณีพื้นฐาน)(?:\s*\(\s*Base\s*Case\s*\))?|(?:DCF|DDM|AFFO|SOTP)\s*(?:กรณีฐาน|กรณีพื้นฐาน)|(?:base[- ]case\s+(?:DCF|DDM|AFFO|SOTP)(?:\s+(?:estimate|value|valuation))?))\s*(?:ที่|อยู่ที่|เท่ากับ|คือ|=|:|is|at|of)?\s*)(\$?[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)`,global?'gi':'i');
const currentMosClaimPattern=(global=false)=>new RegExp(
  String.raw`((?:Margin\s*of\s*Safety|ส่วน(?:ต่าง|เผื่อ)ความปลอดภัย)(?:\s*\((?:Margin\s*of\s*Safety|MoS)\))?\s*(?:สูงถึง|อยู่ที่|เท่ากับ|ประมาณ|คือ|=|:|is|of|at|about)?\s*)([+-]?[0-9]+(?:\.[0-9]+)?)\s*%`,global?'gi':'i');
const hasExternalValuationAttribution=(text:string,offset:number)=>{
  const sentence=text.slice(Math.max(0,offset-240),offset).split(/[;!?\n]|\.(?=\s)/).at(-1)??'';
  return /(?:analyst|consensus|Morningstar|GuruFocus|GF\s*Value|นักวิเคราะห์|ฉันทามติ)/i.test(sentence)
    && !/Lumina[^;!?\n]*$/i.test(sentence);
};

/**
 * Extracts any mentioned DCF / Base Case / Intrinsic valuation number from summary prose.
 */
export function extractBaseValuationMentionedValue(summaryText: string): number | null {
  if (!summaryText || typeof summaryText !== 'string') return null;

  const scoped = summaryText.match(currentBaseClaimPattern());
  if (scoped && !hasExternalValuationAttribution(summaryText,scoped.index!)) return Number(scoped[2].replace(/[$,]/g,''));

  // 1. Explicit Base Case / DCF / Active Model patterns
  const explicitRegex = /(?:(?:canonical\s+)?(?:dcf|ddm|affo|relative\s+valuation)?\s*base\s*case(?:\s*(?:target|fair\s*value|price\s*target|valuation|value))?|base\s*fair\s*value|intrinsic\s*value\s*base(?:\s*case)?|base\s*case\s*valuation|เป้าหมาย\s*(?:Base\s*Case|พื้นฐาน)|มูลค่าพื้นฐาน(?:\s*(?:Base\s*Case|\(Base\s*Case\)|DCF\s*\(Base\s*Case\)|DCF|DDM|AFFO))?|การประเมินมูลค่าด้วย\s*DCF\s*พื้นฐาน|มูลค่าที่แท้จริง(?:\s*(?:Base\s*Case|\(Base\s*Case\)))?|มูลค่ายุติธรรม(?:\s*(?:Base\s*Case|\(Base\s*Case\)))?)\s*(?:=|:|คือ|อยู่ที่|is|at|of|\s)\s*(?:\$)?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)/i;

  const match = summaryText.match(explicitRegex);
  if (match && match[1] && !hasExternalValuationAttribution(summaryText, match.index!)) {
    const val = parseFloat(match[1].replace(/,/g, ''));
    if (finite(val)) return val;
  }

  // General monetary claims need a currency marker or an explicit linking
  // word. A DCF reference followed by FY2026 or a 10-year horizon is not a
  // fair-value claim and must not enter the financial consistency gate.
  const monetary = /(?:DCF|Fair\s*Value|มูลค่าพื้นฐาน|มูลค่าที่แท้จริง)(?:\s*(?:พื้นฐาน|กรณีฐาน|base\s*case))?\s*(?:(?:=|:|คือ|ที่|อยู่ที่|is|at|of)\s*\$?|\$)([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)/gi;
  for (const claim of summaryText.matchAll(monetary)) {
    if (!hasExternalValuationAttribution(summaryText, claim.index!)) return Number(claim[1].replace(/,/g,''));
  }

  return null;
}

/**
 * Reconciles base valuation mentions across Executive Summary and Key Takeaways.
 * - Replaces any stale AI DCF / Base Case number with the active canonical base valuation.
 * - Explicitly disambiguates Technical Target, Analyst Consensus, and SOTP targets.
 * - For non-DCF archetypes, uses the active model's canonical label and value without manufacturing a DCF label.
 */
export function reconcileBaseValuationNarrative(
  text: string,
  snapshot: CanonicalExecutiveSnapshot,
  isThai = true
): string {
  if (!text || typeof text !== 'string') return text;

  const canonicalFv = snapshot.canonicalValuation?.baseFairValue ?? snapshot.valuation?.fairValue ?? null;
  const techT1 = snapshot.technicalPlan?.target1 ? parseFloat(String(snapshot.technicalPlan.target1).replace(/[^0-9.]/g, '')) : null;
  const consensusTarget = snapshot.recommendation?.targetType === 'CONSENSUS_TARGET' ? snapshot.recommendation.targetValue : null;
  const sotpTarget = snapshot.valuation?.sotpModel?.valuePerShare ?? null;

  const { modelFamily, canonicalLabelEn, canonicalLabelTh } = resolveCanonicalValuationLabels(
    snapshot.canonicalValuation?.modelType || snapshot.valuation?.modelType || 'dcf_standard',
    snapshot.identity?.archetype,
    snapshot.canonicalValuation?.modelName,
    snapshot.canonicalValuation?.modelNameTh
  );

  let res = text;

  // Thai grammar may put the method between "value" and "base case", with
  // the currency before the number. Do not use an unscoped numeric fallback:
  // fiscal years, WACC and external analyst targets are different claims.
  res = res.replace(currentBaseClaimPattern(true), (match,prefix,amount,offset) => {
    if (hasExternalValuationAttribution(text,offset)) return match;
    return finite(canonicalFv) ? (modelFamily === 'dcf' ? `${prefix}$${canonicalFv.toFixed(2)}` : `${/[ก-๙]/.test(prefix)?canonicalLabelTh:canonicalLabelEn} = $${canonicalFv.toFixed(2)}`)
      : (/[ก-๙]/.test(prefix)?'ยังประเมินมูลค่าพื้นฐานไม่ได้':'Base valuation unavailable');
  });

  const canonicalMos = snapshot.canonicalValuation?.marginOfSafetyPct ?? snapshot.valuation.marginOfSafetyPct
    ?? resolveValuationPriceMetrics(canonicalFv,snapshot.market.currentPrice).marginOfSafetyPct;
  res = res.replace(currentMosClaimPattern(true),(match,prefix,amount,offset)=>{
    if(hasExternalValuationAttribution(res,offset))return match;
    return finite(canonicalMos)?`${prefix}${canonicalMos.toFixed(2)}%`
      : (/[ก-๙]/.test(prefix)?'ส่วนเผื่อความปลอดภัยยังคำนวณไม่ได้':'Margin of Safety unavailable');
  });

  // A failed canonical run must also remove model-authored fair-value prose.
  // Otherwise Section 1 can still display a stale price after its structured
  // valuation has correctly become unavailable.
  if (!finite(canonicalFv)) {
    const unavailableLabel = /[ก-๙]/.test(text)
      ? 'ยังประเมินมูลค่าพื้นฐานไม่ได้'
      : 'Base valuation unavailable';
    res = res.replace(
      /(?:DCF|DDM|AFFO|SOTP|Relative\s+Valuation)?\s*(?:base\s*case|base\s*fair\s*value|fair\s*value|intrinsic\s*value)(?:\s*(?:target|valuation|value))?\s*(?:=|:|is|at|of)\s*\$?[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?\s*(?:USD|dollars)?/gi,
      (match,offset,source) => hasExternalValuationAttribution(source,offset)?match:unavailableLabel
    );
    res = res.replace(
      /(?:การประเมินมูลค่าด้วย\s*DCF\s*พื้นฐาน|มูลค่าพื้นฐาน(?:กรณีฐาน|กรณีพื้นฐาน)?|มูลค่าที่แท้จริง|มูลค่ายุติธรรม)\s*(?:ที่|อยู่ที่|เท่ากับ|คือ|=|:)\s*\$?[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?\s*(?:ดอลลาร์|USD)?/gi,
      (match,offset,source) => hasExternalValuationAttribution(source,offset)?match:'ยังประเมินมูลค่าพื้นฐานไม่ได้'
    );
    return res;
  }

  // 1. Disambiguate competing targets erroneously labeled Base Case
  const competingRegex = /((?:(?:holding|hold|buy|accumulate|wait|avoid)\s*(?:with\s*)?)?(?:base\s*case(?:\s*(?:target|fair\s*value|price\s*target|valuation))?|เป้าหมาย\s*(?:Base\s*Case|พื้นฐาน)|มูลค่าพื้นฐาน\s*Base\s*Case)\s*(?:=|:|คือ|อยู่ที่|is|at|of|\s)\s*)(?:\$)?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)/gi;

  res = res.replace(competingRegex, (match, prefix, numStr, offset, source) => {
    if (hasExternalValuationAttribution(source,offset)) return match;
    const parsed = parseFloat(numStr.replace(/,/g, ''));
    if (finite(techT1) && Math.abs(parsed - techT1) <= 1.0) {
      return /เป้าหมาย|มูลค่า/i.test(prefix) || isThai
        ? `เป้าหมายทางเทคนิค = ${techT1.toFixed(2)}`
        : `Technical Target = $${techT1.toFixed(2)}`;
    }
    if (finite(consensusTarget) && Math.abs(parsed - consensusTarget) <= 1.0 && (!finite(canonicalFv) || Math.abs(parsed - canonicalFv) > 1.0)) {
      return /เป้าหมาย|มูลค่า/i.test(prefix) || isThai
        ? `ฉันทามตินักวิเคราะห์ = ${consensusTarget.toFixed(2)}`
        : `Analyst Consensus = $${consensusTarget.toFixed(2)}`;
    }
    if (finite(sotpTarget) && Math.abs(parsed - sotpTarget) <= 1.0 && (!finite(canonicalFv) || Math.abs(parsed - canonicalFv) > 1.0)) {
      return /เป้าหมาย|มูลค่า/i.test(prefix) || isThai
        ? `มูลค่าตามส่วนธุรกิจ (SOTP) = ${sotpTarget.toFixed(2)}`
        : `SOTP Scenario = $${sotpTarget.toFixed(2)}`;
    }
    return match;
  });

  // 2. Synchronize active canonical base valuation
  if (finite(canonicalFv)) {
    const fvFormatted = canonicalFv.toFixed(2);

    // Thai Base Valuation expressions
    const thRegex = /((?:คงคำแนะนำ\s*(?:HOLD|BUY|ACCUMULATE|WAIT|AVOID)|แนะนำ(?:ถือ|ซื้อ|รอ|หลีกเลี่ยง)?\s*(?:\([^)]*\))?|HOLD|BUY|ACCUMULATE|WAIT|AVOID)?\s*(?:โดยมี\s*)?(?:(?:ราคา\s*)?เป้าหมาย\s*(?:Base\s*Case|พื้นฐาน|มูลค่าพื้นฐาน)|(?:มูลค่า(?:พื้นฐาน|ที่แท้จริง|ยุติธรรม|เหมาะสม)|การประเมินมูลค่าด้วย\s*DCF\s*พื้นฐาน|ประเมินมูลค่าด้วย\s*(?:DCF|DDM|AFFO|SOTP))(?:[\s/()]*(?:DCF|DDM|AFFO|พื้นฐาน|base(?:\s*case)?|\(Base\s*Case\)))*)\s*(?:=|:|คือ|อยู่ที่|at|\s)\s*)(?:\$)?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*(?:ดอลลาร์|\$|USD)?/gi;

    res = res.replace(thRegex, (match, prefix, numStr, offset, source) => {
      if (hasExternalValuationAttribution(source,offset)) return match;
      const prefixLead = /โดยมี/i.test(prefix) ? 'โดยมี ' : '';
      if (modelFamily !== 'dcf') {
        return `${prefixLead}${canonicalLabelTh} = ${fvFormatted} ดอลลาร์`;
      }
      if (/การประเมินมูลค่าด้วย\s*DCF\s*พื้นฐาน/i.test(prefix)) {
        return `${prefixLead}การประเมินมูลค่าด้วย DCF พื้นฐานอยู่ที่ ${fvFormatted} ดอลลาร์`;
      }
      if (/เป้าหมาย/i.test(prefix)) {
        return `${prefixLead}เป้าหมาย Base Case = ${fvFormatted} ดอลลาร์`;
      }
      return `${prefixLead}มูลค่าพื้นฐาน (Base Case) = ${fvFormatted} ดอลลาร์`;
    });

    // English Base Valuation expressions
    const enRegex = /((?:(?:holding|hold|buy|accumulate|wait|avoid)\s*(?:with\s*)?)?(?:canonical\s+)?(?:dcf|ddm|affo|relative\s+valuation)?\s*(?:base\s*case(?:\s*(?:target|fair\s*value|price\s*target|valuation|value))?|base\s*fair\s*value|intrinsic\s*value\s*base(?:\s*case)?|base\s*case\s*valuation|dcf\s*(?:valuation|fair\s*value|target|value)?)\s*(?:=|:|is|at|of|\s)\s*)(?:\$)?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*(?:USD|\$|dollars)?/gi;

    res = res.replace(enRegex, (match, prefix, numStr, offset, source) => {
      if (hasExternalValuationAttribution(source,offset)) return match;
      if (/^\s*DCF\s*$/i.test(prefix) && !/\$|USD|dollars/i.test(match)) return match;
      if (/[ก-๙]/.test(prefix)) {
        const prefixLead = /โดยมี/i.test(prefix) ? 'โดยมี ' : '';
        if (modelFamily !== 'dcf') {
          return `${prefixLead}${canonicalLabelTh} = ${fvFormatted} ดอลลาร์`;
        }
        return `${prefixLead}เป้าหมาย Base Case = ${fvFormatted} ดอลลาร์`;
      }
      const prefixLead = /with\s*$/i.test(prefix) ? 'with ' : '';
      if (modelFamily !== 'dcf') {
        return `${prefixLead}${canonicalLabelEn} = $${fvFormatted}`;
      }
      if (/dcf\s*base\s*case/i.test(prefix)) {
        return `${prefixLead}DCF base case = $${fvFormatted}`;
      }
      if (/base\s*fair\s*value/i.test(prefix)) {
        return `${prefixLead}Base Fair Value: $${fvFormatted}`;
      }
      if (/intrinsic\s*value\s*base/i.test(prefix)) {
        return `${prefixLead}Intrinsic Value Base = $${fvFormatted}`;
      }
      if (/base\s*case\s*valuation/i.test(prefix)) {
        return `${prefixLead}Base Case Valuation = $${fvFormatted}`;
      }
      return `${prefixLead}Base Case target = $${fvFormatted}`;
    });

    // Thai research prose often says "มูลค่าพื้นฐานกรณีฐานที่ ..." rather
    // than "Base Case = ...". It must obey the same canonical run.
    res = res.replace(
      /(มูลค่าพื้นฐาน(?:กรณีฐาน|กรณีพื้นฐาน)?\s*(?:ที่|อยู่ที่|เท่ากับ|คือ|=|:)\s*)\$?[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?\s*(?:ดอลลาร์)?/gi,
      (_match, prefix, offset, source) => hasExternalValuationAttribution(source,offset) ? _match : modelFamily === 'dcf'
        ? `${prefix}${fvFormatted} ดอลลาร์`
        : `${canonicalLabelTh} = ${fvFormatted} ดอลลาร์`
    );

    // Only explicit per-share valuation labels qualify. Bare Thai "value" may
    // describe a transaction, aggregate asset balance or one-off gain.
    res = res.replace(
      /((?:(?:base(?:\s*case)?\s*)?fair\s*value|DCF|มูลค่า(?:พื้นฐาน|ที่แท้จริง|ยุติธรรม|เหมาะสม))(?:[\s/()]*(?:DCF|พื้นฐาน|base(?:\s*case)?))*[\s:=]*(?:อยู่ที่|คือ|of|at|is|=|:)?)\s*(?:\$)?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*(ดอลลาร์|\$|USD)?/gi,
      (match, prefix, num, unit, offset, source) => {
        if (hasExternalValuationAttribution(source,offset)) return match;
        if (/^\s*DCF\s*$/i.test(prefix) && !unit && !/\$/.test(match)) return match;
        if (modelFamily !== 'dcf') {
          return isThai ? `${canonicalLabelTh} = ${fvFormatted} ดอลลาร์` : `${canonicalLabelEn} = $${fvFormatted}`;
        }
        const u = unit ? ` ${unit}` : (isThai ? ' ดอลลาร์' : '');
        return `${prefix} ${fvFormatted}${u}`;
      }
    );

    // Sanitize any lingering standalone DCF mention for non-DCF archetypes
    if (modelFamily !== 'dcf') {
      res = res.replace(/\b(?:Canonical\s+)?DCF\s*base\s*case\s*(?:=|:|\s)\s*\$?[0-9.]+/gi, (match,offset,source)=>hasExternalValuationAttribution(source,offset)?match:isThai ? `${canonicalLabelTh} = ${fvFormatted} ดอลลาร์` : `${canonicalLabelEn} = $${fvFormatted}`);
      res = res.replace(/\bDCF\s*(?:(?:=|:)\s*\$?|\$)[0-9.]+/gi, (match,offset,source)=>hasExternalValuationAttribution(source,offset)?match:isThai ? `${canonicalLabelTh} = ${fvFormatted} ดอลลาร์` : `${canonicalLabelEn} = $${fvFormatted}`);
      res = res.replace(/(?:การประเมินมูลค่าด้วย\s*DCF\s*พื้นฐาน|มูลค่าพื้นฐาน\s*DCF)\s*(?:อยู่ที่|คือ|=|:|\s)\s*[0-9.]+\s*ดอลลาร์/gi, (match,offset,source)=>hasExternalValuationAttribution(source,offset)?match:`${canonicalLabelTh} = ${fvFormatted} ดอลลาร์`);
    }
  }

  return res;
}

/** Reconcile current narrative sections both after normalization and after a
 * validator quarantines a valuation. Saved versions and quoted evidence are
 * excluded; this function is never used by the immutable History reader. */
export function reconcileCurrentValuationProse(report: ReportData, snapshot: CanonicalExecutiveSnapshot): void {
  const audit = report.current_narrative_audit || [];
  const reconcileRatios = (text: string): string => text.replace(
    /\b(ROE|ROIC)\b((?:(?!\bROE\b|\bROIC\b)[^0-9%\n]){0,80})(-?\d+(?:\.\d+)?)\s*%/gi,
    (match, label: string, bridge: string, claimed: string, offset: number, source: string) => {
      const context = source.slice(Math.max(0, offset - 100), offset + match.length);
      // Historical/forecast/peer observations remain separate evidence. Only
      // unqualified current-company ratios resolve to this report's TTM basis.
      if (hasExternalValuationAttribution(source, offset)
        || /\b(?:FY\s*\d{4}|Q[1-4]\s*\d{4}|forecast|expected|target|peer|previous|prior|historical)\b|คาด|เป้าหมาย|คู่แข่ง|ปีก่อน|อดีต|ย้อนหลัง|ปี\s*\d{4}/i.test(context)) return match;
      const key = label.toUpperCase() === 'ROE' ? 'roe' : 'roic';
      const value = snapshot.profitability[key];
      if (finite(value) && Math.abs(value - Number(claimed)) <= 0.05) return match;
      const period = snapshot.profitability.period ? `TTM ending ${snapshot.profitability.period}` : 'Current canonical TTM';
      if (!audit.some(item => item.metric === key && item.claimedValue === Number(claimed) && item.canonicalValue === (value ?? null)))
        audit.push({ metric: key, claimedValue: Number(claimed), canonicalValue: finite(value) ? value : null, period });
      return finite(value) ? `${label}${bridge}${value.toFixed(2)}%`
        : `${label}: ${/[ก-๙]/.test(match) ? 'ข้อมูลไม่พอสำหรับอัตราส่วนปัจจุบัน' : 'Current canonical ratio unavailable'}`;
    }).replace(
      /((?:\bNet\s+Debt\s*(?:\/|to|ต่อ)\s*(?:TTM\s+)?EBITDA\b|หนี้สินสุทธิต่อ\s*(?:TTM\s+)?EBITDA\b))([^0-9%\n]{0,60})(-?\d+(?:\.\d+)?)\s*(x\b|เท่า)/gi,
      (match, label: string, bridge: string, claimed: string, unit: string, offset: number, source: string) => {
        const context = source.slice(Math.max(0, offset - 100), offset + match.length);
        if (hasExternalValuationAttribution(source, offset)
          || /\b(?:FY\s*\d{4}|Q[1-4]\s*\d{4}|forecast|expected|target|peer|previous|prior|historical|guidance)\b|คาด|เป้าหมาย|คู่แข่ง|ปีก่อน|อดีต|ย้อนหลัง|ปี\s*\d{4}/i.test(context)) return match;
        const value = snapshot.balanceSheet.netDebtToEbitda;
        if (finite(value) && Math.abs(value - Number(claimed)) <= 0.005 + Number.EPSILON) return match;
        if (!audit.some(item => item.metric === 'net_debt_to_ebitda' && item.claimedValue === Number(claimed) && item.canonicalValue === (value ?? null)))
          audit.push({ metric: 'net_debt_to_ebitda', claimedValue: Number(claimed), canonicalValue: finite(value) ? value : null,
            period: `TTM ending ${snapshot.balanceSheet.period || 'current period'}` });
        if (finite(value)) return `${label}${bridge}${value.toFixed(2)}${unit === 'เท่า' ? ' เท่า' : 'x'}`;
        const notApplicable = ['GUARDED', 'NOT_APPLICABLE'].includes(snapshot.balanceSheet.netDebtToEbitdaStatus || '');
        return `${label}: ${notApplicable
          ? /[ก-๙]/.test(match) ? 'ไม่ใช้กับรูปแบบธุรกิจหรือสถานะเงินสดสุทธิปัจจุบัน' : 'Not applicable to the current business or net-cash basis'
          : /[ก-๙]/.test(match) ? 'ข้อมูลไม่พอสำหรับอัตราส่วนปัจจุบัน' : 'Current canonical ratio unavailable'}`;
      });
  const reconcile = (value: unknown): unknown => {
    if (typeof value === 'string') return reconcileRatios(reconcileBaseValuationNarrative(value, snapshot, /[ก-๙]/.test(value)));
    if (Array.isArray(value)) return value.map(reconcile);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,item]) =>
      [key, /history|historical|previous|snapshot|sources|findings/i.test(key) ? item : reconcile(item)]));
    return value;
  };
  for (const key of ['comprehensive_analysis','five_pillars','final_report'] as const)
    if (report[key]) (report as any)[key] = reconcile(report[key]);
  if (report.intrinsic_value?.summary?.verdict_text)
    report.intrinsic_value.summary.verdict_text = reconcileBaseValuationNarrative(report.intrinsic_value.summary.verdict_text, snapshot);
  if (report.verdict?.summary) report.verdict.summary = reconcileRatios(report.verdict.summary);
  if (report.verdict?.key_takeaways) report.verdict.key_takeaways = report.verdict.key_takeaways.map(reconcileRatios);
  if (audit.length) report.current_narrative_audit = audit.slice(0, 100);
}

/**
 * Builds the canonical Section 1 Executive Snapshot after all source completion,
 * normalization, market refresh, metric resolution, and conviction calculation.
 */
export function buildCanonicalExecutiveSnapshot(
  report: Partial<ReportData>,
  ticker?: string
): CanonicalExecutiveSnapshot {
  const sym = (ticker || report.ticker || (report as any)?.symbol || 'STOCK').toUpperCase().trim();
  const archetype = resolveBusinessArchetype(report, sym);
  const resolvedMetrics = resolveFundamentalMetrics(report, sym);
  const adaptivePillars = resolveAdaptiveFivePillars(report, sym);

  const marketSnapshot = (report as any).market_snapshot;
  const currentPrice = marketSnapshot?.price
    ?? report.intrinsic_value?.current_price
    ?? report.company_profile?.stock_price
    ?? null;
  const marketCap = marketSnapshot?.marketCap
    ?? report.company_profile?.market_cap
    ?? null;
  const peTrailing = finite(resolvedMetrics.peTrailing.value) ? resolvedMetrics.peTrailing.value
    : resolvedMetrics.peTrailing.status === 'NOT_APPLICABLE' ? null : finite(marketSnapshot?.trailingPE)
    ? marketSnapshot.trailingPE
    : finite(marketSnapshot?.pe)
      ? marketSnapshot.pe
      : finite(resolvedMetrics.peTrailing.value)
        ? resolvedMetrics.peTrailing.value
        : null;
  const peForward = finite(marketSnapshot?.forwardPE)
    ? marketSnapshot.forwardPE
    : finite(marketSnapshot?.forwardPe)
      ? marketSnapshot.forwardPe
      : finite(resolvedMetrics.peForward.value)
        ? resolvedMetrics.peForward.value
        : null;

  // Canonical Valuation
  const intrinsic = report.intrinsic_value;
  const canonicalRun = intrinsic?.canonical_run;
  const detectedSelector = detectValuationModel(report, sym);
  const selectedModel = intrinsic?.selected_model ?? detectedSelector;
  const modelType = canonicalRun?.primaryMethod ?? selectedModel?.model_type ?? 'dcf_standard';
  const methodNames: Record<string, [string, string]> = {
    FCFF_DCF: ['FCFF DCF', 'โมเดล FCFF DCF'],
    RESIDUAL_INCOME: ['Residual Income', 'โมเดลกำไรส่วนเกิน'],
    DIVIDEND_DISCOUNT: ['Dividend Discount', 'โมเดลคิดลดเงินปันผล'],
    SOTP: ['Sum of the Parts', 'ประเมินแยกส่วนธุรกิจ'],
    AFFO_MULTIPLE: ['AFFO Multiple', 'โมเดล AFFO ของ REIT'],
    PEER_EV_SALES: ['Peer EV/Sales', 'เทียบ EV/Sales กับบริษัทใกล้เคียง'],
    CYCLICAL_NORMALIZED_DCF: ['Through-cycle DCF', 'DCF ปรับตามวัฏจักร'],
    UNAVAILABLE: ['Valuation unavailable', 'ยังประเมินมูลค่าไม่ได้'],
  };
  const modelName = methodNames[modelType]?.[0] ?? selectedModel?.model_name_en ?? 'Discounted Cash Flow (DCF)';
  const modelNameTh = methodNames[modelType]?.[1] ?? selectedModel?.model_name_th ?? 'แบบจำลองคิดลดกระแสเงินสด (DCF)';

  const baseDcfVal = intrinsic?.summary?.base_case_fair_value
    ?? intrinsic?.dcf_model?.scenarios?.base?.fair_value_per_share
    ?? null;
  const ddmVal = intrinsic?.ddm_model?.scenarios?.base?.fair_value_per_share ?? null;
  const reitVal = intrinsic?.reit_model?.scenarios?.base?.fair_value_per_share ?? null;
  const relativeVal = intrinsic?.relative_only_model?.fair_value_per_share ?? null;

  const fairValue = canonicalRun
    ? canonicalRun.baseFairValue
    : modelType === 'ddm' && finite(ddmVal)
    ? ddmVal
    : modelType === 'reit_affo' && finite(reitVal)
      ? reitVal
      : modelType === 'relative_only' && finite(relativeVal)
        ? relativeVal
        : finite(baseDcfVal)
          ? baseDcfVal
          : (finite(ddmVal) ? ddmVal : finite(reitVal) ? reitVal : finite(relativeVal) ? relativeVal : null);

  let marginOfSafetyPct: number | null = null;
  let premiumToFairValuePct: number | null = null;

  if (finite(fairValue) && finite(currentPrice) && currentPrice > 0) {
    marginOfSafetyPct = rounded(((fairValue - currentPrice) / currentPrice) * 100);
  }
  if (finite(fairValue) && finite(currentPrice) && fairValue > 0) {
    premiumToFairValuePct = rounded(((currentPrice - fairValue) / fairValue) * 100);
  }

  // SOTP validation
  const rawSotp = (report as any).sotp_model ?? (intrinsic as any)?.sotp_model;
  const sotpValidation = validateStructuredSotpModel(rawSotp);
  const sotpModel = sotpValidation.isValid ? rawSotp : undefined;

  // Growth & Statements
  const fs = report.financial_statements;
  const periods = fs?.periods || [];
  const latestPeriod = periods.length > 0 ? periods[periods.length - 1] : 'Latest';
  const inc = fs?.income_statement;
  const cf = fs?.cash_flow;

  const at = (arr?: (number | null)[]) => (arr?.length && finite(arr[arr.length - 1]) ? arr[arr.length - 1]! : null);

  const revenueLatestQuarter = at(inc?.revenue);
  const revenueGrowthYoY = resolvedMetrics.revenueGrowthYoY.value ?? at(inc?.yoy_revenue_growth_pct);
  const revenueGrowthPeriod = resolvedMetrics.revenueGrowthYoY.period || latestPeriod;
  const revenueGrowthBasis = resolvedMetrics.revenueGrowthYoY.periodBasis || resolvedMetrics.revenueGrowthYoY.basis || 'Quarter YoY';

  const revenueTtmResolution = resolveReportTtmFlow(report, 'income_statement.revenue');
  const revenueTtm = revenueTtmResolution.canonicalValue;

  // Profitability
  const grossMargin = resolvedMetrics.grossMargin.value ?? at(inc?.gross_margin_pct);
  const operatingMargin = resolvedMetrics.operatingMargin.value ?? at(inc?.operating_margin_pct);
  const netMargin = resolvedMetrics.netMargin.value ?? at(inc?.net_margin_pct);
  const roic = resolvedMetrics.roic.value ?? null;
  const roe = resolvedMetrics.roe.value ?? null;

  // Cash Flow
  const fcfLatest = at(cf?.free_cash_flow);
  const fcfMargin = resolvedMetrics.fcfMargin.value ?? at(cf?.fcf_margin_pct);
  const fcfTtmResolution = resolveReportTtmFlow(report, 'cash_flow.free_cash_flow');
  const fcfTtm = fcfTtmResolution.canonicalValue;

  // Every current balance-sheet claim comes from one compatible instant.
  const currentBalanceSheetSnapshot = resolveCurrentBalanceSheetSnapshot(report);
  const totalCashAndInvestments = currentBalanceSheetSnapshot.cashPlusShortTermInvestments;
  const totalDebt = currentBalanceSheetSnapshot.totalDebt;
  const netCashOrDebt = currentBalanceSheetSnapshot.netCash;
  const isNetCash = netCashOrDebt !== null ? netCashOrDebt >= 0 : false;
  const debtToEquity = currentBalanceSheetSnapshot.facts.debt_to_equity?.value ?? null;
  const currentRatio = resolvedMetrics.currentRatio.value ?? currentBalanceSheetSnapshot.facts.current_ratio?.value ?? null;
  const balancePeriod = currentBalanceSheetSnapshot.period || latestPeriod;
  const balanceStatus = currentBalanceSheetSnapshot.verification === 'verified' ? 'SEC_VERIFIED' : 'FOUND_UNVERIFIED';

  // Conviction
  const convictionScore = report.verdict?.conviction_score ?? null;
  const convictionBreakdown = report.verdict?.conviction_breakdown;

  // Build facts registry
  const facts: Record<string, NumericClaimFact> = {};

  if (finite(currentPrice)) {
    facts.currentPrice = {
      metricKey: 'current_price',
      value: currentPrice,
      formattedValue: `$${currentPrice.toFixed(2)}`,
      unit: '$',
      basis: 'Market Quote',
      period: 'Current Market Snapshot',
      source: marketSnapshot?.source || 'Yahoo Finance / Provider',
      status: 'PROVIDER_REPORTED',
    };
  }

  if (finite(fairValue)) {
    facts.fairValue = {
      metricKey: 'fair_value',
      value: fairValue,
      formattedValue: `$${fairValue.toFixed(2)}`,
      unit: '$',
      basis: modelType,
      period: latestPeriod,
      source: 'Canonical Valuation Engine',
      status: 'CANONICAL_DERIVED',
    };
  }

  if (finite(marginOfSafetyPct)) {
    facts.marginOfSafety = {
      metricKey: 'margin_of_safety_pct',
      value: marginOfSafetyPct,
      formattedValue: `${marginOfSafetyPct >= 0 ? '+' : ''}${marginOfSafetyPct.toFixed(1)}%`,
      unit: '%',
      basis: '(Fair Value - Price) / Price',
      period: 'Current Market Snapshot',
      source: 'Canonical Valuation Engine',
      status: 'CANONICAL_DERIVED',
    };
  }

  if (finite(peTrailing)) {
    facts.peTrailing = {
      metricKey: 'pe_trailing',
      value: peTrailing,
      formattedValue: `${peTrailing.toFixed(1)}x`,
      unit: 'x',
      basis: 'TTM P/E',
      period: 'Current Market Snapshot',
      source: marketSnapshot?.source || 'Provider Reported',
      status: 'PROVIDER_REPORTED',
    };
  }

  if (finite(revenueTtm)) {
    facts.revenueTtm = {
      metricKey: 'revenue_ttm',
      value: revenueTtm,
      formattedValue: revenueTtm.toLocaleString('en-US'),
      unit: 'M USD',
      basis: 'TTM (Trailing 4 Quarters)',
      period: `Trailing 4Q ending ${latestPeriod}`,
      source: revenueTtmResolution.source || 'Financial Statements',
      status: revenueTtmResolution.status === 'verified' ? 'SEC_VERIFIED' : 'FOUND_UNVERIFIED',
    };
  }

  if (finite(revenueGrowthYoY)) {
    facts.latestQuarterRevenueGrowth = {
      metricKey: 'revenue_growth_yoy',
      value: revenueGrowthYoY,
      formattedValue: `${revenueGrowthYoY >= 0 ? '+' : ''}${revenueGrowthYoY.toFixed(1)}%`,
      unit: '%',
      basis: revenueGrowthBasis,
      period: revenueGrowthPeriod,
      source: resolvedMetrics.revenueGrowthYoY.source || 'Financial Statements',
      status: 'CANONICAL_DERIVED',
    };
  }

  if (finite(operatingMargin)) {
    facts.operatingMargin = {
      metricKey: 'operating_margin',
      value: operatingMargin,
      formattedValue: `${operatingMargin.toFixed(2)}%`,
      unit: '%',
      basis: 'Standalone Quarter',
      period: latestPeriod,
      source: 'SEC / Canonical Financials',
      status: 'SEC_VERIFIED',
    };
  }

  if (finite(fcfLatest)) {
    facts.latestQuarterFcf = {
      metricKey: 'latest_quarter_fcf',
      value: fcfLatest,
      formattedValue: `${fcfLatest.toLocaleString('en-US')}`,
      unit: 'M USD',
      basis: 'Standalone Quarter FCF',
      period: latestPeriod,
      source: 'SEC / Canonical Financials',
      status: 'SEC_VERIFIED',
    };
  }

  if (finite(totalCashAndInvestments)) {
    facts.totalCashAndInvestments = {
      metricKey: 'cash_and_investments',
      value: totalCashAndInvestments,
      formattedValue: totalCashAndInvestments.toLocaleString('en-US'),
      unit: 'M USD',
      basis: 'Cash + Short-Term Investments',
      period: balancePeriod,
      asOf: currentBalanceSheetSnapshot.periodEnd || undefined,
      source: currentBalanceSheetSnapshot.source,
      status: balanceStatus,
    };
  }

  if (finite(totalDebt)) {
    facts.totalDebt = {
      metricKey: 'total_debt',
      value: totalDebt,
      formattedValue: totalDebt.toLocaleString('en-US'),
      unit: 'M USD',
      basis: currentBalanceSheetSnapshot.totalDebtBasis === 'REPORTED_DEBT_AND_FINANCE_LEASES'
        ? 'Reported Debt + Finance Leases'
        : currentBalanceSheetSnapshot.totalDebtBasis === 'REPORTED_TOTAL'
          ? 'Reported Total Debt' : 'Current Debt + Long-Term Debt',
      period: balancePeriod,
      asOf: currentBalanceSheetSnapshot.periodEnd || undefined,
      source: currentBalanceSheetSnapshot.source,
      status: balanceStatus,
    };
  }

  if (finite(netCashOrDebt)) {
    facts.netCash = {
      metricKey: 'net_cash_cushion',
      value: netCashOrDebt,
      formattedValue: Math.abs(netCashOrDebt).toLocaleString('en-US'),
      unit: 'M USD',
      basis: isNetCash ? 'Net Cash' : 'Net Debt',
      period: balancePeriod,
      asOf: currentBalanceSheetSnapshot.periodEnd || undefined,
      source: currentBalanceSheetSnapshot.source,
      status: currentBalanceSheetSnapshot.verification === 'verified' ? 'CANONICAL_DERIVED' : 'FOUND_UNVERIFIED',
    };
  }

  if (finite(convictionScore)) {
    facts.convictionScore = {
      metricKey: 'conviction_score',
      value: convictionScore,
      formattedValue: `${convictionScore}/100`,
      unit: '/100',
      basis: 'Deterministic 4-Pillar Model',
      period: 'Canonical Report',
      source: 'Conviction Scorer Engine',
      status: 'CANONICAL_DERIVED',
    };
  }

  const technicalPlan = extractStructuredTechnicalPlan(report, marketSnapshot?.asOf);
  const evidence = extractStructuredQualitativeEvidence(report);

  const isFinancial = archetype === 'bank' || archetype === 'lender' || archetype === 'fintech';
  const isInsurer = archetype === 'insurer';
  const isReit = archetype === 'reit';
  const isPreProfit = archetype === 'early_stage';

  // Cross-sector fact adjustments:
  if (isFinancial || isInsurer) {
    if (facts.latestQuarterFcf) {
      facts.latestQuarterFcf.status = 'NOT_APPLICABLE';
      facts.latestQuarterFcf.basis = 'Not applicable for financial institutions';
    }
    if (facts.currentRatio) {
      facts.currentRatio.status = 'NOT_APPLICABLE';
      facts.currentRatio.basis = 'Not applicable for financial institutions';
    }
    if (facts.netCash) {
      facts.netCash.status = 'NOT_APPLICABLE';
      facts.netCash.basis = 'Not applicable for financial institutions';
    }
  }

  if (isPreProfit) {
    if (facts.peTrailing) {
      facts.peTrailing.status = 'NOT_APPLICABLE';
      facts.peTrailing.basis = 'Not applicable (pre-profit / negative earnings)';
    }
  }

  // Populate categorized fact maps:
  const growthFacts: Record<string, NumericClaimFact> = {};
  if (facts.revenueTtm) growthFacts.revenueTtm = facts.revenueTtm;
  if (facts.latestQuarterRevenueGrowth) growthFacts.latestQuarterRevenueGrowth = facts.latestQuarterRevenueGrowth;

  const profitabilityFacts: Record<string, NumericClaimFact> = {};
  if (facts.operatingMargin) profitabilityFacts.operatingMargin = facts.operatingMargin;

  const cashFlowFacts: Record<string, NumericClaimFact> = {};
  if (facts.latestQuarterFcf) cashFlowFacts.latestQuarterFcf = facts.latestQuarterFcf;

  const balanceSheetFacts: Record<string, NumericClaimFact> = {};
  if (facts.totalCashAndInvestments) balanceSheetFacts.totalCashAndInvestments = facts.totalCashAndInvestments;
  if (facts.totalDebt) balanceSheetFacts.totalDebt = facts.totalDebt;
  if (facts.netCash) balanceSheetFacts.netCash = facts.netCash;

  const marketMultiples: Record<string, NumericClaimFact> = {};
  if (facts.peTrailing) marketMultiples.peTrailing = facts.peTrailing;
  for (const [key,metric] of Object.entries({peForward:resolvedMetrics.peForward,peg:resolvedMetrics.peg})) {
    marketMultiples[key]={metricKey:key,value:finite(metric.value)?metric.value:null,formattedValue:finite(metric.value)?`${metric.value}x`:'Unavailable',unit:'x',basis:metric.basis||'UNRESOLVED',period:metric.period||latestPeriod,source:metric.source||'Canonical metric registry',status:finite(metric.value)?metric.status==='CALCULATED'?'CANONICAL_DERIVED':'PROVIDER_REPORTED':metric.status==='NOT_APPLICABLE'?'NOT_APPLICABLE':'UNAVAILABLE'};
  }

  const { canonicalLabelEn, canonicalLabelTh } = resolveCanonicalValuationLabels(
    modelType,
    archetype,
    modelName,
    modelNameTh
  );
  const structuredValuationSummaryEn = finite(fairValue)
    ? `${canonicalLabelEn} = $${fairValue.toFixed(2)}`
    : undefined;
  const structuredValuationSummaryTh = finite(fairValue)
    ? `${canonicalLabelTh} = ${fairValue.toFixed(2)} ดอลลาร์`
    : undefined;

  return {
    reportAsOf: report.report_provenance?.generated_at || (report as any).report_date,
    marketAsOf: marketSnapshot?.asOf,
    identity: {
      ticker: sym,
      companyName: report.company_profile?.overview?.company_name,
      sector: report.company_profile?.sector,
      archetype,
    },
    market: {
      currentPrice,
      marketCap,
      peTrailing,
      peForward,
      asOf: marketSnapshot?.asOf,
      provider: marketSnapshot?.source,
      status: finite(currentPrice) ? 'PROVIDER_REPORTED' : 'UNAVAILABLE',
    },
    growth: {
      revenueTtm,
      revenueLatestQuarter,
      revenueGrowthYoY,
      revenueGrowthPeriod,
      revenueGrowthBasis,
      epsGrowthYoY: resolvedMetrics.epsGrowthYoY.value,
      status: finite(revenueGrowthYoY) ? 'CANONICAL_DERIVED' : 'UNAVAILABLE',
    },
    profitability: {
      grossMargin,
      operatingMargin,
      netMargin,
      roic,
      roe,
      period: latestPeriod,
      status: finite(operatingMargin) ? 'SEC_VERIFIED' : 'UNAVAILABLE',
    },
    cashFlow: {
      fcfLatest: (isFinancial || isInsurer) ? null : fcfLatest,
      fcfMargin: (isFinancial || isInsurer) ? null : fcfMargin,
      fcfTtm: (isFinancial || isInsurer) ? null : fcfTtm,
      period: latestPeriod,
      status: (isFinancial || isInsurer) ? 'NOT_APPLICABLE' : finite(fcfLatest) ? 'SEC_VERIFIED' : 'UNAVAILABLE',
    },
    balanceSheet: {
      totalCashAndInvestments,
      totalDebt,
      netCashOrDebt: (isFinancial || isInsurer) ? null : netCashOrDebt,
      isNetCash: (isFinancial || isInsurer) ? false : isNetCash,
      debtToEquity,
      currentRatio: (isFinancial || isInsurer) ? null : currentRatio,
      netDebtToEbitda: resolvedMetrics.netDebtToEbitda.value ?? null,
      netDebtToEbitdaStatus: resolvedMetrics.netDebtToEbitda.status,
      period: balancePeriod,
      status: finite(totalCashAndInvestments) ? balanceStatus : 'UNAVAILABLE',
    },
    currentBalanceSheetSnapshot,
    valuation: {
      modelType,
      modelName,
      modelNameTh,
      fairValue,
      currentPrice,
      marginOfSafetyPct,
      premiumToFairValuePct,
      sotpModel,
      valuationAsOf: report.report_provenance?.generated_at || (report as any).report_date,
      assumptionSetId: intrinsic?.summary?.verdict_text,
      status: finite(fairValue) ? 'CANONICAL_DERIVED' : 'UNAVAILABLE',
    },
    conviction: {
      score: convictionScore,
      scoreVersion: 'v2.0',
      inputsAsOf: marketSnapshot?.asOf || latestPeriod,
      breakdown: convictionBreakdown,
    },
    canonicalValuation: {
      modelType,
      valuationRunId: canonicalRun?.valuationRunId,
      financialSnapshotId: canonicalRun?.financialSnapshotId,
      inputHash: canonicalRun?.inputHash,
      assumptionHash: canonicalRun?.assumptionHash,
      modelVersion: canonicalRun?.modelVersion,
      eligibility: canonicalRun?.status,
      modelName,
      modelNameTh,
      baseFairValue: fairValue,
      bearFairValue: canonicalRun ? canonicalRun.bearFairValue
        : typeof intrinsic?.dcf_model?.scenarios?.bear?.fair_value_per_share === 'number'
        ? intrinsic.dcf_model.scenarios.bear.fair_value_per_share
        : null,
      bullFairValue: canonicalRun ? canonicalRun.bullFairValue
        : typeof intrinsic?.dcf_model?.scenarios?.bull?.fair_value_per_share === 'number'
        ? intrinsic.dcf_model.scenarios.bull.fair_value_per_share
        : null,
      currentPrice,
      marginOfSafetyPct,
      premiumToFairValuePct,
      asOf: report.report_provenance?.generated_at || (report as any).report_date,
      valuationAsOf: report.report_provenance?.generated_at || (report as any).report_date,
      assumptionSetId: canonicalRun?.assumptionHash ?? intrinsic?.summary?.verdict_text,
      assumptions: canonicalRun ? { inputHash: canonicalRun.inputHash, assumptionHash: canonicalRun.assumptionHash }
        : intrinsic?.dcf_model?.assumptions as any,
      provenance: finite(fairValue) ? 'CANONICAL_DERIVED' : 'UNAVAILABLE',
      canonicalLabelEn,
      canonicalLabelTh,
      structuredValuationSummaryEn,
      structuredValuationSummaryTh,
    },
    recommendation: resolveRecommendationSnapshot(
      report,
      fairValue,
      technicalPlan,
      currentPrice
    ),
    growthFacts,
    profitabilityFacts,
    cashFlowFacts,
    balanceSheetFacts,
    marketMultiples,
    technicalPlan,
    evidence,
    facts,
  };
}

/**
 * Reconciles the Executive Summary against final canonical snapshot facts.
 * - Preserves qualitative prose and context
 * - Softens unsupported superlative/leadership claims when verified evidence is absent
 * - Replaces any stale DCF fair-value numbers with the final canonical fair value
 * - Updates current price and P/E ratio to match the current market snapshot
 * - Strips unsupported standalone SOTP dollar values when no structured SOTP model exists
 * - Clarifies period semantics: separates TTM revenue from latest-quarter YoY growth
 * - Enforces cross-sector semantics (banks avoid corporate FCF/current ratio, pre-profit avoids meaningless P/E)
 */
/** Explicit current/TTM claims share the exact accounting and market registry.
 * Preserve unrelated historical/segment prose; never turn annual/YTD into TTM.
 * Units are converted for display, not by inserting millions into a B label.
 */
export function reconcileCanonicalFlowAndMultipleNarrative(text: string, snapshot: CanonicalExecutiveSnapshot, isThai = true): string {
  if (!finite(snapshot.balanceSheet?.totalDebt)) {
    text=text.replace(/(?:หนี้สินที่มีภาระดอกเบี้ย|หนี้สินทางการเงิน)(?:เป็น|เท่ากับ)?ศูนย์(?:\s*\(\s*0(?:\.0+)?\s*(?:MUSD|USD|M)\s*\))?|(?:is\s+)?debt[- ]free|(?:has|with)\s+(?:zero|no)\s+(?:interest[- ]bearing\s+)?debt/gi,
      isThai?'ยอดหนี้ทางการเงินยังไม่มีข้อมูล canonical ที่ยืนยันได้':'canonical financial debt is not yet verified');
  }
  const money = (pattern: string, value: number | null | undefined) => {
    const regex=new RegExp(`(${pattern})([^\\d;\\n]{0,45}?)(\\$?\\s*[-+]?\\d[\\d,]*(?:\\.\\d+)?)\\s*(billion|million|MUSD|bn|B|M|พันล้าน|ล้าน)(?![a-z])((?:\\s*(?:ดอลลาร์(?:สหรัฐ)?|USD|dollars?))?)`, 'gi');
    text=text.replace(regex,(match,label,join,stated,unit,suffix)=>{
      if (!finite(value)) return `${label} (${isThai?'ยังไม่มีข้อมูล canonical ที่ยืนยันได้':'verified canonical value unavailable'})`;
      const divisor=/^(?:billion|bn|b|พันล้าน)$/i.test(unit)?1000:1;
      if (Math.abs(Number(stated.replace(/[$,\s]/g,''))*divisor-value)<=Math.max(0.01,Math.abs(value)*0.0001)) return match;
      return `${label}${join}${stated.match(/^\s*/)?.[0] ?? ''}${stated.includes('$')?'$':''}${(value/divisor).toLocaleString('en-US',{maximumFractionDigits:2})}${/^(?:B|M|bn)$/i.test(unit)?'':' '}${unit}${suffix}`;
    });
  };
  money('(?:TTM\\s*revenue|revenue\\s*TTM|trailing\\s*12[ -]month\\s*revenue|รายได้(?:รวม)?\\s*(?:รอบ\\s*)?TTM|รายได้รอบ\\s*12\\s*เดือน)',snapshot.growth?.revenueTtm);
  money('(?:TTM\\s*(?:FCF|free cash flow)|(?:free cash flow|FCF)\\s*(?:\\(\\s*TTM\\s*\\)|TTM)|กระแสเงินสดอิสระ(?:สะสมย้อนหลัง\\s*12\\s*เดือน)?\\s*(?:\\(\\s*TTM(?:\\s*FCF)?\\s*\\)|TTM))',snapshot.cashFlow?.fcfTtm);
  money('(?:Net Cash|สถานะเงินสดสุทธิ|เงินสดสุทธิ)',snapshot.balanceSheet?.netCashOrDebt);
  money('(?:Cash\\s*\\+\\s*Short-Term Investments|Cash and Short-Term Investments|เงินสด(?:และตราสารหนี้|รวมเงินลงทุน|และเงินลงทุน)ระยะสั้น)',snapshot.balanceSheet?.totalCashAndInvestments);
  money('(?:Total Debt|Canonical Debt|หนี้สินที่มีภาระดอกเบี้ย|หนี้สินทางการเงินรวม)',snapshot.balanceSheet?.totalDebt);
  // Match Forward as part of the token so a trailing P/E replacement cannot
  // overwrite a consensus forward P/E, including Thai connective wording.
  const multiples=/(Forward\s*P\/E|Trailing\s*P\/E|P\/E|PEG(?:\s*Ratio)?)([^\d;\n]{0,35}?)([-+]?\d+(?:\.\d+)?)\s*(เท่า|x|times)/gi;
  return text.replace(multiples,(_match,label,join,_amount,unit)=>{
    const fact=/PEG/i.test(label)?snapshot.marketMultiples?.peg:/Forward/i.test(label)?snapshot.marketMultiples?.peForward:snapshot.marketMultiples?.peTrailing;
    const value=fact?.value ?? (/Forward/i.test(label)?snapshot.market.peForward:/PEG/i.test(label)?null:snapshot.market.peTrailing);
    return finite(value) && value>0 ? `${label}${join}${Number(value.toFixed(2))} ${unit}`
      : `${label} (${isThai?'ไม่มีฐานข้อมูลที่เหมาะกับการเปรียบเทียบ':'unavailable or not meaningful on a compatible basis'})`;
  });
}

export function reconcileExecutiveSummary(
  summaryText: string,
  snapshot: CanonicalExecutiveSnapshot,
  isThai = true
): string {
  if (!summaryText || typeof summaryText !== 'string') return summaryText;

  let text = summaryText;

  // 1. Qualitative Leadership / Superlative Language Integrity (Section 3-5)
  // Soften ranking/superlative claims only when structured market leadership evidence is absent
  if (!snapshot.evidence?.hasVerifiedMarketLeadership) {
    // English softening
    text = text.replace(
      /\b(?:is\s+(?:a|the)\s+)?global\s+leader\s+in\s+EVs\b/gi,
      'is one of the major global EV manufacturers'
    );
    text = text.replace(
      /\b(?:is\s+(?:a|the)\s+)?global\s+leader\s+(?:in|of)\b/gi,
      'is one of the major global players in'
    );
    text = text.replace(
      /\b(?:is\s+(?:a|the)\s+)?market\s+leader\s+(?:in|of)\b/gi,
      'is a leading participant in'
    );
    text = text.replace(
      /\ba\s+global\s+leader\b/gi,
      'a major global player'
    );
    text = text.replace(
      /\bthe\s+global\s+leader\b/gi,
      'a major global player'
    );
    text = text.replace(
      /\b(?:a|the)\s+dominant\s+player\s+(?:in|of)\b/gi,
      'a major player in'
    );
    text = text.replace(
      /\bdominant\s+player\s+(?:in|of)\b/gi,
      'major player in'
    );
    text = text.replace(
      /\bbest-in-class\b/gi,
      'strong'
    );
    text = text.replace(
      /\bindustry-leading\b/gi,
      'notable'
    );
    text = text.replace(
      /\bstrongest\s+balance\s+sheet\b/gi,
      'strong balance sheet'
    );

    // Thai softening
    text = text.replace(
      /(?:เป็น)?ผู้นำระดับโลก(?:ใน|ด้าน)\s*(?:ยานยนต์ไฟฟ้า|EV)/gi,
      'เป็นหนึ่งในผู้ผลิตยานยนต์ไฟฟ้ารายสำคัญระดับโลก'
    );
    text = text.replace(
      /(?:เป็น)?ผู้นำระดับโลก(?:ใน|ด้าน)/gi,
      'เป็นหนึ่งในผู้เล่นรายสำคัญระดับโลกด้าน'
    );
    text = text.replace(
      /(?:เป็น)?ผู้นำตลาด(?:ใน|ด้าน)/gi,
      'เป็นหนึ่งในผู้เล่นชั้นนำด้าน'
    );
    text = text.replace(
      /ผู้เล่นที่ครองตลาด/gi,
      'ผู้เล่นรายใหญ่ในตลาด'
    );
    text = text.replace(
      /ดีที่สุดในอุตสาหกรรม/gi,
      'อยู่ในระดับแข็งแกร่งของอุตสาหกรรม'
    );
    text = text.replace(
      /ชั้นนำที่สุดในอุตสาหกรรม/gi,
      'ชั้นนำในอุตสาหกรรม'
    );
    text = text.replace(
      /งบการเงินที่แข็งแกร่งที่สุด/gi,
      'งบการเงินที่แข็งแกร่ง'
    );
  }

  // 2. Reconcile DCF / Base Case / Canonical Valuation narrative
  text = reconcileBaseValuationNarrative(text, snapshot, isThai);

  // 2B. Negative Margin of Safety Wording (Section 9 & 10)
  const canonicalFv = snapshot.canonicalValuation?.baseFairValue ?? snapshot.valuation?.fairValue ?? null;
  const mosPct = snapshot.valuation.marginOfSafetyPct ?? snapshot.canonicalValuation?.marginOfSafetyPct ?? (
    finite(canonicalFv) && finite(snapshot.market.currentPrice) && snapshot.market.currentPrice > 0
      ? ((canonicalFv - snapshot.market.currentPrice) / snapshot.market.currentPrice) * 100
      : null
  );

  if (finite(mosPct) && mosPct < -2) {
    const mosAbs = Math.abs(mosPct).toFixed(1);
    if (isThai) {
      text = text.replace(
        /(?:มี\s*)?Margin\s*of\s*Safety\s*(?:ต่ำ|ค่อนข้างต่ำ|แคบ|จำกัด)/gi,
        `ราคาตลาดสูงกว่ามูลค่าพื้นฐาน ทำให้ Margin of Safety เป็นลบ (ติดลบประมาณ ${mosAbs}%)`
      );
    } else {
      text = text.replace(
        /(?:(?:has\s+)?a\s+)?(?:low|narrow|limited)\s*Margin\s*of\s*Safety|Margin\s*of\s*Safety\s*is\s*(?:low|narrow|limited)/gi,
        `a negative Margin of Safety of approximately -${mosAbs}%, trading at a premium over intrinsic value`
      );
    }
  }

  // 3. Reconcile Current Market Price
  const canonicalPrice = snapshot.market.currentPrice;
  if (finite(canonicalPrice)) {
    const priceFormatted = canonicalPrice.toFixed(2);
    text = text.replace(
      /(ราคาปัจจุบัน(?:ที่)?|current(?:\s*market)?\s*price(?:\s*(?:is|of|at))?|ซื้อขายที่)\s*(?:\$)?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*(ดอลลาร์|\$|USD)?/gi,
      (match, prefix, num, unit) => {
        const u = unit ? ` ${unit}` : (isThai ? ' ดอลลาร์' : '');
        return `${prefix} ${priceFormatted}${u}`;
      }
    );
  }

  // 4. Reconcile P/E ratio
  const isPreProfit = snapshot.identity.archetype === 'early_stage';
  const canonicalPe = snapshot.market.peTrailing;
  if (isPreProfit || (typeof canonicalPe === 'number' && canonicalPe <= 0)) {
    // Pre-profit: suppress misleading P/E claims
    text = text.replace(
      /(?:คิดเป็น\s*)?P\/E(?:\s*(?:สูงถึง|อยู่ที่|คือ|at|of))?\s*[-0-9.]+\s*(?:เท่า|x|times)?/gi,
      isThai ? 'ยังไม่มีกำไรสุทธิ (Pre-profit) จึงไม่ใช้ P/E เป็นเกณฑ์หลัก' : 'Pre-profit stage; P/E is not economically meaningful'
    );
  } else if (finite(canonicalPe)) {
    const peFormatted = Math.round(canonicalPe).toString();
    text = text.replace(
      /(P\/E(?:\s*(?:สูงถึง|อยู่ที่|คือ|at|of))?)\s*([0-9]+(?:\.[0-9]+)?)\s*(เท่า|x|times)/gi,
      (match, prefix, num, unit) => `${prefix} ${peFormatted} ${unit}`
    );
  }

  // 5. SOTP Integrity:
  if (!snapshot.valuation.sotpModel) {
    text = text.replace(
      /(ตามวิธี\s*Sum-of-the-Parts\s*\(SOTP\)|ตามการประเมินมูลค่าส่วนธุรกิจ\s*\(SOTP\)|Sum-of-the-Parts\s*\(SOTP\))\s*(?:ที่|at)?\s*(?:\$)?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*(?:ดอลลาร์|\$|USD)?/gi,
      `$1`
    );
  } else if (snapshot.valuation.sotpModel.valuePerShare) {
    const sotpFormatted = snapshot.valuation.sotpModel.valuePerShare.toFixed(2);
    text = text.replace(
      /(ตามวิธี\s*Sum-of-the-Parts\s*\(SOTP\)|ตามการประเมินมูลค่าส่วนธุรกิจ\s*\(SOTP\)|Sum-of-the-Parts\s*\(SOTP\))\s*(?:ที่|at)?\s*(?:\$)?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*(ดอลลาร์|\$|USD)?/gi,
      (match, prefix, num, unit) => `${prefix} ${isThai ? 'ที่ ' : 'at $'}${sotpFormatted}${unit ? ` ${unit}` : (isThai ? ' ดอลลาร์' : '')}`
    );
  }

  // 6. Period Semantics & Growth:
  if (isThai) {
    text = text.replace(
      /(รายได้รอบ\s*12\s*เดือน|รายได้รวม\s*TTM)(?:ทะลุ|อยู่ที่)?\s*([0-9,]+)\s*(?:ล้านดอลลาร์(?:สหรัฐ)?)?\s*(?:เติบโต|โต)\s*([0-9.]+)%\s*YoY/gi,
      (match, prefix, revVal, growthVal) => {
        return `${prefix} ${revVal} ล้านดอลลาร์สหรัฐ ขณะที่รายได้ไตรมาสล่าสุดเติบโต ${growthVal}% YoY`;
      }
    );
  } else {
    text = text.replace(
      /(TTM\s*revenue|trailing\s*12-month\s*revenue)(?:\s*of)?\s*(?:\$)?([0-9,]+)\s*(?:M(?:illion)?(?: USD)?)?\s*grew\s*([0-9.]+)%\s*YoY/gi,
      (match, prefix, revVal, growthVal) => {
        return `${prefix} was $${revVal}M, while latest-quarter revenue grew ${growthVal}% YoY`;
      }
    );
  }

  // 7. Cross-Sector Semantics (Section 21-26)
  // For Bank / Lender: sanitize corporate FCF and Current Ratio claims
  if (snapshot.identity.archetype === 'bank' || snapshot.identity.archetype === 'lender') {
    text = text.replace(
      /(?:โดยมี|พร้อม)?กระแสเงินสดอิสระ\s*\(FCF\)[^,.\n]*(?:ล้านดอลลาร์)?/gi,
      'ฐานเงินฝากและโครงสร้างเงินทุนมีความมั่นคง'
    );
    text = text.replace(
      /(?:with|generating)\s*free\s*cash\s*flow[^,.\n]*/gi,
      'supported by a stable funding and deposit profile'
    );
  }

  return reconcileCanonicalFlowAndMultipleNarrative(reconcileCurrentBalanceSheetNarrative(text, snapshot, isThai),snapshot,isThai);
}

/**
 * Reconciles Key Takeaways against final canonical facts.
 * - Synchronizes DCF fair value and market price
 * - Synchronizes technical trade plan strictly with final structured Technical Analysis
 * - Softens unsupported superlative/leadership claims when verified evidence is absent
 * - Strips unsupported standalone SOTP dollar values
 * - Enforces cross-sector semantics (e.g. no corporate FCF for banks)
 */
export function reconcileKeyTakeaways(
  takeaways: string[],
  snapshot: CanonicalExecutiveSnapshot,
  isThai = true
): string[] {
  if (!Array.isArray(takeaways)) return takeaways;

  return takeaways.map(takeaway => {
    let text = takeaway;

    // 1. Qualitative Leadership / Superlative Language Integrity (Section 3-5)
    if (!snapshot.evidence?.hasVerifiedMarketLeadership) {
      // English softening
      text = text.replace(/\b(?:is\s+(?:a|the)\s+)?global\s+leader\s+in\s+EVs\b/gi, 'is one of the major global EV manufacturers');
      text = text.replace(/\b(?:is\s+(?:a|the)\s+)?global\s+leader\s+(?:in|of)\b/gi, 'is one of the major global players in');
      text = text.replace(/\b(?:is\s+(?:a|the)\s+)?market\s+leader\s+(?:in|of)\b/gi, 'is a leading participant in');
      text = text.replace(/\ba\s+global\s+leader\b/gi, 'a major global player');
      text = text.replace(/\bthe\s+global\s+leader\b/gi, 'a major global player');
      text = text.replace(/\b(?:a|the)\s+dominant\s+player\s+(?:in|of)\b/gi, 'a major player in');
      text = text.replace(/\bdominant\s+player\s+(?:in|of)\b/gi, 'major player in');
      text = text.replace(/\bbest-in-class\b/gi, 'strong');
      text = text.replace(/\bindustry-leading\b/gi, 'notable');
      text = text.replace(/\bstrongest\s+balance\s+sheet\b/gi, 'strong balance sheet');

      // Thai softening
      text = text.replace(/(?:เป็น)?ผู้นำระดับโลก(?:ใน|ด้าน)\s*(?:ยานยนต์ไฟฟ้า|EV)/gi, 'เป็นหนึ่งในผู้ผลิตยานยนต์ไฟฟ้ารายสำคัญระดับโลก');
      text = text.replace(/(?:เป็น)?ผู้นำระดับโลก(?:ใน|ด้าน)/gi, 'เป็นหนึ่งในผู้เล่นรายสำคัญระดับโลกด้าน');
      text = text.replace(/(?:เป็น)?ผู้นำตลาด(?:ใน|ด้าน)/gi, 'เป็นหนึ่งในผู้เล่นชั้นนำด้าน');
      text = text.replace(/ผู้เล่นที่ครองตลาด/gi, 'ผู้เล่นรายใหญ่ในตลาด');
      text = text.replace(/ดีที่สุดในอุตสาหกรรม/gi, 'อยู่ในระดับแข็งแกร่งของอุตสาหกรรม');
      text = text.replace(/ชั้นนำที่สุดในอุตสาหกรรม/gi, 'ชั้นนำในอุตสาหกรรม');
      text = text.replace(/งบการเงินที่แข็งแกร่งที่สุด/gi, 'งบการเงินที่แข็งแกร่ง');
    }

    // 2. Reconcile DCF / Base Case / Canonical Valuation narrative in Takeaways
    text = reconcileBaseValuationNarrative(text, snapshot, isThai);

    // 2B. Negative Margin of Safety Wording in Takeaways
    const canonicalFv = snapshot.canonicalValuation?.baseFairValue ?? snapshot.valuation?.fairValue ?? null;
    const mosPct = snapshot.valuation.marginOfSafetyPct ?? snapshot.canonicalValuation?.marginOfSafetyPct ?? (
      finite(canonicalFv) && finite(snapshot.market.currentPrice) && snapshot.market.currentPrice > 0
        ? ((canonicalFv - snapshot.market.currentPrice) / snapshot.market.currentPrice) * 100
        : null
    );

    if (finite(mosPct) && mosPct < -2) {
      const mosAbs = Math.abs(mosPct).toFixed(1);
      if (isThai) {
        text = text.replace(
          /(?:มี\s*)?Margin\s*of\s*Safety\s*(?:ต่ำ|ค่อนข้างต่ำ|แคบ|จำกัด)/gi,
          `ราคาตลาดสูงกว่ามูลค่าพื้นฐาน ทำให้ Margin of Safety เป็นลบ (ติดลบประมาณ ${mosAbs}%)`
        );
      } else {
        text = text.replace(
          /(?:(?:has\s+)?a\s+)?(?:low|narrow|limited)\s*Margin\s*of\s*Safety|Margin\s*of\s*Safety\s*is\s*(?:low|narrow|limited)/gi,
          `a negative Margin of Safety of approximately -${mosAbs}%, trading at a premium over intrinsic value`
        );
      }
    }

    // 3. Reconcile Current Market Price
    const canonicalPrice = snapshot.market.currentPrice;
    if (finite(canonicalPrice)) {
      const priceFormatted = canonicalPrice.toFixed(2);
      text = text.replace(
        /(ราคาปัจจุบัน(?:ที่)?|current(?:\s*market)?\s*price(?:\s*(?:is|of|at))?|ซื้อขายที่)\s*(?:\$)?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*(ดอลลาร์|\$|USD)?/gi,
        (match, prefix, num, unit) => {
          const u = unit ? ` ${unit}` : (isThai ? ' ดอลลาร์' : '');
          return `${prefix} ${priceFormatted}${u}`;
        }
      );
    }

    // 4. SOTP Integrity in Takeaways:
    if (!snapshot.valuation.sotpModel) {
      text = text.replace(
        /(ตามวิธี\s*Sum-of-the-Parts\s*\(SOTP\)|ตามการประเมินมูลค่าส่วนธุรกิจ\s*\(SOTP\)|Sum-of-the-Parts\s*\(SOTP\))\s*(?:ที่|at)?\s*(?:\$)?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*(?:ดอลลาร์|\$|USD)?/gi,
        `$1`
      );
    } else if (snapshot.valuation.sotpModel.valuePerShare) {
      const sotpFormatted = snapshot.valuation.sotpModel.valuePerShare.toFixed(2);
      text = text.replace(
        /(ตามวิธี\s*Sum-of-the-Parts\s*\(SOTP\)|ตามการประเมินมูลค่าส่วนธุรกิจ\s*\(SOTP\)|Sum-of-the-Parts\s*\(SOTP\))\s*(?:ที่|at)?\s*(?:\$)?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*(ดอลลาร์|\$|USD)?/gi,
        (match, prefix, num, unit) => `${prefix} ${isThai ? 'ที่ ' : 'at $'}${sotpFormatted}${unit ? ` ${unit}` : (isThai ? ' ดอลลาร์' : '')}`
      );
    }

    // 5. Period Semantics in Growth Takeaway:
    if (isThai) {
      text = text.replace(
        /(รายได้รวม\s*TTM|รายได้\s*TTM)(?:\s*ทะลุ|\s*อยู่ที่)?\s*([0-9,]+)\s*(?:ล้านดอลลาร์(?:สหรัฐ)?)?\s*(?:เติบโต|โต)\s*([0-9.]+)%\s*YoY/gi,
        (match, prefix, revVal, growthVal) => {
          return `${prefix} อยู่ที่ ${revVal} ล้านดอลลาร์ ขณะที่รายได้ไตรมาสล่าสุดเติบโต ${growthVal}% YoY`;
        }
      );
    } else {
      text = text.replace(
        /(TTM\s*revenue|revenue\s*TTM)(?:\s*of)?\s*(?:\$)?([0-9,]+)\s*(?:M(?:illion)?(?: USD)?)?\s*(?:grew|growth of)\s*([0-9.]+)%\s*YoY/gi,
        (match, prefix, revVal, growthVal) => {
          return `${prefix} was $${revVal}M, while latest-quarter revenue grew ${growthVal}% YoY`;
        }
      );
    }

    // 6. Technical Setup / Trade Plan Synchronization (Section 6-9)
    const isValuationTakeaway = /(?:base\s*case|fair\s*value|DCF|intrinsic\s*value|มูลค่าพื้นฐาน|มูลค่ายุติธรรม)/i.test(text);
    const isTechnicalTakeaway = !isValuationTakeaway &&
      /(?:สัญญาณทางเทคนิค|กลยุทธ์ทางเทคนิค|แผนการเทรด|จุดเข้า|Stop\s*Loss|Target\s*(?:1|2|แรก|ที่\s*[12])|Technical\s*Target|เป้าหมายทางเทคนิค|แนวรับ|แนวต้าน|ซื้อเมื่อย่อตัว|Buy\s*on\s*Dip|Technical(?:\s*setup|\s*strategy)?|Trade\s*Plan|Entry(?:\s*Zone)?)/i.test(text);

    if (isTechnicalTakeaway) {
      const tp = snapshot.technicalPlan;
      if (tp && tp.hasStructuredPlan) {
        // Synchronize Entry Zone
        if (tp.entryZone) {
          text = text.replace(
            /(จุดเข้า(?:\s*(?:ซื้อ|โซน|ที่))?|entry(?:\s*zone)?(?:\s*(?:is|at))?)\s*(?:\$)?([0-9]+(?:\.[0-9]+)?(?:\s*-\s*(?:\$)?[0-9]+(?:\.[0-9]+)?)?)/gi,
            `$1 $${tp.entryZone}`
          );
        }
        // Synchronize Stop Loss
        if (tp.stopLoss) {
          text = text.replace(
            /(Stop\s*Loss(?:\s*(?:ที่|at))?|จุดตัดขาดทุน(?:\s*ที่)?)\s*(?:\$)?([0-9]+(?:\.[0-9]+)?)/gi,
            `$1 $${tp.stopLoss}`
          );
        }
        // Synchronize Target 1
        if (tp.target1) {
          text = text.replace(
            /(Target\s*(?:1|แรก)?(?:\s*(?:ที่|at))?|เป้าหมาย(?:\s*(?:แรก|ที่\s*1))?(?:\s*ที่)?)\s*(?:\$)?([0-9]+(?:\.[0-9]+)?)/gi,
            `$1 $${tp.target1}`
          );
        }
        // Synchronize Target 2
        if (tp.target2) {
          text = text.replace(
            /(Target\s*2(?:\s*(?:ที่|at))?|เป้าหมาย(?:\s*ที่\s*2)?(?:\s*ที่)?)\s*(?:\$)?([0-9]+(?:\.[0-9]+)?)/gi,
            `$1 $${tp.target2}`
          );
        }
      } else {
        // NO STRUCTURED TECHNICAL PLAN = NO EXACT PRICE LEVELS (Section 8)
        if (/[0-9]+/.test(text)) {
          text = isThai
            ? 'สัญญาณทางเทคนิคยังอยู่ในช่วงรอดูความชัดเจน รอสัญญาณจุดเข้าและแนวรับที่ชัดเจน'
            : 'Technical setup remains neutral pending a clearer entry signal.';
        }
      }
    }

    // 7. Cross-Sector Invariant: Bank / Lender avoids corporate FCF claims
    if (snapshot.identity.archetype === 'bank' || snapshot.identity.archetype === 'lender') {
      text = text.replace(
        /(?:โดยมี|พร้อม)?กระแสเงินสดอิสระ\s*\(FCF\)[^,.\n]*(?:ล้านดอลลาร์)?/gi,
        'ฐานเงินฝากและโครงสร้างเงินทุนมีความมั่นคง'
      );
      text = text.replace(
        /(?:with|generating)\s*free\s*cash\s*flow[^,.\n]*/gi,
        'supported by a stable funding and deposit profile'
      );
    }

    return reconcileCanonicalFlowAndMultipleNarrative(reconcileCurrentBalanceSheetNarrative(text, snapshot, isThai),snapshot,isThai);
  });
}

/**
 * Validates Section 1 integrity across Header, Summary, Takeaways, Intrinsic Value, and Conviction.
 */
export function validateSection1Integrity(
  report: Partial<ReportData>,
  ticker?: string
): { isValid: boolean; issues: string[]; details: Record<string, any> } {
  const issues: string[] = [];
  const sym = (ticker || report.ticker || 'STOCK').toUpperCase().trim();
  const fresh = buildCanonicalExecutiveSnapshot(report, sym);
  const persisted = report.canonical_executive_snapshot;
  const snapshot = persisted ? {
    ...fresh, ...persisted,
    balanceSheet: fresh.balanceSheet,
    currentBalanceSheetSnapshot: fresh.currentBalanceSheetSnapshot,
    balanceSheetFacts: fresh.balanceSheetFacts,
    facts: { ...persisted.facts, ...fresh.facts,
      totalCashAndInvestments: fresh.facts.totalCashAndInvestments,
      totalDebt: fresh.facts.totalDebt, netCash: fresh.facts.netCash },
  } : fresh;

  const headerPrice = snapshot.market?.currentPrice ?? snapshot.valuation?.currentPrice ?? null;
  const headerFairValue = snapshot.canonicalValuation?.baseFairValue ?? snapshot.valuation?.fairValue ?? null;
  const convictionScore = snapshot.conviction?.score ?? null;

  // 1. Check Executive Summary consistency with Canonical Base Valuation
  const summary = report.verdict?.summary || '';
  const mentionedBaseValue = extractBaseValuationMentionedValue(summary);
  if (summary && finite(headerFairValue)) {
    if (finite(mentionedBaseValue) && Math.abs(mentionedBaseValue - headerFairValue) > 0.05) {
      issues.push(`Executive Summary mentions base valuation value ${mentionedBaseValue} which conflicts with canonical Fair Value ${headerFairValue}`);
    }
  }

  const canonicalMos=snapshot.canonicalValuation?.marginOfSafetyPct??snapshot.valuation.marginOfSafetyPct;
  for(const [label,prose] of [['Executive Summary',summary],...(report.verdict?.key_takeaways??[]).map((item,i)=>[`Key Takeaway #${i+1}`,item])] as Array<[string,string]>) {
    for(const claim of prose.matchAll(currentMosClaimPattern(true))) {
      if(!hasExternalValuationAttribution(prose,claim.index!)&&finite(canonicalMos)&&Math.abs(Number(claim[2])-canonicalMos)>0.05)
        issues.push(`${label} mentions Margin of Safety ${claim[2]} which conflicts with canonical Margin of Safety ${canonicalMos}`);
    }
  }

  // 1B. Check Current Price consistency in Summary
  if (summary && finite(headerPrice)) {
    const priceMatch = summary.match(/(?:ราคาปัจจุบัน|current(?:\s*market)?\s*price|ซื้อขายที่)\s*(?:\$)?([0-9]+(?:\.[0-9]+)?)/i);
    if (priceMatch && priceMatch[1]) {
      const parsedPrice = parseFloat(priceMatch[1]);
      if (finite(parsedPrice) && Math.abs(parsedPrice - headerPrice) > 1.0) {
        issues.push(`Executive Summary mentions Price ${parsedPrice} which conflicts with canonical Market Price ${headerPrice}`);
      }
    }
  }

  // 2. Check Key Takeaways consistency
  const takeaways = report.verdict?.key_takeaways || [];
  if (Array.isArray(takeaways)) {
    for (let i = 0; i < takeaways.length; i++) {
      const item = takeaways[i];

      // Base Fair Value check
      if (finite(headerFairValue)) {
        const itemMentioned = extractBaseValuationMentionedValue(item);
        if (finite(itemMentioned) && Math.abs(itemMentioned - headerFairValue) > 0.05) {
          issues.push(`Key Takeaway #${i + 1} mentions base valuation value ${itemMentioned} which conflicts with canonical Fair Value ${headerFairValue}`);
        }
      }

      // Current Price check
      if (finite(headerPrice)) {
        const priceMatch = item.match(/(?:ราคาปัจจุบัน|current(?:\s*market)?\s*price|ซื้อขายที่)\s*(?:\$)?([0-9]+(?:\.[0-9]+)?)/i);
        if (priceMatch && priceMatch[1]) {
          const parsedPrice = parseFloat(priceMatch[1]);
          if (finite(parsedPrice) && Math.abs(parsedPrice - headerPrice) > 1.0) {
            issues.push(`Key Takeaway #${i + 1} mentions Price ${parsedPrice} which conflicts with canonical Market Price ${headerPrice}`);
          }
        }
      }

      // Check SOTP without structured model
      if (!snapshot.valuation.sotpModel && /(?:SOTP|Sum-of-the-Parts|ส่วนธุรกิจ)[^.\n]*?(?:ที่|at)?\s*(?:\$)?([0-9]+(?:\.[0-9]+)?)\s*(?:ดอลลาร์|\$|USD)/i.test(item)) {
        issues.push(`Key Takeaway #${i + 1} presents an unsupported numeric SOTP claim without a structured SOTP model`);
      }

      // Technical consistency (Section 29)
      const isValuationItem = /(?:base\s*case|fair\s*value|DCF|intrinsic\s*value|มูลค่าพื้นฐาน|มูลค่ายุติธรรม)/i.test(item);
      const isTechItem = !isValuationItem &&
        /(?:สัญญาณทางเทคนิค|กลยุทธ์ทางเทคนิค|จุดเข้า|Stop\s*Loss|Target\s*(?:1|2|แรก|ที่\s*[12])|Technical\s*Target|เป้าหมายทางเทคนิค|Buy\s*on\s*Dip|Technical)/i.test(item);
      if (isTechItem) {
        if (!snapshot.technicalPlan?.hasStructuredPlan) {
          if (/[0-9]+/.test(item)) {
            issues.push(`Key Takeaway #${i + 1} contains exact technical price levels without a structured Technical Analysis plan`);
          }
        } else {
          // If structured plan exists, verify entry/stop consistency
          const entryMatch = item.match(/(?:จุดเข้า|entry(?:\s*zone)?)\s*(?:\$)?([0-9]+(?:\.[0-9]+)?)/i);
          if (entryMatch && entryMatch[1] && snapshot.technicalPlan.entryZone) {
            const parsedEntry = parseFloat(entryMatch[1]);
            const targetEntry = parseFloat(snapshot.technicalPlan.entryZone);
            if (finite(parsedEntry) && finite(targetEntry) && Math.abs(parsedEntry - targetEntry) > 1.0) {
              issues.push(`Key Takeaway #${i + 1} mentions Entry ${parsedEntry} conflicting with technical plan ${targetEntry}`);
            }
          }
        }
      }

      // Qualitative Leadership without evidence
      if (!snapshot.evidence?.hasVerifiedMarketLeadership) {
        if (/\b(?:global\s+leader|market\s+leader|dominant\s+player|best-in-class|ผู้นำระดับโลก|ผู้นำตลาด)\b/i.test(item)) {
          issues.push(`Key Takeaway #${i + 1} contains unsubstantiated market leadership claims without verified evidence`);
        }
      }
    }
  }

  // 3. Margin of Safety vs Premium
  if (finite(snapshot.valuation.marginOfSafetyPct) && snapshot.valuation.marginOfSafetyPct < 0) {
    if (summary.includes('Premium over Fair Value') && !summary.includes('Margin of Safety')) {
      issues.push('Executive summary uses misleading Premium terminology for negative Margin of Safety');
    }
  }

  // 4. Qualitative Leadership in Summary without evidence
  if (!snapshot.evidence?.hasVerifiedMarketLeadership) {
    if (/\b(?:global\s+leader|market\s+leader|dominant\s+player|best-in-class|ผู้นำระดับโลก|ผู้นำตลาด)\b/i.test(summary)) {
      issues.push('Executive Summary contains unsubstantiated market leadership claims without verified evidence');
    }
  }

  // 5. Cross-sector safety: Bank/Lender should not emphasize corporate FCF
  if (snapshot.identity.archetype === 'bank' || snapshot.identity.archetype === 'lender') {
    if (/(?:Free\s*Cash\s*Flow|FCF|กระแสเงินสดอิสระ)/i.test(summary)) {
      issues.push('Bank / Lender Executive Summary erroneously emphasizes corporate FCF');
    }
  }

  // 6. Base Case target assertion (Section 3 & 8)
  if (summary && finite(headerFairValue)) {
    const baseCaseMatch = summary.match(/(?:Base\s*Case(?:\s*target)?|มูลค่าพื้นฐาน\s*Base\s*Case)\s*(?:=|:|คือ|อยู่ที่|is|at)?\s*(?:\$)?([0-9]+(?:\.[0-9]+)?)/i);
    if (baseCaseMatch && baseCaseMatch[1] && !hasExternalValuationAttribution(summary,baseCaseMatch.index!)) {
      const parsedBc = parseFloat(baseCaseMatch[1]);
      if (finite(parsedBc) && Math.abs(parsedBc - headerFairValue) > 0.05) {
        issues.push(`Executive Summary mentions Base Case target ${parsedBc} which conflicts with canonical Fair Value ${headerFairValue}`);
      }
    }
  }

  // 7. Technical target masquerading as Base Case (Section 4)
  const techT1 = snapshot.technicalPlan?.target1 ? parseFloat(snapshot.technicalPlan.target1.replace(/[^0-9.]/g, '')) : null;
  if (summary && finite(techT1) && (!finite(headerFairValue) || Math.abs(techT1 - headerFairValue) > 1.0)) {
    const techAsBaseMatch = summary.match(new RegExp(`Base\\s*Case[^.\\n]*?(${techT1})`, 'i'));
    if (techAsBaseMatch && !hasExternalValuationAttribution(summary,techAsBaseMatch.index!)) {
      issues.push(`Technical target ${techT1} must not be labeled as Base Case Fair Value`);
    }
  }

  // 8. Negative Margin of Safety description (Section 9)
  if (finite(snapshot.valuation.marginOfSafetyPct) && snapshot.valuation.marginOfSafetyPct < -5) {
    if (/(?:Margin\s*of\s*Safety\s*(?:ต่ำ|ค่อนข้างต่ำ|แคบ)|(?:low|narrow)\s*Margin\s*of\s*Safety)/i.test(summary) &&
        !/(?:เป็นลบ|ติดลบ|negative)/i.test(summary)) {
      issues.push('Executive Summary describes negative Margin of Safety merely as low without stating it is negative');
    }
  }

  // 9. Non-DCF archetype assertion: Executive Summary must not manufacture DCF valuation claims
  const isNonDcf = snapshot.identity.archetype === 'bank'
    || snapshot.identity.archetype === 'lender'
    || snapshot.identity.archetype === 'insurer'
    || snapshot.identity.archetype === 'reit'
    || snapshot.identity.archetype === 'early_stage'
    || snapshot.canonicalValuation?.modelType === 'ddm'
    || snapshot.canonicalValuation?.modelType === 'reit_affo'
    || snapshot.canonicalValuation?.modelType === 'relative_only';

  if (isNonDcf && summary) {
    const claimedDcf = [...summary.matchAll(/(?:DCF\s*base\s*case|DCF\s*fair\s*value|DCF\s*target|มูลค่า\s*DCF|ประเมินด้วย\s*DCF|DCF\s*=\s*\$?[0-9.]+)/gi)]
      .some(claim => !hasExternalValuationAttribution(summary,claim.index!));
    if (claimedDcf) {
      issues.push(`Executive Summary for non-DCF archetype (${snapshot.identity.archetype}) must not manufacture a DCF valuation label`);
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    details: {
      headerPrice,
      headerFairValue,
      convictionScore,
      archetype: snapshot.identity.archetype,
      modelType: snapshot.canonicalValuation?.modelType || snapshot.valuation.modelType,
      canonicalBaseFairValue: headerFairValue,
      baseDcfMentionedValue: mentionedBaseValue,
      summaryBaseMentionedValue: mentionedBaseValue,
    },
  };
}
