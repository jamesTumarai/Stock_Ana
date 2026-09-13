import { ResearchMemorySnapshot, compareMemorySnapshots } from './investmentMemory';
import {
  TrackedExpectation,
  evaluateExpectations,
  matchRiskCatalystTransitions,
  TrackedItemTransition
} from './thesisExpectations';

export type ChangeCategory =
  | 'VALUATION'
  | 'FINANCIAL_FACTS'
  | 'MARKET_PRICE'
  | 'CONVICTION'
  | 'THESIS'
  | 'EXPECTATIONS'
  | 'RISKS_AND_CATALYSTS'
  | 'SEC_FILING';

export type ChangeMateriality = 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';

export interface ChangeItem {
  id: string;
  category: ChangeCategory;
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

export interface WhatChangedResult {
  ticker: string;
  previousReportId: string;
  currentReportId: string;
  previousDate: string;
  currentDate: string;
  daysBetween: number;
  hasMaterialChanges: boolean;
  materialChangesCount: number;
  items: ChangeItem[];
  valuationAttribution: ValuationAttribution | null;
  evaluatedExpectations: TrackedExpectation[];
  itemTransitions: TrackedItemTransition[];
  summaryNarrative: string;
  summaryNarrativeTh: string;
}

/**
 * Deterministically analyzes the delta between two research memory snapshots,
 * integrating expectations and risk/catalyst evolutions into a unified ChangeSet.
 */
export function computeWhatChanged(
  current: ResearchMemorySnapshot,
  previous: ResearchMemorySnapshot,
  trackedExpectations: TrackedExpectation[] = []
): WhatChangedResult {
  const baseDelta = compareMemorySnapshots(current, previous);
  const items: ChangeItem[] = [];

  // 1. Valuation Changes
  if (baseDelta.fairValueDelta) {
    const deltaPct = baseDelta.fairValueDelta.deltaPct;
    const absDelta = Math.abs(deltaPct);
    const materiality: ChangeMateriality = absDelta >= 10 ? 'HIGH' : absDelta >= 5 ? 'MEDIUM' : 'LOW';

    items.push({
      id: 'change_fair_value',
      category: 'VALUATION',
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

  // 2. Market Price Changes
  if (baseDelta.priceDelta) {
    const deltaPct = baseDelta.priceDelta.deltaPct;
    const absDelta = Math.abs(deltaPct);
    const materiality: ChangeMateriality = absDelta >= 15 ? 'HIGH' : absDelta >= 8 ? 'MEDIUM' : 'LOW';

    items.push({
      id: 'change_price',
      category: 'MARKET_PRICE',
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

  // 3. Conviction Score Shift
  if (baseDelta.convictionScoreDelta && Math.abs(baseDelta.convictionScoreDelta.deltaPoints) >= 5) {
    const pts = baseDelta.convictionScoreDelta.deltaPoints;
    items.push({
      id: 'change_conviction',
      category: 'CONVICTION',
      metricLabel: 'Conviction Score',
      metricLabelTh: 'คะแนนความเชื่อมั่น',
      previousValue: `${baseDelta.convictionScoreDelta.previous}/100`,
      currentValue: `${baseDelta.convictionScoreDelta.current}/100`,
      deltaDisplay: `${pts >= 0 ? '+' : ''}${pts} pts`,
      materiality: Math.abs(pts) >= 10 ? 'HIGH' : 'MEDIUM',
      explanation: `Conviction shifted by ${pts >= 0 ? '+' : ''}${pts} points.`,
      explanationTh: `คะแนนความเชื่อมั่นเปลี่ยนไป ${pts >= 0 ? '+' : ''}${pts} จุด`,
      provenance: 'DETERMINISTIC_DERIVATION'
    });
  }

  // 4. Financial Facts (Revenue YoY, Margin, FCF)
  if (baseDelta.revenueYoYDelta && Math.abs(baseDelta.revenueYoYDelta.deltaPctPoints) >= 2.0) {
    const pts = baseDelta.revenueYoYDelta.deltaPctPoints;
    items.push({
      id: 'change_revenue_yoy',
      category: 'FINANCIAL_FACTS',
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

  if (baseDelta.freeCashFlowDelta && Math.abs(baseDelta.freeCashFlowDelta.deltaPct) >= 10.0) {
    const pct = baseDelta.freeCashFlowDelta.deltaPct;
    items.push({
      id: 'change_fcf',
      category: 'FINANCIAL_FACTS',
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

  // 6. SEC Filing Update
  if (current.evidence.secAccession && current.evidence.secAccession !== previous.evidence.secAccession) {
    items.push({
      id: 'change_sec_filing',
      category: 'SEC_FILING',
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
        metricLabel: `Expectation: ${exp.metricLabel}`,
        metricLabelTh: `ความคาดหวัง: ${exp.metricLabel}`,
        previousValue: `Target ${exp.targetValue} (${exp.condition})`,
        currentValue: `Actual ${exp.actualValue}`,
        deltaDisplay: 'MISSED',
        materiality: 'HIGH',
        explanation: `Prior expectation for ${exp.targetPeriod} was missed: actual ${exp.actualValue} vs target ${exp.targetValue}.`,
        explanationTh: `ผลลัพธ์รอบ ${exp.targetPeriod} พลาดเป้าที่คาดไว้: ตัวเลขจริง ${exp.actualValue} เทียบกับเป้าหมาย ${exp.targetValue}`,
        provenance: 'USER_EXPECTATION_EVALUATION'
      });
    } else if (exp.status === 'EXCEEDED' || exp.status === 'MET') {
      items.push({
        id: `change_exp_${exp.expectationId}`,
        category: 'EXPECTATIONS',
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

  // 8. Risks and Catalysts Transitions
  const itemTransitions = matchRiskCatalystTransitions(
    previous.thesis.keyRisks,
    current.thesis.keyRisks,
    previous.thesis.catalysts,
    current.thesis.catalysts
  );

  for (const trans of itemTransitions) {
    if (trans.category === 'risk') {
      if (trans.currentState === 'NEW') {
        if (trans.isCertain) {
          items.push({
            id: `change_risk_${items.length}`,
            category: 'RISKS_AND_CATALYSTS',
            metricLabel: 'New Risk Identified',
            metricLabelTh: 'พบปัจจัยความเสี่ยงใหม่',
            previousValue: 'Not tracked',
            currentValue: trans.itemText,
            deltaDisplay: 'NEW RISK',
            materiality: 'HIGH',
            explanation: `A new material risk emerged: "${trans.itemText}".`,
            explanationTh: `ปรากฏปัจจัยความเสี่ยงใหม่: "${trans.itemText}"`,
            provenance: 'AI_AND_STATEMENT_EVIDENCE'
          });
        } else {
          // Blocker 11: isCertain === false must NOT state NEW/RESOLVED/MATERIALIZED as fact, nor generate HIGH risk event
          items.push({
            id: `change_risk_${items.length}`,
            category: 'RISKS_AND_CATALYSTS',
            metricLabel: 'Possible Risk Change — Review Needed',
            metricLabelTh: 'อาจมีการเปลี่ยนแปลงความเสี่ยง — ควรตรวจสอบ',
            previousValue: 'Not tracked',
            currentValue: trans.itemText,
            deltaDisplay: 'POSSIBLE RISK CHANGE',
            materiality: 'MEDIUM',
            explanation: `Unconfirmed risk statement identified in report prose: "${trans.itemText}". Review needed to verify if a new material threat emerged.`,
            explanationTh: `พบข้อความความเสี่ยงใหม่ในบทวิเคราะห์: "${trans.itemText}" ยังไม่ยืนยันการเปลี่ยนแปลง ควรตรวจสอบเพิ่มเติม`,
            provenance: 'AI_AND_STATEMENT_EVIDENCE'
          });
        }
      } else if (trans.currentState === 'RESOLVED') {
        if (trans.isCertain) {
          items.push({
            id: `change_risk_res_${items.length}`,
            category: 'RISKS_AND_CATALYSTS',
            metricLabel: 'Prior Risk Resolved',
            metricLabelTh: 'ความเสี่ยงเดิมคลี่คลาย',
            previousValue: trans.itemText,
            currentValue: 'Resolved / Deprioritized',
            deltaDisplay: 'RESOLVED',
            materiality: 'MEDIUM',
            explanation: `Prior risk no longer cited as primary threat: "${trans.itemText}".`,
            explanationTh: `ความเสี่ยงเดิมไม่ได้ถูกระบุเป็นความเสี่ยงหลักอีกต่อไป: "${trans.itemText}"`,
            provenance: 'AI_AND_STATEMENT_EVIDENCE'
          });
        } else {
          // Blocker 11: isCertain === false must NOT state RESOLVED as fact
          items.push({
            id: `change_risk_res_${items.length}`,
            category: 'RISKS_AND_CATALYSTS',
            metricLabel: 'Risk Wording Changed — Review Needed',
            metricLabelTh: 'ถ้อยคำความเสี่ยงเปลี่ยนแปลง — ควรตรวจสอบ',
            previousValue: trans.itemText,
            currentValue: 'Omitted from prose',
            deltaDisplay: 'UNCONFIRMED LIFECYCLE CHANGE',
            materiality: 'LOW',
            explanation: `Prior risk "${trans.itemText}" was not explicitly restated in recent report prose. Resolution is unconfirmed; review needed.`,
            explanationTh: `ความเสี่ยงเดิม "${trans.itemText}" ไม่ได้ถูกระบุซ้ำในบทวิเคราะห์ล่าสุด ยังไม่ยืนยันว่าคลี่คลายแล้ว ควรตรวจสอบเพิ่มเติม`,
            provenance: 'AI_AND_STATEMENT_EVIDENCE'
          });
        }
      } else if (trans.currentState === 'UNKNOWN' && !trans.isCertain) {
        // Ambiguous rephrasing or semantic evolution across reports (e.g. "Cloud demand slowdown" vs "Slower enterprise cloud spending")
        // Produces at most one uncertain/review-needed change!
        items.push({
          id: `change_risk_evolve_${items.length}`,
          category: 'RISKS_AND_CATALYSTS',
          metricLabel: 'Risk Wording Changed — Review Needed',
          metricLabelTh: 'ถ้อยคำความเสี่ยงเปลี่ยนแปลง — ควรตรวจสอบ',
          previousValue: 'Prior wording',
          currentValue: trans.itemText,
          deltaDisplay: 'POSSIBLE RISK CHANGE',
          materiality: 'LOW',
          explanation: `Risk wording evolved: "${trans.itemText}". Review needed to evaluate whether this represents a true material change or stylistic rephrasing.`,
          explanationTh: `ถ้อยคำของความเสี่ยงปรับเปลี่ยน: "${trans.itemText}" ควรตรวจสอบว่าเป็นความเสี่ยงใหม่จริงหรือเพียงการปรับสำนวน`,
          provenance: 'AI_AND_STATEMENT_EVIDENCE'
        });
      }
    } else if (trans.category === 'catalyst') {
      if (trans.currentState === 'NEW') {
        if (trans.isCertain) {
          items.push({
            id: `change_cat_${items.length}`,
            category: 'RISKS_AND_CATALYSTS',
            metricLabel: 'New Catalyst Tracked',
            metricLabelTh: 'พบปัจจัยเร่งใหม่ (Catalyst)',
            previousValue: 'Not tracked',
            currentValue: trans.itemText,
            deltaDisplay: 'NEW CATALYST',
            materiality: 'MEDIUM',
            explanation: `New upcoming catalyst detected: "${trans.itemText}".`,
            explanationTh: `พบปัจจัยบวกเร่งตัวใหม่: "${trans.itemText}"`,
            provenance: 'AI_AND_MARKET_EVIDENCE'
          });
        } else {
          items.push({
            id: `change_cat_${items.length}`,
            category: 'RISKS_AND_CATALYSTS',
            metricLabel: 'Possible Catalyst Change',
            metricLabelTh: 'อาจมีปัจจัยเร่งใหม่ (ยังไม่ยืนยัน)',
            previousValue: 'Not tracked',
            currentValue: trans.itemText,
            deltaDisplay: 'POSSIBLE CATALYST CHANGE',
            materiality: 'LOW',
            explanation: `New catalyst mentioned in report prose: "${trans.itemText}". Unconfirmed lifecycle change.`,
            explanationTh: `พบการกล่าวถึงปัจจัยเร่งใหม่ในบทวิเคราะห์: "${trans.itemText}" ยังไม่ยืนยัน`,
            provenance: 'AI_AND_MARKET_EVIDENCE'
          });
        }
      } else if (trans.currentState === 'RESOLVED') {
        if (trans.isCertain) {
          items.push({
            id: `change_cat_res_${items.length}`,
            category: 'RISKS_AND_CATALYSTS',
            metricLabel: 'Prior Catalyst Concluded',
            metricLabelTh: 'ปัจจัยเร่งเดิมสิ้นสุดลง',
            previousValue: trans.itemText,
            currentValue: 'Concluded / Past',
            deltaDisplay: 'CATALYST CONCLUDED',
            materiality: 'LOW',
            explanation: `Prior tracked catalyst has passed or concluded: "${trans.itemText}".`,
            explanationTh: `ปัจจัยเร่งเดิมผ่านพ้นหรือเสร็จสิ้นแล้ว: "${trans.itemText}"`,
            provenance: 'AI_AND_MARKET_EVIDENCE'
          });
        } else {
          items.push({
            id: `change_cat_res_${items.length}`,
            category: 'RISKS_AND_CATALYSTS',
            metricLabel: 'Catalyst Wording Changed — Review Needed',
            metricLabelTh: 'ถ้อยคำปัจจัยเร่งเปลี่ยนแปลง — ควรตรวจสอบ',
            previousValue: trans.itemText,
            currentValue: 'Omitted from prose',
            deltaDisplay: 'UNCONFIRMED LIFECYCLE CHANGE',
            materiality: 'LOW',
            explanation: `Prior catalyst "${trans.itemText}" was not explicitly listed in recent report prose; status unconfirmed.`,
            explanationTh: `ปัจจัยเร่งเดิม "${trans.itemText}" ไม่ได้ถูกระบุในบทวิเคราะห์ล่าสุด สถานะยังไม่ยืนยัน`,
            provenance: 'AI_AND_MARKET_EVIDENCE'
          });
        }
      } else if (trans.currentState === 'UNKNOWN' && !trans.isCertain) {
        items.push({
          id: `change_cat_evolve_${items.length}`,
          category: 'RISKS_AND_CATALYSTS',
          metricLabel: 'Catalyst Wording Changed — Review Needed',
          metricLabelTh: 'ถ้อยคำปัจจัยเร่งเปลี่ยนแปลง — ควรตรวจสอบ',
          previousValue: 'Prior wording',
          currentValue: trans.itemText,
          deltaDisplay: 'POSSIBLE CATALYST CHANGE',
          materiality: 'LOW',
          explanation: `Catalyst description shifted: "${trans.itemText}". Review needed.`,
          explanationTh: `คำอธิบายปัจจัยเร่งปรับเปลี่ยน: "${trans.itemText}" ควรตรวจสอบเพิ่มเติม`,
          provenance: 'AI_AND_MARKET_EVIDENCE'
        });
      }
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

  const materialChangesCount = items.filter(i => i.materiality === 'HIGH' || i.materiality === 'MEDIUM').length;
  const hasMaterialChanges = materialChangesCount > 0;

  // Build Summary Narratives
  let summaryNarrative = '';
  let summaryNarrativeTh = '';

  if (!hasMaterialChanges) {
    summaryNarrative = `No material changes detected for ${current.ticker} over the ${baseDelta.daysBetween}-day interval.`;
    summaryNarrativeTh = `ไม่พบการเปลี่ยนแปลงที่มีนัยสำคัญสำหรับ ${current.ticker} ในช่วงระยะเวลา ${baseDelta.daysBetween} วันที่ผ่านมา`;
  } else {
    const highItems = items.filter(i => i.materiality === 'HIGH');
    summaryNarrative = `Identified ${items.length} total changes (${highItems.length} high priority) since prior research on ${previous.asOfDate}.`;
    summaryNarrativeTh = `ตรวจพบการเปลี่ยนแปลง ${items.length} รายการ (ระดับสำคัญสูง ${highItems.length} รายการ) นับจากการวิเคราะห์ครั้งก่อนเมื่อ ${previous.asOfDate}`;
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
    items,
    valuationAttribution,
    evaluatedExpectations,
    itemTransitions,
    summaryNarrative,
    summaryNarrativeTh
  };
}
