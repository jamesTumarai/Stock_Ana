import { ReportData } from '../types';

export interface ValuationDrivers {
  key: string;
  label: string;
  dollarImpact: number;
  percentageContribution: number;
  direction?: 'positive' | 'negative' | 'neutral';
  explanation?: string;
}

export type ThesisStatus = 'intact' | 'upgraded' | 'under_pressure' | 'macro_driven' | 'unchanged';

export interface ThesisHealth {
  status: ThesisStatus;
  headline: string;
  summary: string;
  convictionShift: number;
}

export interface ValuationDecomposition {
  ticker: string;
  previousDate: string;
  currentDate: string;
  previousFairValue: number;
  currentFairValue: number;
  totalDeltaDollars: number;
  totalDeltaPct: number;
  drivers: ValuationDrivers[];
  thesisHealth: ThesisHealth;
}

function parseNumber(val: any): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/**
 * Pure deterministic marginal attribution of DCF Fair Value changes between two reports.
 * Preserves strict financial invariants without inventing qualitative stories.
 */
export function decomposeValuationDelta(
  currentReport: ReportData,
  previousReport: ReportData,
  isThai = false
): ValuationDecomposition | null {
  if (!currentReport || !previousReport) return null;

  const curFv = parseNumber(
    currentReport.intrinsic_value?.summary?.base_case_fair_value ??
    currentReport.intrinsic_value?.dcf_model?.scenarios?.base?.fair_value_per_share
  );

  const prevFv = parseNumber(
    previousReport.intrinsic_value?.summary?.base_case_fair_value ??
    previousReport.intrinsic_value?.dcf_model?.scenarios?.base?.fair_value_per_share
  );

  if (curFv === null || prevFv === null || prevFv <= 0) {
    return null;
  }

  const ticker = currentReport.ticker || (currentReport as any).company_profile?.overview?.symbol || 'EQUITY';
  const curDate = (currentReport as any).report_date || (currentReport as any).created_at || 'Current';
  const prevDate = (previousReport as any).report_date || (previousReport as any).created_at || 'Previous';

  const totalDeltaDollars = Number((curFv - prevFv).toFixed(2));
  const totalDeltaPct = Number((((curFv - prevFv) / prevFv) * 100).toFixed(1));

  // Extract base DCF parameters
  const curDcf: any = currentReport.intrinsic_value?.dcf_model?.scenarios?.base || {};
  const prevDcf: any = previousReport.intrinsic_value?.dcf_model?.scenarios?.base || {};

  const curWacc = parseNumber(curDcf.wacc_percentage) ?? 9.0;
  const prevWacc = parseNumber(prevDcf.wacc_percentage) ?? 9.0;

  const curGrowth = parseNumber(curDcf.projected_growth_rate) ?? 10.0;
  const prevGrowth = parseNumber(prevDcf.projected_growth_rate) ?? 10.0;

  const curTg = parseNumber(curDcf.terminal_growth_rate_percentage) ?? 3.0;
  const prevTg = parseNumber(prevDcf.terminal_growth_rate_percentage) ?? 3.0;

  const curShares = parseNumber(curDcf.shares_outstanding_millions);
  const prevShares = parseNumber(prevDcf.shares_outstanding_millions);

  const curDebt = parseNumber(curDcf.net_debt_millions);
  const prevDebt = parseNumber(prevDcf.net_debt_millions);

  // Compute component sensitivities
  // 1. WACC sensitivity: ~ -10% FV per +100 bps WACC
  const deltaWaccBps = (curWacc - prevWacc) * 100;
  const waccSensitivityFactor = -0.10; // -10% per 100 bps
  const rawWaccImpact = prevFv * (deltaWaccBps / 100) * waccSensitivityFactor;

  // 2. Growth sensitivity: ~ +6% FV per +100 bps Growth
  const deltaGrowthBps = (curGrowth - prevGrowth) * 100;
  const growthSensitivityFactor = 0.06;
  const rawGrowthImpact = prevFv * (deltaGrowthBps / 100) * growthSensitivityFactor;

  // 3. Terminal Growth sensitivity: ~ +7% FV per +100 bps Terminal Growth
  const deltaTgBps = (curTg - prevTg) * 100;
  const tgSensitivityFactor = 0.07;
  const rawTgImpact = prevFv * (deltaTgBps / 100) * tgSensitivityFactor;

  // 4. Capital structure & shares impact
  let rawCapStructureImpact = 0;
  if (curShares && prevShares && prevShares > 0 && curShares !== prevShares) {
    const shareDilutionPct = (curShares - prevShares) / prevShares;
    rawCapStructureImpact -= prevFv * shareDilutionPct;
  }
  if (curDebt !== null && prevDebt !== null && curShares) {
    const debtDelta = curDebt - prevDebt;
    rawCapStructureImpact -= debtDelta / curShares;
  }

  // 5. Baseline Cash Flow / Operating Performance: residual fundamental impact
  const explainedSum = rawWaccImpact + rawGrowthImpact + rawTgImpact + rawCapStructureImpact;
  let rawBaselineCashFlowImpact = totalDeltaDollars - explainedSum;

  // If totalDeltaDollars is 0, all drivers are 0
  if (Math.abs(totalDeltaDollars) < 0.001) {
    const neutralDriver: ValuationDrivers = {
      key: 'fundamentals_stable',
      label: isThai ? 'สมมติฐานและผลการดำเนินงานคงที่' : 'Stable Valuation Assumptions',
      dollarImpact: 0,
      percentageContribution: 0,
      direction: 'neutral',
      explanation: isThai ? 'มูลค่าเหมาะสมเท่าเดิม ไม่มีการปรับเปลี่ยน' : 'Fair value unchanged between periods.',
    };

    return {
      ticker,
      previousDate: String(prevDate),
      currentDate: String(curDate),
      previousFairValue: prevFv,
      currentFairValue: curFv,
      totalDeltaDollars: 0,
      totalDeltaPct: 0,
      drivers: [neutralDriver],
      thesisHealth: classifyThesisHealth(currentReport, previousReport, 0, isThai),
    };
  }

  // Normalize marginal components so they sum exactly to totalDeltaDollars
  const rawDrivers = [
    {
      key: 'cash_flow_growth',
      label: isThai ? 'การเติบโตของกระแสเงินสด (Growth Hurdle)' : 'Cash Flow & Growth Revision',
      raw: rawGrowthImpact + (rawBaselineCashFlowImpact * 0.6),
      explanation: isThai
        ? `ปรับสมมติฐานการเติบโตจาก ${prevGrowth.toFixed(1)}% เป็น ${curGrowth.toFixed(1)}%`
        : `Operating cash flow growth revised from ${prevGrowth.toFixed(1)}% to ${curGrowth.toFixed(1)}%`,
    },
    {
      key: 'wacc_discount_rate',
      label: isThai ? 'อัตราคิดลดต้นทุนเงินทุน (WACC Shift)' : 'Cost of Capital (WACC Shift)',
      raw: rawWaccImpact,
      explanation: isThai
        ? `WACC ปรับจาก ${prevWacc.toFixed(1)}% เป็น ${curWacc.toFixed(1)}%`
        : `Discount rate shifted from ${prevWacc.toFixed(1)}% to ${curWacc.toFixed(1)}%`,
    },
    {
      key: 'terminal_growth',
      label: isThai ? 'อัตราเติบโตระยะยาว (Terminal Growth)' : 'Long-Term Terminal Growth',
      raw: rawTgImpact,
      explanation: isThai
        ? `Terminal growth เปลี่ยนจาก ${prevTg.toFixed(1)}% เป็น ${curTg.toFixed(1)}%`
        : `Terminal growth expectation shifted from ${prevTg.toFixed(1)}% to ${curTg.toFixed(1)}%`,
    },
    {
      key: 'capital_structure',
      label: isThai ? 'โครงสร้างทุน & หุ้นหมุนเวียน (Dilution / Debt)' : 'Capital Structure & Shares',
      raw: rawCapStructureImpact + (rawBaselineCashFlowImpact * 0.4),
      explanation: isThai
        ? 'ผลกระทบจากการเปลี่ยนแปลงหนี้สินสุทธิและจำนวนหุ้นหมุนเวียน'
        : 'Impact of net debt shifts and share repurchase/dilution pace',
    },
  ];

  const totalRaw = rawDrivers.reduce((acc, d) => acc + Math.abs(d.raw), 0);
  const normalizedDrivers: ValuationDrivers[] = [];

  if (totalRaw > 0) {
    let allocatedSum = 0;
    for (let i = 0; i < rawDrivers.length; i++) {
      const item = rawDrivers[i];
      let impact: number;
      if (i === rawDrivers.length - 1) {
        impact = Number((totalDeltaDollars - allocatedSum).toFixed(2));
      } else {
        const weight = item.raw / (rawDrivers.reduce((s, r) => s + r.raw, 0) || 1);
        impact = Number((totalDeltaDollars * weight).toFixed(2));
        allocatedSum += impact;
      }

      const pctContribution = totalDeltaDollars !== 0
        ? Number(((impact / totalDeltaDollars) * 100).toFixed(1))
        : 0;

      normalizedDrivers.push({
        key: item.key,
        label: item.label,
        dollarImpact: impact,
        percentageContribution: pctContribution,
        direction: impact > 0 ? 'positive' : impact < 0 ? 'negative' : 'neutral',
        explanation: item.explanation,
      });
    }
  } else {
    normalizedDrivers.push({
      key: 'cash_flow_growth',
      label: isThai ? 'การเติบโตของกระแสเงินสด' : 'Cash Flow & Growth',
      dollarImpact: totalDeltaDollars,
      percentageContribution: 100,
      direction: totalDeltaDollars > 0 ? 'positive' : 'negative',
    });
  }

  const thesisHealth = classifyThesisHealth(
    currentReport,
    previousReport,
    totalDeltaDollars,
    isThai,
    normalizedDrivers
  );

  return {
    ticker,
    previousDate: String(prevDate),
    currentDate: String(curDate),
    previousFairValue: prevFv,
    currentFairValue: curFv,
    totalDeltaDollars,
    totalDeltaPct,
    drivers: normalizedDrivers,
    thesisHealth,
  };
}

export function classifyThesisHealth(
  currentReport: ReportData,
  previousReport: ReportData,
  totalDeltaDollars: number,
  isThai = false,
  drivers?: ValuationDrivers[]
): ThesisHealth {
  const curScore = currentReport.verdict?.conviction_score ?? 70;
  const prevScore = previousReport.verdict?.conviction_score ?? 70;
  const convictionShift = curScore - prevScore;

  // Check if WACC was the overwhelming driver of a fair value drop
  if (drivers && totalDeltaDollars < 0) {
    const waccDriver = drivers.find(d => d.key === 'wacc_discount_rate');
    if (waccDriver && Math.abs(waccDriver.dollarImpact) >= Math.abs(totalDeltaDollars) * 0.7) {
      return {
        status: 'macro_driven',
        headline: isThai ? 'ปรับลดจากปัจจัยมหภาค (Macro/WACC)' : 'Macro/Discount Rate Driven',
        summary: isThai
          ? `การลดลงของ Fair Value เกิดจากอัตราคิดลด WACC สูงขึ้นเป็นหลัก ขณะที่ปัจจัยพื้นฐานยังไม่เสื่อมถอยรุนแรง`
          : `Fair value decline was primarily driven by elevated cost of capital rather than underlying operational deterioration.`,
        convictionShift,
      };
    }
  }

  if (totalDeltaDollars > 15 && convictionShift >= 0) {
    return {
      status: 'upgraded',
      headline: isThai ? 'สมมติฐานการลงทุนแข็งแกร่งขึ้น (Thesis Upgraded)' : 'Investment Thesis Strengthened',
      summary: isThai
        ? `การปรับเพิ่ม Fair Value มาจากการขยายตัวของกระแสเงินสดและความเชื่อมั่นทางพื้นฐาน`
        : `Intrinsic value expanded driven by stronger cash generation projections and consistent conviction.`,
      convictionShift,
    };
  }

  if (totalDeltaDollars < -15 || convictionShift <= -10) {
    return {
      status: 'under_pressure',
      headline: isThai ? 'สมมติฐานการลงทุนเริ่มเผชิญความเสี่ยง (Under Pressure)' : 'Thesis Under Pressure',
      summary: isThai
        ? `Fair Value หรือคะแนนความเชื่อมั่นลดลง ควรทบทวนการเติบโตและปัจจัยความเสี่ยงทางธุรกิจ`
        : `Fair value or conviction score degraded materially; business operational trajectory warrants close review.`,
      convictionShift,
    };
  }

  return {
    status: 'intact',
    headline: isThai ? 'สมมติฐานการลงทุนยังคงรูป (Thesis Intact)' : 'Investment Thesis Intact',
    summary: isThai
      ? `การเปลี่ยนแปลงของมูลค่ายังอยู่ในกรอบความผันผวนปกติและโครงสร้างธุรกิจยังมั่นคง`
      : `Valuation variance remains within expected bounds with business fundamentals stable.`,
    convictionShift,
  };
}
