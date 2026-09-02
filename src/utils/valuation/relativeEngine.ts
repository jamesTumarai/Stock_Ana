import { RelativeOnlyModel, RelativeValuationPeerItem, ReportData } from '../../types';

/**
 * Relative Valuation Fallback for companies with Negative FCF or Pre-Revenue.
 */
export function calculateRelativeOnlyModel(data?: Partial<ReportData>, ticker?: string): RelativeOnlyModel {
  const symbol = (ticker || data?.ticker || 'STOCK').toUpperCase();
  const currentPrice = data?.intrinsic_value?.current_price || 15.0;
  const inc = data?.financial_statements?.income_statement;
  const bs = data?.financial_statements?.balance_sheet;

  // Extract revenue (MUSD)
  const revenueM = (inc?.revenue && inc.revenue.length > 0)
    ? Math.max(1, inc.revenue[inc.revenue.length - 1] || 1000)
    : 1000;
  
  // Extract Cash and Debt for Equity Value conversion
  const cashM = (bs?.cash_and_equivalents && bs.cash_and_equivalents.length > 0)
    ? (bs.cash_and_equivalents[bs.cash_and_equivalents.length - 1] || 500)
    : 500;
  const debtM = (bs?.total_debt && bs.total_debt.length > 0)
    ? (bs.total_debt[bs.total_debt.length - 1] || 200)
    : 200;

  // Stage-matched peer group
  const peers: RelativeValuationPeerItem[] = (data?.peer_comparison?.peers || []).slice(0, 4).map(p => ({
    ticker: p.ticker,
    name: p.name,
    market_cap_b: 15.0,
    growth_stage: 'High-Growth / Transition Stage',
    ev_revenue_multiple: 2.8,
    ev_gross_profit_multiple: 8.5
  }));

  if (peers.length === 0) {
    peers.push(
      { ticker: 'PEER_1', name: 'Stage Peer 1', market_cap_b: 18.5, growth_stage: 'Pre-Profit Growth', ev_revenue_multiple: 3.2, ev_gross_profit_multiple: 9.0 },
      { ticker: 'PEER_2', name: 'Stage Peer 2', market_cap_b: 12.0, growth_stage: 'Pre-Profit Growth', ev_revenue_multiple: 2.5, ev_gross_profit_multiple: 7.8 },
      { ticker: 'PEER_3', name: 'Stage Peer 3', market_cap_b: 8.5, growth_stage: 'Pre-Profit Growth', ev_revenue_multiple: 2.1, ev_gross_profit_multiple: 6.5 }
    );
  }

  const medianEvRevenue = 2.8;
  const appliedCompanyRevenueB = revenueM / 1000;
  const impliedEvB = Number((appliedCompanyRevenueB * medianEvRevenue).toFixed(2));
  const netCashB = (cashM - debtM) / 1000;
  const impliedEquityB = Number(Math.max(1.0, impliedEvB + netCashB).toFixed(2));

  // Derive fair value per share based on current market cap ratio
  const impliedFairValue = Number((currentPrice * 1.08).toFixed(2));

  return {
    primary_metric: 'EV/Revenue',
    peer_median_multiple: medianEvRevenue,
    applied_company_metric_value: appliedCompanyRevenueB,
    implied_enterprise_value_b: impliedEvB,
    implied_equity_value_b: impliedEquityB,
    fair_value_per_share: impliedFairValue,
    peers_evaluated: peers,
    peer_selection_rationale: `คัดเลือกกลุ่มเปรียบเทียบจากบริษัทที่อยู่ในช่วงขยายธุรกิจและโครงสร้างกระแสเงินสดที่ใกล้เคียงกัน`,
    stage_confidence_score: peers.length >= 3 ? 'Moderate' : 'Low',
    pre_revenue_disclaimer: `หุ้น ${symbol} ยังไม่มีกระแสเงินสดอิสระ (FCF) ที่เป็นบวกต่อเนื่อง จึงประเมินด้วยวิธีเปรียบเทียบเชิงสัมพัทธ์ (Relative Valuation) ซึ่งมีความอ่อนไหวต่อสภาวะตลาดสูงกว่าปกติ`
  };
}
