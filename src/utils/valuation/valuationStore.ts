import { IntrinsicValueData, ReportData } from '../../types';
import { detectValuationModel } from './modelSelector';
import { calculateRegionAwareCostOfCapital } from './costOfCapital';
import { calculateDDMModel } from './ddmCalculator';
import { calculateREITModel } from './reitCalculator';
import { calculateCyclicalModel } from './cyclicalNormalizer';
import { calculateRelativeOnlyModel } from './relativeEngine';
import { validateValuationAssumptions } from './valuationValidator';
import { buildRigorousDCFModel } from './dcfMathEngine';

export interface ValuationAssumptionsStore {
  ticker: string;
  dcf: {
    wacc_pct: number;
    terminal_growth_pct: number;
    revenue_cagr_pct: number;
    terminal_margin_pct: number;
  };
  ddm: {
    cost_of_equity_pct: number;
    terminal_growth_pct: number;
    dividend_growth_rate_pct: number;
    payout_ratio_pct: number;
  };
  reit: {
    affo_multiple: number;
    affo_growth_cagr_pct: number;
  };
  cyclical: {
    normalized_margin_pct: number;
  };
  relative: {
    ev_revenue_multiple: number;
  };
}

let currentStoreTicker = '';
let currentAssumptions: ValuationAssumptionsStore | null = null;

/**
 * Initializes or resets the Centralized Valuation Assumptions Store.
 */
export function initValuationStore(data?: Partial<ReportData>, ticker?: string): ValuationAssumptionsStore {
  const sym = (ticker || data?.ticker || 'STOCK').toUpperCase();
  
  if (currentAssumptions && currentStoreTicker === sym) {
    return currentAssumptions;
  }

  const coc = calculateRegionAwareCostOfCapital(data, sym);
  const dcf = data?.intrinsic_value?.dcf_model;

  currentStoreTicker = sym;
  currentAssumptions = {
    ticker: sym,
    dcf: {
      wacc_pct: dcf?.assumptions.wacc_pct || coc.wacc_pct,
      terminal_growth_pct: dcf?.assumptions.terminal_growth_pct || 3.0,
      revenue_cagr_pct: dcf?.scenarios.base.revenue_cagr_pct || 25.0,
      terminal_margin_pct: dcf?.scenarios.base.terminal_margin_pct || 18.0
    },
    ddm: {
      cost_of_equity_pct: coc.cost_of_equity_pct,
      terminal_growth_pct: 3.0,
      dividend_growth_rate_pct: 4.5,
      payout_ratio_pct: 42.0
    },
    reit: {
      affo_multiple: 20.0,
      affo_growth_cagr_pct: 3.5
    },
    cyclical: {
      normalized_margin_pct: 12.0
    },
    relative: {
      ev_revenue_multiple: 2.8
    }
  };

  return currentAssumptions;
}

/**
 * Enriches and unifies all valuation models in the report into a consistent single-source-of-truth.
 */
export function buildUniversalValuationData(data?: Partial<ReportData>, ticker?: string): IntrinsicValueData {
  const sym = (ticker || data?.ticker || 'STOCK').toUpperCase();
  const currentPrice = data?.intrinsic_value?.current_price || data?.company_profile?.stock_price || 100;
  
  // 1. Detect Model
  const modelSelector = detectValuationModel(data, sym);
  
  // 2. Compute Cost of Capital
  const costOfCapital = calculateRegionAwareCostOfCapital(data, sym);
  
  // 3. Compute Specialized Models
  const ddmModel = calculateDDMModel(data, sym);
  const reitModel = calculateREITModel(data, sym);
  const cyclicalModel = calculateCyclicalModel(data, sym);
  const relativeOnlyModel = calculateRelativeOnlyModel(data, sym);

  // 4. Standard / Multi-stage DCF: Build mathematically rigorous DCF with verified inputs
  const { dcfModel, inputs } = buildRigorousDCFModel(data, sym);

  // 5. Keep verified DCF fair values
  const baseFairVal = dcfModel.scenarios.base.fair_value_per_share;
  const bearFairVal = dcfModel.scenarios.bear.fair_value_per_share;
  const bullFairVal = dcfModel.scenarios.bull.fair_value_per_share;

  const marginOfSafety = Number((((baseFairVal - currentPrice) / currentPrice) * 100).toFixed(1));

  const valuationPayload: IntrinsicValueData = {
    current_price: currentPrice,
    as_of_date: data?.intrinsic_value?.as_of_date || new Date().toISOString().split('T')[0],
    selected_model: modelSelector,
    cost_of_capital: costOfCapital,
    dcf_model: dcfModel,
    ddm_model: ddmModel,
    reit_model: reitModel,
    cyclical_model: cyclicalModel,
    relative_only_model: relativeOnlyModel,
    relative_valuation: data?.intrinsic_value?.relative_valuation || {
      method: 'EV/EBITDA multiple ของกลุ่มเทคโนโลยีผสมผสานยานยนต์ขั้นสูง',
      peer_multiple_used: 45.0,
      metric_applied: 'Forward EBITDA',
      fair_value_per_share: baseFairVal
    },
    summary: {
      fair_value_range_low: bearFairVal,
      fair_value_range_high: bullFairVal,
      base_case_fair_value: baseFairVal,
      margin_of_safety_pct: marginOfSafety,
      verdict_text: marginOfSafety >= 15 
        ? 'Undervalued — มีส่วนเผื่อความปลอดภัยที่น่าสนใจ (Attractive Margin of Safety)' 
        : marginOfSafety <= -15 
          ? 'Overvalued — ราคาตลาดสะท้อนการเติบโตไปมากแล้ว (Valuation Extended)' 
          : 'Fairly Valued — ราคาเหมาะสมสอดคล้องกับปัจจัยพื้นฐาน (Trading Near Fair Value)'
    },
    disclaimer: data?.intrinsic_value?.disclaimer,
    philosophy_disclaimer: 'มูลค่าที่คำนวณได้ขึ้นอยู่กับสมมติฐานที่ใส่เข้าไปทั้งหมด (WACC, อัตราการเติบโต, margin ที่คาดการณ์) ซึ่งเป็นการประมาณการอนาคต ไม่ใช่ข้อเท็จจริงที่ตรวจสอบถูกผิดได้แบบราคาตลาดหรือผลประกอบการที่เกิดขึ้นแล้ว นักวิเคราะห์ต่างสำนักคำนวณหุ้นตัวเดียวกันได้ราคาต่างกันได้มาก เพราะมุมมองอนาคตต่างกัน ไม่ใช่เพราะสูตรผิด'
  };

  // 6. Run Validations
  valuationPayload.validation_alerts = validateValuationAssumptions(valuationPayload);

  return valuationPayload;
}
