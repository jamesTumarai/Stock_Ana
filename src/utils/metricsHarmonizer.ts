import { ReportData, PeerCompanyItem } from '../types';

export interface GroundTruthMetrics {
  revenue?: number | null;
  grossProfit?: number | null;
  operatingIncome?: number | null;
  netIncome?: number | null;
  totalAssets?: number | null;
  totalEquity?: number | null;
  totalDebt?: number | null;
  cashAndInvestments?: number | null;
  ocf?: number | null;
  capex?: number | null;
  fcf?: number | null;
  
  // Computed True Ratios (%)
  grossMarginPct?: number | null;
  operatingMarginPct?: number | null;
  netMarginPct?: number | null;
  roePct?: number | null;
  roaPct?: number | null;
  fcfMarginPct?: number | null;
  currentRatio?: number | null;
  debtToEquity?: number | null;
}

function getLastNonNull(arr?: (number | null)[]): number | null {
  if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== null && arr[i] !== undefined && !isNaN(Number(arr[i]))) {
      return Number(arr[i]);
    }
  }
  return null;
}

function roundTo(val: number | null | undefined, decimals = 1): number | null {
  if (val === null || val === undefined || isNaN(val)) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

/**
 * Extracts and calculates single-source-of-truth ground metrics from financial statements.
 */
export function extractGroundTruthMetrics(data?: ReportData): GroundTruthMetrics {
  if (!data) return {};

  const fs = data.financial_statements;
  const inc = fs?.income_statement;
  const bs = fs?.balance_sheet;
  const cf = fs?.cash_flow;

  const revenue = getLastNonNull(inc?.revenue);
  const grossProfit = getLastNonNull(inc?.gross_profit);
  const operatingIncome = getLastNonNull(inc?.operating_income);
  const netIncome = getLastNonNull(inc?.net_income);
  const totalAssets = getLastNonNull(bs?.total_assets);
  const totalEquity = getLastNonNull(bs?.total_equity);
  const totalDebt = getLastNonNull(bs?.total_debt);
  const cashAndInvestments = getLastNonNull(bs?.cash_and_equivalents) || getLastNonNull(bs?.total_current_assets);
  const ocf = getLastNonNull(cf?.operating_cash_flow);
  const capex = getLastNonNull(cf?.capex);
  const fcf = getLastNonNull(cf?.free_cash_flow) ?? (ocf !== null && capex !== null ? ocf - capex : null);

  const grossMarginPct = revenue && grossProfit ? roundTo((grossProfit / revenue) * 100, 1) : getLastNonNull(inc?.gross_margin_pct);
  const operatingMarginPct = revenue && operatingIncome ? roundTo((operatingIncome / revenue) * 100, 1) : getLastNonNull(inc?.operating_margin_pct);
  const netMarginPct = revenue && netIncome ? roundTo((netIncome / revenue) * 100, 1) : getLastNonNull(inc?.net_margin_pct);
  const roePct = totalEquity && totalEquity > 0 && netIncome ? roundTo((netIncome / totalEquity) * 100, 1) : null;
  const roaPct = totalAssets && totalAssets > 0 && netIncome ? roundTo((netIncome / totalAssets) * 100, 1) : null;
  const fcfMarginPct = revenue && fcf ? roundTo((fcf / revenue) * 100, 1) : getLastNonNull(cf?.fcf_margin_pct);
  const currentRatio = getLastNonNull(bs?.current_ratio);
  const debtToEquity = getLastNonNull(bs?.debt_to_equity) ?? (totalDebt !== null && totalEquity && totalEquity > 0 ? roundTo(totalDebt / totalEquity, 2) : null);

  return {
    revenue,
    grossProfit,
    operatingIncome,
    netIncome,
    totalAssets,
    totalEquity,
    totalDebt,
    cashAndInvestments,
    ocf,
    capex,
    fcf,
    grossMarginPct,
    operatingMarginPct,
    netMarginPct,
    roePct,
    roaPct,
    fcfMarginPct,
    currentRatio,
    debtToEquity
  };
}

/**
 * Parses true RSI value from text, safely ignoring period parameters like (14), 14-day, 14 วัน.
 */
export function extractCleanRsi(text?: string): { value: number; statusTh: string; statusEn: string } | null {
  if (!text) return null;

  // 1. Remove period patterns: "14 days", "(14)", "14-day", "14 วัน", "period 14", "14-period"
  const clean = text
    .replace(/RSI\s*\(\s*14\s*(?:days?|วัน|d)?\s*\)/gi, 'RSI')
    .replace(/RSI\s*(?:period\s*)?14\s*(?:days?|วัน|d|-day)?/gi, 'RSI')
    .replace(/\b14\s*(?:days?|วัน|d|-day)\b/gi, '')
    .replace(/\b(?:period|ช่วงเวลา|คาบ)\s*14\b/gi, '');

  // 2. Look for explicit value match after RSI keywords
  let match = clean.match(/RSI\s*(?:is|at|=|:|อยู่ที่|คือ|เท่ากับ|ระดับ|มีค่า)?\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (!match) {
    match = clean.match(/\b([0-9]{1,2}(?:\.[0-9]+)?)\b/);
  }

  if (match && match[1]) {
    const val = parseFloat(match[1]);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      const isOverbought = val >= 70;
      const isOversold = val <= 30;
      const statusTh = isOverbought ? 'ซื้อมากเกินไป (Overbought)' : isOversold ? 'ขายมากเกินไป (Oversold)' : 'โซนปกติ (Neutral)';
      const statusEn = isOverbought ? 'Overbought' : isOversold ? 'Oversold' : 'Neutral';
      return { value: roundTo(val, 1) || val, statusTh, statusEn };
    }
  }

  return null;
}

/**
 * Evaluates peer benchmark status for comparative evaluation column.
 */
export function evaluatePeerStatus(peer: PeerCompanyItem, isTarget: boolean): { labelTh: string; labelEn: string } {
  const fwdPe = peer.pe_forward || peer.pe_trailing;
  const growth = peer.revenue_growth_yoy_pct || 0;
  const netMargin = peer.net_margin_pct || 0;

  if (isTarget) {
    if (growth >= 30 && netMargin >= 40) {
      return { labelTh: 'พรีเมียมตามคุณภาพ & การเติบโตสูง', labelEn: 'Premium Quality & Hyper Growth' };
    }
    if (growth >= 20) {
      return { labelTh: 'พรีเมียมตามการเติบโต', labelEn: 'Growth Premium' };
    }
    if (fwdPe && fwdPe < 25 && growth >= 15) {
      return { labelTh: 'มูลค่าสมเหตุสมผลตามการเติบโต', labelEn: 'Reasonable Growth Value' };
    }
    return { labelTh: 'หุ้นหลักที่วิเคราะห์', labelEn: 'Target Stock' };
  }

  if (fwdPe && fwdPe < 25 && growth >= 15) {
    return { labelTh: 'ถูกกว่ากลุ่มเมื่อเทียบการเติบโต', labelEn: 'Undervalued relative to growth' };
  }
  if (growth > 30) {
    return { labelTh: 'เติบโตสูงเป็นผู้นำกลุ่ม', labelEn: 'Top-tier growth leader' };
  }
  if (netMargin > 45) {
    return { labelTh: 'อัตรากำไรสุทธิสูงพิเศษ', labelEn: 'High margin efficiency' };
  }
  if (growth < 10) {
    return { labelTh: 'เติบโตต่ำกว่าค่าเฉลี่ยกลุ่ม', labelEn: 'Below-average growth' };
  }
  if (fwdPe && fwdPe > 50) {
    return { labelTh: 'ระดับราคาเทรดด้วยพรีเมียมสูง', labelEn: 'High valuation premium' };
  }

  return { labelTh: 'สถานะระดับกลางของกลุ่ม', labelEn: 'Peer median range' };
}

/**
 * Harmonizes and validates all report sections against the single source of truth.
 */
export function harmonizeReportData(data: ReportData, ticker?: string): ReportData {
  if (!data) return data;

  const targetTicker = (ticker || data.ticker || 'STOCK').toUpperCase();
  const metrics = extractGroundTruthMetrics(data);
  const result: ReportData = JSON.parse(JSON.stringify(data));

  // 1. Harmonize Five Pillars
  if (result.five_pillars) {
    if (result.five_pillars.profitability) {
      if (metrics.netMarginPct !== null && metrics.netMarginPct !== undefined) {
        result.five_pillars.profitability.net_margin_pct = metrics.netMarginPct;
      }
      if (metrics.grossMarginPct !== null && metrics.grossMarginPct !== undefined) {
        result.five_pillars.profitability.gross_margin_pct = metrics.grossMarginPct;
      }
      if (metrics.operatingMarginPct !== null && metrics.operatingMarginPct !== undefined) {
        result.five_pillars.profitability.operating_margin_pct = metrics.operatingMarginPct;
      }
      if (metrics.roePct !== null && metrics.roePct !== undefined) {
        result.five_pillars.profitability.roe_pct = metrics.roePct;
      }
      if (metrics.fcfMarginPct !== null && metrics.fcfMarginPct !== undefined) {
        result.five_pillars.profitability.fcf_margin_pct = metrics.fcfMarginPct;
      }
    }

    if (result.five_pillars.balance_sheet) {
      if (metrics.debtToEquity !== null && metrics.debtToEquity !== undefined) {
        result.five_pillars.balance_sheet.debt_to_equity = metrics.debtToEquity;
      }
      if (metrics.totalDebt !== null && metrics.totalDebt !== undefined) {
        result.five_pillars.balance_sheet.total_debt_b = roundTo(metrics.totalDebt / 1000, 2) || 0;
      }
      if (metrics.cashAndInvestments !== null && metrics.cashAndInvestments !== undefined) {
        result.five_pillars.balance_sheet.total_cash_and_investments_b = roundTo(metrics.cashAndInvestments / 1000, 2) || 0;
        const netCash = (result.five_pillars.balance_sheet.total_cash_and_investments_b || 0) - (result.five_pillars.balance_sheet.total_debt_b || 0);
        result.five_pillars.balance_sheet.net_cash_or_debt_b = roundTo(Math.abs(netCash), 2) || 0;
        result.five_pillars.balance_sheet.is_net_cash = netCash >= 0;
      }
    }
  }

  // 2. Harmonize Peer Comparison
  if (result.peer_comparison?.peers && Array.isArray(result.peer_comparison.peers)) {
    result.peer_comparison.peers = result.peer_comparison.peers.map(p => {
      const isTarget = p.ticker.toUpperCase() === targetTicker;
      const copy = { ...p };

      if (isTarget) {
        if (metrics.netMarginPct !== null && metrics.netMarginPct !== undefined) {
          copy.net_margin_pct = metrics.netMarginPct;
        }
        if (metrics.grossMarginPct !== null && metrics.grossMarginPct !== undefined) {
          copy.gross_margin_pct = metrics.grossMarginPct;
        }
      }

      const status = evaluatePeerStatus(copy, isTarget);
      return {
        ...copy,
        status_label_th: copy.status_label_th || status.labelTh,
        status_label_en: copy.status_label_en || status.labelEn
      };
    });
  }

  // 3. Harmonize Intrinsic Value Margin of Safety
  if (result.intrinsic_value?.dcf_model?.scenarios?.base?.fair_value_per_share && result.intrinsic_value.current_price) {
    const cp = result.intrinsic_value.current_price;
    const baseVal = result.intrinsic_value.dcf_model.scenarios.base.fair_value_per_share;
    const exactMoS = roundTo(((baseVal - cp) / cp) * 100, 1);
    if (result.intrinsic_value.summary) {
      result.intrinsic_value.summary.margin_of_safety_pct = exactMoS ?? 0;
    }
  }

  // 4. Harmonize Financial Statements Internal Ratios
  if (result.financial_statements) {
    const fs = result.financial_statements;
    const inc = fs.income_statement;
    const bs = fs.balance_sheet;
    const cf = fs.cash_flow;

    if (inc && Array.isArray(inc.revenue)) {
      if (!inc.gross_profit && Array.isArray(inc.cogs)) {
        inc.gross_profit = inc.revenue.map((r, i) => r !== null && inc.cogs?.[i] !== null && inc.cogs?.[i] !== undefined ? r - inc.cogs[i]! : null);
      }
      if (!inc.gross_margin_pct && Array.isArray(inc.gross_profit)) {
        inc.gross_margin_pct = inc.revenue.map((r, i) => r && inc.gross_profit?.[i] !== null && inc.gross_profit?.[i] !== undefined ? roundTo((inc.gross_profit[i]! / r) * 100, 1) : null);
      }
      if (!inc.operating_margin_pct && Array.isArray(inc.operating_income)) {
        inc.operating_margin_pct = inc.revenue.map((r, i) => r && inc.operating_income?.[i] !== null && inc.operating_income?.[i] !== undefined ? roundTo((inc.operating_income[i]! / r) * 100, 1) : null);
      }
      if (!inc.net_margin_pct && Array.isArray(inc.net_income)) {
        inc.net_margin_pct = inc.revenue.map((r, i) => r && inc.net_income?.[i] !== null && inc.net_income?.[i] !== undefined ? roundTo((inc.net_income[i]! / r) * 100, 1) : null);
      }
    }

    if (cf && Array.isArray(cf.operating_cash_flow)) {
      if (!cf.free_cash_flow && Array.isArray(cf.capex)) {
        cf.free_cash_flow = cf.operating_cash_flow.map((ocf, i) => {
          const cap = cf.capex?.[i];
          if (ocf !== null && cap !== null && cap !== undefined) return ocf - Math.abs(cap);
          return ocf;
        });
      }
      if (!cf.fcf_margin_pct && inc?.revenue && Array.isArray(cf.free_cash_flow)) {
        cf.fcf_margin_pct = inc.revenue.map((r, i) => r && cf.free_cash_flow?.[i] !== null && cf.free_cash_flow?.[i] !== undefined ? roundTo((cf.free_cash_flow[i]! / r) * 100, 1) : null);
      }
    }

    if (bs && Array.isArray(bs.total_assets)) {
      if (!bs.current_ratio && Array.isArray(bs.total_current_assets) && Array.isArray(bs.total_current_liabilities)) {
        bs.current_ratio = bs.total_current_assets.map((ca, i) => {
          const cl = bs.total_current_liabilities?.[i];
          if (ca && cl) return roundTo(ca / cl, 2);
          return null;
        });
      }
      if (!bs.debt_to_equity && Array.isArray(bs.total_debt) && Array.isArray(bs.total_equity)) {
        bs.debt_to_equity = bs.total_debt.map((d, i) => {
          const eq = bs.total_equity?.[i];
          if (d !== null && d !== undefined && eq && eq > 0) return roundTo(d / eq, 2);
          return null;
        });
      }
    }
  }

  return result;
}
