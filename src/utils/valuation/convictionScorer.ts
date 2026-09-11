import { ReportData, ConvictionBreakdown, ConvictionPillarScore } from '../../types';

export interface ConvictionScoreResult {
  conviction_score: number;
  conviction_breakdown: ConvictionBreakdown;
}

function extractScore(val: any): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && typeof val.score === 'number') return val.score;
  const num = parseFloat(String(val));
  return isNaN(num) ? null : num;
}

/**
 * Continuous linear interpolation clamped between outMin and outMax.
 * Eliminates discrete step-cliffs that cause score jumping.
 */
function interpolate(val: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  if (val <= inMin) return outMin;
  if (val >= inMax) return outMax;
  return outMin + ((val - inMin) / (inMax - inMin)) * (outMax - outMin);
}

/**
 * Ultra-Stable Deterministic Conviction Scoring Engine.
 * 
 * Uses continuous mathematical curves across 4 strategic pillars to ensure
 * high precision with variance strictly bounded within ±1 point across runs.
 * 
 * 1. Revenue & Earnings Growth (30%)
 * 2. Financial Health & Cash Flow (30%)
 * 3. Valuation & Margin of Safety (20%)
 * 4. Moat, Management & Competitive Risk (20%)
 */
export function calculateDeterministicConvictionScore(
  data?: Partial<ReportData>,
  ticker?: string
): ConvictionScoreResult | undefined {
  const sym = (ticker || data?.ticker || 'STOCK').toUpperCase();
  const fs = data?.financial_statements;
  const inc = fs?.income_statement;
  const bs = fs?.balance_sheet;
  const cf = fs?.cash_flow;
  const intrinsic = data?.intrinsic_value;
  const comp = data?.comprehensive_analysis;
  const scoring = comp?.scoring;
  const sector = (data?.company_profile?.sector || '').toLowerCase();
  const statementTemplate = data?.financial_statements?.statement_template;
  const selectedModel = data?.intrinsic_value?.selected_model?.model_type;
  const isFinancialSector = sector.includes('financial')
    || sector.includes('bank')
    || sector.includes('fintech')
    || statementTemplate === 'banking'
    || selectedModel === 'fintech_pe'
    || selectedModel === 'ddm';

  const latest = (values?: Array<number | null>) => values?.length ? values[values.length - 1] : null;
  const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
  const ratio = (numerator: number | null, denominator: number | null, asPercent = false) =>
    finite(numerator) && finite(denominator) && denominator !== 0
      ? (numerator / denominator) * (asPercent ? 100 : 1)
      : null;
  const latestGrowthInput = latest(inc?.yoy_revenue_growth_pct);
  const latestRevenueInput = latest(inc?.revenue);
  const latestNetIncomeInput = latest(inc?.net_income);
  const latestMarginInput = latest(inc?.net_margin_pct)
    ?? ratio(latestNetIncomeInput, latestRevenueInput, true);
  const previousNetIncomeInput = inc?.net_income && inc.net_income.length >= 2
    ? inc.net_income[inc.net_income.length - 2]
    : null;
  const latestFcfInput = latest(cf?.free_cash_flow);
  const latestFcfMarginInput = latest(cf?.fcf_margin_pct)
    ?? ratio(latestFcfInput, latestRevenueInput, true);
  const latestDebtInput = latest(bs?.total_debt);
  const latestEquityInput = latest(bs?.total_equity);
  const latestDebtToEquityInput = latest(bs?.debt_to_equity)
    ?? ratio(latestDebtInput, latestEquityInput);
  const latestCashInput = latest(bs?.cash_and_equivalents);
  const latestCurrentAssetsInput = latest(bs?.total_current_assets);
  const latestCurrentLiabilitiesInput = latest(bs?.total_current_liabilities)
    ?? latest(bs?.current_liabilities);
  const latestCurrentRatioInput = latest(bs?.current_ratio)
    ?? ratio(latestCurrentAssetsInput, latestCurrentLiabilitiesInput);
  const suppliedMoS = (intrinsic as any)?.summary?.margin_of_safety_pct
    ?? (intrinsic as any)?.dcf_model?.margin_of_safety_pct
    ?? (intrinsic as any)?.ddm_model?.scenarios?.base?.margin_of_safety_pct
    ?? (intrinsic as any)?.margin_of_safety_pct;
  const suppliedFairValue = (intrinsic as any)?.dcf_model?.scenarios?.base?.fair_value_per_share
    ?? (intrinsic as any)?.ddm_model?.scenarios?.base?.fair_value_per_share
    ?? (intrinsic as any)?.summary?.base_case_fair_value
    ?? (intrinsic as any)?.fair_value_base;
  const suppliedCurrentPrice = intrinsic?.current_price ?? data?.company_profile?.stock_price;
  const pegItem = data?.valuation_ratios?.find(r => (r.name || '').toLowerCase().includes('peg'));
  const pegInput = pegItem
    ? (typeof pegItem.value === 'number' ? pegItem.value : parseFloat(String(pegItem.value)))
    : null;
  const financialStrengthInput = extractScore(scoring?.financial_strength);
  const riskScoreInput = extractScore(scoring?.risk_level);

  const hasSolvencyInput = latestDebtToEquityInput !== null
    || (latestCashInput !== null && latestDebtInput !== null);
  const hasValuationInput = suppliedMoS !== null && suppliedMoS !== undefined
    || (typeof suppliedFairValue === 'number' && typeof suppliedCurrentPrice === 'number' && suppliedCurrentPrice > 0)
    || (isFinancialSector && typeof suppliedCurrentPrice === 'number' && suppliedCurrentPrice > 0 && pegInput !== null && pegInput > 0);
  const hasCashFlowInput = isFinancialSector
    ? financialStrengthInput !== null
    : latestFcfInput !== null && (latestFcfInput <= 0 || latestFcfMarginInput !== null);

  if (
    latestGrowthInput === null
    || latestMarginInput === null
    || latestNetIncomeInput === null
    || previousNetIncomeInput === null
    || !hasCashFlowInput
    || (!isFinancialSector && (!hasSolvencyInput || latestCurrentRatioInput === null))
    || !hasValuationInput
    || pegInput === null
    || !Number.isFinite(pegInput)
    || pegInput <= 0
    || !comp?.business_strengths
    || riskScoreInput === null
  ) {
    return undefined;
  }

  // =========================================================================
  // PILLAR 1: Revenue & Earnings Growth (Max 30 Points)
  // =========================================================================
  let growthPoints = 0;
  let growthDetailsTh: string[] = [];
  let growthDetailsEn: string[] = [];

  // A. Latest YoY Revenue Growth (Max 15 pts) - Continuous interpolation
  const growthArr = inc?.yoy_revenue_growth_pct || [];
  const latestGrowth = growthArr.length > 0 ? growthArr[growthArr.length - 1] : null;

  if (latestGrowth !== null && latestGrowth !== undefined) {
    if (latestGrowth < 0) {
      growthPoints += interpolate(latestGrowth, -15, 0, 3.0, 6.5);
      growthDetailsTh.push(`รายได้หดตัว ${latestGrowth.toFixed(1)}% YoY`);
      growthDetailsEn.push(`Revenue contracting ${latestGrowth.toFixed(1)}% YoY`);
    } else if (latestGrowth < 15) {
      growthPoints += interpolate(latestGrowth, 0, 15, 6.5, 11.0);
      growthDetailsTh.push(`รายได้เติบโต +${latestGrowth.toFixed(1)}% YoY`);
      growthDetailsEn.push(`Revenue growing +${latestGrowth.toFixed(1)}% YoY`);
    } else {
      growthPoints += interpolate(latestGrowth, 15, 35, 11.0, 15.0);
      growthDetailsTh.push(`รายได้โตแกร่ง +${latestGrowth.toFixed(1)}% YoY`);
      growthDetailsEn.push(`Strong revenue growth +${latestGrowth.toFixed(1)}% YoY`);
    }
  }

  // B. Net Profit Margin Quality (Max 10 pts) - Continuous interpolation
  const latestNetMargin = latestMarginInput;

  if (latestNetMargin !== null && latestNetMargin !== undefined) {
    if (latestNetMargin < 0) {
      growthPoints += 1.5;
      growthDetailsTh.push(`ยังไม่ทำกำไรสุทธิ (${latestNetMargin.toFixed(1)}%)`);
      growthDetailsEn.push(`Net unprofitable (${latestNetMargin.toFixed(1)}%)`);
    } else if (latestNetMargin < 15) {
      growthPoints += interpolate(latestNetMargin, 0, 15, 2.5, 7.5);
      growthDetailsTh.push(`อัตรากำไรสุทธิ ${latestNetMargin.toFixed(1)}%`);
      growthDetailsEn.push(`Net margin ${latestNetMargin.toFixed(1)}%`);
    } else {
      growthPoints += interpolate(latestNetMargin, 15, 35, 7.5, 10.0);
      growthDetailsTh.push(`อัตรากำไรสุทธิสูงเด่น ${latestNetMargin.toFixed(1)}%`);
      growthDetailsEn.push(`High net margin ${latestNetMargin.toFixed(1)}%`);
    }
  }

  // C. Growth Continuity & Direction (Max 5 pts)
  const netIncArr = inc?.net_income || [];
  if (netIncArr.length >= 2) {
    const last = netIncArr[netIncArr.length - 1];
    const prev = netIncArr[netIncArr.length - 2];
    if (last !== null && prev !== null && last > 0 && last >= prev) {
      growthPoints += 5.0;
      growthDetailsTh.push(`กำไรเติบโตต่อเนื่อง QoQ`);
      growthDetailsEn.push(`Consecutive profit expansion QoQ`);
    } else if (last !== null && last > 0) {
      growthPoints += 3.5;
      growthDetailsTh.push(`รักษากำไรสุทธิเป็นบวก`);
      growthDetailsEn.push(`Maintains positive net income`);
    } else {
      growthPoints += 1.0;
    }
  }

  const rawGrowthScore = Math.min(30, Math.max(0, growthPoints));
  const roundedGrowthScore = Math.round(rawGrowthScore);
  const growthPillar: ConvictionPillarScore = {
    score: roundedGrowthScore,
    maxScore: 30,
    pct: Math.round((rawGrowthScore / 30) * 100),
    reasonTh: growthDetailsTh.join(' • ') || 'ประเมินจากอัตราเติบโตรายได้และกำไรสุทธิ',
    reasonEn: growthDetailsEn.join(' • ') || 'Evaluated from revenue growth rate and net margin'
  };

  // =========================================================================
  // PILLAR 2: Financial Health & Cash Flow (Max 30 Points)
  // =========================================================================
  let healthPoints = 0;
  let healthDetailsTh: string[] = [];
  let healthDetailsEn: string[] = [];

  if (isFinancialSector) {
    const finStrength = financialStrengthInput!;
    healthPoints = (finStrength / 10) * 30;
    healthDetailsTh.push(`ความแข็งแกร่งของเงินกองทุนและสภาพคล่อง (${finStrength}/10)`);
    healthDetailsEn.push(`Banking solvency & liquidity position (${finStrength}/10)`);
  } else {
    // A. Free Cash Flow Generation (Max 12 pts) - Continuous interpolation
    const fcfArr = cf?.free_cash_flow || [];
    const latestFcf = fcfArr.length > 0 ? fcfArr[fcfArr.length - 1] : null;
    const latestFcfMargin = latestFcfMarginInput;

    if (latestFcf !== null && latestFcf !== undefined) {
      if (latestFcf <= 0) {
        healthPoints += 2.0;
        healthDetailsTh.push(`กระแสเงินสด FCF ติดลบ`);
        healthDetailsEn.push(`Negative free cash flow`);
      } else {
        const marginVal = latestFcfMargin!;
        healthPoints += interpolate(marginVal, 0, 25, 6.0, 12.0);
        healthDetailsTh.push(`กระแสเงินสด FCF แข็งแกร่ง${latestFcfMargin ? ` (${latestFcfMargin.toFixed(1)}% margin)` : ''}`);
        healthDetailsEn.push(`Strong FCF generation${latestFcfMargin ? ` (${latestFcfMargin.toFixed(1)}% margin)` : ''}`);
      }
    }

    // B. Debt to Equity / Solvency (Max 10 pts) - Continuous interpolation
    const latestDe = latestDebtToEquityInput;
    const latestCash = latestCashInput;
    const latestDebt = latestDebtInput;
    const hasNetCash = latestCash !== null && latestDebt !== null && latestCash >= latestDebt;

    if (hasNetCash) {
      healthPoints += 10.0;
      healthDetailsTh.push(`มีสถานะ Net Cash เงินสดมากกว่าหนี้`);
      healthDetailsEn.push(`Net Cash balance sheet position`);
    } else if (latestDe !== null) {
      healthPoints += interpolate(latestDe, 0, 2.5, 10.0, 3.0);
      healthDetailsTh.push(`ภาระหนี้ D/E ${latestDe.toFixed(2)} เท่า`);
      healthDetailsEn.push(`D/E ratio ${latestDe.toFixed(2)}x`);
    }

    // C. Liquidity / Current Ratio (Max 8 pts) - Continuous interpolation
    const latestCr = latestCurrentRatioInput;

    if (latestCr !== null && latestCr !== undefined) {
      healthPoints += interpolate(latestCr, 0.8, 2.0, 2.0, 8.0);
      healthDetailsTh.push(`Current Ratio ${latestCr.toFixed(2)} เท่า`);
      healthDetailsEn.push(`Current Ratio ${latestCr.toFixed(2)}x`);
    }
  }

  const rawHealthScore = Math.min(30, Math.max(0, healthPoints));
  const roundedHealthScore = Math.round(rawHealthScore);
  const healthPillar: ConvictionPillarScore = {
    score: roundedHealthScore,
    maxScore: 30,
    pct: Math.round((rawHealthScore / 30) * 100),
    reasonTh: healthDetailsTh.join(' • ') || 'ประเมินจากกระแสเงินสดอิสระ, D/E ratio และสภาพคล่อง',
    reasonEn: healthDetailsEn.join(' • ') || 'Evaluated from free cash flow, D/E ratio, and liquidity'
  };

  // =========================================================================
  // PILLAR 3: Valuation & Margin of Safety (Max 20 Points)
  // Continuous smooth curve prevents cliff-jumps between runs.
  // =========================================================================
  let valPoints = 0;
  let valDetailsTh: string[] = [];
  let valDetailsEn: string[] = [];

  // A. DCF / Intrinsic Value Margin of Safety (Max 14 pts) - Dampened Continuous Curve
  const currentPrice = intrinsic?.current_price ?? data?.company_profile?.stock_price;
  const fairValue = (intrinsic as any)?.dcf_model?.scenarios?.base?.fair_value_per_share
    ?? (intrinsic as any)?.summary?.base_case_fair_value
    ?? (intrinsic as any)?.fair_value_base;
  let mosPct: number | undefined | null = (intrinsic as any)?.summary?.margin_of_safety_pct
    ?? (intrinsic as any)?.dcf_model?.margin_of_safety_pct
    ?? (intrinsic as any)?.margin_of_safety_pct;

  if ((mosPct === undefined || mosPct === null) && finite(fairValue) && finite(currentPrice) && currentPrice > 0) {
    mosPct = Number((((fairValue - currentPrice) / currentPrice) * 100).toFixed(1));
  }

  if (mosPct !== undefined && mosPct !== null) {
    if (mosPct <= 0) {
      valPoints += interpolate(mosPct, -30, 0, 3.0, 9.5);
      valDetailsTh.push(`ราคาปัจจุบันมี Premium เหนือ Fair Value (${Math.abs(mosPct).toFixed(1)}%)`);
      valDetailsEn.push(`Premium over Fair Value (${Math.abs(mosPct).toFixed(1)}%)`);
    } else {
      valPoints += interpolate(mosPct, 0, 30, 9.5, 14.0);
      valDetailsTh.push(`Margin of Safety +${mosPct.toFixed(1)}%`);
      valDetailsEn.push(`Margin of Safety +${mosPct.toFixed(1)}%`);
    }
  } else if (isFinancialSector) {
    valPoints += 8.5;
    valDetailsTh.push('แบบจำลอง FCFF ถูกระงับตาม Financial Sector Guard (ประเมินตาม Multiples & Solvency)');
    valDetailsEn.push('Generic FCFF disabled under Financial Sector Guard (Multiples & Solvency evaluated)');
  }

  // B. Valuation Multiples & Multiplier Sanity (Max 6 pts) - Smooth interpolation
  const ratios = data?.valuation_ratios || [];
  const pegRatioItem = ratios.find(r => (r.name || '').toLowerCase().includes('peg'));
  const pegVal = pegRatioItem ? (typeof pegRatioItem.value === 'number' ? pegRatioItem.value : parseFloat(String(pegRatioItem.value))) : null;

  if (pegVal !== null && !isNaN(pegVal) && pegVal > 0) {
    valPoints += interpolate(pegVal, 0.8, 2.5, 6.0, 3.5);
    valDetailsTh.push(`PEG ${pegVal.toFixed(2)}x`);
    valDetailsEn.push(`PEG ${pegVal.toFixed(2)}x`);
  }

  const rawValScore = Math.min(20, Math.max(0, valPoints));
  const roundedValScore = Math.round(rawValScore);
  const valPillar: ConvictionPillarScore = {
    score: roundedValScore,
    maxScore: 20,
    pct: Math.round((rawValScore / 20) * 100),
    reasonTh: valDetailsTh.join(' • ') || 'ประเมินจาก DCF Margin of Safety และ Valuation Multiples',
    reasonEn: valDetailsEn.join(' • ') || 'Evaluated from DCF Margin of Safety and Valuation Multiples'
  };

  // =========================================================================
  // PILLAR 4: Moat, Management & Competitive Risk (Max 20 Points)
  // Anchored 80% to objective financial fundamentals, 20% to AI risk level
  // =========================================================================
  let moatPoints = 0;
  let moatDetailsTh: string[] = [];
  let moatDetailsEn: string[] = [];

  // A. Moat & Business Strengths (Max 10 pts)
  const strengths = comp?.business_strengths || '';
  const strengthsCount = typeof strengths === 'string'
    ? (strengths.match(/\n\s*[-*•\d.]/g) || []).length
    : Array.isArray(strengths) ? (strengths as any[]).length : 0;
  
  const moatKeywords = ['monopoly', 'pricing power', 'switching cost', 'network effect', 'patent', 'duopoly', 'ผู้นำตลาด', 'ความได้เปรียบ', 'moat'];
  const matchedKeywords = moatKeywords.filter(k => typeof strengths === 'string' && strengths.toLowerCase().includes(k)).length;

  let moatSubScore = 0;
  if (matchedKeywords > 0) {
    moatSubScore += Math.min(2.0, matchedKeywords * 1.0);
  }
  if (strengthsCount > 0) {
    moatSubScore += Math.min(1.0, strengthsCount * 0.3);
  }
  moatPoints += Math.min(10.0, Math.max(0, moatSubScore));
  moatDetailsTh.push(`Moat และความได้เปรียบในการแข่งขัน`);
  moatDetailsEn.push(`Economic moat & competitive advantages`);

  // B. Risk Profile & Governance (Max 10 pts)
  // 1. Positive Net Income (+3.0 pts)
  let objectiveRiskPoints = 0;
  const lastNi = inc?.net_income?.[inc.net_income.length - 1];
  if (lastNi !== null && lastNi !== undefined && lastNi > 0) objectiveRiskPoints += 3.0;

  // 2. Positive FCF (+3.0 pts)
  const lastFcf = cf?.free_cash_flow?.[cf.free_cash_flow.length - 1];
  if (lastFcf !== null && lastFcf !== undefined && lastFcf > 0) objectiveRiskPoints += 3.0;

  // 3. Balance sheet safety (+2.0 pts)
  const lastCash = latestCashInput;
  const lastDebt = latestDebtInput;
  const lastDe = latestDebtToEquityInput;
  if ((finite(lastCash) && finite(lastDebt) && lastCash >= lastDebt) || (finite(lastDe) && lastDe < 1.0)) {
    objectiveRiskPoints += 2.0;
  }

  // 4. AI subjective risk level (dampened to max 2.0 pts to eliminate stochastic swings)
  const subjectiveAiRisk = interpolate(riskScoreInput!, 1, 10, 2.0, 0.5);

  const totalRiskPoints = Math.min(10.0, objectiveRiskPoints + subjectiveAiRisk);
  moatPoints += totalRiskPoints;
  moatDetailsTh.push(`ฐานะการเงินและงบดุลช่วยจำกัดความเสี่ยง`);
  moatDetailsEn.push(`Risk profile backed by financial fundamentals`);

  const rawMoatScore = Math.min(20, Math.max(0, moatPoints));
  const roundedMoatScore = Math.round(rawMoatScore);
  const moatPillar: ConvictionPillarScore = {
    score: roundedMoatScore,
    maxScore: 20,
    pct: Math.round((rawMoatScore / 20) * 100),
    reasonTh: moatDetailsTh.join(' • ') || 'ประเมินจาก Moat, ฝีมือผู้บริหาร และความเสี่ยง 8 ด้าน',
    reasonEn: moatDetailsEn.join(' • ') || 'Evaluated from business moat, management track record, and risk profile'
  };

  // =========================================================================
  // FINAL CONVICTION SCORE (Total 100 Points)
  // Sum continuous scores, then round to nearest integer
  // =========================================================================
  const totalScore = Math.min(100, Math.max(0, Math.round(rawGrowthScore + rawHealthScore + rawValScore + rawMoatScore)));

  return {
    conviction_score: totalScore,
    conviction_breakdown: {
      growth: growthPillar,
      financial_health: healthPillar,
      valuation: valPillar,
      moat_and_risk: moatPillar,
      total_score: totalScore
    }
  };
}
