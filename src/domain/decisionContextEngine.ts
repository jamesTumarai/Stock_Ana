import { ResearchMemorySnapshot } from './investmentMemory';
import { InvestmentThesisRecord, TrackedExpectation } from './thesisExpectations';
import { WhatChangedResult } from './whatChangedEngine';

export type ReEvaluationStance =
  | 'RE_EVALUATION_WARRANTED'
  | 'THESIS_CONDITION_TRIGGERED'
  | 'VALUATION_REVISION_NOTED'
  | 'EXPECTATIONS_REVIEW_NEEDED'
  | 'MONITORING_CONTINUES_UNCHANGED'
  | 'NO_PRIOR_RESEARCH_FOUND';

export interface DecisionReason {
  id: string;
  category: 'THESIS' | 'EXPECTATION' | 'VALUATION' | 'RISK' | 'SEC' | 'PRICE';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  titleTh: string;
  detail: string;
  detailTh: string;
  evidenceRef?: string | null;
}

export interface DecisionContextResult {
  ticker: string;
  stance: ReEvaluationStance;
  headline: string;
  headlineTh: string;
  requiresAttention: boolean;
  reasons: DecisionReason[];
  priorBeliefSummary: {
    thesisSummary: string | null;
    priorFairValue: number | null;
    priorMarketPrice: number | null;
    priorConvictionScore: number | null;
    priorResearchDate: string | null;
  };
  expectationsSummary: {
    totalTracked: number;
    metCount: number;
    missedCount: number;
    pendingCount: number;
    missedDetails: string[];
  };
  valuationContext: {
    currentFairValue: number | null;
    currentMarketPrice: number | null;
    currentMarginOfSafetyPct: number | null;
    primaryAttribution: string | null;
    primaryAttributionTh: string | null;
  };
  invalidationTriggersFound: string[];
  summaryNarrative: string;
  summaryNarrativeTh: string;
}

/**
 * Deterministically constructs actionable Decision Context for re-evaluation.
 * Synthesizes prior belief + expectations status + what changed into objective decision support.
 * Never issues automated Buy/Sell commands.
 */
export function buildDecisionContext(
  currentSnapshot: ResearchMemorySnapshot,
  previousSnapshot: ResearchMemorySnapshot | null,
  activeThesis: InvestmentThesisRecord | null,
  whatChanged: WhatChangedResult | null,
  expectations: TrackedExpectation[] = []
): DecisionContextResult {
  const ticker = currentSnapshot.ticker;

  // If no prior research exists:
  if (!previousSnapshot) {
    return {
      ticker,
      stance: 'NO_PRIOR_RESEARCH_FOUND',
      headline: `Initial Research Baseline Established for ${ticker}`,
      headlineTh: `สร้างเกณฑ์การวิจัยเริ่มต้นสำหรับ ${ticker}`,
      requiresAttention: false,
      reasons: [
        {
          id: 'initial_research',
          category: 'THESIS',
          severity: 'INFO',
          title: 'First Recorded Research Session',
          titleTh: 'การบันทึกการวิจัยครั้งแรก',
          detail: 'This report serves as the initial investment memory baseline for subsequent comparisons.',
          detailTh: 'รายงานฉบับนี้ทำหน้าที่เป็นฐานข้อมูลหน่วยความจำการลงทุนสำหรับการเปรียบเทียบในอนาคต'
        }
      ],
      priorBeliefSummary: {
        thesisSummary: null,
        priorFairValue: null,
        priorMarketPrice: null,
        priorConvictionScore: null,
        priorResearchDate: null
      },
      expectationsSummary: {
        totalTracked: expectations.length,
        metCount: 0,
        missedCount: 0,
        pendingCount: expectations.length,
        missedDetails: []
      },
      valuationContext: {
        currentFairValue: currentSnapshot.valuation.baseFairValue,
        currentMarketPrice: currentSnapshot.marketPrice,
        currentMarginOfSafetyPct: currentSnapshot.valuation.marginOfSafetyPct,
        primaryAttribution: null,
        primaryAttributionTh: null
      },
      invalidationTriggersFound: [],
      summaryNarrative: `Initial research established for ${ticker}. Form a thesis and track expectations for future comparative re-evaluation.`,
      summaryNarrativeTh: `สร้างการวิเคราะห์เริ่มต้นสำหรับ ${ticker} เรียบร้อยแล้ว กำหนดสมมติฐานและบันทึกความคาดหวังเพื่อใช้ประเมินซ้ำในอนาคต`
    };
  }

  const reasons: DecisionReason[] = [];
  const invalidationTriggersFound: string[] = [];

  // 1. Invalidation Conditions Check
  if (activeThesis?.invalidationConditions && activeThesis.invalidationConditions.length > 0) {
    for (const cond of activeThesis.invalidationConditions) {
      // Check if operating margin or FCF trigger
      if (cond.toLowerCase().includes('margin') && currentSnapshot.financials.operatingMarginPct !== null) {
        const matchNum = cond.match(/(\d+(\.\d+)?)%/);
        if (matchNum) {
          const threshold = parseFloat(matchNum[1]);
          if (currentSnapshot.financials.operatingMarginPct < threshold) {
            invalidationTriggersFound.push(cond);
            reasons.push({
              id: 'trig_margin_invalidation',
              category: 'THESIS',
              severity: 'CRITICAL',
              title: 'Thesis Invalidation Condition Triggered',
              titleTh: 'เงื่อนไขการหักล้างสมมติฐานถูกกระตุ้น',
              detail: `Operating margin (${currentSnapshot.financials.operatingMarginPct.toFixed(1)}%) fell below tracked invalidation threshold (${threshold}%).`,
              detailTh: `อัตรากำไรจากการดำเนินงาน (${currentSnapshot.financials.operatingMarginPct.toFixed(1)}%) ลดลงต่ำกว่าเกณฑ์การหักล้างที่กำหนด (${threshold}%)`
            });
          }
        }
      }
    }
  }

  // 2. Expectations Evaluation Check
  const missedExps = expectations.filter(e => e.status === 'MISSED');
  const metExps = expectations.filter(e => e.status === 'MET' || e.status === 'EXCEEDED');
  const pendingExps = expectations.filter(e => e.status === 'PENDING');
  const missedDetails: string[] = [];

  for (const exp of missedExps) {
    missedDetails.push(`${exp.metricLabel} (Target: ${exp.targetValue}, Actual: ${exp.actualValue})`);
    reasons.push({
      id: `exp_miss_${exp.expectationId}`,
      category: 'EXPECTATION',
      severity: 'WARNING',
      title: `Expectation Missed: ${exp.metricLabel}`,
      titleTh: `ผลลัพธ์พลาดเป้าหมาย: ${exp.metricLabel}`,
      detail: `Reported actual ${exp.actualValue} vs target expectation of ${exp.targetValue} for ${exp.targetPeriod}.`,
      detailTh: `ผลลัพธ์จริง ${exp.actualValue} พลาดจากเป้าหมายที่คาดไว้ ${exp.targetValue} ในงวด ${exp.targetPeriod}`
    });
  }

  // 3. What Changed Material Deltas Check
  if (whatChanged) {
    for (const item of whatChanged.items) {
      if (item.materiality === 'HIGH') {
        let cat: DecisionReason['category'] = 'VALUATION';
        if (item.category === 'SEC_FILING') cat = 'SEC';
        else if (item.category === 'RISKS_AND_CATALYSTS') cat = 'RISK';
        else if (item.category === 'MARKET_PRICE') cat = 'PRICE';

        // Avoid duplicate if already covered by expectation
        if (item.category !== 'EXPECTATIONS') {
          reasons.push({
            id: `dec_${item.id}`,
            category: cat,
            severity: item.category === 'SEC_FILING' ? 'INFO' : 'WARNING',
            title: item.metricLabel,
            titleTh: item.metricLabelTh,
            detail: item.explanation,
            detailTh: item.explanationTh,
            evidenceRef: item.evidenceRef
          });
        }
      }
    }
  }

  // Determine Stance & Headline
  let stance: ReEvaluationStance = 'MONITORING_CONTINUES_UNCHANGED';
  let headline = `Thesis Intact — Monitoring Continues for ${ticker}`;
  let headlineTh = `สมมติฐานการลงทุนยังคงสมบูรณ์ — ติดตามต่อเนื่องสำหรับ ${ticker}`;

  if (invalidationTriggersFound.length > 0) {
    stance = 'THESIS_CONDITION_TRIGGERED';
    headline = `Thesis Invalidation Alert — Immediate Re-evaluation Required for ${ticker}`;
    headlineTh = `แจ้งเตือนเงื่อนไขหักล้างสมมติฐาน — ควรประเมินซ้ำทันทีสำหรับ ${ticker}`;
  } else if (missedExps.length > 0) {
    stance = 'EXPECTATIONS_REVIEW_NEEDED';
    headline = `Expectations Missed — Fundamental Review Warranted for ${ticker}`;
    headlineTh = `ผลลัพธ์พลาดจากความคาดหวัง — ควรทบทวนปัจจัยพื้นฐานสำหรับ ${ticker}`;
  } else if (whatChanged && whatChanged.materialChangesCount >= 3) {
    stance = 'RE_EVALUATION_WARRANTED';
    headline = `Material Changes Detected — Re-evaluation Warranted for ${ticker}`;
    headlineTh = `พบการเปลี่ยนแปลงที่มีนัยสำคัญหลายประการ — ควรประเมินความเชื่อมั่นซ้ำสำหรับ ${ticker}`;
  } else if (whatChanged && whatChanged.items.some(i => i.id === 'change_fair_value' && i.materiality === 'HIGH')) {
    stance = 'VALUATION_REVISION_NOTED';
    headline = `Material Valuation Adjustment — Review Assumptions for ${ticker}`;
    headlineTh = `มูลค่ายุติธรรมเปลี่ยนแปลงอย่างมีนัยสำคัญ — ควรทบทวนสมมติฐานสำหรับ ${ticker}`;
  }

  const requiresAttention = stance !== 'MONITORING_CONTINUES_UNCHANGED';

  // Build Summaries
  let summaryNarrative = '';
  let summaryNarrativeTh = '';

  if (!requiresAttention) {
    summaryNarrative = `Prior investment thesis and key drivers remain intact across the latest research interval. No invalidation triggers or material expectation misses detected.`;
    summaryNarrativeTh = `สมมติฐานการลงทุนและปัจจัยขับเคลื่อนหลักยังคงสมบูรณ์ตามการวิจัยล่าสุด ไม่พบเงื่อนไขการหักล้างหรือผลประกอบการที่พลาดเป้าหมายอย่างมีนัยสำคัญ`;
  } else {
    summaryNarrative = `Identified ${reasons.length} key decision factor(s) warranting closer re-evaluation. Review the specific drivers and expectation variances below before updating thesis conviction.`;
    summaryNarrativeTh = `พบ ${reasons.length} ปัจจัยสำคัญที่ควรนำมาพิจารณาประเมินซ้ำ กรุณาตรวจสอบรายละเอียดความแปรผันของผลการดำเนินงานและสมมติฐานด้านล่างก่อนปรับระดับความเชื่อมั่น`;
  }

  return {
    ticker,
    stance,
    headline,
    headlineTh,
    requiresAttention,
    reasons,
    priorBeliefSummary: {
      thesisSummary: activeThesis?.summary || previousSnapshot.thesis.summary,
      priorFairValue: previousSnapshot.valuation.baseFairValue,
      priorMarketPrice: previousSnapshot.marketPrice,
      priorConvictionScore: previousSnapshot.conviction.score,
      priorResearchDate: previousSnapshot.asOfDate
    },
    expectationsSummary: {
      totalTracked: expectations.length,
      metCount: metExps.length,
      missedCount: missedExps.length,
      pendingCount: pendingExps.length,
      missedDetails
    },
    valuationContext: {
      currentFairValue: currentSnapshot.valuation.baseFairValue,
      currentMarketPrice: currentSnapshot.marketPrice,
      currentMarginOfSafetyPct: currentSnapshot.valuation.marginOfSafetyPct,
      primaryAttribution: whatChanged?.valuationAttribution?.impactDescription || null,
      primaryAttributionTh: whatChanged?.valuationAttribution?.impactDescriptionTh || null
    },
    invalidationTriggersFound,
    summaryNarrative,
    summaryNarrativeTh
  };
}
