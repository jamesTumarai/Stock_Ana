import { CyclicalModel, ReportData } from '../../types';

/**
 * Through-Cycle Normalized DCF Model for Cyclical / Commodity Companies.
 */
export function calculateCyclicalModel(data?: Partial<ReportData>, ticker?: string): CyclicalModel {
  const currentPrice = data?.intrinsic_value?.current_price || 100;
  const inc = data?.financial_statements?.income_statement;
  const currentOpMargin = (inc?.operating_margin_pct && inc.operating_margin_pct.length > 0)
    ? Math.max(0, Number(inc.operating_margin_pct[inc.operating_margin_pct.length - 1] || 12))
    : 12.0;

  // 1. Establish 7-10 Year Business Cycle Benchmark Margins
  // For cyclicals, peak margin is usually ~1.6x-2.0x of mid-cycle, trough is ~0.3x-0.5x
  const normalizedAverage = Number(Math.max(8.0, Math.min(22.0, currentOpMargin * 0.9)).toFixed(1));
  const peakMargin = Number((normalizedAverage * 1.85).toFixed(1));
  const troughMargin = Number(Math.max(2.0, normalizedAverage * 0.35).toFixed(1));

  // 2. Base Fair Value using Normalized Margin (smoothing out commodity swings)
  // Scaling fair value based on normalized margin vs current cyclical state
  const marginAdjustmentRatio = normalizedAverage / Math.max(1, currentOpMargin);
  const baseFairValue = Number((currentPrice * marginAdjustmentRatio).toFixed(2));
  
  // Scenarios tied to commodity demand cycle
  const bearFairValue = Number((baseFairValue * 0.72).toFixed(2));
  const bullFairValue = Number((baseFairValue * 1.38).toFixed(2));

  return {
    cycle_length_years: 8,
    historical_margins: {
      cycle_peak_margin_pct: peakMargin,
      cycle_trough_margin_pct: troughMargin,
      normalized_average_margin_pct: normalizedAverage,
      current_margin_pct: currentOpMargin
    },
    scenarios: {
      bear: {
        commodity_cycle_assumption: 'วัฏจักรขาลง (Downcycle Trough): อุปทานส่วนเกินกดดันราคาขาย อัตรากำไรลดลงสู่ระดับต่ำสุด',
        normalized_margin_pct: troughMargin,
        fair_value_per_share: bearFairValue,
        key_assumption_note: `สมมติฐานราคาสินค้าโภคภัณฑ์ปรับลดลง อัตรากำไรระดับ ${troughMargin}%`
      },
      base: {
        commodity_cycle_assumption: 'ค่าเฉลี่ยทั้งวัฏจักร (Mid-Cycle Normalized): สะท้อนกำไรปกติข้ามรอบ 7-10 ปี ทั้งช่วงขาขึ้นและขาลง',
        normalized_margin_pct: normalizedAverage,
        fair_value_per_share: baseFairValue,
        key_assumption_note: `อิงอัตรากำไรเฉลี่ยตลอดวัฏจักร ${normalizedAverage}% ป้องกันการตีมูลค่าผิดพลาดที่จุดสูงสุด/ต่ำสุด`
      },
      bull: {
        commodity_cycle_assumption: 'วัฏจักรขาขึ้น (Upcycle Peak): อุปสงค์ตึงตัว ค่าการกลั่น/ราคาขายพุ่งแตะระดับสูงสุดของรอบ',
        normalized_margin_pct: peakMargin,
        fair_value_per_share: bullFairValue,
        key_assumption_note: `สมมติฐานช่วง Supercycle หนุนอัตรากำไรขยับขึ้นแตะ ${peakMargin}%`
      }
    }
  };
}
