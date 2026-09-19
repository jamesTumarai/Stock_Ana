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
  | 'MARKET_CONTEXT_CHANGE';

export type ChangeConfirmation =
  | 'CONFIRMED'
  | 'SUPPORTED'
  | 'UNCONFIRMED'
  | 'RESEARCH_ONLY';

export type DriftSubtype = 'PROSE_COVERAGE' | 'ANALYSIS_MODEL_DRIFT';

export type ChangeMateriality = 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';

export interface ChangeItem {
  id: string;
  category: ChangeCategory;
  domain: ChangeDomain;
  confirmation: ChangeConfirmation;
  driftSubtype?: DriftSubtype;
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
}

export interface ValuationAttribution {
  primaryDriver:
    | 'CASH_FLOW_AND_MARGINS'
    | 'GROWTH_EXPECTATIONS'
    | 'DISCOUNT_RATE'
    | 'CAPITAL_STRUCTURE'
    | 'SECTOR_MODEL_SWITCH'
    | 'UNCHANGED'
    | 'UNAVAILABLE';
  impactDescription: string;
  impactDescriptionTh: string;
  isDeterministic: boolean;
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

  // 1. Valuation Changes (Model / Thesis)
  if (baseDelta.fairValueDelta && Math.abs(baseDelta.fairValueDelta.deltaPct) >= 0.1) {
    const deltaPct = baseDelta.fairValueDelta.deltaPct;
    const absDelta = Math.abs(deltaPct);
    const materiality: ChangeMateriality = absDelta >= 10 ? 'HIGH' : absDelta >= 5 ? 'MEDIUM' : 'LOW';

    items.push({
      id: 'change_fair_value',
      category: 'VALUATION',
      domain: 'THESIS_MODEL_CHANGE',
      confirmation: 'CONFIRMED',
      metricLabel: 'Base Fair Value',
      metricLabelTh: 'มูลค่ายุติธรรมพื้นฐาน',
      previousValue: `$${baseDelta.fairValueDelta.previous.toFixed(2)}`,
      currentValue: `$${baseDelta.fairValueDelta.current.toFixed(2)}`,
      deltaDisplay: `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%`,
      materiality,
      explanation: `Fair value shifted by ${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}% between research periods.`,
      explanationTh: `มูลค่ายุติธรรมเปลี่ยนแปลง ${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}% ระหว่างช่วงการวิจัย`,
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

  // 3. Conviction Score Shift (Evidence-driven vs Analysis Drift)
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
        metricLabel: 'Conviction Score',
        metricLabelTh: 'คะแนนความเชื่อมั่น',
        previousValue: `${prevScore}/100`,
        currentValue: `${curScore}/100`,
        deltaDisplay: `${pts >= 0 ? '+' : ''}${pts} pts`,
        materiality: Math.abs(pts) >= 10 ? 'HIGH' : Math.abs(pts) >= 5 ? 'MEDIUM' : 'LOW',
        explanation: `Conviction shifted by ${pts >= 0 ? '+' : ''}${pts} points (${prevScore} → ${curScore}), supported by verified fundamental/model adjustments.`,
        explanationTh: `คะแนนความเชื่อมั่นเปลี่ยนไป ${pts >= 0 ? '+' : ''}${pts} จุด (${prevScore} → ${curScore}) โดยสอดคล้องกับการเปลี่ยนแปลงข้อมูลจริงหรือแบบจำลองที่ยืนยันแล้ว`,
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

  // 4. Financial Facts (Revenue YoY, Margin, Net Income, FCF)
  if (baseDelta.revenueYoYDelta && Math.abs(baseDelta.revenueYoYDelta.deltaPctPoints) >= 2.0) {
    const pts = baseDelta.revenueYoYDelta.deltaPctPoints;
    items.push({
      id: 'change_revenue_yoy',
      category: 'FINANCIAL_FACTS',
      domain: 'EVIDENCE_CHANGE',
      confirmation: 'CONFIRMED',
      metricLabel: 'Revenue YoY Growth',
      metricLabelTh: 'การเติบโตรายได้ YoY',
      previousValue: `${baseDelta.revenueYoYDelta.previous.toFixed(1)}%`,
      currentValue: `${baseDelta.revenueYoYDelta.current.toFixed(1)}%`,
      deltaDisplay: `${pts >= 0 ? '+' : ''}${pts.toFixed(1)}% pts`,
      materiality: Math.abs(pts) >= 5.0 ? 'HIGH' : 'MEDIUM',
      explanation: `Revenue YoY rate moved by ${pts >= 0 ? '+' : ''}${pts.toFixed(1)} percentage points.`,
      explanationTh: `อัตราการเติบโตรายได้ YoY เปลี่ยนแปลง ${pts >= 0 ? '+' : ''}${pts.toFixed(1)} จุดเปอร์เซ็นต์`,
      provenance: current.financials.provenance
    });
  }

  if (baseDelta.operatingMarginDelta && Math.abs(baseDelta.operatingMarginDelta.deltaPctPoints) >= 1.5) {
    const pts = baseDelta.operatingMarginDelta.deltaPctPoints;
    items.push({
      id: 'change_op_margin',
      category: 'FINANCIAL_FACTS',
      domain: 'EVIDENCE_CHANGE',
      confirmation: 'CONFIRMED',
      metricLabel: 'Operating Margin',
      metricLabelTh: 'อัตรากำไรจากการดำเนินงาน',
      previousValue: `${baseDelta.operatingMarginDelta.previous.toFixed(1)}%`,
      currentValue: `${baseDelta.operatingMarginDelta.current.toFixed(1)}%`,
      deltaDisplay: `${pts >= 0 ? '+' : ''}${pts.toFixed(1)}% pts`,
      materiality: Math.abs(pts) >= 3.0 ? 'HIGH' : 'MEDIUM',
      explanation: `Operating margin moved by ${pts >= 0 ? '+' : ''}${pts.toFixed(1)} percentage points.`,
      explanationTh: `อัตรากำไรจากการดำเนินงานเปลี่ยนแปลง ${pts >= 0 ? '+' : ''}${pts.toFixed(1)} จุดเปอร์เซ็นต์`,
      provenance: current.financials.provenance
    });
  }

  if (baseDelta.netIncomeDelta && Math.abs(baseDelta.netIncomeDelta.deltaPct) >= 5.0) {
    const pct = baseDelta.netIncomeDelta.deltaPct;
    items.push({
      id: 'change_net_income',
      category: 'FINANCIAL_FACTS',
      domain: 'EVIDENCE_CHANGE',
      confirmation: 'CONFIRMED',
      metricLabel: 'Net Income',
      metricLabelTh: 'กำไรสุทธิ (Net Income)',
      previousValue: `$${baseDelta.netIncomeDelta.previous.toLocaleString()}M`,
      currentValue: `$${baseDelta.netIncomeDelta.current.toLocaleString()}M`,
      deltaDisplay: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
      materiality: Math.abs(pct) >= 15.0 ? 'HIGH' : 'MEDIUM',
      explanation: `Net Income moved by ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%.`,
      explanationTh: `กำไรสุทธิเปลี่ยนแปลง ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
      provenance: current.financials.provenance
    });
  }

  if (baseDelta.freeCashFlowDelta && Math.abs(baseDelta.freeCashFlowDelta.deltaPct) >= 10.0) {
    const pct = baseDelta.freeCashFlowDelta.deltaPct;
    items.push({
      id: 'change_fcf',
      category: 'FINANCIAL_FACTS',
      domain: 'EVIDENCE_CHANGE',
      confirmation: 'CONFIRMED',
      metricLabel: 'Free Cash Flow',
      metricLabelTh: 'กระแสเงินสดอิสระ (FCF)',
      previousValue: `$${baseDelta.freeCashFlowDelta.previous.toLocaleString()}M`,
      currentValue: `$${baseDelta.freeCashFlowDelta.current.toLocaleString()}M`,
      deltaDisplay: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
      materiality: Math.abs(pct) >= 25.0 ? 'HIGH' : 'MEDIUM',
      explanation: `Free Cash Flow moved by ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%.`,
      explanationTh: `กระแสเงินสดอิสระเปลี่ยนแปลง ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
      provenance: current.financials.provenance
    });
  }

  // 5. Valuation Assumptions Changes (WACC, Terminal Growth)
  const waccDelta = baseDelta.valuationAssumptionsDelta.waccDeltaPoints;
  if (waccDelta !== null && Math.abs(waccDelta) >= 0.25) {
    items.push({
      id: 'change_wacc',
      category: 'VALUATION',
      domain: 'THESIS_MODEL_CHANGE',
      confirmation: 'CONFIRMED',
      metricLabel: 'Discount Rate (WACC)',
      metricLabelTh: 'อัตราคิดลด (WACC)',
      previousValue: `${previous.valuation.assumptions.waccPct}%`,
      currentValue: `${current.valuation.assumptions.waccPct}%`,
      deltaDisplay: `${waccDelta >= 0 ? '+' : ''}${waccDelta.toFixed(2)}% pts`,
      materiality: Math.abs(waccDelta) >= 0.75 ? 'HIGH' : 'MEDIUM',
      explanation: `WACC adjusted by ${waccDelta >= 0 ? '+' : ''}${waccDelta.toFixed(2)} percentage points.`,
      explanationTh: `อัตราคิดลด WACC ปรับเปลี่ยน ${waccDelta >= 0 ? '+' : ''}${waccDelta.toFixed(2)} จุดเปอร์เซ็นต์`,
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
  const evaluatedExpectations = evaluateExpectations(trackedExpectations, current, historicalSnapshots);
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

  // 9. Valuation Change Attribution
  let valuationAttribution: ValuationAttribution | null = null;
  if (baseDelta.fairValueDelta) {
    const fvMove = baseDelta.fairValueDelta.deltaPct;
    const fcfMove = baseDelta.freeCashFlowDelta?.deltaPct ?? 0;
    const waccDiff = baseDelta.valuationAssumptionsDelta.waccDeltaPoints ?? 0;

    if (current.valuation.modelType !== previous.valuation.modelType) {
      valuationAttribution = {
        primaryDriver: 'SECTOR_MODEL_SWITCH',
        impactDescription: `Valuation model transitioned from ${previous.valuation.modelType || 'None'} to ${current.valuation.modelType || 'None'}.`,
        impactDescriptionTh: `แบบจำลองการประเมินมูลค่าเปลี่ยนจาก ${previous.valuation.modelType || 'None'} เป็น ${current.valuation.modelType || 'None'}`,
        isDeterministic: true
      };
    } else if (Math.abs(fcfMove) >= 15 && Math.sign(fcfMove) === Math.sign(fvMove)) {
      valuationAttribution = {
        primaryDriver: 'CASH_FLOW_AND_MARGINS',
        impactDescription: `Fair value movement largely driven by underlying cash flow performance (${fcfMove >= 0 ? '+' : ''}${fcfMove.toFixed(1)}% FCF change).`,
        impactDescriptionTh: `การเปลี่ยนแปลงมูลค่ายุติธรรมมีแรงผลักดันหลักจากกระแสเงินสดจริง (${fcfMove >= 0 ? '+' : ''}${fcfMove.toFixed(1)}% FCF)`,
        isDeterministic: true
      };
    } else if (Math.abs(waccDiff) >= 0.5 && Math.sign(waccDiff) !== Math.sign(fvMove)) {
      valuationAttribution = {
        primaryDriver: 'DISCOUNT_RATE',
        impactDescription: `Fair value shift predominantly explained by discount rate adjustment (${waccDiff >= 0 ? '+' : ''}${waccDiff.toFixed(2)}% WACC).`,
        impactDescriptionTh: `การเปลี่ยนแปลงมูลค่ายุติธรรมเกิดจากการปรับอัตราคิดลดเป็นหลัก (${waccDiff >= 0 ? '+' : ''}${waccDiff.toFixed(2)}% WACC)`,
        isDeterministic: true
      };
    } else if (Math.abs(fvMove) < 3.0) {
      valuationAttribution = {
        primaryDriver: 'UNCHANGED',
        impactDescription: 'Fair value remained stable with no material model assumption divergence.',
        impactDescriptionTh: 'มูลค่ายุติธรรมคงที่โดยไม่มีการเปลี่ยนแปลงสมมติฐานที่มีนัยสำคัญ',
        isDeterministic: true
      };
    } else {
      valuationAttribution = {
        primaryDriver: 'GROWTH_EXPECTATIONS',
        impactDescription: 'Fair value change reflects revised growth expectations and margin projections across model stages.',
        impactDescriptionTh: 'การเปลี่ยนแปลงมูลค่ายุติธรรมสะท้อนการปรับประมาณการเติบโตและอัตรากำไรในแบบจำลอง',
        isDeterministic: true
      };
    }
  }

  // 10. Compute Canonical Summary
  const confirmedMaterial = items.filter(
    i => (i.domain === 'EVIDENCE_CHANGE' || i.domain === 'THESIS_MODEL_CHANGE') &&
      i.confirmation === 'CONFIRMED' &&
      (i.materiality === 'HIGH' || i.materiality === 'MEDIUM')
  ).length;

  const needsReview = items.filter(
    i => i.confirmation === 'UNCONFIRMED'
  ).length;

  const researchCoverage = items.filter(
    i => i.domain === 'RESEARCH_COVERAGE_CHANGE' && i.confirmation === 'RESEARCH_ONLY'
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
