import { IntrinsicValueData, ValuationValidationAlert } from '../../types';

/**
 * Validates valuation assumptions and outputs to flag anomalies and sanity violations.
 */
export function validateValuationAssumptions(data?: IntrinsicValueData): ValuationValidationAlert[] {
  if (!data) return [];

  const alerts: ValuationValidationAlert[] = [];
  const currentPrice = data.current_price;
  const coc = data.cost_of_capital;
  const dcf = data.dcf_model;
  const ddm = data.ddm_model;
  const selectedModel = data.selected_model?.model_type;

  // 1. Terminal Growth vs WACC / Ke Check
  const waccOrKe = selectedModel === 'ddm' ? (ddm?.assumptions.cost_of_equity_pct || 9.5) : (dcf?.assumptions.wacc_pct || 9.5);
  const termGrowth = selectedModel === 'ddm' ? (ddm?.assumptions.terminal_growth_pct || 3.0) : (dcf?.assumptions.terminal_growth_pct || 3.0);
  const rawTermGrowth = (data as any)?.intrinsic_value?.dcf_model?.assumptions?.terminal_growth_pct ?? termGrowth;

  if (termGrowth >= waccOrKe || rawTermGrowth >= waccOrKe) {
    alerts.push({
      type: 'error',
      code: 'TERMINAL_GROWTH_EXCEEDS_DISCOUNT_RATE',
      message_th: `อัตราเติบโตยั่งยืน (${rawTermGrowth}%) ต้องต่ำกว่าต้นทุนเงินทุน (${waccOrKe}%)`,
      message_en: `Terminal Growth Rate (${rawTermGrowth}%) cannot exceed Discount Rate (${waccOrKe}%)`,
      detail: 'ในทางคณิตศาสตร์การเงิน Terminal Growth ที่สูงกว่าหรือเท่ากับ Discount Rate จะทำให้มูลค่ากิจการพุ่งเป็นอนันต์'
    });
  }


  // 2. WACC < Local Rf + 2% Check
  if (coc && coc.wacc_pct < (coc.risk_free_rate_pct + 2.0)) {
    alerts.push({
      type: 'warning',
      code: 'WACC_TOO_LOW',
      message_th: `WACC (${coc.wacc_pct}%) ต่ำกว่าเกณฑ์ปกติเมื่อเทียบกับอัตราดอกเบี้ยไร้ความเสี่ยง (${coc.risk_free_rate_pct}%)`,
      message_en: `WACC (${coc.wacc_pct}%) is lower than standard risk-free spread (${coc.risk_free_rate_pct}%)`,
      detail: 'WACC ที่ต่ำเกินไปอาจประเมินมูลค่าสูงเกินจริง ควรตรวจสอบค่า Beta และสัดส่วนหนี้สิน'
    });
  }

  // 3. Margin Sanity Check (Base Margin vs Peak Margin for Cyclicals)
  if (selectedModel === 'dcf_cyclical' && data.cyclical_model) {
    const cyc = data.cyclical_model;
    if (cyc.scenarios.base.normalized_margin_pct >= cyc.historical_margins.cycle_peak_margin_pct) {
      alerts.push({
        type: 'warning',
        code: 'BASE_MARGIN_EXCEEDS_PEAK',
        message_th: 'สมมติฐาน Base Case สูงกว่าช่วงที่ดีที่สุดในอดีต (Peak Margin)',
        message_en: 'Base Case margin exceeds historical peak margin',
        detail: 'สำหรับหุ้นวัฏจักร Base Case ควรสะท้อนค่าเฉลี่ยกลางรอบ (Mid-Cycle) และย้ายสมมติฐานสูงสุดไปไว้ที่ Bull Case'
      });
    }
  }

  // 4. Fair Value vs Market Price Deviation > 40%
  const baseFairVal = data.summary?.base_case_fair_value || currentPrice;
  if (currentPrice > 0) {
    const deviationPct = Math.abs((baseFairVal - currentPrice) / currentPrice) * 100;
    if (deviationPct > 40) {
      alerts.push({
        type: 'warning',
        code: 'HIGH_VALUATION_DEVIATION',
        message_th: `ราคาเหมาะสมเบี่ยงเบนจากราคาตลาดปัจจุบัน ${deviationPct.toFixed(1)}%`,
        message_en: `Fair value deviates by ${deviationPct.toFixed(1)}% from market price`,
        detail: 'ความคลาดเคลื่อนเกิน 40% แนะนำให้ทบทวนสมมติฐานการเติบโตและอัตราคิดลดอย่างรอบคอบ'
      });
    }
  }

  // 5. Relative Valuation Peer Count Check
  if (selectedModel === 'relative_only' && data.relative_only_model) {
    const peerCount = data.relative_only_model.peers_evaluated?.length || 0;
    if (peerCount < 3) {
      alerts.push({
        type: 'warning',
        code: 'LOW_PEER_COUNT',
        message_th: `กลุ่มบริษัทเปรียบเทียบมีเพียง ${peerCount} บริษัท (ความเชื่อมั่นต่ำ)`,
        message_en: `Peer comparison group has only ${peerCount} companies (low confidence)`,
        detail: 'ควรมีกลุ่มเปรียบเทียบอย่างน้อย 3-5 บริษัทเพื่อลดความลำเอียงของตัวอย่าง'
      });
    }
  }

  // 6. DCF vs Relative Valuation Discrepancy Check (Cross-Model Divergence)
  const relFair = data.relative_valuation?.fair_value_per_share;
  if (relFair && relFair > 0 && baseFairVal > 0) {
    const ratio = baseFairVal / relFair;
    if (ratio >= 2.5) {
      alerts.push({
        type: 'warning',
        code: 'DCF_RELATIVE_DISCREPANCY_ALERT',
        message_th: `ความขัดแย้งของแบบจำลอง: ราคา DCF Base Case ($${baseFairVal.toFixed(2)}) สูงกว่า Relative Valuation ($${relFair.toFixed(2)}) ถึง ${ratio.toFixed(1)} เท่า`,
        message_en: `Model Divergence Alert: DCF Base Case ($${baseFairVal.toFixed(2)}) is ${ratio.toFixed(1)}x higher than Relative Valuation ($${relFair.toFixed(2)})`,
        detail: 'ความแตกต่างข้ามโมเดลเกิน 2.5 เท่า บ่งชี้ว่าสมมติฐานการเติบโตหรืออัตราคิดลด (WACC) ใน DCF อาจมองโลกในแง่ดีเกินไปเมื่อเทียบกับมูลค่าที่ตลาดซื้อขายจริง แนะนำให้อิง Relative Valuation หรือถ่วงน้ำหนักความน่าจะเป็น'
      });
    } else if (ratio <= 0.4) {
      alerts.push({
        type: 'warning',
        code: 'DCF_RELATIVE_DISCREPANCY_ALERT',
        message_th: `ความขัดแย้งของแบบจำลอง: ราคา DCF Base Case ($${baseFairVal.toFixed(2)}) ต่ำกว่า Relative Valuation ($${relFair.toFixed(2)}) อย่างมีนัยสำคัญ (${ratio.toFixed(2)}x)`,
        message_en: `Model Divergence Alert: DCF Base Case ($${baseFairVal.toFixed(2)}) is significantly lower than Relative Valuation ($${relFair.toFixed(2)}) (${ratio.toFixed(2)}x)`,
        detail: 'ราคา DCF ต่ำกว่ามูลค่าเปรียบเทียบในอุตสาหกรรมมาก ควรตรวจสอบภาระหนี้สินหรือการปรับตัวของมาร์จิ้น'
      });
    }
  }

  // 7. Unprofitable / Distressed Low WACC Check
  if (coc && coc.is_distressed_or_unprofitable && coc.wacc_pct < 13.0) {
    alerts.push({
      type: 'warning',
      code: 'UNPROFITABLE_DISTRESS_WACC_WARNING',
      message_th: `WACC (${coc.wacc_pct}%) ต่ำเกินไปสำหรับบริษัทที่ยังขาดทุนหรือกระแสเงินสดติดลบ`,
      message_en: `WACC (${coc.wacc_pct}%) is too low for an unprofitable / cash-burning company`,
      detail: 'บริษัทที่มีผลการดำเนินงานขาดทุนหรือ Gross Margin ติดลบ ควรมี WACC ไม่ต่ำกว่า 14-18% เพื่อสะท้อน Size Premium และ Distress Risk'
    });
  }

  // 8. Currency Mismatch Check
  if (coc && coc.is_foreign_currency_converted) {
    alerts.push({
      type: 'info',
      code: 'FOREIGN_CURRENCY_CONVERSION',
      message_th: `แปลงค่าจากงบการเงินสกุล ${coc.currency} เป็นสกุลราคาตลาดแล้ว (+${coc.currency_risk_premium_pct}% Currency Risk Premium)`,
      message_en: `Financials in ${coc.currency} converted with currency risk adjustment`,
      detail: 'การประเมินมูลค่าสะท้อนความเสี่ยงจากอัตราแลกเปลี่ยนระหว่างสกุลเงินที่รายงานงบกับสกุลที่เทรด'
    });
  }

  return alerts;
}
