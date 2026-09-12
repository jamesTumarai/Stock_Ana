import { ReportData } from '../types';
import { detectValuationModel } from './valuation/modelSelector';
import { getCanonicalValuationSandboxInputs } from './valuationSandboxAdapter';
import { calculateStrictDCFValue } from './valuation/dcfMathEngine';

export interface ValuationDrivers {
  key: string;
  label: string;
  dollarImpact: number;
  percentageContribution: number;
  direction?: 'positive' | 'negative' | 'neutral';
  explanation?: string;
}

export type ThesisStatus =
  | 'intact'
  | 'upgraded'
  | 'under_pressure'
  | 'macro_driven'
  | 'unchanged'
  | 'insufficient_data';

export interface ThesisHealth {
  status: ThesisStatus;
  headline: string;
  summary: string;
  convictionShift: number | null;
}

export interface ValuationDecomposition {
  isAvailable: true;
  ticker: string;
  previousDate: string;
  currentDate: string;
  previousFairValue: number;
  currentFairValue: number;
  totalDeltaDollars: number;
  totalDeltaPct: number;
  drivers: ValuationDrivers[];
  thesisHealth: ThesisHealth;
  reason?: string;
  reasonTh?: string;
}

export interface ValuationDecompositionUnavailable {
  isAvailable: false;
  reason: string;
  reasonTh: string;
  missingFields?: string[];
  previousFairValue?: number;
  currentFairValue?: number;
}

export type ValuationDecompositionResult = ValuationDecomposition | ValuationDecompositionUnavailable;

function parseNumber(val: any): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

interface CanonicalExtractedParams {
  ticker: string;
  startingRevenueM: number;
  sharesOutstandingM: number;
  netCashM: number;
  waccPct: number;
  terminalGrowthPct: number;
  baseRevenueCagrPct: number;
  baseFcfMarginPct: number;
  projectionYears: number;
  fairValue: number;
  reportDate: string;
}

type ExtractedResult =
  | { isValid: true; params: CanonicalExtractedParams }
  | { isValid: false; reason: string; reasonTh: string; missingFields: string[] };

/**
 * Extracts validated canonical valuation parameters from a report.
 * Strict financial invariants:
 * 1. Sector guard: Non-FCFF companies (banks, lenders, insurance, FinTech PE) fail closed.
 * 2. Missing financial fields NEVER receive fabricated defaults (e.g. 9.0, 10.0, 3.0, 70).
 */
function extractCanonicalParams(
  report: Partial<ReportData>,
  tickerSymbol: string
): ExtractedResult {
  const sym = (tickerSymbol || report.ticker || (report as any).company_profile?.overview?.symbol || 'STOCK').toUpperCase();

  // 1. Sector Guard
  const selectedModel = detectValuationModel(report, sym);
  const isGenericFcffModel =
    selectedModel.model_type === 'dcf_standard' ||
    selectedModel.model_type === 'dcf_multistage' ||
    selectedModel.model_type === 'dcf_gordon' ||
    selectedModel.model_type === 'dcf_cyclical';

  if (!isGenericFcffModel) {
    return {
      isValid: false,
      reason: `Valuation decomposition is unavailable for non-FCFF models (selected model: ${selectedModel.model_type}).`,
      reasonTh: `การแจกแจงปัจจัยมูลค่าแบบ DCF ไม่สามารถใช้กับธุรกิจที่ใช้โมเดล ${selectedModel.model_name_th || selectedModel.model_type}`,
      missingFields: [`operating-company FCFF model fit (${selectedModel.model_type} selected)`],
    };
  }

  const reportDate = String((report as any).report_date || (report as any).created_at || 'Report');

  // 2. Try Canonical Sandbox Adapter first
  const sandbox = getCanonicalValuationSandboxInputs(report, sym);
  if (sandbox.isEligible) {
    const inp = sandbox.inputs;
    const baseFv = typeof inp.canonicalBaseFairValue === 'number' && inp.canonicalBaseFairValue > 0
      ? inp.canonicalBaseFairValue
      : parseNumber(report.intrinsic_value?.summary?.base_case_fair_value ?? report.intrinsic_value?.dcf_model?.scenarios?.base?.fair_value_per_share);

    const fv = (baseFv && baseFv > 0)
      ? baseFv
      : calculateStrictDCFValue(
          inp.startingRevenueM,
          inp.sharesOutstandingM,
          inp.netCashM,
          inp.waccPct,
          inp.terminalGrowthPct,
          inp.baseRevenueCagrPct,
          inp.baseFcfMarginPct,
          inp.projectionYears
        );

    return {
      isValid: true,
      params: {
        ticker: sym,
        startingRevenueM: inp.startingRevenueM,
        sharesOutstandingM: inp.sharesOutstandingM,
        netCashM: inp.netCashM,
        waccPct: inp.waccPct,
        terminalGrowthPct: inp.terminalGrowthPct,
        baseRevenueCagrPct: inp.baseRevenueCagrPct,
        baseFcfMarginPct: inp.baseFcfMarginPct,
        projectionYears: inp.projectionYears,
        fairValue: fv,
        reportDate,
      },
    };
  }

  // 3. Fallback: Check if report has explicit verified DCF model inputs and assumptions
  const dcfModel = report.intrinsic_value?.dcf_model;
  const dcfInputs = dcfModel?.inputs;
  const dcfAssumptions = dcfModel?.assumptions;
  const baseScenario: any = dcfModel?.scenarios?.base || {};

  const fsAnnual = (report.financial_statements as any)?.annual;
  const startingRevenueM = parseNumber(dcfInputs?.startingRevenueM ?? fsAnnual?.[0]?.revenue);
  const sharesOutstandingM = parseNumber(dcfInputs?.sharesOutstandingM ?? baseScenario.shares_outstanding_millions ?? report.company_profile?.shares_outstanding);

  let netCashM = parseNumber(dcfInputs?.netCashM);
  if (netCashM === null && typeof baseScenario.net_debt_millions === 'number') {
    netCashM = -baseScenario.net_debt_millions;
  }

  const waccPct = parseNumber(dcfAssumptions?.wacc_pct ?? baseScenario.wacc_percentage);
  const terminalGrowthPct = parseNumber(dcfAssumptions?.terminal_growth_pct ?? baseScenario.terminal_growth_rate_percentage);
  const baseRevenueCagrPct = parseNumber(baseScenario.revenue_cagr_pct ?? baseScenario.projected_growth_rate);

  let baseFcfMarginPct = parseNumber(baseScenario.terminal_margin_pct);
  if (baseFcfMarginPct === null && fsAnnual?.[0]) {
    const ann = fsAnnual[0];
    if (typeof ann.operating_cash_flow === 'number' && typeof ann.revenue === 'number' && ann.revenue > 0) {
      baseFcfMarginPct = Number(((ann.operating_cash_flow / ann.revenue) * 100).toFixed(2));
    }
  }

  const projectionYears = parseNumber(dcfAssumptions?.projection_years) ?? 5;

  const missing: string[] = [];
  if (startingRevenueM === null || startingRevenueM <= 0) missing.push('starting revenue (USD millions)');
  if (sharesOutstandingM === null || sharesOutstandingM <= 0) missing.push('shares outstanding');
  if (netCashM === null) missing.push('net cash / debt (USD millions)');
  if (waccPct === null || waccPct <= 0) missing.push('WACC discount rate');
  if (terminalGrowthPct === null || terminalGrowthPct < 0 || (waccPct !== null && terminalGrowthPct >= waccPct)) {
    missing.push('terminal growth rate (< WACC)');
  }
  if (baseRevenueCagrPct === null) missing.push('projected growth rate');
  if (baseFcfMarginPct === null) missing.push('FCF / operating margin');

  if (missing.length > 0) {
    return {
      isValid: false,
      reason: `Insufficient verified valuation inputs: missing ${missing.join(', ')}.`,
      reasonTh: `ข้อมูลสำหรับการประเมินมูลค่าไม่ครบถ้วน: ขาด ${missing.join(', ')}`,
      missingFields: missing,
    };
  }

  const baseFv = parseNumber(report.intrinsic_value?.summary?.base_case_fair_value ?? baseScenario.fair_value_per_share);
  const fv = (baseFv !== null && baseFv > 0)
    ? baseFv
    : calculateStrictDCFValue(
        startingRevenueM!,
        sharesOutstandingM!,
        netCashM!,
        waccPct!,
        terminalGrowthPct!,
        baseRevenueCagrPct!,
        baseFcfMarginPct!,
        projectionYears
      );

  return {
    isValid: true,
    params: {
      ticker: sym,
      startingRevenueM: startingRevenueM!,
      sharesOutstandingM: sharesOutstandingM!,
      netCashM: netCashM!,
      waccPct: waccPct!,
      terminalGrowthPct: terminalGrowthPct!,
      baseRevenueCagrPct: baseRevenueCagrPct!,
      baseFcfMarginPct: baseFcfMarginPct!,
      projectionYears,
      fairValue: fv,
      reportDate,
    },
  };
}

/**
 * Pure deterministic sequential revaluation bridge of DCF Fair Value changes between two reports.
 * Replaces heuristic linear sensitivity approximations with true sequential model re-evaluation:
 * V(prev) -> V(rev) -> V(growth) -> V(margin) -> V(wacc) -> V(tg) -> V(netCash) -> V(shares)
 */
export function decomposeValuationDelta(
  currentReport?: Partial<ReportData> | null,
  previousReport?: Partial<ReportData> | null,
  isThai = false
): ValuationDecompositionResult | null {
  if (!currentReport || !previousReport) return null;

  // 1. Ticker match guard
  const curTicker = (currentReport.ticker || (currentReport as any).company_profile?.overview?.symbol || 'STOCK').toUpperCase().trim();
  const prevTicker = (previousReport.ticker || (previousReport as any).company_profile?.overview?.symbol || 'STOCK').toUpperCase().trim();

  if (
    curTicker !== prevTicker &&
    curTicker !== 'STOCK' &&
    prevTicker !== 'STOCK' &&
    curTicker !== 'EQUITY' &&
    prevTicker !== 'EQUITY'
  ) {
    return {
      isAvailable: false,
      reason: `Ticker mismatch: cannot decompose valuation between ${curTicker} and ${prevTicker}.`,
      reasonTh: `ไม่สามารถเปรียบเทียบปัจจัยมูลค่าระหว่างหุ้นคนละตัว (${curTicker} vs ${prevTicker})`,
    };
  }

  const ticker = curTicker !== 'STOCK' && curTicker !== 'EQUITY' ? curTicker : prevTicker;

  // Check fair value presence: if either report completely lacks fair value, return null
  const curFvCheck = parseNumber(
    currentReport.intrinsic_value?.summary?.base_case_fair_value ??
    currentReport.intrinsic_value?.dcf_model?.scenarios?.base?.fair_value_per_share
  );
  const prevFvCheck = parseNumber(
    previousReport.intrinsic_value?.summary?.base_case_fair_value ??
    previousReport.intrinsic_value?.dcf_model?.scenarios?.base?.fair_value_per_share
  );

  if (curFvCheck === null || prevFvCheck === null || prevFvCheck <= 0) {
    return null;
  }

  // 2. Extract verified canonical DCF parameters for both reports
  const curExtracted = extractCanonicalParams(currentReport, ticker);
  if (curExtracted.isValid === false) {
    return {
      isAvailable: false,
      reason: `Current report: ${curExtracted.reason}`,
      reasonTh: `รายงานฉบับปัจจุบัน: ${curExtracted.reasonTh}`,
      missingFields: curExtracted.missingFields,
    };
  }

  const prevExtracted = extractCanonicalParams(previousReport, ticker);
  if (prevExtracted.isValid === false) {
    return {
      isAvailable: false,
      reason: `Historical report: ${prevExtracted.reason}`,
      reasonTh: `รายงานฉบับก่อนหน้า: ${prevExtracted.reasonTh}`,
      missingFields: prevExtracted.missingFields,
    };
  }

  const cur = curExtracted.params;
  const prev = prevExtracted.params;

  // 3. Sequential Valuation Revaluation Bridge
  // Step 0: Previous baseline model valuation
  const V0 = calculateStrictDCFValue(
    prev.startingRevenueM,
    prev.sharesOutstandingM,
    prev.netCashM,
    prev.waccPct,
    prev.terminalGrowthPct,
    prev.baseRevenueCagrPct,
    prev.baseFcfMarginPct,
    prev.projectionYears
  );

  // Step 1: Base Operating Revenue Fact (cur startingRevenueM)
  const V1 = calculateStrictDCFValue(
    cur.startingRevenueM,
    prev.sharesOutstandingM,
    prev.netCashM,
    prev.waccPct,
    prev.terminalGrowthPct,
    prev.baseRevenueCagrPct,
    prev.baseFcfMarginPct,
    prev.projectionYears
  );

  // Step 2: Growth Assumption Revision (cur baseRevenueCagrPct)
  const V2 = calculateStrictDCFValue(
    cur.startingRevenueM,
    prev.sharesOutstandingM,
    prev.netCashM,
    prev.waccPct,
    prev.terminalGrowthPct,
    cur.baseRevenueCagrPct,
    prev.baseFcfMarginPct,
    prev.projectionYears
  );

  // Step 3: Margin Assumption Revision (cur baseFcfMarginPct)
  const V3 = calculateStrictDCFValue(
    cur.startingRevenueM,
    prev.sharesOutstandingM,
    prev.netCashM,
    prev.waccPct,
    prev.terminalGrowthPct,
    cur.baseRevenueCagrPct,
    cur.baseFcfMarginPct,
    prev.projectionYears
  );

  // Step 4: Cost of Capital / WACC Shift (cur waccPct)
  // Ensure intermediate terminal growth does not exceed intermediate WACC
  const safeTg4 = Math.min(cur.waccPct - 0.5, prev.terminalGrowthPct);
  const V4 = calculateStrictDCFValue(
    cur.startingRevenueM,
    prev.sharesOutstandingM,
    prev.netCashM,
    cur.waccPct,
    safeTg4,
    cur.baseRevenueCagrPct,
    cur.baseFcfMarginPct,
    prev.projectionYears
  );

  // Step 5: Long-Term Terminal Growth (cur terminalGrowthPct)
  const V5 = calculateStrictDCFValue(
    cur.startingRevenueM,
    prev.sharesOutstandingM,
    prev.netCashM,
    cur.waccPct,
    cur.terminalGrowthPct,
    cur.baseRevenueCagrPct,
    cur.baseFcfMarginPct,
    prev.projectionYears
  );

  // Step 6: Capital Structure & Net Cash / Debt (cur netCashM)
  const V6 = calculateStrictDCFValue(
    cur.startingRevenueM,
    prev.sharesOutstandingM,
    cur.netCashM,
    cur.waccPct,
    cur.terminalGrowthPct,
    cur.baseRevenueCagrPct,
    cur.baseFcfMarginPct,
    prev.projectionYears
  );

  // Step 7: Share Count / Dilution & Projection Horizon (cur sharesOutstandingM, cur projectionYears)
  const V7 = calculateStrictDCFValue(
    cur.startingRevenueM,
    cur.sharesOutstandingM,
    cur.netCashM,
    cur.waccPct,
    cur.terminalGrowthPct,
    cur.baseRevenueCagrPct,
    cur.baseFcfMarginPct,
    cur.projectionYears
  );

  const prevFv = prev.fairValue > 0 ? prev.fairValue : V0;
  const curFv = cur.fairValue > 0 ? cur.fairValue : V7;

  const totalDeltaDollars = Number((curFv - prevFv).toFixed(2));
  const totalDeltaPct = prevFv > 0 ? Number((((curFv - prevFv) / prevFv) * 100).toFixed(1)) : 0;

  // Exact marginal deltas from the sequential steps
  const dV_rev = Number((V1 - V0).toFixed(2));
  const dV_growth = Number((V2 - V1).toFixed(2));
  const dV_margin = Number((V3 - V2).toFixed(2));
  const dV_wacc = Number((V4 - V3).toFixed(2));
  const dV_tg = Number((V5 - V4).toFixed(2));
  const dV_netCash = Number((V6 - V5).toFixed(2));
  const dV_shares = Number((V7 - V6).toFixed(2));

  const modelDelta = Number((V7 - V0).toFixed(2));
  const unattributed = Number((totalDeltaDollars - modelDelta).toFixed(2));

  // If totalDeltaDollars is virtually 0, all drivers are 0
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
      isAvailable: true,
      ticker,
      previousDate: prev.reportDate,
      currentDate: cur.reportDate,
      previousFairValue: prevFv,
      currentFairValue: curFv,
      totalDeltaDollars: 0,
      totalDeltaPct: 0,
      drivers: [neutralDriver],
      thesisHealth: classifyThesisHealth(currentReport, previousReport, 0, isThai, [neutralDriver], prevFv),
    };
  }

  const rawDrivers: Array<{
    key: string;
    label: string;
    dollarImpact: number;
    explanation: string;
  }> = [
    {
      key: 'revenue_base_facts',
      label: isThai ? 'ฐานรายได้จริง (Revenue Fact Update)' : 'Base Revenue Fact Update',
      dollarImpact: dV_rev,
      explanation: isThai
        ? `รายได้รอบฐานเปลี่ยนจาก $${prev.startingRevenueM.toLocaleString()}M เป็น $${cur.startingRevenueM.toLocaleString()}M (${((cur.startingRevenueM - prev.startingRevenueM) / prev.startingRevenueM * 100).toFixed(1)}%)`
        : `Starting revenue moved from $${prev.startingRevenueM.toLocaleString()}M to $${cur.startingRevenueM.toLocaleString()}M (${((cur.startingRevenueM - prev.startingRevenueM) / prev.startingRevenueM * 100).toFixed(1)}%)`,
    },
    {
      key: 'cash_flow_growth',
      label: isThai ? 'การเติบโตของกระแสเงินสด (Growth Revision)' : 'Cash Flow & Growth Revision',
      dollarImpact: dV_growth,
      explanation: isThai
        ? `ปรับสมมติฐานการเติบโตจาก ${prev.baseRevenueCagrPct.toFixed(1)}% เป็น ${cur.baseRevenueCagrPct.toFixed(1)}%`
        : `Operating growth assumption revised from ${prev.baseRevenueCagrPct.toFixed(1)}% to ${cur.baseRevenueCagrPct.toFixed(1)}%`,
    },
    {
      key: 'margin_assumption',
      label: isThai ? 'สมมติฐานอัตรากำไร (FCF Margin Revision)' : 'FCF Margin Revision',
      dollarImpact: dV_margin,
      explanation: isThai
        ? `ปรับสมมติฐานอัตรากำไรกระแสเงินสดอิสระจาก ${prev.baseFcfMarginPct.toFixed(1)}% เป็น ${cur.baseFcfMarginPct.toFixed(1)}%`
        : `FCF margin assumption revised from ${prev.baseFcfMarginPct.toFixed(1)}% to ${cur.baseFcfMarginPct.toFixed(1)}%`,
    },
    {
      key: 'wacc_discount_rate',
      label: isThai ? 'อัตราคิดลดต้นทุนเงินทุน (WACC Shift)' : 'Cost of Capital (WACC Shift)',
      dollarImpact: dV_wacc,
      explanation: isThai
        ? `WACC ปรับจาก ${prev.waccPct.toFixed(2)}% เป็น ${cur.waccPct.toFixed(2)}%`
        : `Discount rate shifted from ${prev.waccPct.toFixed(2)}% to ${cur.waccPct.toFixed(2)}%`,
    },
    {
      key: 'terminal_growth',
      label: isThai ? 'อัตราเติบโตระยะยาว (Terminal Growth)' : 'Long-Term Terminal Growth',
      dollarImpact: dV_tg,
      explanation: isThai
        ? `Terminal growth เปลี่ยนจาก ${prev.terminalGrowthPct.toFixed(2)}% เป็น ${cur.terminalGrowthPct.toFixed(2)}%`
        : `Terminal growth expectation shifted from ${prev.terminalGrowthPct.toFixed(2)}% to ${cur.terminalGrowthPct.toFixed(2)}%`,
    },
    {
      key: 'capital_structure',
      label: isThai ? 'โครงสร้างทุน & หนี้สินสุทธิ (Net Debt / Cash)' : 'Capital Structure & Net Debt',
      dollarImpact: dV_netCash,
      explanation: isThai
        ? `เงินสดสุทธิ/หนี้สินสุทธิเปลี่ยนจาก $${prev.netCashM.toLocaleString()}M เป็น $${cur.netCashM.toLocaleString()}M`
        : `Net cash/debt shifted from $${prev.netCashM.toLocaleString()}M to $${cur.netCashM.toLocaleString()}M`,
    },
    {
      key: 'share_dilution',
      label: isThai ? 'จำนวนหุ้นหมุนเวียน (Dilution / Share Count)' : 'Share Count & Dilution',
      dollarImpact: dV_shares,
      explanation: isThai
        ? `จำนวนหุ้นเปลี่ยนจาก ${prev.sharesOutstandingM.toLocaleString()}M เป็น ${cur.sharesOutstandingM.toLocaleString()}M`
        : `Diluted shares moved from ${prev.sharesOutstandingM.toLocaleString()}M to ${cur.sharesOutstandingM.toLocaleString()}M`,
    },
  ];

  // Include explicit unattributed residual driver if any discrepancy exists between reported FV and model steps
  if (Math.abs(unattributed) >= 0.01) {
    rawDrivers.push({
      key: 'unattributed_interaction',
      label: isThai ? 'ส่วนต่างผลกระทบร่วม / ค่าปัดเศษ (Model Interaction)' : 'Unattributed / Model Interaction',
      dollarImpact: unattributed,
      explanation: isThai
        ? 'ผลกระทบร่วมระหว่างตัวแปรหรือความต่างจากการปัดเศษทางทศนิยม'
        : 'Cross-parameter interaction or rounding discrepancy between published fair value and sequential steps',
    });
  }

  const drivers: ValuationDrivers[] = rawDrivers.map((d) => {
    const pct = totalDeltaDollars !== 0
      ? Number(((d.dollarImpact / totalDeltaDollars) * 100).toFixed(1))
      : 0;

    return {
      key: d.key,
      label: d.label,
      dollarImpact: d.dollarImpact,
      percentageContribution: pct,
      direction: d.dollarImpact > 0 ? 'positive' : d.dollarImpact < 0 ? 'negative' : 'neutral',
      explanation: d.explanation,
    };
  });

  const thesisHealth = classifyThesisHealth(
    currentReport,
    previousReport,
    totalDeltaDollars,
    isThai,
    drivers,
    prevFv
  );

  return {
    isAvailable: true,
    ticker,
    previousDate: prev.reportDate,
    currentDate: cur.reportDate,
    previousFairValue: prevFv,
    currentFairValue: curFv,
    totalDeltaDollars,
    totalDeltaPct,
    drivers,
    thesisHealth,
  };
}

/**
 * Classifies the health of the investment thesis based on percentage fair value delta,
 * verified conviction score shift, and primary driver attribution.
 * Eliminates heuristic fallback defaults (no `?? 70` and no fixed $15 threshold).
 */
export function classifyThesisHealth(
  currentReport: Partial<ReportData>,
  previousReport: Partial<ReportData>,
  totalDeltaDollars: number,
  isThai = false,
  drivers?: ValuationDrivers[],
  previousFairValue?: number
): ThesisHealth {
  const curScore = typeof currentReport.verdict?.conviction_score === 'number' &&
    Number.isFinite(currentReport.verdict.conviction_score)
    ? currentReport.verdict.conviction_score
    : null;

  const prevScore = typeof previousReport.verdict?.conviction_score === 'number' &&
    Number.isFinite(previousReport.verdict.conviction_score)
    ? previousReport.verdict.conviction_score
    : null;

  const convictionShift = (curScore !== null && prevScore !== null)
    ? curScore - prevScore
    : null;

  const prevFv = previousFairValue
    ?? parseNumber(previousReport.intrinsic_value?.summary?.base_case_fair_value ?? previousReport.intrinsic_value?.dcf_model?.scenarios?.base?.fair_value_per_share)
    ?? 100;

  const totalDeltaPct = prevFv > 0 ? (totalDeltaDollars / prevFv) * 100 : 0;

  // Check if WACC was the overwhelming driver of a fair value drop (>= 70% of negative delta)
  if (drivers && totalDeltaDollars < 0) {
    const waccDriver = drivers.find((d) => d.key === 'wacc_discount_rate');
    if (waccDriver && Math.abs(waccDriver.dollarImpact) >= Math.abs(totalDeltaDollars) * 0.7) {
      return {
        status: 'macro_driven',
        headline: isThai ? 'ปรับลดจากปัจจัยมหภาค (Macro/WACC)' : 'Macro/Discount Rate Driven',
        summary: isThai
          ? 'การลดลงของ Fair Value เกิดจากอัตราคิดลด WACC สูงขึ้นเป็นหลัก ขณะที่ปัจจัยพื้นฐานยังไม่เสื่อมถอยรุนแรง'
          : 'Fair value decline was primarily driven by elevated cost of capital rather than underlying operational deterioration.',
        convictionShift,
      };
    }
  }

  // Material Thesis Upgrade: Fair Value expansion >= +10% and conviction not deteriorating
  if (totalDeltaPct >= 10.0 && (convictionShift === null || convictionShift >= 0)) {
    return {
      status: 'upgraded',
      headline: isThai ? 'สมมติฐานการลงทุนแข็งแกร่งขึ้น (Thesis Upgraded)' : 'Investment Thesis Strengthened',
      summary: isThai
        ? `การปรับเพิ่ม Fair Value มาจากการขยายตัวของกระแสเงินสดและสมมติฐานพื้นฐาน${convictionShift !== null ? ` (ความเชื่อมั่น +${convictionShift} จุด)` : ''}`
        : `Intrinsic value expanded driven by stronger operating cash generation.${convictionShift !== null ? ` (Conviction +${convictionShift} pts)` : ''}`,
      convictionShift,
    };
  }

  // Material Thesis Contraction: Fair Value drop <= -10% or conviction drop <= -10 pts
  if (totalDeltaPct <= -10.0 || (convictionShift !== null && convictionShift <= -10)) {
    return {
      status: 'under_pressure',
      headline: isThai ? 'สมมติฐานการลงทุนเริ่มเผชิญความเสี่ยง (Under Pressure)' : 'Thesis Under Pressure',
      summary: isThai
        ? `Fair Value หรือคะแนนความเชื่อมั่นลดลง ควรทบทวนการเติบโตและปัจจัยความเสี่ยงทางธุรกิจ${convictionShift !== null ? ` (ความเชื่อมั่น ${convictionShift} จุด)` : ''}`
        : `Fair value or conviction score degraded materially; business operational trajectory warrants close review.${convictionShift !== null ? ` (Conviction ${convictionShift} pts)` : ''}`,
      convictionShift,
    };
  }

  return {
    status: 'intact',
    headline: isThai ? 'สมมติฐานการลงทุนยังคงรูป (Thesis Intact)' : 'Investment Thesis Intact',
    summary: isThai
      ? 'การเปลี่ยนแปลงของมูลค่ายังอยู่ในกรอบความผันผวนปกติ (±10%) และโครงสร้างธุรกิจยังมั่นคง'
      : 'Valuation variance remains within expected bounds (±10%) with business fundamentals stable.',
    convictionShift,
  };
}
