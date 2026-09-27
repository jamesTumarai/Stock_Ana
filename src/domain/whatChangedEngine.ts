import { ResearchMemorySnapshot, compareMemorySnapshots } from './investmentMemory';
import {
  TrackedExpectation,
  evaluateExpectations,
  matchRiskCatalystTransitions,
  TrackedItemTransition
} from './thesisExpectations';
import {
  reconcileSubjectLifecycles,
  ReconciledSubjectTransition
} from './semanticSubjectMatcher';
import { calculateStrictDCFValue } from '../utils/valuation/dcfMathEngine';

export type ChangeCategory =
  | 'VALUATION'
  | 'FINANCIAL_FACTS'
  | 'MARKET_PRICE'
  | 'CONVICTION'
  | 'THESIS'
  | 'EXPECTATIONS'
  | 'RISKS_AND_CATALYSTS'
  | 'SEC_FILING';

export type ChangeDomain =
  | 'EVIDENCE_CHANGE'
  | 'THESIS_MODEL_CHANGE'
  | 'RESEARCH_COVERAGE_CHANGE'
  | 'MARKET_CONTEXT_CHANGE'
  | 'DATA_CORRECTION'
  | 'SOURCE_UPGRADE'
  | 'ANALYSIS_DRIFT'
  | 'RESTATED_EVIDENCE';

export type ChangeConfirmation =
  | 'CONFIRMED'
  | 'SUPPORTED'
  | 'UNCONFIRMED'
  | 'RESEARCH_ONLY';

export type ChangeSemanticType =
  | 'NEW_REAL_WORLD_EVIDENCE'
  | 'RESTATED_OR_AMENDED_EVIDENCE'
  | 'MARKET_CONTEXT_CHANGE'
  | 'MODEL_ASSUMPTION_CHANGE'
  | 'DATA_CORRECTION_OR_NORMALIZATION_CHANGE'
  | 'SOURCE_UPGRADE'
  | 'ANALYSIS_OUTPUT_DRIFT'
  | 'RESEARCH_COVERAGE_CHANGE'
  | 'VALUATION_MODEL_OUTPUT_CHANGE'
  | 'DERIVED_OUTPUT_CHANGE'
  | 'VALUATION_MODEL_SWITCH';

export type DriftSubtype = 'PROSE_COVERAGE' | 'ANALYSIS_MODEL_DRIFT';

export type ChangeMateriality = 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';

export interface ChangeItem {
  id: string;
  category: ChangeCategory;
  domain: ChangeDomain;
  confirmation: ChangeConfirmation;
  driftSubtype?: DriftSubtype;
  semanticType?: ChangeSemanticType;
  metricLabel: string;
  metricLabelTh: string;
  previousValue: string | number | null;
  currentValue: string | number | null;
  deltaDisplay: string;
  materiality: ChangeMateriality;
  explanation: string;
  explanationTh: string;
  provenance: string;
  evidenceRef?: string | null;
  reviewReason?: string;
  reviewReasonTh?: string;
  debugMetadata?: Record<string, unknown>;
}

export interface ValuationAttribution {
  primaryDriver:
    | 'CASH_FLOW_AND_MARGINS'
    | 'GROWTH_EXPECTATIONS'
    | 'DISCOUNT_RATE'
    | 'CAPITAL_STRUCTURE'
    | 'SECTOR_MODEL_SWITCH'
    | 'UNCHANGED'
    | 'NO_MATERIAL_ATTRIBUTION'
    | 'UNAVAILABLE'
    | 'HEURISTIC_ASSOCIATION'
    | 'LIKELY_DRIVER'
    | 'ATTRIBUTION_INPUTS_INCOMPLETE'
    | 'MULTIPLE_MODEL_ASSUMPTIONS'
    | 'MIXED_MODEL_ASSUMPTIONS';
  impactDescription: string;
  impactDescriptionTh: string;
  isDeterministic: boolean;
  waterfall?: {
    observedDelta: number;
    cashFlowImpact?: number;
    growthImpact?: number;
    marginImpact?: number;
    discountRateImpact?: number;
    terminalGrowthImpact?: number;
    capitalStructureImpact?: number;
    dilutionImpact?: number;
    residualInteraction?: number;
  };
}

export interface WhatChangedSummary {
  totalDetected: number;
  confirmedMaterial: number;
  needsReview: number;
  researchCoverage: number;
  high: number;
  medium: number;
  low: number;
}

export interface WhatChangedResult {
  ticker: string;
  previousReportId: string;
  currentReportId: string;
  previousDate: string;
  currentDate: string;
  daysBetween: number;
  hasMaterialChanges: boolean;
  materialChangesCount: number;
  summary: WhatChangedSummary;
  items: ChangeItem[];
  valuationAttribution: ValuationAttribution | null;
  evaluatedExpectations: TrackedExpectation[];
  itemTransitions: TrackedItemTransition[];
  summaryNarrative: string;
  summaryNarrativeTh: string;
}

export interface SignedDeltaResult {
  deltaDisplay: string;
  deltaDisplayTh: string;
  semanticState: 'DETERIORATION' | 'TURNAROUND' | 'DEFICIT_EXPANDED' | 'DEFICIT_NARROWED' | 'GROWTH' | 'CONTRACTION' | 'UNCHANGED';
  explanationPhrase: string;
  explanationPhraseTh: string;
  rawDeltaPct?: number;
}

/**
 * Robust cross-zero and signed financial metric delta formatter.
 * Prevents misleading conventional growth percentages when crossing zero (e.g. +1264M -> -1092M is NOT -186%).
 */
export function formatSignedMetricDelta(
  previous: number,
  current: number,
  unit = 'M',
  isPercentage = false
): SignedDeltaResult {
  const prefix = isPercentage ? '' : '$';
  const suffix = isPercentage ? '%' : unit;

  if (previous > 0 && current < 0) {
    return {
      deltaDisplay: 'DETERIORATION (Pos → Neg)',
      deltaDisplayTh: 'ลดลงจนติดลบ (บวก → ลบ)',
      semanticState: 'DETERIORATION',
      explanationPhrase: `swung from positive (${prefix}${previous.toLocaleString()}${suffix}) to negative (-${prefix}${Math.abs(current).toLocaleString()}${suffix}) [DETERIORATION]`,
      explanationPhraseTh: `พลิกจากบวก (${prefix}${previous.toLocaleString()}${suffix}) กลายเป็นติดลบ (-${prefix}${Math.abs(current).toLocaleString()}${suffix}) [ผลการดำเนินงานถดถอย]`
    };
  }

  if (previous < 0 && current > 0) {
    return {
      deltaDisplay: 'TURNAROUND (Neg → Pos)',
      deltaDisplayTh: 'พลิกกลับมาเป็นบวก (ลบ → บวก)',
      semanticState: 'TURNAROUND',
      explanationPhrase: `turned around from negative (-${prefix}${Math.abs(previous).toLocaleString()}${suffix}) to positive (+${prefix}${current.toLocaleString()}${suffix}) [TURNAROUND]`,
      explanationPhraseTh: `พลิกฟื้นจากติดลบ (-${prefix}${Math.abs(previous).toLocaleString()}${suffix}) กลับมาเป็นบวก (+${prefix}${current.toLocaleString()}${suffix}) [พลิกฟื้นธุรกิจ]`
    };
  }

  if (previous < 0 && current < 0) {
    const diff = current - previous; // e.g. -200 - (-100) = -100 (wider deficit)
    if (diff < 0) {
      return {
        deltaDisplay: `DEFICIT EXPANDED (-${prefix}${Math.abs(diff).toLocaleString()}${suffix})`,
        deltaDisplayTh: `ขาดทุน/ติดลบเพิ่มขึ้น (-${prefix}${Math.abs(diff).toLocaleString()}${suffix})`,
        semanticState: 'DEFICIT_EXPANDED',
        explanationPhrase: `negative value expanded from -${prefix}${Math.abs(previous).toLocaleString()}${suffix} to -${prefix}${Math.abs(current).toLocaleString()}${suffix} (wider deficit by ${prefix}${Math.abs(diff).toLocaleString()}${suffix})`,
        explanationPhraseTh: `ตัวเลขติดลบขยายตัวเพิ่มขึ้นจาก -${prefix}${Math.abs(previous).toLocaleString()}${suffix} เป็น -${prefix}${Math.abs(current).toLocaleString()}${suffix} (ขาดดุลเพิ่มขึ้น ${prefix}${Math.abs(diff).toLocaleString()}${suffix})`
      };
    } else if (diff > 0) {
      return {
        deltaDisplay: `DEFICIT NARROWED (+${prefix}${diff.toLocaleString()}${suffix})`,
        deltaDisplayTh: `ขาดทุน/ติดลบลดลง (+${prefix}${diff.toLocaleString()}${suffix})`,
        semanticState: 'DEFICIT_NARROWED',
        explanationPhrase: `negative value narrowed from -${prefix}${Math.abs(previous).toLocaleString()}${suffix} to -${prefix}${Math.abs(current).toLocaleString()}${suffix} (reduced deficit by ${prefix}${diff.toLocaleString()}${suffix})`,
        explanationPhraseTh: `ตัวเลขติดลบลดลงจาก -${prefix}${Math.abs(previous).toLocaleString()}${suffix} เป็น -${prefix}${Math.abs(current).toLocaleString()}${suffix} (ขาดดุลลดลง ${prefix}${diff.toLocaleString()}${suffix})`
      };
    } else {
      return {
        deltaDisplay: 'UNCHANGED',
        deltaDisplayTh: 'ไม่เปลี่ยนแปลง',
        semanticState: 'UNCHANGED',
        explanationPhrase: `remained unchanged at -${prefix}${Math.abs(current).toLocaleString()}${suffix}`,
        explanationPhraseTh: `คงที่อยู่ที่ -${prefix}${Math.abs(current).toLocaleString()}${suffix}`
      };
    }
  }

  if (previous === 0) {
    const deltaDisplay = `${current >= 0 ? '+' : ''}${prefix}${current.toLocaleString()}${suffix} (from 0)`;
    return {
      deltaDisplay,
      deltaDisplayTh: deltaDisplay,
      semanticState: current >= 0 ? 'GROWTH' : 'DETERIORATION',
      explanationPhrase: `shifted from zero to ${current >= 0 ? '+' : ''}${prefix}${current.toLocaleString()}${suffix}`,
      explanationPhraseTh: `ปรับจากศูนย์เป็น ${current >= 0 ? '+' : ''}${prefix}${current.toLocaleString()}${suffix}`
    };
  }

  // Both positive: standard percentage growth allowed
  const deltaPct = ((current - previous) / Math.abs(previous)) * 100;
  return {
    deltaDisplay: `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%`,
    deltaDisplayTh: `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%`,
    semanticState: deltaPct >= 0 ? 'GROWTH' : 'CONTRACTION',
    explanationPhrase: `moved by ${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}% (${prefix}${previous.toLocaleString()}${suffix} → ${prefix}${current.toLocaleString()}${suffix})`,
    explanationPhraseTh: `เปลี่ยนแปลง ${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}% (${prefix}${previous.toLocaleString()}${suffix} → ${prefix}${current.toLocaleString()}${suffix})`,
    rawDeltaPct: deltaPct
  };
}

export interface FinancialFactClassification {
  domain: ChangeDomain;
  confirmation: ChangeConfirmation;
  semanticType: ChangeSemanticType;
  explanationPhrase: string;
  explanationPhraseTh: string;
  deltaDisplayOverride?: string;
  reviewReason?: string;
  reviewReasonTh?: string;
}

/**
 * Classifies a financial fact change based on authoritative evidence identity
 * (fiscal period, filing accession, provenance, and restatement signals).
 */
export function classifyFinancialFactChange(
  previousSnapshot: ResearchMemorySnapshot,
  currentSnapshot: ResearchMemorySnapshot,
  metricName: string,
  metricNameTh: string,
  previousVal: number,
  currentVal: number,
  signedDelta: SignedDeltaResult,
  unit = 'M',
  isPercentage = false
): FinancialFactClassification {
  const prefix = isPercentage ? '' : '$';
  const suffix = isPercentage ? '%' : unit;

  const prevPeriod = previousSnapshot.financials.latestPeriod;
  const curPeriod = currentSnapshot.financials.latestPeriod;
  const prevAccession = previousSnapshot.evidence.secAccession;
  const curAccession = currentSnapshot.evidence.secAccession;
  const prevProv = previousSnapshot.financials.provenance;
  const curProv = currentSnapshot.financials.provenance;

  const isSamePeriod = Boolean(prevPeriod && curPeriod && prevPeriod.trim().toUpperCase() === curPeriod.trim().toUpperCase());
  const isSameAccession = Boolean(prevAccession && curAccession && prevAccession.trim() === curAccession.trim());
  const isDifferentAccession = Boolean(prevAccession && curAccession && prevAccession.trim() !== curAccession.trim());
  const hasNewFiling = Boolean(curAccession && (!prevAccession || curAccession !== prevAccession));

  const curVerified = curProv === 'sec_verified' || currentSnapshot.evidence.hasVerifiedSecStatements;
  const prevUnverified = prevProv === 'unverified' || !previousSnapshot.evidence.hasVerifiedSecStatements;

  // 1. Same period
  if (isSamePeriod) {
    // 1A. Source Upgrade: prior unverified -> current SEC verified under same period
    if (prevUnverified && curVerified) {
      const qMatch = curPeriod?.match(/^(Q[1-4])/i);
      const periodToken = qMatch ? qMatch[1].toUpperCase() : (curPeriod || '');
      const metricShort = metricName === 'Free Cash Flow' ? 'FCF' : metricName;
      const formattedPrev = `${previousVal >= 0 ? '+' : ''}${previousVal.toLocaleString()}${unit}`;
      const formattedCur = `${currentVal >= 0 ? '+' : ''}${currentVal.toLocaleString()}${unit}`;
      const displayPhrase = `Prior value ${formattedPrev} was replaced by verified ${periodToken} ${metricShort} ${formattedCur}. Current research replaced prior unverified value with filing-verified value.`;
      return {
        domain: 'SOURCE_UPGRADE',
        confirmation: 'SUPPORTED',
        semanticType: 'SOURCE_UPGRADE',
        deltaDisplayOverride: 'SOURCE UPGRADE',
        explanationPhrase: displayPhrase,
        explanationPhraseTh: `งานวิเคราะห์ปัจจุบันแทนที่ค่าเดิม (${formattedPrev}) ที่ยังไม่ยืนยันด้วยข้อมูลที่ผ่านการตรวจสอบจากรายงาน ก.ล.ต. (${formattedCur}) สำหรับงวด ${curPeriod} (เป็นการอัปเกรดแหล่งข้อมูล ไม่ใช่การเปลี่ยนแปลงผลการดำเนินงานจริง)`
      };
    }

    // 1B. Restatement: same period with different later authoritative accession
    if (isDifferentAccession) {
      const isConfirmed = curVerified;
      return {
        domain: 'RESTATED_EVIDENCE',
        confirmation: isConfirmed ? 'CONFIRMED' : 'UNCONFIRMED',
        semanticType: 'RESTATED_OR_AMENDED_EVIDENCE',
        deltaDisplayOverride: 'RESTATED',
        explanationPhrase: `Restated financial disclosure: ${metricName} for ${curPeriod} was amended/restated in subsequent SEC filing (${curAccession} vs prior ${prevAccession}).`,
        explanationPhraseTh: `การปรับปรุงงบการเงินย้อนหลัง (Restated): ${metricNameTh} สำหรับงวด ${curPeriod} ได้รับการแก้ไขในรายงาน ก.ล.ต. ฉบับถัดมา (${curAccession})`,
        reviewReason: isConfirmed ? undefined : 'Restated disclosure reported from unverified source; verify filing.',
        reviewReasonTh: isConfirmed ? undefined : 'มีรายงานการปรับปรุงงบย้อนหลังแต่ยังไม่ได้รับการยืนยัน'
      };
    }

    // 1C. Current remains unverified under same period -> Cannot be confirmed (Rule: unverified fact != confirmed evidence)
    if (!curVerified) {
      return {
        domain: 'DATA_CORRECTION',
        confirmation: 'UNCONFIRMED',
        semanticType: 'DATA_CORRECTION_OR_NORMALIZATION_CHANGE',
        deltaDisplayOverride: 'DATA CORRECTION',
        explanationPhrase: `Unverified ${metricName} shifted (${prefix}${previousVal.toLocaleString()}${suffix} → ${prefix}${currentVal.toLocaleString()}${suffix}) under identical period (${curPeriod}). Prior research value corrected / normalized without new filing.`,
        explanationPhraseTh: `พบการปรับปรุง/แก้ไขข้อมูล ${metricNameTh} (${prefix}${previousVal.toLocaleString()}${suffix} → ${prefix}${currentVal.toLocaleString()}${suffix}) ภายใต้งวดบัญชีเดิม (${curPeriod}) โดยยังไม่ได้รับการยืนยันจากรายงาน ก.ล.ต. ฉบับใหม่`,
        reviewReason: `Unverified financial value changed under same fiscal period (${curPeriod}); verify against authoritative SEC filing.`,
        reviewReasonTh: `ตัวเลขการเงินที่ยังไม่ยืนยันเปลี่ยนแปลงในงวดบัญชีเดิม (${curPeriod}) ควรตรวจสอบกับรายงานทางการ ก.ล.ต.`
      };
    }

    // 1D. Both verified under same period + filing -> Normalization / Data Correction
    return {
      domain: 'DATA_CORRECTION',
      confirmation: 'SUPPORTED',
      semanticType: 'DATA_CORRECTION_OR_NORMALIZATION_CHANGE',
      deltaDisplayOverride: 'DATA CORRECTION',
      explanationPhrase: `Prior research value corrected: ${metricName} normalized/adjusted from ${prefix}${previousVal.toLocaleString()}${suffix} to ${prefix}${currentVal.toLocaleString()}${suffix} under identical authoritative filing (${curAccession || curPeriod}).`,
      explanationPhraseTh: `พบการแก้ไขข้อมูลในงานวิเคราะห์เดิม: ค่า ${metricNameTh} ได้รับการปรับปรุงจาก ${prefix}${previousVal.toLocaleString()}${suffix} เป็น ${prefix}${currentVal.toLocaleString()}${suffix} ภายใต้รายงานงวดเดียวกัน (${curAccession || curPeriod})`
    };
  }

  // 3. New Period or New Authoritative Filing -> Real World Evidence
  if (curVerified) {
    return {
      domain: 'EVIDENCE_CHANGE',
      confirmation: 'CONFIRMED',
      semanticType: 'NEW_REAL_WORLD_EVIDENCE',
      explanationPhrase: `${metricName} ${signedDelta.explanationPhrase} between ${prevPeriod || 'prior period'} and ${curPeriod || 'latest period'}.`,
      explanationPhraseTh: `${metricNameTh} ${signedDelta.explanationPhraseTh} ระหว่างงวด ${prevPeriod || 'ก่อนหน้า'} ถึง ${curPeriod || 'ล่าสุด'}`
    };
  }

  // 4. New Period but Current is UNVERIFIED -> Invariant: UNVERIFIED FACT != CONFIRMED EVIDENCE CHANGE
  return {
    domain: 'EVIDENCE_CHANGE',
    confirmation: 'UNCONFIRMED',
    semanticType: 'NEW_REAL_WORLD_EVIDENCE',
    explanationPhrase: `${metricName} reported as ${prefix}${currentVal.toLocaleString()}${suffix} (vs prior ${prefix}${previousVal.toLocaleString()}${suffix}), but source remains unverified.`,
    explanationPhraseTh: `รายงาน ${metricNameTh} เท่ากับ ${prefix}${currentVal.toLocaleString()}${suffix} (เทียบกับเดิม ${prefix}${previousVal.toLocaleString()}${suffix}) แต่แหล่งข้อมูลยังไม่ได้รับการยืนยัน`,
    reviewReason: `New fiscal period (${curPeriod}) reported from unverified source; confirm against official SEC statements before relying on it as confirmed evidence.`,
    reviewReasonTh: `รายงานงวดใหม่ (${curPeriod}) ยังไม่ได้รับการยืนยันจากรายงานทางการ ก.ล.ต. ควรตรวจสอบก่อนใช้เป็นข้อเท็จจริงยืนยัน`
  };
}

/**
 * Executes a deterministic counterfactual one-at-a-time valuation replay
 * against the previous valuation model baseline.
 * Sets isDeterministic: true ONLY when model replay successfully calculates first-order impacts.
 */
export function runCounterfactualDcfReplay(
  current: ResearchMemorySnapshot,
  previous: ResearchMemorySnapshot,
  baseDelta: any
): ValuationAttribution {
  // 1. Model switch check
  if (
    current.valuation.modelType &&
    previous.valuation.modelType &&
    current.valuation.modelType !== previous.valuation.modelType
  ) {
    return {
      primaryDriver: 'SECTOR_MODEL_SWITCH',
      impactDescription: `Valuation model transitioned from ${previous.valuation.modelType} to ${current.valuation.modelType}. Cross-model input-level attribution is mathematically incompatible.`,
      impactDescriptionTh: `แบบจำลองการประเมินมูลค่าเปลี่ยนจาก ${previous.valuation.modelType} เป็น ${current.valuation.modelType} ไม่สามารถแจกแจงสาเหตุเชิงคำนวณข้ามประเภทแบบจำลองที่ต่างกันได้`,
      isDeterministic: true
    };
  }

  // 2. Archetype sector guard: non-FCFF models (banks, lenders, REITs, insurance, pre-profit EV/sales)
  const curModel = current.valuation.modelType || '';
  const isGenericFcff = !curModel ||
    curModel === 'dcf_standard' ||
    curModel === 'dcf_multistage' ||
    curModel === 'dcf_gordon' ||
    curModel === 'dcf_cyclical' ||
    curModel === 'comprehensive';

  if (!isGenericFcff) {
    return {
      primaryDriver: 'UNAVAILABLE',
      impactDescription: `Valuation attribution is specialized for ${curModel}. Generic DCF cash flow attribution is not applicable for this sector archetype.`,
      impactDescriptionTh: `แบบจำลองการประเมินมูลค่าใช้เกณฑ์เฉพาะสำหรับภาคส่วนนี้ (${curModel}) จึงไม่นำการแจกแจงแบบกระแสเงินสดอิสระ (FCF) ทั่วไปมาใช้`,
      isDeterministic: false
    };
  }

  // 3. Counterfactual Replay Data Extraction
  const prevRev = previous.financials.revenue;
  const curRev = current.financials.revenue;
  const prevShares = previous.financials.currentSharesOutstandingM ?? previous.financials.sharesOutstanding ?? previous.financials.dilutedWeightedAverageSharesM;
  const curShares = current.financials.currentSharesOutstandingM ?? current.financials.sharesOutstanding ?? current.financials.dilutedWeightedAverageSharesM;
  const prevNetCash = previous.financials.netCash ?? 0;
  const curNetCash = current.financials.netCash ?? 0;
  const prevWacc = previous.valuation.assumptions.waccPct;
  const curWacc = current.valuation.assumptions.waccPct;
  const prevTg = previous.valuation.assumptions.terminalGrowthPct;
  const curTg = current.valuation.assumptions.terminalGrowthPct;
  const prevCagr = previous.valuation.assumptions.revenueCagrPct ?? previous.financials.revenueYoYPct;
  const curCagr = current.valuation.assumptions.revenueCagrPct ?? current.financials.revenueYoYPct;
  const prevMargin = previous.valuation.assumptions.fcfMarginPct ??
    (typeof previous.financials.freeCashFlow === 'number' && typeof prevRev === 'number' && prevRev > 0
      ? (previous.financials.freeCashFlow / prevRev) * 100
      : previous.financials.operatingMarginPct);
  const curMargin = current.valuation.assumptions.fcfMarginPct ??
    (typeof current.financials.freeCashFlow === 'number' && typeof curRev === 'number' && curRev > 0
      ? (current.financials.freeCashFlow / curRev) * 100
      : current.financials.operatingMarginPct);

  const hasCompleteInputs =
    typeof prevRev === 'number' && prevRev > 0 &&
    typeof curRev === 'number' && curRev > 0 &&
    typeof prevShares === 'number' && prevShares > 0 &&
    typeof curShares === 'number' && curShares > 0 &&
    typeof prevWacc === 'number' && prevWacc > 0 &&
    typeof curWacc === 'number' && curWacc > 0 &&
    typeof prevTg === 'number' && prevTg < prevWacc &&
    typeof curTg === 'number' && curTg < curWacc &&
    typeof prevCagr === 'number' &&
    typeof curCagr === 'number' &&
    typeof prevMargin === 'number' &&
    typeof curMargin === 'number';

  if (hasCompleteInputs) {
    const V0 = calculateStrictDCFValue(prevRev, prevShares, prevNetCash, prevWacc, prevTg, prevCagr, prevMargin, 5);
    if (Number.isFinite(V0) && V0 > 0) {
      // Counterfactual runs:
      const impRev = calculateStrictDCFValue(curRev, prevShares, prevNetCash, prevWacc, prevTg, prevCagr, prevMargin, 5) - V0;
      const impMargin = calculateStrictDCFValue(prevRev, prevShares, prevNetCash, prevWacc, prevTg, prevCagr, curMargin, 5) - V0;
      const impCagr = calculateStrictDCFValue(prevRev, prevShares, prevNetCash, prevWacc, prevTg, curCagr, prevMargin, 5) - V0;
      const impTg = calculateStrictDCFValue(prevRev, prevShares, prevNetCash, prevWacc, curTg, prevCagr, prevMargin, 5) - V0;
      const impWacc = calculateStrictDCFValue(prevRev, prevShares, prevNetCash, curWacc, prevTg, prevCagr, prevMargin, 5) - V0;
      const impNetCash = calculateStrictDCFValue(prevRev, prevShares, curNetCash, prevWacc, prevTg, prevCagr, prevMargin, 5) - V0;
      const impShares = calculateStrictDCFValue(prevRev, curShares, prevNetCash, prevWacc, prevTg, prevCagr, prevMargin, 5) - V0;

      const cashFlowImpact = Number((impRev + impMargin).toFixed(2));
      const growthImpact = Number((impCagr + impTg).toFixed(2));
      const discountRateImpact = Number(impWacc.toFixed(2));
      const capitalStructureImpact = Number((impNetCash + impShares).toFixed(2));

      const observedDelta = (typeof current.valuation.baseFairValue === 'number' && typeof previous.valuation.baseFairValue === 'number')
        ? Number((current.valuation.baseFairValue - previous.valuation.baseFairValue).toFixed(2))
        : Number((cashFlowImpact + growthImpact + discountRateImpact + capitalStructureImpact).toFixed(2));

      const totalFirstOrder = cashFlowImpact + growthImpact + discountRateImpact + capitalStructureImpact;
      const residualInteraction = Number((observedDelta - totalFirstOrder).toFixed(2));

      const drivers = [
        { key: 'CASH_FLOW_AND_MARGINS' as const, abs: Math.abs(cashFlowImpact), val: cashFlowImpact, label: 'Cash Flow & Margins', labelTh: 'กระแสเงินสดและอัตรากำไร' },
        { key: 'GROWTH_EXPECTATIONS' as const, abs: Math.abs(growthImpact), val: growthImpact, label: 'Growth Expectations', labelTh: 'การคาดการณ์การเติบโต' },
        { key: 'DISCOUNT_RATE' as const, abs: Math.abs(discountRateImpact), val: discountRateImpact, label: 'Discount Rate (WACC)', labelTh: 'อัตราคิดลด (WACC)' },
        { key: 'CAPITAL_STRUCTURE' as const, abs: Math.abs(capitalStructureImpact), val: capitalStructureImpact, label: 'Capital Structure & Shares', labelTh: 'โครงสร้างเงินทุนและจำนวนหุ้น' }
      ];

      drivers.sort((a, b) => b.abs - a.abs);
      const top = drivers[0];
      const isStrictlyZero = Math.abs(observedDelta) < 0.01;
      const isModestMove = !isStrictlyZero && (Math.abs(observedDelta) < 0.25 || top.abs < 0.25);

      let primaryDriver: ValuationAttribution['primaryDriver'];
      let impactDescription = '';
      let impactDescriptionTh = '';

      if (isStrictlyZero) {
        primaryDriver = 'UNCHANGED';
        impactDescription = 'Fair value is identical across research periods; valuation model baseline unchanged.';
        impactDescriptionTh = 'มูลค่ายุติธรรมไม่เปลี่ยนแปลงระหว่างงวดการวิจัย แบบจำลองมีค่าพื้นฐานคงเดิม';
      } else if (isModestMove) {
        primaryDriver = 'NO_MATERIAL_ATTRIBUTION';
        impactDescription = `Fair value changed modestly ($${observedDelta >= 0 ? '+' : ''}${observedDelta.toFixed(2)}). Although model inputs shifted, the overall valuation movement is below the threshold for assigning a material primary driver.`;
        impactDescriptionTh = `มูลค่ายุติธรรมเปลี่ยนแปลงเล็กน้อย ($${observedDelta >= 0 ? '+' : ''}${observedDelta.toFixed(2)}) แม้สมมติฐานจะเปลี่ยน แต่ขนาดการเปลี่ยนแปลงยังต่ำกว่าเกณฑ์ที่ใช้ระบุสาเหตุหลักเชิงปริมาณ`;
      } else {
        primaryDriver = top.key;
        impactDescription = `Deterministic counterfactual replay indicates Fair Value delta ($${observedDelta >= 0 ? '+' : ''}${observedDelta.toFixed(2)}) was primarily driven by ${top.label} (${top.val >= 0 ? '+' : ''}$${top.val.toFixed(2)} isolated impact, residual interaction: ${residualInteraction >= 0 ? '+' : ''}$${residualInteraction.toFixed(2)}).`;
        impactDescriptionTh = `การจำลองแบบจำลองเชิงเปรียบเทียบ (Counterfactual Replay) พบว่าการเปลี่ยนแปลงมูลค่ายุติธรรม ($${observedDelta >= 0 ? '+' : ''}${observedDelta.toFixed(2)}) ขับเคลื่อนหลักโดย ${top.labelTh} (ผลกระทบเดี่ยว: ${top.val >= 0 ? '+' : ''}$${top.val.toFixed(2)}, ผลกระทบร่วม: ${residualInteraction >= 0 ? '+' : ''}$${residualInteraction.toFixed(2)})`;
      }

      return {
        primaryDriver,
        impactDescription,
        impactDescriptionTh,
        isDeterministic: true,
        waterfall: {
          observedDelta,
          cashFlowImpact,
          growthImpact,
          marginImpact: Number(impMargin.toFixed(2)),
          discountRateImpact,
          terminalGrowthImpact: Number(impTg.toFixed(2)),
          capitalStructureImpact,
          dilutionImpact: Number(impShares.toFixed(2)),
          residualInteraction
        }
      };
    }
  }

  // 4. Truthful Fallback when Counterfactual Replay is Not Available
  // NEVER claim isDeterministic = true
  const fvMove = baseDelta.fairValueDelta?.deltaPct ?? 0;
  const fcfMove = baseDelta.freeCashFlowDelta?.deltaPct;
  const waccDiff = baseDelta.valuationAssumptionsDelta.waccDeltaPoints;
  const tgDiff = baseDelta.valuationAssumptionsDelta.terminalGrowthDeltaPoints;
  const cagrDiff = baseDelta.valuationAssumptionsDelta.revenueCagrDeltaPoints;
  const tmDiff = baseDelta.valuationAssumptionsDelta.terminalMarginDeltaPoints;

  const isStrictlyZero = Math.abs(fvMove) < 0.05;
  const isModestMove = !isStrictlyZero && Math.abs(fvMove) < 3.0;

  if (isStrictlyZero) {
    return {
      primaryDriver: 'UNCHANGED',
      impactDescription: 'Fair value is identical across research periods; valuation model baseline unchanged.',
      impactDescriptionTh: 'มูลค่ายุติธรรมไม่เปลี่ยนแปลงระหว่างงวดการวิจัย แบบจำลองมีค่าพื้นฐานคงเดิม',
      isDeterministic: false
    };
  }

  if (isModestMove) {
    const waccChanged = typeof waccDiff === 'number' && Math.abs(waccDiff) >= 0.25;
    return {
      primaryDriver: 'NO_MATERIAL_ATTRIBUTION',
      impactDescription: waccChanged
        ? `Fair value changed modestly (${fvMove >= 0 ? '+' : ''}${fvMove.toFixed(1)}%). Although WACC changed, the overall valuation movement is below the threshold for assigning a material primary driver.`
        : `Fair value changed modestly (${fvMove >= 0 ? '+' : ''}${fvMove.toFixed(1)}%). Although model assumptions shifted, the overall valuation movement is below the threshold for assigning a material primary driver.`,
      impactDescriptionTh: waccChanged
        ? `มูลค่ายุติธรรมเปลี่ยนแปลงเล็กน้อย (${fvMove >= 0 ? '+' : ''}${fvMove.toFixed(1)}%) แม้ WACC จะเปลี่ยน แต่ขนาดการเปลี่ยนแปลงยังต่ำกว่าเกณฑ์ที่ใช้ระบุสาเหตุหลักเชิงปริมาณ`
        : `มูลค่ายุติธรรมเปลี่ยนแปลงเล็กน้อย (${fvMove >= 0 ? '+' : ''}${fvMove.toFixed(1)}%) แม้สมมติฐานจะเปลี่ยน แต่ขนาดการเปลี่ยนแปลงยังต่ำกว่าเกณฑ์ที่ใช้ระบุสาเหตุหลักเชิงปริมาณ`,
      isDeterministic: false
    };
  }

  // Collect materially changed compatible DCF assumptions and determine directional consistency
  interface MaterialAssumptionItem {
    id: string;
    detailEn: string;
    detailTh: string;
    impliedFvDirection: 'UP' | 'DOWN';
  }

  const materialAssumptions: MaterialAssumptionItem[] = [];

  // WACC: higher discount rate -> generally lower DCF value
  if (typeof waccDiff === 'number' && Math.abs(waccDiff) >= 0.25) {
    materialAssumptions.push({
      id: 'wacc',
      detailEn: waccDiff > 0 ? 'a higher discount rate' : 'a lower discount rate',
      detailTh: waccDiff > 0 ? 'WACC ที่สูงขึ้น' : 'WACC ที่ลดลง',
      impliedFvDirection: waccDiff > 0 ? 'DOWN' : 'UP'
    });
  }

  // Growth / Revenue CAGR: lower growth -> generally lower DCF value
  if (typeof cagrDiff === 'number' && Math.abs(cagrDiff) >= 0.5) {
    materialAssumptions.push({
      id: 'growth',
      detailEn: cagrDiff > 0 ? 'higher growth expectations' : 'lower growth expectations',
      detailTh: cagrDiff > 0 ? 'อัตราการเติบโตที่สูงขึ้น' : 'อัตราการเติบโตที่ลดลง',
      impliedFvDirection: cagrDiff > 0 ? 'UP' : 'DOWN'
    });
  }

  // Terminal Margin: lower terminal margin -> generally lower DCF value
  if (typeof tmDiff === 'number' && Math.abs(tmDiff) >= 0.25) {
    materialAssumptions.push({
      id: 'terminal_margin',
      detailEn: tmDiff > 0 ? 'higher terminal margin' : 'lower terminal margin',
      detailTh: tmDiff > 0 ? 'Terminal Margin ที่สูงขึ้น' : 'Terminal Margin ที่ลดลง',
      impliedFvDirection: tmDiff > 0 ? 'UP' : 'DOWN'
    });
  }

  // Terminal Growth: lower terminal growth -> generally lower DCF value
  if (typeof tgDiff === 'number' && Math.abs(tgDiff) >= 0.1) {
    materialAssumptions.push({
      id: 'terminal_growth',
      detailEn: tgDiff > 0 ? 'higher terminal growth' : 'lower terminal growth',
      detailTh: tgDiff > 0 ? 'อัตราการเติบโตระยะยาวที่สูงขึ้น' : 'อัตราการเติบโตระยะยาวที่ลดลง',
      impliedFvDirection: tgDiff > 0 ? 'UP' : 'DOWN'
    });
  }

  // Projection Horizon: longer forecast period -> generally higher DCF explicit value for growth companies
  const projYearsDiff = baseDelta.valuationAssumptionsDelta.projectionYearsDelta;
  if (typeof projYearsDiff === 'number' && projYearsDiff !== 0) {
    materialAssumptions.push({
      id: 'projection_years',
      detailEn: projYearsDiff > 0 ? 'a longer projection horizon' : 'a shorter projection horizon',
      detailTh: projYearsDiff > 0 ? 'ระยะเวลาการประมาณการที่ยาวนานขึ้น' : 'ระยะเวลาการประมาณการที่สั้นลง',
      impliedFvDirection: projYearsDiff > 0 ? 'UP' : 'DOWN'
    });
  }

  // Normalized Cash Flow (FCF): lower cash flow -> generally lower DCF value
  if (typeof fcfMove === 'number' && Math.abs(fcfMove) >= 10) {
    materialAssumptions.push({
      id: 'cash_flow',
      detailEn: fcfMove > 0 ? 'higher cash flow' : 'lower cash flow',
      detailTh: fcfMove > 0 ? 'กระแสเงินสดที่สูงขึ้น' : 'กระแสเงินสดที่ลดลง',
      impliedFvDirection: fcfMove > 0 ? 'UP' : 'DOWN'
    });
  }

  const targetDirection = fvMove >= 0 ? 'UP' : 'DOWN';
  const consistentAssumptions = materialAssumptions.filter(a => a.impliedFvDirection === targetDirection);
  const conflictingAssumptions = materialAssumptions.filter(a => a.impliedFvDirection !== targetDirection);

  const formatListEn = (items: string[]) => {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
  };

  const formatListTh = (items: string[]) => {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} และ ${items[1]}`;
    return `${items.slice(0, -1).join(' ')} และ ${items[items.length - 1]}`;
  };

  // Case A: Multiple material assumptions moved in direction consistent with valuation change
  if (consistentAssumptions.length >= 2 && conflictingAssumptions.length === 0) {
    const listEn = formatListEn(consistentAssumptions.map(a => a.detailEn));
    const listTh = formatListTh(consistentAssumptions.map(a => a.detailTh));
    return {
      primaryDriver: 'MULTIPLE_MODEL_ASSUMPTIONS',
      impactDescription: `Fair value ${fvMove >= 0 ? 'increased' : 'declined'} alongside multiple model-assumption changes, including ${listEn}. These changes are directionally consistent with the valuation ${fvMove >= 0 ? 'increase' : 'decline'}, but their individual quantitative contributions cannot be established without counterfactual model replay.`,
      impactDescriptionTh: `มูลค่ายุติธรรม${fvMove >= 0 ? 'เพิ่มขึ้น' : 'ลดลง'}พร้อมกับการปรับสมมติฐานหลายรายการ ได้แก่ ${listTh} ซึ่งล้วนมีทิศทางสอดคล้องกับมูลค่าที่${fvMove >= 0 ? 'เพิ่มขึ้น' : 'ลดลง'} อย่างไรก็ตามยังไม่สามารถแจกแจงผลกระทบของแต่ละปัจจัยเชิงปริมาณได้หากไม่มี counterfactual replay`,
      isDeterministic: false
    };
  }

  // Case B: Conflicting assumption changes (e.g. some imply UP, some imply DOWN)
  if (conflictingAssumptions.length > 0 && consistentAssumptions.length > 0) {
    const consEn = formatListEn(consistentAssumptions.map(a => a.detailEn));
    const confEn = formatListEn(conflictingAssumptions.map(a => a.detailEn));
    const consTh = formatListTh(consistentAssumptions.map(a => a.detailTh));
    const confTh = formatListTh(conflictingAssumptions.map(a => a.detailTh));
    return {
      primaryDriver: 'MIXED_MODEL_ASSUMPTIONS',
      impactDescription: `Model assumptions shifted in conflicting directions (${consEn} vs ${confEn}). Without counterfactual model replay, exact net causal attribution cannot be determined.`,
      impactDescriptionTh: `สมมติฐานในแบบจำลองมีการปรับเปลี่ยนไปในทิศทางที่ขัดแย้งกัน (${consTh} เทียบกับ ${confTh}) ยังไม่สามารถระบุผลลัพธ์สุทธิเชิงสาเหตุได้หากไม่มี counterfactual replay`,
      isDeterministic: false
    };
  }

  // Case C: Exactly one material assumption changed, consistent
  if (consistentAssumptions.length === 1 && conflictingAssumptions.length === 0) {
    const item = consistentAssumptions[0];
    let impactDesc = '';
    let impactDescTh = '';

    if (item.id === 'wacc' && typeof waccDiff === 'number') {
      impactDesc = `Discount rate (WACC) adjusted by ${waccDiff >= 0 ? '+' : ''}${waccDiff.toFixed(2)}% pts; directionally consistent with fair value shift, but deterministic attribution is unavailable without complete counterfactual replay inputs.`;
      impactDescTh = `อัตราคิดลด (WACC) ปรับเปลี่ยน ${waccDiff >= 0 ? '+' : ''}${waccDiff.toFixed(2)}% จุด สอดคล้องกับการปรับมูลค่ายุติธรรม แต่ยังไม่สามารถแจกแจงเชิงคำนวณที่แน่นอนได้เนื่องจากขาดข้อมูลการจำลอง counterfactual`;
    } else if (item.id === 'growth' && typeof cagrDiff === 'number') {
      impactDesc = `Revenue growth expectations adjusted by ${cagrDiff >= 0 ? '+' : ''}${cagrDiff.toFixed(2)}% pts; directionally consistent with fair value shift, but deterministic attribution is unavailable without complete counterfactual replay inputs.`;
      impactDescTh = `อัตราการเติบโตของรายได้ปรับเปลี่ยน ${cagrDiff >= 0 ? '+' : ''}${cagrDiff.toFixed(2)}% จุด สอดคล้องกับการปรับมูลค่ายุติธรรม แต่ยังไม่สามารถแจกแจงเชิงคำนวณที่แน่นอนได้เนื่องจากขาดข้อมูลการจำลอง counterfactual`;
    } else if (item.id === 'terminal_margin' && typeof tmDiff === 'number') {
      impactDesc = `Terminal margin adjusted by ${tmDiff >= 0 ? '+' : ''}${tmDiff.toFixed(2)}% pts; directionally consistent with fair value shift, but deterministic attribution is unavailable without complete counterfactual replay inputs.`;
      impactDescTh = `Terminal margin ปรับเปลี่ยน ${tmDiff >= 0 ? '+' : ''}${tmDiff.toFixed(2)}% จุด สอดคล้องกับการปรับมูลค่ายุติธรรม แต่ยังไม่สามารถแจกแจงเชิงคำนวณที่แน่นอนได้เนื่องจากขาดข้อมูลการจำลอง counterfactual`;
    } else if (item.id === 'terminal_growth' && typeof tgDiff === 'number') {
      impactDesc = `Terminal growth rate adjusted by ${tgDiff >= 0 ? '+' : ''}${tgDiff.toFixed(2)}% pts; directionally consistent with fair value shift, but deterministic attribution is unavailable without complete counterfactual replay inputs.`;
      impactDescTh = `อัตราการเติบโตระยะยาวปรับเปลี่ยน ${tgDiff >= 0 ? '+' : ''}${tgDiff.toFixed(2)}% จุด สอดคล้องกับการปรับมูลค่ายุติธรรม แต่ยังไม่สามารถแจกแจงเชิงคำนวณที่แน่นอนได้เนื่องจากขาดข้อมูลการจำลอง counterfactual`;
    } else if (item.id === 'projection_years' && typeof projYearsDiff === 'number') {
      const prevY = previous.valuation.assumptions.projectionYears ?? previous.valuation.inputSnapshot?.projectionYears;
      const curY = current.valuation.assumptions.projectionYears ?? current.valuation.inputSnapshot?.projectionYears;
      const horizonChangeText = projYearsDiff > 0 ? 'a longer projection horizon' : 'a shorter projection horizon';
      const horizonChangeTextTh = projYearsDiff > 0 ? 'ระยะเวลาการประมาณการที่ยาวนานขึ้น' : 'ระยะเวลาการประมาณการที่สั้นลง';
      impactDesc = `Projection horizon adjusted from ${prevY ?? '—'} to ${curY ?? '—'} years (${projYearsDiff >= 0 ? '+' : ''}${projYearsDiff} yrs; ${horizonChangeText}); directionally associated with fair value change, but deterministic attribution is unavailable without complete counterfactual replay inputs.`;
      impactDescTh = `ระยะเวลาการประมาณการปรับเปลี่ยนจาก ${prevY ?? '—'} เป็น ${curY ?? '—'} ปี (${projYearsDiff >= 0 ? '+' : ''}${projYearsDiff} ปี; ${horizonChangeTextTh}) สัมพันธ์กับการปรับมูลค่ายุติธรรม แต่ยังไม่สามารถแจกแจงเชิงคำนวณที่แน่นอนได้เนื่องจากขาดข้อมูลการจำลอง counterfactual`;
    } else if (item.id === 'cash_flow' && typeof fcfMove === 'number') {
      impactDesc = `Cash flow moved by ${fcfMove >= 0 ? '+' : ''}${fcfMove.toFixed(1)}%; directionally associated with fair value change, but deterministic attribution is unavailable without complete counterfactual replay inputs.`;
      impactDescTh = `กระแสเงินสดเปลี่ยนไป ${fcfMove >= 0 ? '+' : ''}${fcfMove.toFixed(1)}% สัมพันธ์กับการปรับมูลค่ายุติธรรม แต่ยังไม่สามารถแจกแจงเชิงคำนวณที่แน่นอนได้เนื่องจากขาดข้อมูลการจำลอง counterfactual`;
    }

    return {
      primaryDriver: 'HEURISTIC_ASSOCIATION',
      impactDescription: impactDesc,
      impactDescriptionTh: impactDescTh,
      isDeterministic: false
    };
  }

  // Case D: Assumptions moved in opposite direction to fair value (conflict with valuation direction)
  if (conflictingAssumptions.length > 0 && consistentAssumptions.length === 0) {
    const confEn = formatListEn(conflictingAssumptions.map(a => a.detailEn));
    const confTh = formatListTh(conflictingAssumptions.map(a => a.detailTh));
    return {
      primaryDriver: 'MIXED_MODEL_ASSUMPTIONS',
      impactDescription: `Model assumptions moved counter to fair value direction (${confEn}). Without counterfactual model replay, exact net causal attribution cannot be determined.`,
      impactDescriptionTh: `สมมติฐานในแบบจำลองเคลื่อนไหวตรงข้ามกับทิศทางมูลค่ายุติธรรม (${confTh}) ยังไม่สามารถระบุผลลัพธ์สุทธิเชิงสาเหตุได้หากไม่มี counterfactual replay`,
      isDeterministic: false
    };
  }

  // Case E: Huge Fair-Value Change Guard (Section 21 & Test 33)
  if (Math.abs(fvMove) >= 50) {
    const hasPlausibleMajorDriver =
      (typeof waccDiff === 'number' && Math.abs(waccDiff) >= 1.5) ||
      (typeof fcfMove === 'number' && Math.abs(fcfMove) >= 30) ||
      (typeof cagrDiff === 'number' && Math.abs(cagrDiff) >= 4) ||
      (typeof tmDiff === 'number' && Math.abs(tmDiff) >= 2) ||
      (typeof projYearsDiff === 'number' && Math.abs(projYearsDiff) >= 3);
    if (!hasPlausibleMajorDriver) {
      return {
        primaryDriver: 'ATTRIBUTION_INPUTS_INCOMPLETE',
        impactDescription: 'Fair value changed materially, but the stored assumption snapshot is insufficient for complete attribution.',
        impactDescriptionTh: 'มูลค่าพื้นฐานเปลี่ยนแปลงอย่างมีนัยสำคัญ แต่ชุดสมมติฐานที่บันทึกไว้ไม่เพียงพอสำหรับการระบุสาเหตุอย่างสมบูรณ์',
        isDeterministic: false
      };
    }
  }

  // Case F: General fallback when no material assumption changed
  return {
    primaryDriver: 'HEURISTIC_ASSOCIATION',
    impactDescription: 'Fair value change reflects revised model assumptions; exact deterministic attribution is unavailable without complete counterfactual replay inputs.',
    impactDescriptionTh: 'การเปลี่ยนแปลงมูลค่ายุติธรรมสะท้อนการปรับสมมติฐานในแบบจำลอง โดยยังไม่สามารถแจกแจงเชิงคำนวณที่แน่นอนได้เนื่องจากขาดข้อมูลการจำลอง counterfactual',
    isDeterministic: false
  };
}

/**
 * Deterministically analyzes the delta between two research memory snapshots,
 * separating real company/evidence changes from research coverage drift.
 */
export function computeWhatChanged(
  current: ResearchMemorySnapshot,
  previous: ResearchMemorySnapshot,
  trackedExpectations: TrackedExpectation[] = []
): WhatChangedResult {
  const baseDelta = compareMemorySnapshots(current, previous);
  const items: ChangeItem[] = [];

  // 1. Valuation Changes (Model Output Change)
  if (baseDelta.fairValueDelta && Math.abs(baseDelta.fairValueDelta.deltaPct) >= 0.1) {
    const deltaPct = baseDelta.fairValueDelta.deltaPct;
    const absDelta = Math.abs(deltaPct);
    const materiality: ChangeMateriality = absDelta >= 10 ? 'HIGH' : absDelta >= 5 ? 'MEDIUM' : 'LOW';

    items.push({
      id: 'change_fair_value',
      category: 'VALUATION',
      domain: 'THESIS_MODEL_CHANGE',
      confirmation: 'CONFIRMED',
      semanticType: 'VALUATION_MODEL_OUTPUT_CHANGE',
      metricLabel: 'Base Fair Value',
      metricLabelTh: 'มูลค่ายุติธรรมพื้นฐาน',
      previousValue: `$${baseDelta.fairValueDelta.previous.toFixed(2)}`,
      currentValue: `$${baseDelta.fairValueDelta.current.toFixed(2)}`,
      deltaDisplay: `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%`,
      materiality,
      explanation: `Fair value shifted by ${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}% between research periods (Valuation Model Output Change).`,
      explanationTh: `มูลค่ายุติธรรมเปลี่ยนแปลง ${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}% ระหว่างช่วงการวิจัย (ผลลัพธ์แบบจำลองการประเมินมูลค่า)`,
      provenance: 'DETERMINISTIC_CALCULATION'
    });
  }

  // 2. Market Price Changes (Market Context)
  if (baseDelta.priceDelta && Math.abs(baseDelta.priceDelta.deltaPct) >= 0.1) {
    const deltaPct = baseDelta.priceDelta.deltaPct;
    const absDelta = Math.abs(deltaPct);
    const materiality: ChangeMateriality = absDelta >= 15 ? 'HIGH' : absDelta >= 8 ? 'MEDIUM' : 'LOW';

    items.push({
      id: 'change_price',
      category: 'MARKET_PRICE',
      domain: 'MARKET_CONTEXT_CHANGE',
      confirmation: 'CONFIRMED',
      semanticType: 'MARKET_CONTEXT_CHANGE',
      metricLabel: 'Market Price',
      metricLabelTh: 'ราคาตลาด',
      previousValue: `$${baseDelta.priceDelta.previous.toFixed(2)}`,
      currentValue: `$${baseDelta.priceDelta.current.toFixed(2)}`,
      deltaDisplay: `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%`,
      materiality,
      explanation: `Market price changed by ${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%.`,
      explanationTh: `ราคาตลาดเปลี่ยนแปลง ${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%`,
      provenance: 'MARKET_SNAPSHOT'
    });
  }

  // 3. Conviction Score Shift (Downstream Derived Output)
  if (baseDelta.convictionScoreDelta && Math.abs(baseDelta.convictionScoreDelta.deltaPoints) >= 1) {
    const pts = baseDelta.convictionScoreDelta.deltaPoints;
    const prevScore = baseDelta.convictionScoreDelta.previous;
    const curScore = baseDelta.convictionScoreDelta.current;

    const hasVerifiedEvidenceChange = Boolean(
      (baseDelta.revenueYoYDelta && Math.abs(baseDelta.revenueYoYDelta.deltaPctPoints) >= 1.0) ||
      (baseDelta.operatingMarginDelta && Math.abs(baseDelta.operatingMarginDelta.deltaPctPoints) >= 1.0) ||
      (baseDelta.freeCashFlowDelta && Math.abs(baseDelta.freeCashFlowDelta.deltaPct) >= 5.0) ||
      (baseDelta.netIncomeDelta && Math.abs(baseDelta.netIncomeDelta.deltaPct) >= 5.0) ||
      (current.evidence.secAccession && current.evidence.secAccession !== previous.evidence.secAccession)
    );
    const hasDeterministicModelChange = Boolean(
      baseDelta.fairValueDelta && Math.abs(baseDelta.fairValueDelta.deltaPct) >= 3.0
    );

    if (hasVerifiedEvidenceChange || hasDeterministicModelChange) {
      items.push({
        id: 'change_conviction',
        category: 'CONVICTION',
        domain: 'THESIS_MODEL_CHANGE',
        confirmation: 'CONFIRMED',
        semanticType: 'DERIVED_OUTPUT_CHANGE',
        metricLabel: 'Conviction Score',
        metricLabelTh: 'คะแนนความเชื่อมั่น',
        previousValue: `${prevScore}/100`,
        currentValue: `${curScore}/100`,
        deltaDisplay: `${pts >= 0 ? '+' : ''}${pts} pts`,
        materiality: Math.abs(pts) >= 10 ? 'HIGH' : Math.abs(pts) >= 5 ? 'MEDIUM' : 'LOW',
        explanation: `Conviction shifted by ${pts >= 0 ? '+' : ''}${pts} points (${prevScore} → ${curScore}), downstream derived output reflecting fundamental and valuation adjustments.`,
        explanationTh: `คะแนนความเชื่อมั่นเปลี่ยนไป ${pts >= 0 ? '+' : ''}${pts} จุด (${prevScore} → ${curScore}) เป็นผลลัพธ์ต่อเนื่องที่สะท้อนการปรับเปลี่ยนของปัจจัยพื้นฐานและแบบจำลอง`,
        provenance: 'DETERMINISTIC_DERIVATION'
      });
    } else {
      // Score shifted without verified evidence or model changes -> Analysis Drift / Unattributed
      items.push({
        id: 'change_conviction',
        category: 'CONVICTION',
        domain: 'RESEARCH_COVERAGE_CHANGE',
        confirmation: 'RESEARCH_ONLY',
        driftSubtype: 'ANALYSIS_MODEL_DRIFT',
        semanticType: 'ANALYSIS_OUTPUT_DRIFT',
        metricLabel: 'Conviction Score (Analysis Drift)',
        metricLabelTh: 'คะแนนความเชื่อมั่น (ความผันผวนจากการวิเคราะห์)',
        previousValue: `${prevScore}/100`,
        currentValue: `${curScore}/100`,
        deltaDisplay: `${pts >= 0 ? '+' : ''}${pts} pts`,
        materiality: 'LOW',
        explanation: `Conviction changed by ${pts >= 0 ? '+' : ''}${pts} points (${prevScore} → ${curScore}), but the delta is not attributable to new verified evidence (analysis variation / model-output drift).`,
        explanationTh: `คะแนนความเชื่อมั่นเปลี่ยนแปลง ${pts >= 0 ? '+' : ''}${pts} จุด (${prevScore} → ${curScore}) แต่ยังไม่สามารถเชื่อมโยงกับหลักฐานใหม่ที่ยืนยันแล้ว โดยสาเหตุของการเปลี่ยนแปลงคะแนนยังไม่สามารถเชื่อมโยงกับหลักฐานใหม่ได้ (ความผันผวนจากการวิเคราะห์ / Analysis Drift)`,
        provenance: 'MODEL_OUTPUT_VARIATION',
        reviewReason: 'Conviction delta is not attributable to new verified evidence.',
        reviewReasonTh: 'คะแนนความเชื่อมั่นเปลี่ยนแปลง แต่ยังไม่สามารถเชื่อมโยงกับหลักฐานใหม่ที่ยืนยันแล้ว'
      });
    }
  }

  // 4. Financial Facts (Revenue YoY, Margin, Net Income, FCF with Evidence Identity and Cross-Zero Guards)
  const curRevYoY = current.financials.revenueYoYPct;
  const prevRevYoY = previous.financials.revenueYoYPct;
  if (typeof curRevYoY === 'number' && typeof prevRevYoY === 'number' && Math.abs(curRevYoY - prevRevYoY) >= 2.0) {
    const signed = formatSignedMetricDelta(prevRevYoY, curRevYoY, '%', true);
    const cl = classifyFinancialFactChange(previous, current, 'Revenue YoY Growth', 'การเติบโตรายได้ YoY', prevRevYoY, curRevYoY, signed, '%', true);
    items.push({
      id: 'change_revenue_yoy',
      category: 'FINANCIAL_FACTS',
      domain: cl.domain,
      confirmation: cl.confirmation,
      semanticType: cl.semanticType,
      metricLabel: 'Revenue YoY Growth',
      metricLabelTh: 'การเติบโตรายได้ YoY',
      previousValue: `${prevRevYoY.toFixed(1)}%`,
      currentValue: `${curRevYoY.toFixed(1)}%`,
      deltaDisplay: cl.deltaDisplayOverride || `${(curRevYoY - prevRevYoY) >= 0 ? '+' : ''}${(curRevYoY - prevRevYoY).toFixed(1)}% pts`,
      materiality: Math.abs(curRevYoY - prevRevYoY) >= 5.0 ? 'HIGH' : 'MEDIUM',
      explanation: cl.explanationPhrase,
      explanationTh: cl.explanationPhraseTh,
      provenance: current.financials.provenance,
      reviewReason: cl.reviewReason,
      reviewReasonTh: cl.reviewReasonTh
    });
  }

  const curOpm = current.financials.operatingMarginPct;
  const prevOpm = previous.financials.operatingMarginPct;
  if (typeof curOpm === 'number' && typeof prevOpm === 'number' && Math.abs(curOpm - prevOpm) >= 1.5) {
    const signed = formatSignedMetricDelta(prevOpm, curOpm, '%', true);
    const cl = classifyFinancialFactChange(previous, current, 'Operating Margin', 'อัตรากำไรจากการดำเนินงาน', prevOpm, curOpm, signed, '%', true);
    items.push({
      id: 'change_op_margin',
      category: 'FINANCIAL_FACTS',
      domain: cl.domain,
      confirmation: cl.confirmation,
      semanticType: cl.semanticType,
      metricLabel: 'Operating Margin',
      metricLabelTh: 'อัตรากำไรจากการดำเนินงาน',
      previousValue: `${prevOpm.toFixed(1)}%`,
      currentValue: `${curOpm.toFixed(1)}%`,
      deltaDisplay: cl.deltaDisplayOverride || `${(curOpm - prevOpm) >= 0 ? '+' : ''}${(curOpm - prevOpm).toFixed(1)}% pts`,
      materiality: Math.abs(curOpm - prevOpm) >= 3.0 ? 'HIGH' : 'MEDIUM',
      explanation: cl.explanationPhrase,
      explanationTh: cl.explanationPhraseTh,
      provenance: current.financials.provenance,
      reviewReason: cl.reviewReason,
      reviewReasonTh: cl.reviewReasonTh
    });
  }

  const curNetInc = current.financials.netIncome;
  const prevNetInc = previous.financials.netIncome;
  if (typeof curNetInc === 'number' && typeof prevNetInc === 'number' && curNetInc !== prevNetInc) {
    const signed = formatSignedMetricDelta(prevNetInc, curNetInc, 'M');
    const isMaterial = Math.abs(curNetInc - prevNetInc) >= 20 ||
      (prevNetInc !== 0 && Math.abs((curNetInc - prevNetInc) / Math.abs(prevNetInc)) >= 0.05) ||
      signed.semanticState === 'DETERIORATION' ||
      signed.semanticState === 'TURNAROUND';
    if (isMaterial) {
      const cl = classifyFinancialFactChange(previous, current, 'Net Income', 'กำไรสุทธิ (Net Income)', prevNetInc, curNetInc, signed, 'M');
      items.push({
        id: 'change_net_income',
        category: 'FINANCIAL_FACTS',
        domain: cl.domain,
        confirmation: cl.confirmation,
        semanticType: cl.semanticType,
        metricLabel: 'Net Income',
        metricLabelTh: 'กำไรสุทธิ (Net Income)',
        previousValue: `$${prevNetInc.toLocaleString()}M`,
        currentValue: `$${curNetInc.toLocaleString()}M`,
        deltaDisplay: cl.deltaDisplayOverride || signed.deltaDisplay,
        materiality: (Math.abs(curNetInc - prevNetInc) >= 100 || signed.semanticState === 'DETERIORATION') ? 'HIGH' : 'MEDIUM',
        explanation: cl.explanationPhrase,
        explanationTh: cl.explanationPhraseTh,
        provenance: current.financials.provenance,
        reviewReason: cl.reviewReason,
        reviewReasonTh: cl.reviewReasonTh
      });
    }
  }

  const curFcf = current.financials.freeCashFlow;
  const prevFcf = previous.financials.freeCashFlow;
  if (typeof curFcf === 'number' && typeof prevFcf === 'number' && curFcf !== prevFcf) {
    const signed = formatSignedMetricDelta(prevFcf, curFcf, 'M');
    const isMaterial = Math.abs(curFcf - prevFcf) >= 50 ||
      (prevFcf !== 0 && Math.abs((curFcf - prevFcf) / Math.abs(prevFcf)) >= 0.10) ||
      signed.semanticState === 'DETERIORATION' ||
      signed.semanticState === 'TURNAROUND';
    if (isMaterial) {
      const cl = classifyFinancialFactChange(previous, current, 'Free Cash Flow', 'กระแสเงินสดอิสระ (FCF)', prevFcf, curFcf, signed, 'M');
      items.push({
        id: 'change_fcf',
        category: 'FINANCIAL_FACTS',
        domain: cl.domain,
        confirmation: cl.confirmation,
        semanticType: cl.semanticType,
        metricLabel: 'Free Cash Flow',
        metricLabelTh: 'กระแสเงินสดอิสระ (FCF)',
        previousValue: `$${prevFcf.toLocaleString()}M`,
        currentValue: `$${curFcf.toLocaleString()}M`,
        deltaDisplay: cl.deltaDisplayOverride || signed.deltaDisplay,
        materiality: (Math.abs(curFcf - prevFcf) >= 200 || signed.semanticState === 'DETERIORATION') ? 'HIGH' : 'MEDIUM',
        explanation: cl.explanationPhrase,
        explanationTh: cl.explanationPhraseTh,
        provenance: current.financials.provenance,
        reviewReason: cl.reviewReason,
        reviewReasonTh: cl.reviewReasonTh
      });
    }
  }

  // 5. Valuation Assumptions Changes (WACC, Terminal Growth, Projection Years, Revenue CAGR, Terminal Margin)
  if (
    current.valuation.modelType &&
    previous.valuation.modelType &&
    current.valuation.modelType !== previous.valuation.modelType
  ) {
    items.push({
      id: 'change_model_switch',
      category: 'VALUATION',
      domain: 'THESIS_MODEL_CHANGE',
      confirmation: 'CONFIRMED',
      semanticType: 'VALUATION_MODEL_SWITCH',
      metricLabel: 'Valuation Model Switch',
      metricLabelTh: 'การเปลี่ยนแบบจำลองประเมินมูลค่า',
      previousValue: previous.valuation.modelType,
      currentValue: current.valuation.modelType,
      deltaDisplay: 'MODEL SWITCH',
      materiality: 'HIGH',
      explanation: `Valuation model transitioned from ${previous.valuation.modelType} to ${current.valuation.modelType}. Assumption comparison is restricted to compatible fields.`,
      explanationTh: `แบบจำลองการประเมินมูลค่าเปลี่ยนจาก ${previous.valuation.modelType} เป็น ${current.valuation.modelType} โดยจำกัดการเปรียบเทียบเฉพาะฟิลด์ที่เข้ากันได้`,
      provenance: 'VALUATION_MODEL_SWITCH'
    });
  }

  const waccDelta = baseDelta.valuationAssumptionsDelta.waccDeltaPoints;
  if (waccDelta !== null && Math.abs(waccDelta) >= 0.25) {
    items.push({
      id: 'change_wacc',
      category: 'VALUATION',
      domain: 'THESIS_MODEL_CHANGE',
      confirmation: 'CONFIRMED',
      semanticType: 'MODEL_ASSUMPTION_CHANGE',
      metricLabel: 'Discount Rate (WACC)',
      metricLabelTh: 'อัตราคิดลด (WACC)',
      previousValue: `${previous.valuation.assumptions.waccPct}%`,
      currentValue: `${current.valuation.assumptions.waccPct}%`,
      deltaDisplay: `${waccDelta >= 0 ? '+' : ''}${waccDelta.toFixed(2)}% pts`,
      materiality: Math.abs(waccDelta) >= 0.75 ? 'HIGH' : 'MEDIUM',
      explanation: `WACC adjusted by ${waccDelta >= 0 ? '+' : ''}${waccDelta.toFixed(2)} percentage points (model assumption change, not operating company evidence).`,
      explanationTh: `อัตราคิดลด WACC ปรับเปลี่ยน ${waccDelta >= 0 ? '+' : ''}${waccDelta.toFixed(2)} จุดเปอร์เซ็นต์ (การปรับสมมติฐานแบบจำลอง ไม่ใช่หลักฐานการดำเนินงานจริงของบริษัท)`,
      provenance: 'MODEL_ASSUMPTION'
    });
  }

  const tgDelta = baseDelta.valuationAssumptionsDelta.terminalGrowthDeltaPoints;
  if (tgDelta !== null && Math.abs(tgDelta) >= 0.1) {
    items.push({
      id: 'change_terminal_growth',
      category: 'VALUATION',
      domain: 'THESIS_MODEL_CHANGE',
      confirmation: 'CONFIRMED',
      semanticType: 'MODEL_ASSUMPTION_CHANGE',
      metricLabel: 'Terminal Growth Rate',
      metricLabelTh: 'อัตราการเติบโตระยะยาว (Terminal Growth)',
      previousValue: `${previous.valuation.assumptions.terminalGrowthPct}%`,
      currentValue: `${current.valuation.assumptions.terminalGrowthPct}%`,
      deltaDisplay: `${tgDelta >= 0 ? '+' : ''}${tgDelta.toFixed(2)}% pts`,
      materiality: Math.abs(tgDelta) >= 0.5 ? 'HIGH' : 'MEDIUM',
      explanation: `Terminal growth adjusted by ${tgDelta >= 0 ? '+' : ''}${tgDelta.toFixed(2)} percentage points (model assumption change).`,
      explanationTh: `อัตราการเติบโตระยะยาว (Terminal Growth) ปรับเปลี่ยน ${tgDelta >= 0 ? '+' : ''}${tgDelta.toFixed(2)} จุดเปอร์เซ็นต์ (การปรับสมมติฐานแบบจำลอง)`,
      provenance: 'MODEL_ASSUMPTION'
    });
  }

  const projYearsDelta = baseDelta.valuationAssumptionsDelta.projectionYearsDelta;
  if (projYearsDelta !== null && projYearsDelta !== 0) {
    const prevYears = previous.valuation.assumptions.projectionYears ?? previous.valuation.inputSnapshot?.projectionYears;
    const curYears = current.valuation.assumptions.projectionYears ?? current.valuation.inputSnapshot?.projectionYears;
    items.push({
      id: 'change_projection_years',
      category: 'VALUATION',
      domain: 'THESIS_MODEL_CHANGE',
      confirmation: 'CONFIRMED',
      semanticType: 'MODEL_ASSUMPTION_CHANGE',
      metricLabel: 'Projection Horizon',
      metricLabelTh: 'ระยะเวลาการประมาณการ (Projection Horizon)',
      previousValue: `${prevYears} years`,
      currentValue: `${curYears} years`,
      deltaDisplay: `${projYearsDelta >= 0 ? '+' : ''}${projYearsDelta} yrs`,
      materiality: 'HIGH',
      explanation: `Projection horizon adjusted from ${prevYears} to ${curYears} years (model structure change, not operating company evidence).`,
      explanationTh: `ระยะเวลาการประมาณการเปลี่ยนจาก ${prevYears} ปีเป็น ${curYears} ปี ซึ่งเป็นการเปลี่ยนแปลงโครงสร้างแบบจำลอง ไม่ใช่หลักฐานการดำเนินงานของบริษัท`,
      provenance: 'MODEL_ASSUMPTION'
    });
  }

  const cagrDelta = baseDelta.valuationAssumptionsDelta.revenueCagrDeltaPoints;
  if (cagrDelta !== null && Math.abs(cagrDelta) >= 0.5) {
    items.push({
      id: 'change_revenue_cagr',
      category: 'VALUATION',
      domain: 'THESIS_MODEL_CHANGE',
      confirmation: 'CONFIRMED',
      semanticType: 'MODEL_ASSUMPTION_CHANGE',
      metricLabel: 'Base Revenue CAGR',
      metricLabelTh: 'อัตราเติบโตรายได้สมมติฐาน (Revenue CAGR)',
      previousValue: `${previous.valuation.assumptions.revenueCagrPct}%`,
      currentValue: `${current.valuation.assumptions.revenueCagrPct}%`,
      deltaDisplay: `${cagrDelta >= 0 ? '+' : ''}${cagrDelta.toFixed(2)}% pts`,
      materiality: Math.abs(cagrDelta) >= 2.0 ? 'HIGH' : 'MEDIUM',
      explanation: `Base revenue CAGR assumption adjusted by ${cagrDelta >= 0 ? '+' : ''}${cagrDelta.toFixed(2)} percentage points (model assumption change).`,
      explanationTh: `สมมติฐานอัตราเติบโตรายได้ (Revenue CAGR) ปรับเปลี่ยน ${cagrDelta >= 0 ? '+' : ''}${cagrDelta.toFixed(2)} จุดเปอร์เซ็นต์ (การปรับสมมติฐานแบบจำลอง)`,
      provenance: 'MODEL_ASSUMPTION'
    });
  }

  const tmDelta = baseDelta.valuationAssumptionsDelta.terminalMarginDeltaPoints;
  if (tmDelta !== null && Math.abs(tmDelta) >= 0.5) {
    const prevTm = previous.valuation.assumptions.terminalMarginPct ?? previous.valuation.assumptions.fcfMarginPct;
    const curTm = current.valuation.assumptions.terminalMarginPct ?? current.valuation.assumptions.fcfMarginPct;
    items.push({
      id: 'change_terminal_margin',
      category: 'VALUATION',
      domain: 'THESIS_MODEL_CHANGE',
      confirmation: 'CONFIRMED',
      semanticType: 'MODEL_ASSUMPTION_CHANGE',
      metricLabel: 'Terminal Margin',
      metricLabelTh: 'อัตรากำไรระยะยาว (Terminal Margin)',
      previousValue: `${prevTm}%`,
      currentValue: `${curTm}%`,
      deltaDisplay: `${tmDelta >= 0 ? '+' : ''}${tmDelta.toFixed(2)}% pts`,
      materiality: Math.abs(tmDelta) >= 2.0 ? 'HIGH' : 'MEDIUM',
      explanation: `Terminal margin assumption adjusted by ${tmDelta >= 0 ? '+' : ''}${tmDelta.toFixed(2)} percentage points (distinct from historical FCF margin).`,
      explanationTh: `สมมติฐานอัตรากำไรระยะยาว (Terminal Margin) ปรับเปลี่ยน ${tmDelta >= 0 ? '+' : ''}${tmDelta.toFixed(2)} จุดเปอร์เซ็นต์ (แยกต่างหากจากอัตรากำไร FCF ในอดีต)`,
      provenance: 'MODEL_ASSUMPTION'
    });
  }

  // 6. SEC Filing Update (Verified Evidence)
  if (current.evidence.secAccession && current.evidence.secAccession !== previous.evidence.secAccession) {
    items.push({
      id: 'change_sec_filing',
      category: 'SEC_FILING',
      domain: 'EVIDENCE_CHANGE',
      confirmation: 'CONFIRMED',
      metricLabel: 'New SEC Filing',
      metricLabelTh: 'แบบรายงานใหม่ต่อ ก.ล.ต. สหรัฐฯ (SEC)',
      previousValue: previous.evidence.secFilingDate || 'Prior filing',
      currentValue: current.evidence.secFilingDate || 'Latest filing',
      deltaDisplay: 'New Filing',
      materiality: 'HIGH',
      explanation: `New SEC filing verified (Accession: ${current.evidence.secAccession}).`,
      explanationTh: `พบแบบรายงานใหม่ต่อ ก.ล.ต. สหรัฐฯ (เลขที่: ${current.evidence.secAccession})`,
      provenance: 'VERIFIED_FACT',
      evidenceRef: current.evidence.secAccession
    });
  }

  // 7. Tracked Expectations Evaluation
  const historicalSnapshots = previous ? [previous] : [];
  const safeExpectations = Array.isArray(trackedExpectations) ? trackedExpectations : [];
  const evaluatedExpectations = evaluateExpectations(safeExpectations, current, historicalSnapshots);
  for (const exp of evaluatedExpectations) {
    if (exp.status === 'MISSED') {
      items.push({
        id: `change_exp_${exp.expectationId}`,
        category: 'EXPECTATIONS',
        domain: 'EVIDENCE_CHANGE',
        confirmation: 'CONFIRMED',
        metricLabel: `Expectation: ${exp.metricLabel}`,
        metricLabelTh: `ความคาดหวัง: ${exp.metricLabel}`,
        previousValue: `Target ${exp.targetValue} (${exp.condition})`,
        currentValue: `Actual ${exp.actualValue}`,
        deltaDisplay: 'MISSED',
        materiality: 'HIGH',
        explanation: `Prior expectation for ${exp.targetPeriod} was missed: actual ${exp.actualValue} vs target ${exp.targetValue}.`,
        explanationTh: `ผลลัพธ์รอบ ${exp.targetPeriod} ไม่เป็นไปตามเป้าหมาย: ตัวเลขจริง ${exp.actualValue} พลาดจากเป้าหมาย ${exp.targetValue}`,
        provenance: 'USER_EXPECTATION_EVALUATION'
      });
    } else if (exp.status === 'EXCEEDED' || exp.status === 'MET') {
      items.push({
        id: `change_exp_${exp.expectationId}`,
        category: 'EXPECTATIONS',
        domain: 'EVIDENCE_CHANGE',
        confirmation: 'CONFIRMED',
        metricLabel: `Expectation: ${exp.metricLabel}`,
        metricLabelTh: `ความคาดหวัง: ${exp.metricLabel}`,
        previousValue: `Target ${exp.targetValue} (${exp.condition})`,
        currentValue: `Actual ${exp.actualValue}`,
        deltaDisplay: exp.status,
        materiality: 'MEDIUM',
        explanation: `Prior expectation for ${exp.targetPeriod} was ${exp.status.toLowerCase()}: actual ${exp.actualValue} vs target ${exp.targetValue}.`,
        explanationTh: `ผลลัพธ์รอบ ${exp.targetPeriod} บรรลุตามที่คาดหวัง (${exp.status}): ตัวเลขจริง ${exp.actualValue} เทียบกับเป้าหมาย ${exp.targetValue}`,
        provenance: 'USER_EXPECTATION_EVALUATION'
      });
    }
  }

  // 8. Risks and Catalysts Transitions (Semantic Deduplication & Lifecycle Reconciliation)
  const riskTransitions = reconcileSubjectLifecycles(
    previous.thesis.keyRisks,
    current.thesis.keyRisks,
    'risk'
  );
  const catalystTransitions = reconcileSubjectLifecycles(
    previous.thesis.catalysts,
    current.thesis.catalysts,
    'catalyst'
  );

  const itemTransitions: TrackedItemTransition[] = [];

  // Process Risks
  for (const trans of riskTransitions) {
    if (trans.lifecycleState === 'CONTINUED_UNCHANGED') {
      itemTransitions.push({
        itemText: trans.currentText || '',
        category: 'risk',
        previousState: 'ACTIVE',
        currentState: 'ACTIVE',
        isCertain: true
      });
      // Exact identical wording continued: no change item emitted
    } else if (trans.lifecycleState === 'CONTINUED_PARAPHRASED') {
      itemTransitions.push({
        itemText: `${trans.currentText} (evolving from: ${trans.previousText})`,
        category: 'risk',
        previousState: 'ACTIVE',
        currentState: 'ACTIVE',
        isCertain: false,
        evidence: 'Ambiguous rephrasing or semantic evolution across reports; review needed'
      });
      items.push({
        id: `change_risk_evolve_${items.length}`,
        category: 'RISKS_AND_CATALYSTS',
        domain: 'RESEARCH_COVERAGE_CHANGE',
        confirmation: 'UNCONFIRMED',
        driftSubtype: 'PROSE_COVERAGE',
        metricLabel: 'Risk Wording Changed — Review Needed',
        metricLabelTh: 'ความเสี่ยงที่อาจเปลี่ยนแปลง — ควรตรวจสอบ',
        previousValue: trans.previousText,
        currentValue: trans.currentText,
        deltaDisplay: 'POSSIBLE RISK CHANGE',
        materiality: 'MEDIUM',
        explanation: `Risk wording evolved: "${trans.currentText}" (prior: "${trans.previousText}"). Review needed to determine if the underlying threat changed.`,
        explanationTh: `ถ้อยคำของความเสี่ยงปรับเปลี่ยน: "${trans.currentText}" (เดิม: "${trans.previousText}") ควรตรวจสอบว่าสาระสำคัญของความเสี่ยงเปลี่ยนไปหรือไม่`,
        provenance: 'AI_AND_STATEMENT_EVIDENCE',
        reviewReason: 'Ambiguous risk rewording across reports; review needed.',
        reviewReasonTh: 'ถ้อยคำความเสี่ยงมีการปรับเปลี่ยน ควรตรวจสอบว่าสาระสำคัญของความเสี่ยงเปลี่ยนไปหรือไม่'
      });
    } else if (trans.lifecycleState === 'NEWLY_TRACKED') {
      itemTransitions.push({
        itemText: trans.currentText || '',
        category: 'risk',
        previousState: 'UNKNOWN',
        currentState: 'NEW',
        isCertain: trans.isCertain,
        evidence: trans.isCertain ? 'Confirmed new risk' : 'Newly introduced in report prose; identity unconfirmed'
      });
      if (trans.isCertain) {
        items.push({
          id: `change_risk_${items.length}`,
          category: 'RISKS_AND_CATALYSTS',
          domain: 'EVIDENCE_CHANGE',
          confirmation: 'CONFIRMED',
          metricLabel: 'New Risk Identified',
          metricLabelTh: 'พบปัจจัยความเสี่ยงใหม่',
          previousValue: 'Not tracked',
          currentValue: trans.currentText,
          deltaDisplay: 'NEW RISK',
          materiality: 'HIGH',
          explanation: `A new material risk emerged: "${trans.currentText}".`,
          explanationTh: `ปรากฏปัจจัยความเสี่ยงใหม่: "${trans.currentText}"`,
          provenance: 'AI_AND_STATEMENT_EVIDENCE'
        });
      } else {
        // Unconfirmed newly mentioned risk -> RESEARCH_COVERAGE_CHANGE, UNCONFIRMED, Needs Review
        items.push({
          id: `change_risk_${items.length}`,
          category: 'RISKS_AND_CATALYSTS',
          domain: 'RESEARCH_COVERAGE_CHANGE',
          confirmation: 'UNCONFIRMED',
          driftSubtype: 'PROSE_COVERAGE',
          metricLabel: 'Possible Risk Change — Review Needed',
          metricLabelTh: 'ความเสี่ยงที่อาจเปลี่ยนแปลง — ควรตรวจสอบ',
          previousValue: 'Not tracked',
          currentValue: trans.currentText,
          deltaDisplay: 'POSSIBLE RISK CHANGE',
          materiality: 'MEDIUM',
          explanation: `Unconfirmed risk statement identified in report prose: "${trans.currentText}". Review needed to verify if a new material threat emerged.`,
          explanationTh: `พบข้อความความเสี่ยงใหม่ในบทวิเคราะห์: "${trans.currentText}" ยังไม่ยืนยันการเปลี่ยนแปลง ควรตรวจสอบเพิ่มเติม`,
          provenance: 'AI_AND_STATEMENT_EVIDENCE',
          reviewReason: 'Unconfirmed risk mentioned in recent report; verify if a real threat emerged.',
          reviewReasonTh: 'พบข้อความความเสี่ยงใหม่ในบทวิเคราะห์ ควรตรวจสอบว่าเป็นข้อเท็จจริงใหม่จริงหรือไม่'
        });
      }
    } else if (trans.lifecycleState === 'OMITTED_FROM_CURRENT_RESEARCH') {
      itemTransitions.push({
        itemText: trans.previousText || '',
        category: 'risk',
        previousState: 'ACTIVE',
        currentState: 'RESOLVED',
        isCertain: false,
        evidence: 'Not mentioned in latest report; resolution unconfirmed'
      });
      // Omitted from prose -> RESEARCH_COVERAGE_CHANGE, RESEARCH_ONLY, LOW
      items.push({
        id: `change_risk_res_${items.length}`,
        category: 'RISKS_AND_CATALYSTS',
        domain: 'RESEARCH_COVERAGE_CHANGE',
        confirmation: 'RESEARCH_ONLY',
        driftSubtype: 'PROSE_COVERAGE',
        metricLabel: 'Risk Wording Omitted From Prose',
        metricLabelTh: 'ถ้อยคำความเสี่ยงไม่ได้ถูกระบุซ้ำในบทวิเคราะห์',
        previousValue: trans.previousText,
        currentValue: 'Omitted from prose',
        deltaDisplay: 'OMITTED FROM PROSE',
        materiality: 'LOW',
        explanation: `Prior risk "${trans.previousText}" was not explicitly restated in recent report prose. This reflects research coverage difference, not confirmed real-world resolution.`,
        explanationTh: `ความเสี่ยงเดิม "${trans.previousText}" ไม่ได้ถูกระบุซ้ำในบทวิเคราะห์ล่าสุด เป็นความแตกต่างของการครอบคลุมเนื้อหา ไม่ใช่การยืนยันว่าปัญหาคลี่คลายในโลกจริง`,
        provenance: 'AI_AND_STATEMENT_EVIDENCE'
      });
    }
  }

  // Process Catalysts
  for (const trans of catalystTransitions) {
    if (trans.lifecycleState === 'CONTINUED_UNCHANGED') {
      itemTransitions.push({
        itemText: trans.currentText || '',
        category: 'catalyst',
        previousState: 'ACTIVE',
        currentState: 'ACTIVE',
        isCertain: true
      });
      // Exact identical wording continued: no change item emitted
    } else if (trans.lifecycleState === 'CONTINUED_PARAPHRASED') {
      itemTransitions.push({
        itemText: `${trans.currentText} (evolving from: ${trans.previousText})`,
        category: 'catalyst',
        previousState: 'ACTIVE',
        currentState: 'ACTIVE',
        isCertain: false,
        evidence: 'Ambiguous rephrasing or semantic evolution across reports; review needed'
      });
      items.push({
        id: `change_cat_evolve_${items.length}`,
        category: 'RISKS_AND_CATALYSTS',
        domain: 'RESEARCH_COVERAGE_CHANGE',
        confirmation: 'UNCONFIRMED',
        driftSubtype: 'PROSE_COVERAGE',
        metricLabel: 'Catalyst Wording Changed — Review Needed',
        metricLabelTh: 'ปัจจัยเร่งที่อาจเปลี่ยนแปลง — ควรตรวจสอบ',
        previousValue: trans.previousText,
        currentValue: trans.currentText,
        deltaDisplay: 'POSSIBLE CATALYST CHANGE',
        materiality: 'LOW',
        explanation: `Catalyst description shifted: "${trans.currentText}" (prior: "${trans.previousText}"). Review needed to determine if the underlying catalyst changed.`,
        explanationTh: `คำอธิบายปัจจัยเร่งปรับเปลี่ยน: "${trans.currentText}" (เดิม: "${trans.previousText}") ควรตรวจสอบว่าสาระสำคัญของปัจจัยเร่งเปลี่ยนไปหรือไม่`,
        provenance: 'AI_AND_MARKET_EVIDENCE',
        reviewReason: 'Ambiguous catalyst rewording across reports; review needed.',
        reviewReasonTh: 'ถ้อยคำปัจจัยเร่งมีการปรับเปลี่ยน ควรตรวจสอบว่าสาระสำคัญของปัจจัยเร่งเปลี่ยนไปหรือไม่'
      });
    } else if (trans.lifecycleState === 'NEWLY_TRACKED') {
      itemTransitions.push({
        itemText: trans.currentText || '',
        category: 'catalyst',
        previousState: 'UNKNOWN',
        currentState: 'NEW',
        isCertain: trans.isCertain,
        evidence: trans.isCertain ? 'Confirmed new catalyst' : 'Newly introduced in report prose; identity unconfirmed'
      });
      if (trans.isCertain) {
        items.push({
          id: `change_cat_${items.length}`,
          category: 'RISKS_AND_CATALYSTS',
          domain: 'EVIDENCE_CHANGE',
          confirmation: 'CONFIRMED',
          metricLabel: 'New Catalyst Tracked',
          metricLabelTh: 'พบปัจจัยเร่งใหม่ (Catalyst)',
          previousValue: 'Not tracked',
          currentValue: trans.currentText,
          deltaDisplay: 'NEW CATALYST',
          materiality: 'MEDIUM',
          explanation: `New upcoming catalyst detected: "${trans.currentText}".`,
          explanationTh: `พบปัจจัยบวกเร่งตัวใหม่: "${trans.currentText}"`,
          provenance: 'AI_AND_MARKET_EVIDENCE'
        });
      } else {
        // Unconfirmed newly mentioned catalyst -> RESEARCH_COVERAGE_CHANGE, UNCONFIRMED, Needs Review
        items.push({
          id: `change_cat_${items.length}`,
          category: 'RISKS_AND_CATALYSTS',
          domain: 'RESEARCH_COVERAGE_CHANGE',
          confirmation: 'UNCONFIRMED',
          driftSubtype: 'PROSE_COVERAGE',
          metricLabel: 'Possible Catalyst Change',
          metricLabelTh: 'ปัจจัยเร่งที่อาจเปลี่ยนแปลง (ยังไม่ยืนยัน)',
          previousValue: 'Not tracked',
          currentValue: trans.currentText,
          deltaDisplay: 'POSSIBLE CATALYST CHANGE',
          materiality: 'LOW',
          explanation: `New catalyst mentioned in report prose: "${trans.currentText}". Unconfirmed lifecycle change.`,
          explanationTh: `พบการกล่าวถึงปัจจัยเร่งใหม่ในบทวิเคราะห์: "${trans.currentText}" ยังไม่ยืนยัน`,
          provenance: 'AI_AND_MARKET_EVIDENCE',
          reviewReason: 'Unconfirmed catalyst mentioned in recent report prose.',
          reviewReasonTh: 'พบการกล่าวถึงปัจจัยเร่งใหม่ในบทวิเคราะห์ ยังไม่ยืนยัน'
        });
      }
    } else if (trans.lifecycleState === 'OMITTED_FROM_CURRENT_RESEARCH') {
      itemTransitions.push({
        itemText: trans.previousText || '',
        category: 'catalyst',
        previousState: 'ACTIVE',
        currentState: 'RESOLVED',
        isCertain: false,
        evidence: 'Not mentioned in latest report; resolution unconfirmed'
      });
      // Omitted from prose -> RESEARCH_COVERAGE_CHANGE, RESEARCH_ONLY, LOW
      items.push({
        id: `change_cat_res_${items.length}`,
        category: 'RISKS_AND_CATALYSTS',
        domain: 'RESEARCH_COVERAGE_CHANGE',
        confirmation: 'RESEARCH_ONLY',
        driftSubtype: 'PROSE_COVERAGE',
        metricLabel: 'Catalyst Wording Omitted From Prose',
        metricLabelTh: 'ถ้อยคำปัจจัยเร่งไม่ได้ถูกระบุซ้ำในบทวิเคราะห์',
        previousValue: trans.previousText,
        currentValue: 'Omitted from prose',
        deltaDisplay: 'OMITTED FROM PROSE',
        materiality: 'LOW',
        explanation: `Prior catalyst "${trans.previousText}" was not explicitly listed in recent report prose. This reflects research coverage difference, not confirmed real-world conclusion.`,
        explanationTh: `ปัจจัยเร่งเดิม "${trans.previousText}" ไม่ได้ถูกระบุในบทวิเคราะห์ล่าสุด เป็นความแตกต่างของการครอบคลุมเนื้อหา`,
        provenance: 'AI_AND_MARKET_EVIDENCE'
      });
    }
  }

  // 9. Valuation Change Attribution (Counterfactual Replay or Truthful Fallback)
  let valuationAttribution: ValuationAttribution | null = null;
  if (baseDelta.fairValueDelta) {
    valuationAttribution = runCounterfactualDcfReplay(current, previous, baseDelta);
  }

  // 10. Compute Canonical Summary
  // Confirmed company/model changes only:
  // - EVIDENCE_CHANGE or RESTATED_EVIDENCE or THESIS_MODEL_CHANGE
  // - CONFIRMED confirmation status
  // - Materiality HIGH or MEDIUM
  // - Excludes downstream Conviction Score to prevent double-counting
  // - Excludes DATA_CORRECTION and SOURCE_UPGRADE (which are data quality/revisions, not company changes)
  const confirmedMaterial = items.filter(
    i => (i.domain === 'EVIDENCE_CHANGE' || i.domain === 'RESTATED_EVIDENCE' || (i.domain === 'THESIS_MODEL_CHANGE' && i.id !== 'change_conviction')) &&
      i.confirmation === 'CONFIRMED' &&
      (i.materiality === 'HIGH' || i.materiality === 'MEDIUM')
  ).length;

  const needsReview = items.filter(
    i => i.confirmation === 'UNCONFIRMED' ||
      (i.domain === 'DATA_CORRECTION' && i.confirmation !== 'CONFIRMED')
  ).length;

  const researchCoverage = items.filter(
    i => i.confirmation !== 'UNCONFIRMED' &&
      (i.domain === 'RESEARCH_COVERAGE_CHANGE' ||
       i.confirmation === 'RESEARCH_ONLY' ||
       i.domain === 'ANALYSIS_DRIFT' ||
       i.domain === 'SOURCE_UPGRADE' ||
       (i.domain === 'DATA_CORRECTION' && i.confirmation === 'SUPPORTED'))
  ).length;

  const high = items.filter(i => i.materiality === 'HIGH').length;
  const medium = items.filter(i => i.materiality === 'MEDIUM').length;
  const low = items.filter(i => i.materiality === 'LOW' || i.materiality === 'INFORMATIONAL').length;

  const summary: WhatChangedSummary = {
    totalDetected: items.length,
    confirmedMaterial,
    needsReview,
    researchCoverage,
    high,
    medium,
    low
  };

  const hasMaterialChanges = confirmedMaterial > 0;
  const materialChangesCount = confirmedMaterial;

  // Build Summary Narratives using Canonical Summary
  let summaryNarrative = '';
  let summaryNarrativeTh = '';

  if (items.length === 0) {
    summaryNarrative = `No material changes detected for ${current.ticker} compared to prior distinct research snapshot.`;
    summaryNarrativeTh = `ไม่พบการเปลี่ยนแปลงที่มีนัยสำคัญจากการวิเคราะห์ก่อนหน้าสำหรับ ${current.ticker}`;
  } else if (confirmedMaterial === 0) {
    summaryNarrative = `Identified ${summary.totalDetected} total differences since prior research: 0 confirmed material changes, ${summary.needsReview} items need review, and ${summary.researchCoverage} research & analysis drift differences.`;
    summaryNarrativeTh = `ตรวจพบความแตกต่าง ${summary.totalDetected} รายการจากการวิเคราะห์ก่อนหน้า: ยังไม่มีการเปลี่ยนแปลงที่ยืนยันแล้วและมีนัยสำคัญ, มี ${summary.needsReview} ประเด็นที่ควรตรวจสอบเพิ่มเติม และ ${summary.researchCoverage} รายการเป็นความแตกต่างจากงานวิจัยและการวิเคราะห์`;
  } else {
    summaryNarrative = `Identified ${summary.confirmedMaterial} confirmed material changes (${summary.high} high priority) since prior research on ${previous.asOfDate}.`;
    summaryNarrativeTh = `ตรวจพบการเปลี่ยนแปลงที่ยืนยันแล้ว ${summary.confirmedMaterial} รายการ (${summary.high} ระดับสำคัญสูง) นับจากการวิเคราะห์ครั้งก่อนเมื่อ ${previous.asOfDate}`;
  }

  return {
    ticker: current.ticker,
    previousReportId: previous.reportId,
    currentReportId: current.reportId,
    previousDate: previous.asOfDate,
    currentDate: current.asOfDate,
    daysBetween: baseDelta.daysBetween,
    hasMaterialChanges,
    materialChangesCount,
    summary,
    items,
    valuationAttribution,
    evaluatedExpectations,
    itemTransitions,
    summaryNarrative,
    summaryNarrativeTh
  };
}

export type SemanticBadgeType =
  | 'EVIDENCE'
  | 'MODEL_ASSUMPTION'
  | 'MARKET'
  | 'VALUATION_OUTPUT'
  | 'DATA_CORRECTION'
  | 'SOURCE_UPGRADE'
  | 'DERIVED_OUTPUT'
  | 'RESTATED';

export interface SemanticCategoryBadge {
  label: string;
  badgeType: SemanticBadgeType;
  className: string;
}

/**
 * Returns a compact, truthful semantic category badge for a ChangeItem.
 * Reuses existing domain, semanticType, category, and id metadata without guessing from prose.
 */
export function getSemanticCategoryBadge(
  item: ChangeItem,
  isThai: boolean
): SemanticCategoryBadge {
  if (item.id === 'change_fair_value' || item.semanticType === 'VALUATION_MODEL_OUTPUT_CHANGE') {
    return {
      label: isThai ? 'ผลลัพธ์แบบจำลอง' : 'VALUATION OUTPUT',
      badgeType: 'VALUATION_OUTPUT',
      className: 'bg-indigo-50 text-indigo-700 border-indigo-200'
    };
  }
  if (
    item.id === 'change_wacc' ||
    item.semanticType === 'MODEL_ASSUMPTION_CHANGE' ||
    item.domain === 'THESIS_MODEL_CHANGE'
  ) {
    return {
      label: isThai ? 'สมมติฐานแบบจำลอง' : 'MODEL ASSUMPTION',
      badgeType: 'MODEL_ASSUMPTION',
      className: 'bg-blue-50 text-blue-700 border-blue-200'
    };
  }
  if (item.domain === 'MARKET_CONTEXT_CHANGE' || item.category === 'MARKET_PRICE') {
    return {
      label: isThai ? 'ตลาด' : 'MARKET',
      badgeType: 'MARKET',
      className: 'bg-amber-50 text-amber-800 border-amber-200'
    };
  }
  if (item.domain === 'RESTATED_EVIDENCE' || item.semanticType === 'RESTATED_OR_AMENDED_EVIDENCE') {
    return {
      label: isThai ? 'ปรับงบย้อนหลัง' : 'RESTATED',
      badgeType: 'RESTATED',
      className: 'bg-purple-50 text-purple-700 border-purple-200'
    };
  }
  if (item.domain === 'SOURCE_UPGRADE' || item.semanticType === 'SOURCE_UPGRADE') {
    return {
      label: isThai ? 'อัปเกรดแหล่งข้อมูล' : 'SOURCE UPGRADE',
      badgeType: 'SOURCE_UPGRADE',
      className: 'bg-cyan-50 text-cyan-700 border-cyan-200'
    };
  }
  if (item.domain === 'DATA_CORRECTION' || item.semanticType === 'DATA_CORRECTION_OR_NORMALIZATION_CHANGE') {
    return {
      label: isThai ? 'แก้ไขข้อมูล' : 'DATA CORRECTION',
      badgeType: 'DATA_CORRECTION',
      className: 'bg-stone-100 text-stone-700 border-stone-300'
    };
  }
  if (item.semanticType === 'DERIVED_OUTPUT_CHANGE' || item.id === 'change_conviction') {
    return {
      label: isThai ? 'ผลลัพธ์ต่อเนื่อง' : 'DERIVED OUTPUT',
      badgeType: 'DERIVED_OUTPUT',
      className: 'bg-teal-50 text-teal-700 border-teal-200'
    };
  }
  // Default to EVIDENCE for real-world verified company facts
  return {
    label: isThai ? 'ข้อมูลจริง' : 'EVIDENCE',
    badgeType: 'EVIDENCE',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200'
  };
}

/**
 * Returns a truthful, human-readable display label for valuation primaryDriver.
 * Explicitly guards against showing "UNCHANGED" when fair value visibly moved.
 */
export function formatValuationDriverLabel(
  driver: string,
  isThai: boolean,
  fairValueDeltaPct?: number | null
): string {
  const hasVisibleFvMove = typeof fairValueDeltaPct === 'number' && Math.abs(fairValueDeltaPct) >= 0.05;

  if (driver === 'NO_MATERIAL_ATTRIBUTION' || (driver === 'UNCHANGED' && hasVisibleFvMove)) {
    return isThai ? 'ไม่มีสาเหตุหลักที่มีนัยสำคัญ' : 'NO MATERIAL ATTRIBUTION';
  }
  if (driver === 'UNCHANGED') {
    return isThai ? 'ไม่เปลี่ยนแปลง' : 'UNCHANGED';
  }
  if (driver === 'CASH_FLOW_AND_MARGINS') {
    return isThai ? 'กระแสเงินสดและอัตรากำไร' : 'CASH FLOW & MARGINS';
  }
  if (driver === 'GROWTH_EXPECTATIONS') {
    return isThai ? 'การคาดการณ์การเติบโต' : 'GROWTH EXPECTATIONS';
  }
  if (driver === 'DISCOUNT_RATE') {
    return isThai ? 'อัตราคิดลด (WACC)' : 'DISCOUNT RATE (WACC)';
  }
  if (driver === 'CAPITAL_STRUCTURE') {
    return isThai ? 'โครงสร้างเงินทุนและจำนวนหุ้น' : 'CAPITAL STRUCTURE & SHARES';
  }
  if (driver === 'SECTOR_MODEL_SWITCH') {
    return isThai ? 'เปลี่ยนประเภทแบบจำลอง' : 'SECTOR MODEL SWITCH';
  }
  if (driver === 'HEURISTIC_ASSOCIATION') {
    return isThai ? 'ความสัมพันธ์เชิงทิศทาง (Heuristic)' : 'HEURISTIC ASSOCIATION';
  }
  if (driver === 'UNAVAILABLE' || driver === 'ATTRIBUTION_UNAVAILABLE') {
    return isThai ? 'ไม่สามารถแจกแจงเชิงคำนวณได้' : 'ATTRIBUTION UNAVAILABLE';
  }
  if (driver === 'ATTRIBUTION_INPUTS_INCOMPLETE') {
    return isThai ? 'ชุดข้อมูลไม่เพียงพอต่อการแจกแจงสาเหตุ' : 'ATTRIBUTION INPUTS INCOMPLETE';
  }
  if (driver === 'MULTIPLE_MODEL_ASSUMPTIONS') {
    return isThai ? 'สมมติฐานหลายรายการ (Heuristic)' : 'MULTIPLE MODEL ASSUMPTIONS';
  }
  if (driver === 'MIXED_MODEL_ASSUMPTIONS') {
    return isThai ? 'สมมติฐานเปลี่ยนทิศทางผสม (Mixed)' : 'MIXED MODEL ASSUMPTION CHANGES';
  }
  return driver.replace(/_/g, ' ');
}
