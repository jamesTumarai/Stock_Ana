import { ReportData } from '../types';
import { detectValuationModel } from './valuation/modelSelector';
import { buildRigorousDCFModel, calculateStrictDCFValue } from './valuation/dcfMathEngine';

export interface CanonicalValuationSandboxInputs {
  ticker: string;
  currentPrice: number;
  startingRevenueM: number;
  sharesOutstandingM: number;
  netCashM: number;
  waccPct: number;
  terminalGrowthPct: number;
  projectionYears: number;
  baseRevenueCagrPct: number;
  baseFcfMarginPct: number;
  sourcePeriod?: string;
  financialDataSource?: 'sec_verified' | 'report_statements';
  priceSource?: 'market_snapshot' | 'intrinsic_value' | 'company_profile';
  canonicalBaseFairValue?: number;
}

export type ValuationSandboxEligibility =
  | {
      isEligible: true;
      inputs: CanonicalValuationSandboxInputs;
    }
  | {
      isEligible: false;
      reason: string;
      reasonTh: string;
      missingFields: string[];
      modelType?: string;
    };

/**
 * Validates and extracts canonical DCF inputs for Phase 9 Sandbox (Scenario Analysis, Sensitivity, Reverse DCF).
 *
 * Financial Integrity Invariants:
 * 1. Financial sector companies (banks, lenders, insurers, FinTech platforms routing to non-FCFF models)
 *    are strictly barred from generic FCFF calculations (fail closed).
 * 2. Missing, zero, or unverified financial inputs NEVER fall back to fabricated numbers (e.g. 9.0, 2.5, 10, 100, FCF 10).
 * 3. Returns an explicit failure with missing fields if canonical inputs are incomplete.
 */
export function getCanonicalValuationSandboxInputs(
  data?: Partial<ReportData>,
  ticker?: string
): ValuationSandboxEligibility {
  const sym = (ticker || data?.ticker || 'STOCK').toUpperCase();

  // 1. Sector & Model Type Guard
  const selectedModel = detectValuationModel(data, sym);
  const isGenericFcffModel =
    selectedModel.model_type === 'dcf_standard' ||
    selectedModel.model_type === 'dcf_multistage' ||
    selectedModel.model_type === 'dcf_gordon' ||
    selectedModel.model_type === 'dcf_cyclical';

  if (!isGenericFcffModel) {
    return {
      isEligible: false,
      reason: `Generic FCFF scenario and sensitivity calculations are not applicable to financial institutions or non-FCFF models (selected model: ${selectedModel.model_type}).`,
      reasonTh: `การจำลอง Sensitivity และ Reverse DCF แบบ FCFF ไม่สามารถใช้กับสถาบันการเงินหรือกลุ่มธุรกิจที่ใช้โมเดล ${selectedModel.model_name_th || selectedModel.model_type}`,
      missingFields: [`operating-company FCFF model fit (${selectedModel.model_type} selected)`],
      modelType: selectedModel.model_type
    };
  }

  // 2. Extract and rigorously validate DCF inputs
  const dcfResult = buildRigorousDCFModel(data, sym);
  const { inputs, dcfModel } = dcfResult;

  if (!inputs.isValid) {
    const missing = inputs.missingFields || ['required canonical DCF inputs'];
    return {
      isEligible: false,
      reason: `Insufficient verified valuation inputs: missing ${missing.join('; ')}.`,
      reasonTh: `ข้อมูลสำหรับการประเมินมูลค่าไม่ครบถ้วน: ขาด ${missing.join('; ')}`,
      missingFields: missing,
      modelType: selectedModel.model_type
    };
  }

  // 3. Validate base scenario assumptions
  const baseScenario = dcfModel.scenarios?.base;
  const baseRevenueCagrPct = baseScenario?.revenue_cagr_pct;
  const baseFcfMarginPct = baseScenario?.terminal_margin_pct;

  if (
    typeof baseRevenueCagrPct !== 'number' ||
    !Number.isFinite(baseRevenueCagrPct) ||
    typeof baseFcfMarginPct !== 'number' ||
    !Number.isFinite(baseFcfMarginPct)
  ) {
    return {
      isEligible: false,
      reason: 'Insufficient verified valuation inputs: missing base scenario revenue CAGR or FCF margin assumptions.',
      reasonTh: 'ข้อมูลสำหรับการประเมินมูลค่าไม่ครบถ้วน: ขาดสมมติฐานการเติบโตของรายได้หรืออัตรากำไร FCF กรณีฐาน',
      missingFields: ['base scenario revenue CAGR / FCF margin assumptions'],
      modelType: selectedModel.model_type
    };
  }

  const currentPrice = inputs.currentPrice;
  const startingRevenueM = inputs.startingRevenueM;
  const sharesOutstandingM = inputs.sharesOutstandingM;
  const netCashM = inputs.netCashM;
  const waccPct = inputs.waccPct;
  const terminalGrowthPct = inputs.terminalGrowthPct;
  const projectionYears = inputs.projectionYears;

  if (
    typeof currentPrice !== 'number' ||
    !Number.isFinite(currentPrice) ||
    currentPrice <= 0 ||
    typeof startingRevenueM !== 'number' ||
    !Number.isFinite(startingRevenueM) ||
    startingRevenueM <= 0 ||
    typeof sharesOutstandingM !== 'number' ||
    !Number.isFinite(sharesOutstandingM) ||
    sharesOutstandingM <= 0 ||
    typeof netCashM !== 'number' ||
    !Number.isFinite(netCashM) ||
    typeof waccPct !== 'number' ||
    !Number.isFinite(waccPct) ||
    waccPct <= 0 ||
    typeof terminalGrowthPct !== 'number' ||
    !Number.isFinite(terminalGrowthPct) ||
    terminalGrowthPct < 0 ||
    terminalGrowthPct >= waccPct ||
    typeof projectionYears !== 'number' ||
    !Number.isInteger(projectionYears) ||
    projectionYears < 1
  ) {
    return {
      isEligible: false,
      reason: 'Insufficient verified valuation inputs: one or more canonical inputs are non-finite or out of bounds.',
      reasonTh: 'ข้อมูลสำหรับการประเมินมูลค่าไม่ถูกต้องตามหลักเกณฑ์',
      missingFields: ['valid numeric canonical valuation inputs'],
      modelType: selectedModel.model_type
    };
  }

  return {
    isEligible: true,
    inputs: {
      ticker: sym,
      currentPrice,
      startingRevenueM,
      sharesOutstandingM,
      netCashM,
      waccPct,
      terminalGrowthPct,
      projectionYears,
      baseRevenueCagrPct,
      baseFcfMarginPct,
      sourcePeriod: inputs.sourcePeriod,
      financialDataSource: inputs.financialDataSource,
      priceSource: inputs.priceSource,
      canonicalBaseFairValue: typeof baseScenario.fair_value_per_share === 'number' ? baseScenario.fair_value_per_share : undefined
    }
  };
}

/**
 * Deterministically recalculates DCF Fair Value using the canonical strict DCF engine.
 * Ensures zero divergence with dcfMathEngine.
 */
export function recalculateSandboxFairValue(
  inputs: CanonicalValuationSandboxInputs,
  overrides?: {
    revenueCagrPct?: number;
    fcfMarginPct?: number;
    waccPct?: number;
    terminalGrowthPct?: number;
  }
): number {
  const cagr = overrides?.revenueCagrPct ?? inputs.baseRevenueCagrPct;
  const margin = overrides?.fcfMarginPct ?? inputs.baseFcfMarginPct;
  const wacc = overrides?.waccPct ?? inputs.waccPct;
  const tg = overrides?.terminalGrowthPct ?? inputs.terminalGrowthPct;

  return calculateStrictDCFValue(
    inputs.startingRevenueM,
    inputs.sharesOutstandingM,
    inputs.netCashM,
    wacc,
    tg,
    cagr,
    margin,
    inputs.projectionYears
  );
}
