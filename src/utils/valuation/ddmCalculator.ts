import { DDMModel, ReportData } from '../../types';
import { calculateRegionAwareCostOfCapital } from './costOfCapital';

/**
 * Calculates Dividend Discount Model (DDM) & Residual Income / Excess Return Model for Banks and Financials.
 */
export function calculateDDMModel(data?: Partial<ReportData>, ticker?: string): DDMModel {
  const coc = calculateRegionAwareCostOfCapital(data, ticker);
  const ke = coc.cost_of_equity_pct; // Single Cost of Equity (WACC is NOT used for banks)
  const currentPrice = data?.intrinsic_value?.current_price || 100;
  
  // 1. Extract Dividends, Payout Ratio, and ROE
  const divSummary = data?.corporate_actions?.dividends?.summary;
  const trailingDps = divSummary?.annual_payout_usd || (currentPrice * ((divSummary?.dividend_yield_pct || 3.2) / 100));
  const dps = Math.max(0.5, Number(trailingDps.toFixed(2)));
  const payoutRatio = Math.max(20, Math.min(85, divSummary?.payout_ratio_pct || 42.0));
  
  // Calculate ROE from financials or key indicators
  const roe = (data?.five_pillars?.profitability?.roe_pct) || (data?.key_indicators?.roe as number) || 12.5;

  // Sustainable growth rate: g = ROE * (1 - Payout Ratio)
  const retentionRate = 1 - (payoutRatio / 100);
  const baseGrowthRate = Math.min(6.5, Math.max(1.5, Number((roe * retentionRate).toFixed(2))));
  const terminalGrowth = Math.min(3.5, Math.max(1.5, coc.risk_free_rate_pct * 0.8));

  // 2. Multi-stage DDM calculation function
  const computeDdmValue = (gGrowth: number, gTerm: number): number => {
    const discountRate = ke / 100;
    const termDiscountRate = Math.max(0.015, discountRate - (gTerm / 100));
    
    // 5-year projection of DPS
    let pvDividends = 0;
    let projDps = dps;
    for (let yr = 1; yr <= 5; yr++) {
      projDps = projDps * (1 + (gGrowth / 100));
      pvDividends += projDps / Math.pow(1 + discountRate, yr);
    }
    
    // Terminal Value at Year 5
    const terminalDps = projDps * (1 + (gTerm / 100));
    const terminalValue = terminalDps / termDiscountRate;
    const pvTerminalValue = terminalValue / Math.pow(1 + discountRate, 5);

    return Number((pvDividends + pvTerminalValue).toFixed(2));
  };

  const baseFairValue = computeDdmValue(baseGrowthRate, terminalGrowth);
  const bearFairValue = computeDdmValue(Math.max(0.5, baseGrowthRate - 2.0), Math.max(1.0, terminalGrowth - 0.75));
  const bullFairValue = computeDdmValue(baseGrowthRate + 2.5, terminalGrowth + 0.5);

  // 3. Residual Income / Excess Return Model: Value = BVPS + Σ [(ROE - Ke) * BVPS / (1+Ke)^t]
  const bs = data?.financial_statements?.balance_sheet;
  const totalEquityM = (bs?.total_equity && bs.total_equity.length > 0) ? bs.total_equity[bs.total_equity.length - 1] || 50000 : 50000;
  // Estimate shares from market cap or base
  const impliedSharesM = totalEquityM > 0 ? (totalEquityM / (currentPrice * 0.85)) : 500;
  const bvps = Number((totalEquityM / Math.max(1, impliedSharesM)).toFixed(2)) || (currentPrice * 0.75);
  
  const excessReturnRate = (roe - ke) / 100;
  const residualIncomePerShare = bvps * excessReturnRate;
  const pvResidualIncome = residualIncomePerShare / Math.max(0.02, (ke / 100) - (terminalGrowth / 100));
  const residualIncomeFairValue = Number((bvps + pvResidualIncome).toFixed(2));

  return {
    assumptions: {
      cost_of_equity_pct: ke,
      terminal_growth_pct: terminalGrowth,
      current_dividend_per_share: dps,
      current_payout_ratio_pct: payoutRatio,
      current_roe_pct: roe
    },
    scenarios: {
      bear: {
        dividend_growth_rate_pct: Math.max(0.5, Number((baseGrowthRate - 2.0).toFixed(1))),
        terminal_payout_ratio_pct: Math.min(80, payoutRatio + 10),
        fair_value_per_share: bearFairValue,
        key_assumption_note: 'เศรษฐกิจชะลอตัว การตั้งสำรอง NPL เพิ่มขึ้น และการเติบโตของเงินปันผลลดลง'
      },
      base: {
        dividend_growth_rate_pct: Number(baseGrowthRate.toFixed(1)),
        terminal_payout_ratio_pct: payoutRatio,
        fair_value_per_share: baseFairValue,
        key_assumption_note: `เติบโตตามอัตราสะท้อน ROE (${roe}%) และ Payout Ratio ปัจจุบัน (${payoutRatio}%)`
      },
      bull: {
        dividend_growth_rate_pct: Number((baseGrowthRate + 2.5).toFixed(1)),
        terminal_payout_ratio_pct: Math.max(25, payoutRatio - 5),
        fair_value_per_share: bullFairValue,
        key_assumption_note: 'NIM ขยายตัว การปล่อยสินเชื่อเติบโตแข็งแกร่ง และ ROE ปรับตัวสูงขึ้น'
      }
    },
    residual_income_fair_value: residualIncomeFairValue,
    book_value_per_share: bvps
  };
}
