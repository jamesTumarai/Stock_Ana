import { ReportData } from '../types';
import { detectValuationModel } from './valuation/modelSelector';
import { getCanonicalValuationSandboxInputs, CanonicalValuationSandboxInputs } from './valuationSandboxAdapter';
import { calculateStrictDCFValue } from './valuation/dcfMathEngine';

export interface MacroStressCanonicalInputs {
  ticker?: string;
  startingRevenueM?: number;
  sharesOutstandingM?: number;
  netCashM?: number;
  waccPct?: number;
  terminalGrowthPct?: number;
  revenueCagrPct?: number;
  fcfMarginPct?: number;
  projectionYears?: number;
  currentPrice?: number;
  fairValue?: number;
  // Legacy field name mappings
  wacc?: number;
  terminalGrowth?: number;
  revenueGrowth?: number;
  operatingMargin?: number;
}

export type MacroStressInput =
  | CanonicalValuationSandboxInputs
  | MacroStressCanonicalInputs
  | Partial<ReportData>;

export interface MacroStressScenario {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'moderate' | 'high' | 'opportunity';
  stressedWacc: number;
  stressedTerminalGrowth: number;
  stressedGrowth: number;
  stressedMargin: number;
  stressedFairValue: number;
  stressedMarginOfSafety: number;
  fairValueChangePct: number;
  driverImpacts: {
    waccDeltaBps: number;
    growthDeltaBps: number;
    marginDeltaBps: number;
    terminalGrowthDeltaBps: number;
  };
}

export type MacroStressScenariosResult = MacroStressScenario[] & {
  isAvailable: boolean;
  reason?: string;
  reasonTh?: string;
  methodologyNote?: string;
  methodologyNoteTh?: string;
  baseFairValue?: number;
  currentPrice?: number;
};

function parseNum(val: any): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

interface ResolvedStressInputs {
  ticker: string;
  startingRevenueM: number;
  sharesOutstandingM: number;
  netCashM: number;
  waccPct: number;
  terminalGrowthPct: number;
  revenueCagrPct: number;
  fcfMarginPct: number;
  projectionYears: number;
  currentPrice: number;
  baseFairValue?: number;
}

function resolveInputs(input: MacroStressInput, tickerSymbol?: string):
  | { isValid: true; inputs: ResolvedStressInputs }
  | { isValid: false; reason: string; reasonTh: string } {
  if (!input) {
    return {
      isValid: false,
      reason: 'No input data provided for macro stress analysis.',
      reasonTh: 'ไม่มีข้อมูลสำหรับการทดสอบภาวะวิกฤต',
    };
  }

  const rawAny = input as any;
  const sym = (tickerSymbol || rawAny.ticker || rawAny.company_profile?.overview?.symbol || 'STOCK').toUpperCase();

  // 1. Sector Guard
  const selectedModel = detectValuationModel(rawAny, sym);
  const isGenericFcffModel =
    selectedModel.model_type === 'dcf_standard' ||
    selectedModel.model_type === 'dcf_multistage' ||
    selectedModel.model_type === 'dcf_gordon' ||
    selectedModel.model_type === 'dcf_cyclical';

  if (!isGenericFcffModel) {
    return {
      isValid: false,
      reason: `Stress analysis unavailable: non-FCFF valuation models are not supported (model: ${selectedModel.model_type}).`,
      reasonTh: `การทดสอบภาวะวิกฤตแบบ DCF ไม่รองรับธุรกิจที่ใช้โมเดล ${selectedModel.model_name_th || selectedModel.model_type}`,
    };
  }

  // 2. Try Canonical Sandbox Adapter if this looks like a report
  if (rawAny.intrinsic_value || rawAny.sec_verification || rawAny.financial_statements) {
    const sandbox = getCanonicalValuationSandboxInputs(rawAny, sym);
    if (sandbox.isEligible) {
      const inp = sandbox.inputs;
      return {
        isValid: true,
        inputs: {
          ticker: sym,
          startingRevenueM: inp.startingRevenueM,
          sharesOutstandingM: inp.sharesOutstandingM,
          netCashM: inp.netCashM,
          waccPct: inp.waccPct,
          terminalGrowthPct: inp.terminalGrowthPct,
          revenueCagrPct: inp.baseRevenueCagrPct,
          fcfMarginPct: inp.baseFcfMarginPct,
          projectionYears: inp.projectionYears,
          currentPrice: inp.currentPrice,
          baseFairValue: inp.canonicalBaseFairValue,
        },
      };
    }
  }

  // 3. Extract direct canonical fields
  const startingRevenueM = parseNum(rawAny.startingRevenueM ?? rawAny.revenue);
  const sharesOutstandingM = parseNum(rawAny.sharesOutstandingM ?? rawAny.shares);
  const netCashM = parseNum(rawAny.netCashM ?? rawAny.netCash) ?? 0;
  const waccPct = parseNum(rawAny.waccPct ?? rawAny.wacc);
  const terminalGrowthPct = parseNum(rawAny.terminalGrowthPct ?? rawAny.terminalGrowth);
  const revenueCagrPct = parseNum(rawAny.revenueCagrPct ?? rawAny.baseRevenueCagrPct ?? rawAny.revenueGrowth);
  const fcfMarginPct = parseNum(rawAny.fcfMarginPct ?? rawAny.baseFcfMarginPct ?? rawAny.operatingMargin);
  const projectionYears = parseNum(rawAny.projectionYears) ?? 5;
  const currentPrice = parseNum(rawAny.currentPrice) ?? 0;
  const baseFairValue = parseNum(rawAny.canonicalBaseFairValue ?? rawAny.fairValue);

  const missing: string[] = [];
  if (startingRevenueM === null || startingRevenueM <= 0) missing.push('starting revenue (USD millions)');
  if (sharesOutstandingM === null || sharesOutstandingM <= 0) missing.push('shares outstanding');
  if (waccPct === null || waccPct <= 0) missing.push('WACC discount rate');
  if (terminalGrowthPct === null || terminalGrowthPct < 0 || (waccPct !== null && terminalGrowthPct >= waccPct)) {
    missing.push('terminal growth rate (< WACC)');
  }
  if (revenueCagrPct === null) missing.push('projected revenue CAGR');
  if (fcfMarginPct === null) missing.push('FCF / operating margin');

  if (missing.length > 0) {
    return {
      isValid: false,
      reason: `Stress analysis unavailable: missing verified valuation inputs (${missing.join(', ')}).`,
      reasonTh: `การทดสอบภาวะวิกฤตไม่สามารถใช้งานได้: ขาดข้อมูล ${missing.join(', ')}`,
    };
  }

  return {
    isValid: true,
    inputs: {
      ticker: sym,
      startingRevenueM: startingRevenueM!,
      sharesOutstandingM: sharesOutstandingM!,
      netCashM,
      waccPct: waccPct!,
      terminalGrowthPct: terminalGrowthPct!,
      revenueCagrPct: revenueCagrPct!,
      fcfMarginPct: fcfMarginPct!,
      projectionYears,
      currentPrice,
      baseFairValue: baseFairValue ?? undefined,
    },
  };
}

/**
 * Evaluates institutional macro stress-test scenarios deterministically against a DCF baseline.
 * Replaces heuristic sensitivity percentages with explicit recalculations via calculateStrictDCFValue.
 * Strict financial invariants:
 * 1. Calls calculateStrictDCFValue directly with stress overrides.
 * 2. Non-FCFF companies fail closed.
 * 3. Scenarios are explicitly labeled as "System-defined illustrative stress assumptions".
 */
export function evaluateMacroStressScenarios(
  input: MacroStressInput,
  isThai = false,
  ticker?: string
): MacroStressScenariosResult {
  const resolved = resolveInputs(input, ticker);

  if (resolved.isValid === false) {
    const emptyResult: MacroStressScenariosResult = [] as any;
    emptyResult.isAvailable = false;
    emptyResult.reason = resolved.reason;
    emptyResult.reasonTh = resolved.reasonTh;
    return emptyResult;
  }

  const {
    startingRevenueM,
    sharesOutstandingM,
    netCashM,
    waccPct,
    terminalGrowthPct,
    revenueCagrPct,
    fcfMarginPct,
    projectionYears,
    currentPrice,
    baseFairValue,
  } = resolved.inputs;

  // Recalculate baseline fair value deterministically
  const strictlyCalculatedBaseFv = calculateStrictDCFValue(
    startingRevenueM,
    sharesOutstandingM,
    netCashM,
    waccPct,
    terminalGrowthPct,
    revenueCagrPct,
    fcfMarginPct,
    projectionYears
  );

  const baselineFv = (typeof baseFairValue === 'number' && baseFairValue > 0)
    ? baseFairValue
    : strictlyCalculatedBaseFv;

  if (!baselineFv || baselineFv <= 0 || Number.isNaN(baselineFv)) {
    const emptyResult: MacroStressScenariosResult = [] as any;
    emptyResult.isAvailable = false;
    emptyResult.reason = 'Stress analysis unavailable: unable to calculate baseline DCF valuation.';
    emptyResult.reasonTh = 'การทดสอบภาวะวิกฤตไม่สามารถใช้งานได้: ไม่สามารถคำนวณมูลค่าพื้นฐาน DCF ได้';
    return emptyResult;
  }

  const definitions = [
    {
      id: 'base_case',
      nameEn: 'Base Case (Current Model)',
      nameTh: 'กรณีฐาน (สมมติฐานปัจจุบัน)',
      descEn: 'Unchanged valuation model reflecting verified financial filings and guidance.',
      descTh: 'แบบจำลองปัจจุบัน อ้างอิงงบการเงินและประมาณการตรวจสอบแล้ว',
      severity: 'low' as const,
      waccDeltaBps: 0,
      growthDeltaBps: 0,
      marginDeltaBps: 0,
      tgDeltaBps: 0,
    },
    {
      id: 'stagflation_shock',
      nameEn: 'Stagflation Shock',
      nameTh: 'วิกฤตภาวะเงินเฟ้อสูง + เศรษฐกิจชะลอ (Stagflation)',
      descEn: 'Persistent inflation spikes discount rates (+150 bps WACC) while cost inflation compresses margins (-200 bps).',
      descTh: 'เงินเฟ้อยืดเยื้อ ดอกเบี้ยพุ่ง (+150 bps WACC) และต้นทุนเบียดเบียนกำไร (-200 bps margin)',
      severity: 'high' as const,
      waccDeltaBps: 150,
      growthDeltaBps: -300,
      marginDeltaBps: -200,
      tgDeltaBps: -50,
    },
    {
      id: 'recession_demand_drop',
      nameEn: 'Recessionary Demand Contraction',
      nameTh: 'เศรษฐกิจถดถอย & อุปสงค์หดตัว (Recession)',
      descEn: 'Severe cyclical slowdown: revenue growth slows (-1000 bps) and margins compress (-300 bps).',
      descTh: 'อุปสงค์ทรุดตัว การเติบโตชะลอ (-1000 bps) และมาร์จิ้นหดตัว (-300 bps)',
      severity: 'high' as const,
      waccDeltaBps: 100,
      growthDeltaBps: -1000,
      marginDeltaBps: -300,
      tgDeltaBps: -80,
    },
    {
      id: 'rates_higher_for_longer',
      nameEn: 'Higher-for-Longer Rates',
      nameTh: 'ดอกเบี้ยยืนสูงยาวนาน (Higher for Longer)',
      descEn: 'Central banks keep terminal rates elevated (+200 bps WACC); valuation multiples compress across assets.',
      descTh: 'ธนาคารกลางตรึงดอกเบี้ยระดับสูง (+200 bps WACC) กดดันตัวคูณ Valuation ทั่วตลาด',
      severity: 'moderate' as const,
      waccDeltaBps: 200,
      growthDeltaBps: -100,
      marginDeltaBps: 0,
      tgDeltaBps: 0,
    },
    {
      id: 'ai_productivity_wave',
      nameEn: 'AI & Productivity Wave',
      nameTh: 'คลื่นผลิตภาพ AI และขยายมาร์จิ้น (AI Productivity)',
      descEn: 'Automation accelerates revenue expansion (+400 bps) and operational operating leverage (+250 bps margin).',
      descTh: 'เทคโนโลยีและ AI เพิ่มผลิตภาพ ยอดขายเร่งตัว (+400 bps) และมาร์จิ้นขยายตัว (+250 bps)',
      severity: 'opportunity' as const,
      waccDeltaBps: -25,
      growthDeltaBps: 400,
      marginDeltaBps: 250,
      tgDeltaBps: 30,
    },
  ];

  const scenarios: MacroStressScenario[] = definitions.map((def) => {
    // Parameter overrides under stress
    const stressedWacc = Number(Math.max(4.0, waccPct + (def.waccDeltaBps / 100)).toFixed(2));
    const stressedGrowth = Number((revenueCagrPct + (def.growthDeltaBps / 100)).toFixed(2));
    const stressedMargin = Number(Math.max(1.0, fcfMarginPct + (def.marginDeltaBps / 100)).toFixed(2));
    const stressedTerminalGrowth = Number(
      Math.min(
        stressedWacc - 0.5,
        Math.max(0.5, terminalGrowthPct + (def.tgDeltaBps / 100))
      ).toFixed(2)
    );

    // Strict deterministic DCF recalculation
    const stressedFvRaw = def.id === 'base_case'
      ? baselineFv
      : calculateStrictDCFValue(
          startingRevenueM,
          sharesOutstandingM,
          netCashM,
          stressedWacc,
          stressedTerminalGrowth,
          stressedGrowth,
          stressedMargin,
          projectionYears
        );

    const stressedFv = Number((Number.isFinite(stressedFvRaw) && stressedFvRaw > 0 ? stressedFvRaw : 0.01).toFixed(2));

    const price = currentPrice > 0 ? currentPrice : baselineFv;
    const stressedMos = Number((((stressedFv - price) / price) * 100).toFixed(1));
    const fvChangePct = Number((((stressedFv - baselineFv) / baselineFv) * 100).toFixed(1));

    return {
      id: def.id,
      name: isThai ? def.nameTh : def.nameEn,
      description: isThai ? def.descTh : def.descEn,
      severity: def.severity,
      stressedWacc,
      stressedTerminalGrowth,
      stressedGrowth,
      stressedMargin,
      stressedFairValue: stressedFv,
      stressedMarginOfSafety: stressedMos,
      fairValueChangePct: fvChangePct,
      driverImpacts: {
        waccDeltaBps: def.waccDeltaBps,
        growthDeltaBps: def.growthDeltaBps,
        marginDeltaBps: def.marginDeltaBps,
        terminalGrowthDeltaBps: def.tgDeltaBps,
      },
    };
  });

  const result: MacroStressScenariosResult = scenarios as any;
  result.isAvailable = true;
  result.baseFairValue = baselineFv;
  result.currentPrice = currentPrice;
  result.methodologyNote = 'System-defined illustrative stress assumptions evaluated against canonical DCF model.';
  result.methodologyNoteTh = 'การจำลองภาวะวิกฤตเชิงสมมติฐานของระบบคำนวณผ่านแบบจำลอง DCF ที่ตรวจสอบแล้ว';

  return result;
}
