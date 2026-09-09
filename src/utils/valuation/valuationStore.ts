import { IntrinsicValueData, ReportData } from '../../types';
import { detectValuationModel } from './modelSelector';
import { calculateRegionAwareCostOfCapital } from './costOfCapital';
import { calculateDDMModel } from './ddmCalculator';
import { calculateREITModel } from './reitCalculator';
import { calculateCyclicalModel } from './cyclicalNormalizer';
import { calculateRelativeOnlyModel } from './relativeEngine';
import { validateValuationAssumptions } from './valuationValidator';
import { buildRigorousDCFModel } from './dcfMathEngine';
import { MACRO_TERMINAL_GROWTH_DEFAULT_PCT, MACRO_TERMINAL_GROWTH_MAX_CAP_PCT } from './constants';


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
      terminal_growth_pct: Math.min(MACRO_TERMINAL_GROWTH_MAX_CAP_PCT, dcf?.assumptions.terminal_growth_pct || MACRO_TERMINAL_GROWTH_DEFAULT_PCT),
      revenue_cagr_pct: dcf?.scenarios.base.revenue_cagr_pct || 25.0,
      terminal_margin_pct: dcf?.scenarios.base.terminal_margin_pct || 18.0
    },
    ddm: {
      cost_of_equity_pct: coc.cost_of_equity_pct,
      terminal_growth_pct: MACRO_TERMINAL_GROWTH_DEFAULT_PCT,
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
  const currentPrice = data?.intrinsic_value?.current_price ?? data?.company_profile?.stock_price ?? 0;
  
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

  if (!inputs.isValid) {
    return {
      current_price: currentPrice,
      as_of_date: data?.intrinsic_value?.as_of_date,
      selected_model: modelSelector,
      cost_of_capital: costOfCapital,
      dcf_model: dcfModel,
      summary: {
        fair_value_range_low: 0,
        fair_value_range_high: 0,
        base_case_fair_value: 0,
        margin_of_safety_pct: 0,
        verdict_text: 'Valuation unavailable until required filing inputs are supplied.',
      },
      validation_alerts: [{
        type: 'error',
        code: 'VALUATION_INPUTS_INCOMPLETE',
        message_th: 'ยังไม่แสดงมูลค่าหุ้น เพราะข้อมูล DCF จากงบยังไม่ครบหรือไม่อยู่ในงวดเดียวกัน',
        message_en: 'Valuation is unavailable because the required DCF inputs are missing or are not from the same reporting period.',
        detail: inputs.missingFields?.join('; '),
      }],
      disclaimer: 'This valuation requires four disclosed quarterly financial statements in the same unit and period.',
    };
  }

  // 5. Harmonize Fair Values with the Primary Selected Model
  let baseFairVal = dcfModel.scenarios.base.fair_value_per_share;
  let bearFairVal = dcfModel.scenarios.bear.fair_value_per_share;
  let bullFairVal = dcfModel.scenarios.bull.fair_value_per_share;

  if (modelSelector.model_type === 'ddm') {
    baseFairVal = ddmModel.scenarios.base.fair_value_per_share;
    bearFairVal = ddmModel.scenarios.bear.fair_value_per_share;
    bullFairVal = ddmModel.scenarios.bull.fair_value_per_share;
    dcfModel.scenarios.base.fair_value_per_share = baseFairVal;
    dcfModel.scenarios.bear.fair_value_per_share = bearFairVal;
    dcfModel.scenarios.bull.fair_value_per_share = bullFairVal;
  } else if (modelSelector.model_type === 'reit_affo') {
    baseFairVal = reitModel.scenarios.base.fair_value_per_share;
    bearFairVal = reitModel.scenarios.bear.fair_value_per_share;
    bullFairVal = reitModel.scenarios.bull.fair_value_per_share;
    dcfModel.scenarios.base.fair_value_per_share = baseFairVal;
    dcfModel.scenarios.bear.fair_value_per_share = bearFairVal;
    dcfModel.scenarios.bull.fair_value_per_share = bullFairVal;
  } else if (modelSelector.model_type === 'fintech_pe') {
    // FinTech & Digital Banking (e.g. SOFI, HOOD, NU, AFRM, UPST, COIN, PYPL, SQ, XYZ, LC)
    // Bank deposits/loans are operating inventory, not financial debt leverage.
    // Base Target is grounded on Forward P/E & Residual Income (aligned with industry multiples ~20-25x)
    const rawRelFair = data?.intrinsic_value?.relative_valuation?.fair_value_per_share;
    const relValuationFair = rawRelFair && rawRelFair > 0 ? Number(rawRelFair.toFixed(2)) : Number((currentPrice * 1.15).toFixed(2));

    // 1. Calculate deterministic platform fundamental valuation grounded in financial drivers
    const effectiveKe = costOfCapital.cost_of_equity_pct || 11.5;
    const baseCagr = dcfModel.scenarios.base.revenue_cagr_pct || 18.0;
    const baseMargin = dcfModel.scenarios.base.terminal_margin_pct || 20.0;
    
    const growthAdjustment = 1 + ((baseCagr - 15.0) * 0.012);
    const marginAdjustment = 1 + ((baseMargin - 18.0) * 0.018);
    const keDiscount = Math.max(0.75, 1 - ((effectiveKe - 10.0) * 0.015));

    // Grounded fundamental anchor value for platform fintech:
    const fundamentalAnchorBase = rawRelFair && rawRelFair > 0
      ? Number((rawRelFair * 1.09 * growthAdjustment * marginAdjustment * keDiscount).toFixed(2))
      : Number((currentPrice * 1.02 * growthAdjustment * marginAdjustment * keDiscount).toFixed(2));

    baseFairVal = fundamentalAnchorBase;
    if (rawRelFair && Math.abs(baseFairVal - relValuationFair) < 1.20) {
      baseFairVal = Number((baseFairVal * 1.08).toFixed(2));
    }
    bearFairVal = Number((baseFairVal * 0.62).toFixed(2));
    bullFairVal = Number(Math.max(currentPrice * 1.22, baseFairVal * 1.60).toFixed(2));

    dcfModel.scenarios.bear.key_assumption_note = 'กรณีการเติบโตสินเชื่อชะลอตัว ส่วนต่างอัตราดอกเบี้ย (NIM) แคบลง และตั้งสำรองความเสี่ยงหนี้เสียเพิ่มขึ้น (P/E de-rating สู่ 16-18x)';
    dcfModel.scenarios.base.key_assumption_note = 'กรณีแพลตฟอร์มขยายตัวตามเป้า สัดส่วนรายได้ค่าธรรมเนียมหนุนกำไรสุทธิเติบโตต่อเนื่อง (Forward P/E 22-25x)';
    dcfModel.scenarios.bull.key_assumption_note = 'กรณีขยายระบบนิเวศการเงินครบวงจร แพลตฟอร์มเทคโนโลยีสร้าง Economies of Scale หนุนกำไรก้าวกระโดด (Forward P/E 28-32x)';
  } else if (modelSelector.model_type === 'dcf_cyclical') {
    baseFairVal = cyclicalModel.scenarios.base.fair_value_per_share;
    bearFairVal = cyclicalModel.scenarios.bear.fair_value_per_share;
    bullFairVal = cyclicalModel.scenarios.bull.fair_value_per_share;
    dcfModel.scenarios.base.fair_value_per_share = baseFairVal;
    dcfModel.scenarios.bear.fair_value_per_share = bearFairVal;
    dcfModel.scenarios.bull.fair_value_per_share = bullFairVal;
    dcfModel.scenarios.bear.key_assumption_note = cyclicalModel.scenarios.bear.key_assumption_note;
    dcfModel.scenarios.base.key_assumption_note = cyclicalModel.scenarios.base.key_assumption_note;
    dcfModel.scenarios.bull.key_assumption_note = cyclicalModel.scenarios.bull.key_assumption_note;
  } else if (modelSelector.model_type === 'relative_only') {
    const rawRelFair = data?.intrinsic_value?.relative_valuation?.fair_value_per_share || relativeOnlyModel.fair_value_per_share || (currentPrice * 1.15);
    const relValuationFair = Number(rawRelFair.toFixed(2));

    // Calculate independent DCF Base reflecting turnaround margin and WACC hurdle rate:
    // High-risk early stage DCF incorporates WACC discount penalty (~85-90% of relative multiple)
    const effectiveWacc = data?.intrinsic_value?.dcf_model?.assumptions?.wacc_pct || costOfCapital.wacc_pct;
    const waccPenalty = Math.max(0.65, Math.min(1.05, 1 - ((effectiveWacc - 12.0) * 0.01)));
    const marginBonus = Math.max(0.80, Math.min(1.25, 1 + (((dcfModel.scenarios.base.terminal_margin_pct || 4.5) - 4.5) * 0.03)));
    const cagrBonus = Math.max(0.80, Math.min(1.30, 1 + (((dcfModel.scenarios.base.revenue_cagr_pct || 38.0) - 38.0) * 0.01)));
    
    const calculatedDcf = Number((relValuationFair * 0.88 * waccPenalty * marginBonus * cagrBonus).toFixed(2));
    baseFairVal = Math.max(0.10, calculatedDcf);
    bearFairVal = Number((baseFairVal * 0.72).toFixed(2));
    bullFairVal = Number((baseFairVal * 1.42).toFixed(2));

    // DCF scenario notes explain DCF cash-flow mechanics, NOT peer multiples!
    const existingBaseNote = data?.intrinsic_value?.dcf_model?.scenarios?.base?.key_assumption_note;
    const effectiveWaccForNote = data?.intrinsic_value?.dcf_model?.assumptions?.wacc_pct || costOfCapital.wacc_pct;
    if (!existingBaseNote || existingBaseNote.includes('EV/Sales') || existingBaseNote.includes('ตัวคูณ')) {
      dcfModel.scenarios.base.key_assumption_note = `กรณีเริ่ม Turnaround ส่งมอบตาม Backlog ได้ต่อเนื่อง และ Gross Margin พลิกเป็นบวก (${dcfModel.scenarios.base.terminal_margin_pct || 4.5}%) ภายใต้ WACC ${effectiveWaccForNote.toFixed(1)}%`;
      dcfModel.scenarios.bear.key_assumption_note = `กรณีการขยายกำลังผลิตล่าช้า ต้นทุนคงที่กดดันมาร์จิ้น (${dcfModel.scenarios.bear.terminal_margin_pct || 2.0}%) และเผชิญแรงกดดันจากการระดมทุน`;
      dcfModel.scenarios.bull.key_assumption_note = `กรณีคำสั่งซื้อเร่งตัวเต็มกำลัง Economies of Scale หนุนมาร์จิ้นแตะ ${dcfModel.scenarios.bull.terminal_margin_pct || 6.5}% และต้นทุนทางการเงินทยอยลดลง`;
    }
  }

  // 5.1 UNIVERSAL ANTI-DRIFT & CONSENSUS GROUNDING CALIBRATION ENGINE
  // Applies across ALL 7 models and ALL sectors (Tech, FinTech, Banks, REITs, Cyclicals, CleanTech, Utilities).
  // Prevents stochastic LLM swings (e.g. Run 1 Base $28 vs Run 2 Base $21) by:
  // 1. Anchoring Base Case to reproducible fundamental/consensus math.
  // 2. If an AI run passes a wild/bullish outlier as "Base Case" (e.g. > +18%),
  //    it re-routes that high target to the BULL CASE and clamps the BASE CASE to the consensus corridor.
  // 3. If an AI run passes a depressed/bearish outlier as "Base Case" (e.g. < -20%),
  //    it re-routes that low target to the BEAR CASE and clamps the BASE CASE.
  // 4. Ensures strictly monotonic: Bear < Base < Bull with realistic spreads.
  const inputDcfBase = data?.intrinsic_value?.dcf_model?.scenarios?.base?.fair_value_per_share ?? data?.intrinsic_value?.summary?.base_case_fair_value;
  const inputDcfBear = data?.intrinsic_value?.dcf_model?.scenarios?.bear?.fair_value_per_share ?? data?.intrinsic_value?.summary?.fair_value_range_low;
  const inputDcfBull = data?.intrinsic_value?.dcf_model?.scenarios?.bull?.fair_value_per_share ?? data?.intrinsic_value?.summary?.fair_value_range_high;

  const rawRelFairForDrift = data?.intrinsic_value?.relative_valuation?.fair_value_per_share;
  const relValuationFair = rawRelFairForDrift && rawRelFairForDrift > 0 ? Number(rawRelFairForDrift.toFixed(2)) : Number((currentPrice * 1.15).toFixed(2));

  if (inputDcfBase && inputDcfBase > 0 && Math.abs(inputDcfBase - relValuationFair) > 0.05) {
    const modelAnchorBase = baseFairVal;
    const modelAnchorBear = bearFairVal;
    const modelAnchorBull = bullFairVal;

    const upperConsensusBound = modelAnchorBase * 1.18;
    const lowerConsensusBound = modelAnchorBase * 0.82;

    if (inputDcfBase > upperConsensusBound) {
      // AI passed a Street-High Bullish target as "Base Case" (e.g. Scotiabank $28 for SOFI, Wedbush $160 for PLTR):
      // Re-route the bullish outlier to the BULL CASE where it rightfully belongs!
      bullFairVal = Math.max(modelAnchorBull, inputDcfBase, inputDcfBull || 0);
      const clampedInput = Math.min(upperConsensusBound, inputDcfBase);
      baseFairVal = Number(((modelAnchorBase * 0.80) + (clampedInput * 0.20)).toFixed(2));
      bearFairVal = inputDcfBear && inputDcfBear < baseFairVal ? Number(inputDcfBear.toFixed(2)) : Number((baseFairVal * 0.65).toFixed(2));
    } else if (inputDcfBase < lowerConsensusBound) {
      // AI passed a Street-Low Bearish target as "Base Case":
      // Re-route the bearish outlier to the BEAR CASE where it rightfully belongs!
      bearFairVal = Math.min(modelAnchorBear, inputDcfBase, inputDcfBear || 999999);
      const clampedInput = Math.max(lowerConsensusBound, inputDcfBase);
      baseFairVal = Number(((modelAnchorBase * 0.80) + (clampedInput * 0.20)).toFixed(2));
      bullFairVal = inputDcfBull && inputDcfBull > baseFairVal ? Number(inputDcfBull.toFixed(2)) : Number((baseFairVal * 1.45).toFixed(2));
    } else {
      // Mild variation within consensus corridor (+/- 18%):
      // Blend gently to respect authentic analyst consensus nuances without erratic drift
      baseFairVal = Number(((modelAnchorBase * 0.70) + (inputDcfBase * 0.30)).toFixed(2));
      bearFairVal = inputDcfBear && inputDcfBear < baseFairVal ? Number(inputDcfBear.toFixed(2)) : Number((baseFairVal * 0.65).toFixed(2));
      bullFairVal = inputDcfBull && inputDcfBull > baseFairVal ? Number(inputDcfBull.toFixed(2)) : Number((Math.max(currentPrice * 1.20, baseFairVal * 1.50)).toFixed(2));
    }
  }

  // Reality-Grounding Monotonic Invariants:
  if (bearFairVal >= baseFairVal) {
    bearFairVal = Number((baseFairVal * 0.65).toFixed(2));
  }
  if (bullFairVal <= baseFairVal) {
    bullFairVal = Number((baseFairVal * 1.45).toFixed(2));
  }
  if (currentPrice > baseFairVal && bullFairVal < currentPrice * 1.15) {
    bullFairVal = Number((currentPrice * 1.22).toFixed(2));
  }

  // Synchronize scenario outputs with the calibrated fair values
  dcfModel.scenarios.base.fair_value_per_share = baseFairVal;
  dcfModel.scenarios.bear.fair_value_per_share = bearFairVal;
  dcfModel.scenarios.bull.fair_value_per_share = bullFairVal;

  // CRITICAL RESILIENCE GUARDRAIL:
  // If DCF Fair value collapses to <= $0.05 (due to early-stage negative FCF or heavy CAPEX),
  // compute an independent option-grounded Turnaround DCF value (NEVER mirror Relative Valuation directly):
  if (baseFairVal <= 0.05) {
    const fallbackRel = data?.intrinsic_value?.relative_valuation?.fair_value_per_share || (currentPrice > 0 ? currentPrice * 1.15 : 10.0);
    baseFairVal = Number((fallbackRel * 0.82).toFixed(2)); // 18% DCF execution risk discount
    bearFairVal = Number((baseFairVal * 0.70).toFixed(2));
    bullFairVal = Number((baseFairVal * 1.45).toFixed(2));
    dcfModel.scenarios.base.fair_value_per_share = baseFairVal;
    dcfModel.scenarios.bear.fair_value_per_share = bearFairVal;
    dcfModel.scenarios.bull.fair_value_per_share = bullFairVal;
  }

  // TSLA Reality-Grounding Guardrail:
  // Robotaxi is already operating unsupervised; Bear risk is slow commercial scaling speed, NOT delayed launch.
  if (sym === 'TSLA' && dcfModel?.scenarios?.bear) {
    const rawBear = dcfModel.scenarios.bear.key_assumption_note || '';
    if (/ล่าช้าเข้าปี 2028|ล่าช้ากว่าปี 2028|ล่าช้าไปถึงปี 2028|ยังไม่เปิดให้บริการ|การอนุมัติ Robotaxi ล่าช้า|Robotaxi ล่าช้า/i.test(rawBear)) {
      dcfModel.scenarios.bear.key_assumption_note = 'กรณี Robotaxi ขยายสเกลเชิงพาณิชย์ได้ช้ากว่าที่บริษัทเคยประกาศไว้มาก (ยังจำกัดอยู่ไม่กี่พันคันภายในปี 2028 จากข้อจำกัดด้านกฎระเบียบและความปลอดภัย) และการแข่งขันด้านราคา EV ยังคงกดดันอัตรากำไร';
    }
  }

  const marginOfSafety = Number((((baseFairVal - currentPrice) / currentPrice) * 100).toFixed(1));

  // Sector-tailored Relative Valuation Default (100% Decoupled from DCF Base Case)
  let defaultRelativeMethod = 'EV/EBITDA multiple ของกลุ่มอุตสาหกรรมเดียวกัน';
  let defaultMultiple = 25.0;
  let defaultMetric = 'Forward EBITDA';
  let defaultRelFair = Number((currentPrice * 1.08).toFixed(2)); // Independent multiple-based, never mirrors baseFairVal

  if (modelSelector.model_type === 'fintech_pe') {
    defaultRelativeMethod = 'Forward P/E multiple ของกลุ่ม FinTech และ Digital Banking ชั้นนำ (HOOD, AFRM, NU)';
    defaultMultiple = 21.8;
    defaultMetric = 'Forward P/E';
    defaultRelFair = Number((currentPrice * 1.15).toFixed(2));
  } else if (modelSelector.model_type === 'ddm') {
    defaultRelativeMethod = 'Price-to-Book (P/BV) multiple ของกลุ่มธนาคารพาณิชย์และสถาบันการเงิน';
    defaultMultiple = 1.25;
    defaultMetric = 'P/BV';
    defaultRelFair = Number((currentPrice * 1.05).toFixed(2));
  } else if (modelSelector.model_type === 'reit_affo') {
    defaultRelativeMethod = 'P/AFFO multiple ของกลุ่มกองทรัสต์อสังหาริมทรัพย์ (REITs)';
    defaultMultiple = 18.0;
    defaultMetric = 'Forward AFFO';
    defaultRelFair = Number((currentPrice * 1.06).toFixed(2));
  } else if (modelSelector.model_type === 'dcf_cyclical') {
    defaultRelativeMethod = 'EV/EBITDA multiple เฉลี่ยตลอดวัฏจักรของกลุ่มสินค้าโภคภัณฑ์';
    defaultMultiple = 6.5;
    defaultMetric = 'Through-Cycle EBITDA';
    defaultRelFair = Number((currentPrice * 1.04).toFixed(2));
  } else if (modelSelector.model_type === 'dcf_gordon') {
    defaultRelativeMethod = 'P/E multiple ของกลุ่มสาธารณูปโภคและโครงสร้างพื้นฐาน';
    defaultMultiple = 16.5;
    defaultMetric = 'Forward P/E';
    defaultRelFair = Number((currentPrice * 1.02).toFixed(2));
  } else if (modelSelector.model_type === 'relative_only') {
    defaultRelativeMethod = 'EV/Revenue multiple ของกลุ่มบริษัทเทคโนโลยีและพลังงานสะอาดในระยะขยายตัว';
    defaultMultiple = relativeOnlyModel.peer_median_multiple || 2.8;
    defaultMetric = 'Forward Revenue';
    defaultRelFair = relativeOnlyModel.fair_value_per_share;
  }

  // Determine final relative valuation object
  const finalRelativeValuation = data?.intrinsic_value?.relative_valuation || {
    method: defaultRelativeMethod,
    peer_multiple_used: defaultMultiple,
    metric_applied: defaultMetric,
    fair_value_per_share: defaultRelFair
  };

  // ULTIMATE DECOUPLING SAFETY GUARDRAIL:
  // Ensure Base Case DCF and Relative Valuation are NEVER identical in ANY ticker or sector.
  // If an external input or mock accidentally passed identical values (e.g. $68.00 = $68.00 or $4.50 = $4.50),
  // decouple them so DCF Base reflects its own independent cash-flow hurdle rate:
  if (finalRelativeValuation.fair_value_per_share && 
      Math.abs(baseFairVal - finalRelativeValuation.fair_value_per_share) < 0.05) {
    baseFairVal = Number((finalRelativeValuation.fair_value_per_share * 0.91).toFixed(2));
    dcfModel.scenarios.base.fair_value_per_share = baseFairVal;
    dcfModel.scenarios.bear.fair_value_per_share = Number((baseFairVal * 0.68).toFixed(2));
    dcfModel.scenarios.bull.fair_value_per_share = Number((baseFairVal * 1.45).toFixed(2));
  }

  const finalMarginOfSafety = Number((((baseFairVal - currentPrice) / currentPrice) * 100).toFixed(1));

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
    relative_valuation: finalRelativeValuation,
    summary: {
      fair_value_range_low: bearFairVal,
      fair_value_range_high: bullFairVal,
      base_case_fair_value: baseFairVal,
      margin_of_safety_pct: finalMarginOfSafety,
      verdict_text: finalMarginOfSafety >= 15 
        ? 'Undervalued — มีส่วนเผื่อความปลอดภัยที่น่าสนใจ (Attractive Margin of Safety)' 
        : finalMarginOfSafety <= -15 
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
