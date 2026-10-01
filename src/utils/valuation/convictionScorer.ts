import { ReportData, ConvictionBreakdown, ConvictionPillarScore } from '../../types';
import { resolveBusinessArchetype, type BusinessArchetype } from '../../domain/financialMetricContext';
import { resolveFundamentalMetrics, type ResolvedFundamentalMetrics } from '../../domain/valuation/metricRegistry';
import { resolveAdaptiveFivePillars } from '../../domain/valuation/fivePillarsResolver';
import { resolveCurrentBalanceSheetSnapshot } from '../../domain/currentBalanceSheetSnapshot';
import { resolveReportedEarnings } from '../../domain/reportedEarnings';

export interface ConvictionScoreResult {
  conviction_score: number | null;
  conviction_breakdown: ConvictionBreakdown;
  input_dossier?: ConvictionInputDossier;
}

export interface ConvictionMetricAuditItem {
  metric: string;
  value: number | null | undefined;
  basis?: string;
  source?: string;
  pointsAwarded: number;
  maxPoints: number;
  status: string;
  reason?: string;
}

export interface ConvictionPillarDossier {
  pillarName: string;
  earnedPoints: number;
  maxPoints: number;
  eligibleMetrics: ConvictionMetricAuditItem[];
  excludedMetrics: { metric: string; status: string; reason: string }[];
}

export interface ConvictionInputDossier {
  ticker: string;
  archetype: BusinessArchetype;
  finalScore: number;
  pillars: Record<string, ConvictionPillarDossier>;
}

function extractScore(val: any): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return Number.isFinite(val) && val >= 1 && val <= 10 ? val : null;
  if (typeof val === 'object' && typeof val.score === 'number') return extractScore(val.score);
  const num = parseFloat(String(val));
  return Number.isFinite(num) && num >= 1 && num <= 10 ? num : null;
}

/**
 * Continuous linear interpolation clamped between outMin and outMax.
 * Eliminates discrete step-cliffs that cause score jumping.
 */
function interpolate(val: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  if (inMax < inMin) return interpolate(val, inMax, inMin, outMax, outMin);
  if (val <= inMin) return outMin;
  if (val >= inMax) return outMax;
  return outMin + ((val - inMin) / (inMax - inMin)) * (outMax - outMin);
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const rounded = (value: number) => Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100;

/**
 * Ultra-Stable Deterministic Canonical Conviction Scoring Engine.
 *
 * Rebased on canonical resolved metrics across 4 strategic pillars:
 * 1. Revenue & Earnings Growth (30%)
 * 2. Financial Health & Cash Flow (30%)
 * 3. Valuation & Margin of Safety (20%)
 * 4. Moat, Management & Competitive Risk (20%)
 *
 * Archetype-aware:
 * - Banks/Lenders/Fintech: Uses CET1/Tier-1, ROE, NIM, solvency (never penalizes for missing corporate FCF/Current Ratio).
 * - Insurers: Prioritizes combined ratio, ROE, capital adequacy.
 * - REITs: Prioritizes occupancy, FFO/AFFO, interest coverage, leverage.
 * - Pre-Profit: Prioritizes runway, cash burn, gross margin, EV/Sales.
 * - Operating: Prioritizes revenue growth, margins, FCF generation, balance sheet fortress.
 *
 * Moat scoring is wording-independent: does not rely on keywords ('monopoly', 'moat') or bullet counting.
 */
export function calculateDeterministicConvictionScore(
  data?: Partial<ReportData>,
  ticker?: string
): ConvictionScoreResult | undefined {
  const sym = (ticker || data?.ticker || (data as any)?.symbol || 'STOCK').toUpperCase().trim();
  const archetype = resolveBusinessArchetype(data, sym);
  const statementTemplate = data?.financial_statements?.statement_template;
  const selectedModel = data?.intrinsic_value?.selected_model?.model_type;

  const isFinancialSector = [
    'bank', 'lender', 'fintech', 'insurer', 'asset_manager', 'broker_exchange'
  ].includes(archetype)
    || statementTemplate === 'banking'
    || selectedModel === 'fintech_pe'
    || selectedModel === 'ddm';

  const isBankOrLender = ['bank', 'lender', 'fintech'].includes(archetype) || statementTemplate === 'banking';
  const isInsurer = archetype === 'insurer';
  const isReit = archetype === 'reit';

  const fs = data?.financial_statements;
  const inc = fs?.income_statement;
  const cf = fs?.cash_flow;
  const intrinsic = data?.intrinsic_value;
  const comp = data?.comprehensive_analysis;
  const scoring = comp?.scoring;

  const latest = (values?: Array<number | null>) => values?.length ? values[values.length - 1] : null;
  const ratio = (numerator: number | null, denominator: number | null, asPercent = false) =>
    finite(numerator) && finite(denominator) && denominator !== 0
      ? (numerator / denominator) * (asPercent ? 100 : 1)
      : null;

  // Resolve Canonical Fundamental Metrics from single domain registry
  const resolvedMetrics: ResolvedFundamentalMetrics | undefined = (() => {
    try {
      return resolveFundamentalMetrics(data || {}, sym);
    } catch {
      return undefined;
    }
  })();

  const latestGrowthInput = resolvedMetrics?.revenueGrowthYoY?.value ?? latest(inc?.yoy_revenue_growth_pct);
  const latestRevenueInput = latest(inc?.revenue);
  const reportedEarnings = resolveReportedEarnings(fs);
  const earningsSeries = reportedEarnings?.values;
  const latestNetIncomeInput = latest(earningsSeries);
  const latestMarginInput = resolvedMetrics?.netMargin?.value ?? latest(inc?.net_margin_pct)
    ?? ratio(latestNetIncomeInput, latestRevenueInput, true);

  const previousNetIncomeInput = earningsSeries && earningsSeries.length >= 2
    ? earningsSeries[earningsSeries.length - 2]
    : null;

  const latestFcfInput = resolvedMetrics?.fcfMargin?.value !== undefined && finite(latestRevenueInput)
    ? (resolvedMetrics.fcfMargin.value * latestRevenueInput) / 100
    : latest(cf?.free_cash_flow);
  const latestFcfMarginInput = resolvedMetrics?.fcfMargin?.value ?? latest(cf?.fcf_margin_pct)
    ?? ratio(latestFcfInput, latestRevenueInput, true);

  const balanceSnapshot = resolveCurrentBalanceSheetSnapshot(data || {});
  const latestDebtInput = balanceSnapshot.totalDebt;
  const latestEquityInput = balanceSnapshot.facts.total_equity?.value ?? null;
  const latestDebtToEquityInput = balanceSnapshot.facts.debt_to_equity?.value
    ?? ratio(latestDebtInput, latestEquityInput);
  const latestCashInput = balanceSnapshot.cashAndEquivalents;
  const latestCurrentAssetsInput = balanceSnapshot.facts.total_current_assets?.value ?? null;
  const latestCurrentLiabilitiesInput = balanceSnapshot.facts.total_current_liabilities?.value
    ?? balanceSnapshot.facts.current_liabilities?.value ?? null;
  const latestCurrentRatioInput = resolvedMetrics?.currentRatio?.value ?? balanceSnapshot.facts.current_ratio?.value
    ?? ratio(latestCurrentAssetsInput, latestCurrentLiabilitiesInput);

  // Valuation inputs
  const suppliedMoS = intrinsic?.canonical_run ? intrinsic.canonical_run.marginOfSafetyPct : (intrinsic as any)?.summary?.margin_of_safety_pct
    ?? (intrinsic as any)?.dcf_model?.margin_of_safety_pct
    ?? (intrinsic as any)?.ddm_model?.scenarios?.base?.margin_of_safety_pct
    ?? (intrinsic as any)?.margin_of_safety_pct;
  const suppliedFairValue = intrinsic?.canonical_run ? intrinsic.canonical_run.baseFairValue : (intrinsic as any)?.dcf_model?.scenarios?.base?.fair_value_per_share
    ?? (intrinsic as any)?.ddm_model?.scenarios?.base?.fair_value_per_share
    ?? (intrinsic as any)?.reit_model?.scenarios?.base?.fair_value_per_share
    ?? (intrinsic as any)?.summary?.base_case_fair_value
    ?? (intrinsic as any)?.fair_value_base;
  const suppliedCurrentPrice = intrinsic?.current_price ?? data?.company_profile?.stock_price;

  // Canonical PEG Resolution
  // Section 28 & 29: Canonical PEG status controls scoring eligibility.
  // If canonical PEG is unavailable or BASIS_MISMATCH, do NOT resurrect legacy raw PEG from valuation_ratios!
  const canonicalPeg = resolvedMetrics?.peg;
  const isCanonicalPegEligible = canonicalPeg
    && (canonicalPeg.status === 'CALCULATED' || canonicalPeg.status === 'REPORTED')
    && finite(canonicalPeg.value)
    && canonicalPeg.value > 0;

  // Fallback to legacy valuation_ratios only if no canonical status check failed
  const isCanonicalPegBlocked = Boolean(
    canonicalPeg && (
      canonicalPeg.status === 'BASIS_MISMATCH'
      || canonicalPeg.status === 'NOT_APPLICABLE'
      || canonicalPeg.status === 'GUARDED'
      || canonicalPeg.status === 'TURNAROUND'
      || canonicalPeg.status === 'UNAVAILABLE'
      || canonicalPeg.status === 'INSUFFICIENT_HISTORY'
    )
  );

  const rawPegItem = !isCanonicalPegBlocked
    ? data?.valuation_ratios?.find(r => (r.name || '').toLowerCase().includes('peg'))
    : undefined;
  const rawPegVal = rawPegItem
    ? (typeof rawPegItem.value === 'number' ? rawPegItem.value : parseFloat(String(rawPegItem.value)))
    : null;

  const eligiblePeg: number | null = isCanonicalPegEligible
    ? canonicalPeg.value!
    : (finite(rawPegVal) && rawPegVal > 0 && !isCanonicalPegBlocked ? rawPegVal : null);

  const riskScoreInput = extractScore(scoring?.risk_level);

  const hasSolvencyInput = finite(latestDebtToEquityInput)
    || (finite(latestCashInput) && finite(latestDebtInput));
  const hasCashFlowInput = isFinancialSector
    ? finite(resolvedMetrics?.roe?.value)
    : isReit
      ? finite(resolvedMetrics?.interestCoverage?.value)
      : latestFcfInput !== null && (latestFcfInput <= 0 || latestFcfMarginInput !== null);

  if (!data?.financial_statements && !data?.canonical_financials) return undefined;
  const growthCapacity = (finite(latestGrowthInput) ? 15 : 0) + (finite(latestMarginInput) ? 10 : 0)
    + (finite(latestNetIncomeInput) && finite(previousNetIncomeInput) ? 5 : 0);
  let healthCapacity = 0;
  // An empty accounting envelope plus optimistic AI prose is not evidence.
  if (growthCapacity === 0 && !finite(latestFcfInput) && !hasSolvencyInput && !finite(latestCurrentRatioInput)
    && !finite(resolvedMetrics?.roe?.value) && !finite(resolvedMetrics?.nim?.value)) return undefined;

  // =========================================================================
  // PILLAR 1: Revenue & Earnings Growth (Max 30 Points)
  // =========================================================================
  let growthPoints = 0;
  const growthDetailsTh: string[] = [];
  const growthDetailsEn: string[] = [];

  // A. Latest YoY Revenue Growth (Max 15 pts) - Continuous interpolation
  const latestGrowth = latestGrowthInput;
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
  // Section 31 & 73: Single QoQ comparison must say "Net income increased QoQ",
  // never "consecutive profit growth" unless 3+ quarters proved a streak.
  const netIncArr = earningsSeries || [];
  if (finite(latestNetIncomeInput) && finite(previousNetIncomeInput) && netIncArr.length >= 3) {
    const last = netIncArr[netIncArr.length - 1];
    const prev = netIncArr[netIncArr.length - 2];
    const prev2 = netIncArr[netIncArr.length - 3];
    if (last !== null && prev !== null && prev2 !== null && last > 0 && last >= prev && prev >= prev2) {
      growthPoints += 5.0;
      growthDetailsTh.push(`กำไรเติบโตต่อเนื่อง QoQ`);
      growthDetailsEn.push(`Consecutive profit expansion QoQ`);
    } else if (last !== null && prev !== null && last > 0 && last >= prev) {
      growthPoints += 4.5;
      growthDetailsTh.push(`กำไรสุทธิเพิ่มขึ้น QoQ`);
      growthDetailsEn.push(`Net income increased QoQ`);
    } else if (last !== null && last > 0) {
      growthPoints += 3.5;
      growthDetailsTh.push(`รักษากำไรสุทธิเป็นบวก`);
      growthDetailsEn.push(`Maintains positive net income`);
    } else {
      growthPoints += 1.0;
    }
  } else if (finite(latestNetIncomeInput) && finite(previousNetIncomeInput) && netIncArr.length >= 2) {
    const last = netIncArr[netIncArr.length - 1];
    const prev = netIncArr[netIncArr.length - 2];
    if (last !== null && prev !== null && last > 0 && last >= prev) {
      growthPoints += 4.5;
      growthDetailsTh.push(`กำไรสุทธิเพิ่มขึ้น QoQ`);
      growthDetailsEn.push(`Net income increased QoQ`);
    } else if (last !== null && last > 0) {
      growthPoints += 3.5;
      growthDetailsTh.push(`รักษากำไรสุทธิเป็นบวก`);
      growthDetailsEn.push(`Maintains positive net income`);
    } else {
      growthPoints += 1.0;
    }
  }

  const rawGrowthScore = Math.min(30, Math.max(0, growthPoints));
  if (reportedEarnings && reportedEarnings.scope !== 'TOTAL') {
    growthDetailsTh.push(`ขอบเขตกำไรที่รายงาน: ${reportedEarnings.labelTh} (ไม่แทนกำไรสุทธิรวม)`);
    growthDetailsEn.push(`Reported earnings scope: ${reportedEarnings.label} (not total income)`);
  }
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
  // Cross-sector adaptation: Banks/Lenders, Insurers, REITs, Operating companies
  // =========================================================================
  let healthPoints = 0;
  const healthDetailsTh: string[] = [];
  const healthDetailsEn: string[] = [];

  if (isBankOrLender) {
    // Bank & Lender Policy (Section 33):
    // CET1 / Tier 1 capital, ROE / ROA, NIM, deposit quality.
    // Never penalize for missing corporate FCF or Current Ratio.
    {
      const roe = resolvedMetrics?.roe?.value;
      const roePts = finite(roe) ? interpolate(roe, 5, 18, 5, 15) : 0;
      const nim = resolvedMetrics?.nim?.value;
      const nimPts = finite(nim) ? interpolate(nim, 2.0, 4.0, 3, 10) : 0;
      const capital = resolvedMetrics?.cet1Ratio?.value ?? resolvedMetrics?.tier1CapitalRatio?.value;
      const capitalPts = finite(capital) ? interpolate(capital,6,12,1,5) : 0;
      healthCapacity = (finite(roe) ? 15 : 0) + (finite(nim) ? 10 : 0) + (finite(capital) ? 5 : 0);
      healthPoints = roePts + nimPts + capitalPts;
      healthDetailsTh.push(`ผลตอบแทนต่อส่วนของผู้ถือหุ้น (ROE) และ Net Interest Margin (NIM)`);
      healthDetailsEn.push(`Bank profitability metrics (ROE & Net Interest Margin)`);
    }
  } else if (isInsurer) {
    // Insurer Policy (Section 34):
    // Combined ratio, ROE, capital adequacy
    const combinedRatio = resolvedMetrics?.combinedRatio?.value;
    const roe = resolvedMetrics?.roe?.value;
    let combPts = 0;
    if (finite(combinedRatio)) {
      combPts = interpolate(combinedRatio, 102, 92, 4.0, 15.0);
      healthDetailsTh.push(`Combined Ratio ${combinedRatio.toFixed(1)}%`);
      healthDetailsEn.push(`Combined Ratio ${combinedRatio.toFixed(1)}%`);
    }
    const roePts = finite(roe) ? interpolate(roe, 5, 18, 5.0, 15.0) : 0;
    healthCapacity = (finite(combinedRatio) ? 15 : 0) + (finite(roe) ? 15 : 0);
    healthPoints = combPts + roePts;
    if (finite(roe)) {
      healthDetailsTh.push(`ROE ${roe.toFixed(1)}%`);
      healthDetailsEn.push(`ROE ${roe.toFixed(1)}%`);
    }
  } else if (isReit) {
    // REIT Policy (Section 35):
    // Occupancy, leverage, interest coverage
    const occ = resolvedMetrics?.occupancyRate?.value;
    const intCov = resolvedMetrics?.interestCoverage?.value;
    let occPts = 0;
    if (finite(occ)) {
      occPts = interpolate(occ, 90, 98, 8.0, 15.0);
      healthDetailsTh.push(`อัตราการเช่า (Occupancy) ${occ.toFixed(1)}%`);
      healthDetailsEn.push(`Portfolio Occupancy ${occ.toFixed(1)}%`);
    }
    let intPts = 0;
    if (finite(intCov)) {
      intPts = interpolate(intCov, 1.5, 4.5, 6.0, 15.0);
      healthDetailsTh.push(`Interest Coverage ${intCov.toFixed(1)}x`);
      healthDetailsEn.push(`Interest Coverage ${intCov.toFixed(1)}x`);
    }
    healthPoints = occPts + intPts;
    healthCapacity = (finite(occ) ? 15 : 0) + (finite(intCov) ? 15 : 0);
  } else {
    // Standard Operating Company Policy (Section 32, 37):
    // Free Cash Flow Generation (Max 12 pts)
    const latestFcf = latestFcfInput;
    const latestFcfMargin = latestFcfMarginInput;

    if (finite(latestFcf) && (latestFcf <= 0 || finite(latestFcfMargin))) {
      healthCapacity += 12;
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

    // Debt to Equity / Solvency (Max 10 pts)
    const latestDe = latestDebtToEquityInput;
    const latestCash = latestCashInput;
    const latestDebt = latestDebtInput;
    const hasNetCash = finite(latestCash) && finite(latestDebt) && latestCash >= latestDebt;

    if (hasNetCash) {
      healthCapacity += 10;
      healthPoints += 10.0;
      healthDetailsTh.push(balanceSnapshot.netCash !== null && balanceSnapshot.netCash >= 0
        ? 'มีสถานะเงินสดสุทธิ (Net Cash)'
        : 'เงินสดและรายการเทียบเท่าเงินสดครอบคลุมหนี้สินทางการเงิน');
      healthDetailsEn.push(balanceSnapshot.netCash !== null && balanceSnapshot.netCash >= 0
        ? 'Net Cash balance sheet position'
        : 'Cash & Cash Equivalents cover financial debt');
    } else if (finite(latestDe)) {
      healthCapacity += 10;
      healthPoints += interpolate(latestDe, 0, 2.5, 10.0, 3.0);
      healthDetailsTh.push(`ภาระหนี้ D/E ${latestDe.toFixed(2)} เท่า`);
      healthDetailsEn.push(`D/E ratio ${latestDe.toFixed(2)}x`);
    } else if (finite(latestCash) && finite(latestDebt) && latestDebt > 0) {
      healthCapacity += 10;
      healthPoints += interpolate(latestCash / latestDebt,0,1,3,10);
      healthDetailsTh.push(`เงินสดครอบคลุมหนี้ ${(latestCash / latestDebt * 100).toFixed(1)}%`);
      healthDetailsEn.push(`Cash covers ${(latestCash / latestDebt * 100).toFixed(1)}% of financial debt; equity denominator unavailable`);
    }

    // Liquidity / Current Ratio (Max 8 pts)
    const latestCr = latestCurrentRatioInput;
    if (finite(latestCr)) {
      healthCapacity += 8;
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
  // Section 48 & 49: Margin of Safety vs Premium terminology strictly separated.
  // Section 28 & 30: If PEG is N/A or BASIS_MISMATCH, do not score or resurrect legacy PEG.
  // =========================================================================
  let valPoints = 0;
  const valDetailsTh: string[] = [];
  const valDetailsEn: string[] = [];

  const currentPrice = suppliedCurrentPrice;
  const fairValue = suppliedFairValue;
  let mosPct: number | undefined | null = suppliedMoS;

  if ((mosPct === undefined || mosPct === null) && finite(fairValue) && finite(currentPrice) && currentPrice > 0) {
    mosPct = Number((((fairValue - currentPrice) / currentPrice) * 100).toFixed(1));
  }

  const isPegActive = eligiblePeg !== null && !isCanonicalPegBlocked;
  const maxDcfPoints = isPegActive ? 14 : 20; // Weight re-normalization when PEG is ineligible

  if (mosPct !== undefined && mosPct !== null) {
    if (mosPct <= 0) {
      const dcfScore = interpolate(mosPct, -30, 0, 3.0, 9.5);
      valPoints += (dcfScore / 14) * maxDcfPoints;
      // Section 48: Strict MOS terminology. Do NOT call negative MOS a "Premium over Fair Value"!
      valDetailsTh.push(`Fair Value ต่ำกว่าราคาตลาด ${Math.abs(mosPct).toFixed(1)}% (Margin of Safety ${mosPct.toFixed(1)}%)`);
      valDetailsEn.push(`Fair value is ${Math.abs(mosPct).toFixed(1)}% below current price (Margin of Safety ${mosPct.toFixed(1)}%)`);
    } else {
      const dcfScore = interpolate(mosPct, 0, 30, 9.5, 14.0);
      valPoints += (dcfScore / 14) * maxDcfPoints;
      valDetailsTh.push(`Margin of Safety +${mosPct.toFixed(1)}%`);
      valDetailsEn.push(`Margin of Safety +${mosPct.toFixed(1)}%`);
    }
  } else if (isFinancialSector) {
    valDetailsTh.push('แบบจำลอง FCFF ถูกระงับตาม Financial Sector Guard (ประเมินตาม Multiples & Solvency)');
    valDetailsEn.push('Generic FCFF disabled under Financial Sector Guard (Multiples & Solvency evaluated)');
  }

  // B. PEG Multiple (Max 6 pts) — strictly guarded
  if (isPegActive && eligiblePeg !== null) {
    const pegPoints = interpolate(eligiblePeg, 0.8, 2.5, 6.0, 3.5);
    valPoints += pegPoints;
    valDetailsTh.push(`PEG ${eligiblePeg.toFixed(2)}x`);
    valDetailsEn.push(`PEG ${eligiblePeg.toFixed(2)}x`);
  } else if (isCanonicalPegBlocked && canonicalPeg?.reasonTh) {
    valDetailsTh.push(`PEG ไม่ถูกนำมาคิดคะแนน (${canonicalPeg.reasonTh})`);
    valDetailsEn.push(`PEG excluded from scoring (${canonicalPeg.reason || 'basis mismatch'})`);
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
  // Section 44: Wording-independent Moat Scoring
  // Eliminated keyword matching ('monopoly', 'moat', etc.) and bullet counting.
  // Anchored 80% to objective economic fundamentals, 20% to AI risk level.
  // =========================================================================
  let moatPoints = 0;
  const moatDetailsTh: string[] = [];
  const moatDetailsEn: string[] = [];

  // A. Objective Economic Moat Signals (Max 10 pts)
  let economicMoatScore = 0;

  // 1. Pricing power reflected in Gross Margin superiority (up to 3.5 pts)
  const grossMargin = resolvedMetrics?.grossMargin?.value ?? latest(inc?.gross_margin_pct);
  if (isBankOrLender) {
    const nim = resolvedMetrics?.nim?.value;
    if (finite(nim)) {
      economicMoatScore += interpolate(nim, 2.0, 3.5, 1.5, 3.5);
    }
  } else if (finite(grossMargin)) {
    if (grossMargin >= 60) economicMoatScore += 3.5;
    else if (grossMargin >= 40) economicMoatScore += 2.5;
    else if (grossMargin >= 20) economicMoatScore += 1.5;
    else economicMoatScore += 0.5;
  }

  // 2. High return on capital / value creation spread (up to 3.5 pts)
  const roic = resolvedMetrics?.roic?.value;
  const roe = resolvedMetrics?.roe?.value;
  if (finite(roic)) {
    economicMoatScore += interpolate(roic, 6, 18, 1.0, 3.5);
  } else if (finite(roe)) {
    economicMoatScore += interpolate(roe, 8, 20, 1.0, 3.5);
  }

  // 3. Morningstar Moat Rating or Operating Margin durability (up to 3.0 pts)
  const morningstarMoat = (data as any)?.morningstar_research?.economic_moat;
  if (morningstarMoat === 'Wide') {
    economicMoatScore += 3.0;
  } else if (morningstarMoat === 'Narrow') {
    economicMoatScore += 2.0;
  } else {
    const opMargin = resolvedMetrics?.operatingMargin?.value ?? latestMarginInput;
    if (finite(opMargin) && opMargin > 20) {
      economicMoatScore += 3.0;
    } else if (finite(opMargin) && opMargin > 10) {
      economicMoatScore += 2.0;
    } else if (finite(opMargin)) {
      economicMoatScore += 1.0;
    }
  }

  moatPoints += Math.min(10.0, Math.max(0, economicMoatScore));
  moatDetailsTh.push(`ความได้เปรียบในการแข่งขันทางเศรษฐกิจ (Economic Moat)`);
  moatDetailsEn.push(`Economic moat & competitive advantages`);

  // B. Risk Profile & Governance (Max 10 pts)
  // 1. Positive Net Income (+3.0 pts)
  let objectiveRiskPoints = 0;
  const lastNi = earningsSeries?.at(-1);
  if (lastNi !== null && lastNi !== undefined && lastNi > 0) objectiveRiskPoints += 3.0;

  // 2. Positive FCF or OCF (+3.0 pts)
  const lastFcf = cf?.free_cash_flow?.[cf.free_cash_flow.length - 1]
    ?? cf?.operating_cash_flow?.[cf.operating_cash_flow.length - 1];
  if (lastFcf !== null && lastFcf !== undefined && lastFcf > 0) objectiveRiskPoints += 3.0;

  // 3. Balance sheet safety (+2.0 pts)
  const lastCash = latestCashInput;
  const lastDebt = latestDebtInput;
  const lastDe = latestDebtToEquityInput;
  if ((finite(lastCash) && finite(lastDebt) && lastCash >= lastDebt) || (finite(lastDe) && lastDe < 1.0)) {
    objectiveRiskPoints += 2.0;
  }

  // 4. AI subjective risk level (dampened to max 2.0 pts to eliminate stochastic swings)
  const subjectiveAiRisk = finite(riskScoreInput) ? interpolate(riskScoreInput, 1, 10, 2.0, 0.5) : 0;

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
  // =========================================================================
  const moatCapacity = (finite(isBankOrLender ? resolvedMetrics?.nim?.value : grossMargin) ? 3.5 : 0)
    + (finite(roic) || finite(roe) ? 3.5 : 0)
    + (['Wide','Narrow'].includes(morningstarMoat) || finite(resolvedMetrics?.operatingMargin?.value ?? latestMarginInput) ? 3 : 0)
    + (finite(lastNi) ? 3 : 0) + (finite(lastFcf) ? 3 : 0)
    + (hasSolvencyInput ? 2 : 0) + (finite(riskScoreInput) ? 2 : 0);
  const valuationCapacity = (finite(mosPct) ? maxDcfPoints : 0) + (isPegActive ? 6 : 0);
  const capacities = [growthCapacity, healthCapacity, valuationCapacity, moatCapacity];
  const pillars = [growthPillar, healthPillar, valPillar, moatPillar];
  const rawScores = [rawGrowthScore, rawHealthScore, rawValScore, rawMoatScore];
  const missing = [
    [[latestGrowthInput,'revenueGrowthYoY'],[latestMarginInput,'netMargin'],[finite(latestNetIncomeInput)&&finite(previousNetIncomeInput)?1:null,'compatibleEarningsHistory']],
    isBankOrLender ? [[resolvedMetrics?.roe?.value,'ROE'],[resolvedMetrics?.nim?.value,'NIM'],[resolvedMetrics?.cet1Ratio?.value??resolvedMetrics?.tier1CapitalRatio?.value,'CET1/Tier1']]
      : isInsurer ? [[resolvedMetrics?.combinedRatio?.value,'combinedRatio'],[resolvedMetrics?.roe?.value,'ROE']]
      : isReit ? [[resolvedMetrics?.occupancyRate?.value,'occupancy'],[resolvedMetrics?.interestCoverage?.value,'interestCoverage']]
      : [[hasCashFlowInput?1:null,'FCF/margin'],[hasSolvencyInput?1:null,'solvency'],[latestCurrentRatioInput,'currentRatio']],
    [[mosPct,'methodCompatibleFairValue'],[isPegActive?1:null,'meaningfulPEG']],
    [[isBankOrLender?resolvedMetrics?.nim?.value:grossMargin,'economicMargin'],[roic??roe,'returnOnCapital'],[lastNi,'netIncome'],[lastFcf,'cashGeneration'],[hasSolvencyInput?1:null,'balanceSafety'],[riskScoreInput,'attributedRiskAssessment']],
  ];
  // No unknown input earns points or becomes a zero score. Display each observed
  // pillar normalized to its published weight, with its measured coverage.
  for (let i = 0; i < pillars.length; i++) {
    const pillar = pillars[i], capacity = capacities[i];
    pillar.availableInputWeight = capacity;
    pillar.missingInputs = missing[i].filter(([value])=>!finite(value)).map(([,key])=>String(key));
    pillar.coveragePct = Math.round(capacity / pillar.maxScore * 100);
    pillar.status = capacity === 0 ? 'INSUFFICIENT_DATA' : capacity >= pillar.maxScore ? 'AVAILABLE' : 'PARTIAL';
    pillar.score = capacity > 0 ? Math.round(Math.min(capacity,rawScores[i]) / capacity * pillar.maxScore) : null;
    pillar.pct = pillar.score == null ? null : Math.round(pillar.score / pillar.maxScore * 100);
    if (capacity < pillar.maxScore) {
      pillar.reasonEn += `; input coverage ${pillar.coveragePct}%; missing inputs do not earn points`;
      pillar.reasonTh += `; ข้อมูลรองรับ ${pillar.coveragePct}% ไม่ให้คะแนนกับข้อมูลที่ขาด`;
    }
  }
  const coverage = capacities.reduce((a,b) => a+b,0);
  // Overall minimum: >=60% original input weight, >=3 independently supported
  // pillars, Growth and Financial Health each >=50% covered. Never extrapolate
  // a single good ratio into a whole-company conviction score.
  const enough = coverage >= 60 && capacities.filter(c => c > 0).length >= 3
    && growthCapacity >= 15 && healthCapacity >= 15;
  const totalScore = enough ? Math.min(100, Math.max(0, Math.round(
    rawScores.reduce((a,b) => a+b,0) / coverage * 100))) : null;

  return {
    conviction_score: totalScore,
    conviction_breakdown: {
      growth: growthPillar,
      financial_health: healthPillar,
      valuation: valPillar,
      moat_and_risk: moatPillar,
      total_score: totalScore,
      coverage_pct: Math.round(coverage),
      verified_input_coverage_pct: data?.canonical_financials?.ticker?.toUpperCase()===sym&&(data.canonical_financials.sourceCoverage?.verifiedValues??0)>0
        ?Math.round(Math.max(0, coverage - (finite(riskScoreInput) ? 2 : 0) - (['Wide','Narrow'].includes(morningstarMoat)?3:0))):0,
      status: totalScore === null ? 'INSUFFICIENT_DATA' : coverage === 100 ? 'AVAILABLE' : 'PARTIAL'
    }
  };
}
