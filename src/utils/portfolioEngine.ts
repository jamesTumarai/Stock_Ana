import {
  PortfolioHolding,
  PortfolioComputedHolding,
  PortfolioSummary,
  PortfolioSectorExposure
} from '../types';

export const WATCHLIST_STORAGE_KEY = 'lumina_watchlist';
export const PORTFOLIO_STORAGE_KEY = 'lumina_portfolio_holdings';

export function calculateHoldingMetrics(
  holding: PortfolioHolding,
  currentPrice?: number | null,
  fairValue?: number | null
): PortfolioComputedHolding {
  const quantity = Math.max(0, holding.quantity || 0);
  const avgCost = Math.max(0, holding.average_cost || 0);
  const totalCost = Number((quantity * avgCost).toFixed(2));

  const hasPrice = typeof currentPrice === 'number' && Number.isFinite(currentPrice) && currentPrice > 0;
  const marketValue = hasPrice ? Number((quantity * currentPrice).toFixed(2)) : null;

  const unrealizedPnl = (hasPrice && marketValue !== null)
    ? Number((marketValue - totalCost).toFixed(2))
    : null;

  const unrealizedPnlPct = (hasPrice && avgCost > 0)
    ? Number((((currentPrice - avgCost) / avgCost) * 100).toFixed(2))
    : null;

  const hasFairValue = typeof fairValue === 'number' && Number.isFinite(fairValue) && fairValue > 0;
  const mosPct = (hasFairValue && hasPrice)
    ? Number((((fairValue - currentPrice) / currentPrice) * 100).toFixed(1))
    : null;

  return {
    ...holding,
    current_price: hasPrice ? currentPrice : null,
    market_value: marketValue,
    total_cost: totalCost,
    unrealized_pnl: unrealizedPnl,
    unrealized_pnl_pct: unrealizedPnlPct,
    allocation_pct: 0, // Assigned in calculatePortfolioSummary
    fair_value: hasFairValue ? fairValue : null,
    margin_of_safety_pct: mosPct
  };
}

export function calculatePortfolioSummary(
  holdings: PortfolioHolding[],
  quotes: Record<string, number | { price?: number } | undefined> = {},
  latestReports: Record<string, any> = {}
): PortfolioSummary {
  if (!holdings || holdings.length === 0) {
    return {
      total_market_value: 0,
      total_cost_basis: 0,
      total_unrealized_pnl: 0,
      total_unrealized_pnl_pct: 0,
      holdings_count: 0,
      top_holding_concentration_pct: 0,
      concentration_risk_alert: false,
      sector_breakdown: [],
      weighted_margin_of_safety_pct: null,
      computed_holdings: []
    };
  }

  // 1. Compute individual metrics
  const computedList: PortfolioComputedHolding[] = holdings.map(h => {
    const rawQuote = quotes[h.ticker.toUpperCase()];
    const price = typeof rawQuote === 'number'
      ? rawQuote
      : (typeof rawQuote === 'object' && rawQuote !== null && typeof rawQuote.price === 'number')
        ? rawQuote.price
        : null;

    const report = latestReports[h.ticker.toUpperCase()];
    const fv = report?.intrinsic_value?.summary?.base_case_fair_value
      || report?.intrinsic_value?.dcf_model?.scenarios?.base?.fair_value_per_share
      || null;

    return calculateHoldingMetrics(h, price, fv);
  });

  // 2. Aggregate totals
  let totalMarketValue = 0;
  let totalCostBasis = 0;

  for (const item of computedList) {
    totalCostBasis += item.total_cost;
    if (typeof item.market_value === 'number') {
      totalMarketValue += item.market_value;
    } else {
      // If live quote is missing, fallback to cost basis for allocation weighting
      totalMarketValue += item.total_cost;
    }
  }

  totalMarketValue = Number(totalMarketValue.toFixed(2));
  totalCostBasis = Number(totalCostBasis.toFixed(2));

  const totalUnrealizedPnl = Number((totalMarketValue - totalCostBasis).toFixed(2));
  const totalUnrealizedPnlPct = totalCostBasis > 0
    ? Number((((totalMarketValue - totalCostBasis) / totalCostBasis) * 100).toFixed(2))
    : 0;

  // 3. Compute allocations and concentration
  let topConcentration = 0;
  const sectorMap: Record<string, number> = {};
  let weightedMosNumerator = 0;
  let weightedMosDenominator = 0;

  for (const item of computedList) {
    const itemVal = typeof item.market_value === 'number' ? item.market_value : item.total_cost;
    const alloc = totalMarketValue > 0 ? Number(((itemVal / totalMarketValue) * 100).toFixed(1)) : 0;
    item.allocation_pct = alloc;

    if (alloc > topConcentration) {
      topConcentration = alloc;
    }

    const sectorName = item.sector?.trim() || 'Other';
    sectorMap[sectorName] = (sectorMap[sectorName] || 0) + itemVal;

    if (typeof item.margin_of_safety_pct === 'number' && itemVal > 0) {
      weightedMosNumerator += (item.margin_of_safety_pct * itemVal);
      weightedMosDenominator += itemVal;
    }
  }

  // 4. Sector breakdown sorted by weight descending
  const sectorBreakdown: PortfolioSectorExposure[] = Object.entries(sectorMap)
    .map(([sec, val]) => ({
      sector: sec,
      market_value: Number(val.toFixed(2)),
      allocation_pct: totalMarketValue > 0 ? Number(((val / totalMarketValue) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.market_value - a.market_value);

  // 5. Weighted portfolio margin of safety
  const weightedMos = weightedMosDenominator > 0
    ? Number((weightedMosNumerator / weightedMosDenominator).toFixed(1))
    : null;

  return {
    total_market_value: totalMarketValue,
    total_cost_basis: totalCostBasis,
    total_unrealized_pnl: totalUnrealizedPnl,
    total_unrealized_pnl_pct: totalUnrealizedPnlPct,
    holdings_count: holdings.length,
    top_holding_concentration_pct: topConcentration,
    concentration_risk_alert: topConcentration >= 30, // Institutional concentration threshold
    sector_breakdown: sectorBreakdown,
    weighted_margin_of_safety_pct: weightedMos,
    computed_holdings: computedList
  };
}

export function loadLocalWatchlist(userId?: string): string[] {
  try {
    const key = userId ? `${WATCHLIST_STORAGE_KEY}_${userId}` : WATCHLIST_STORAGE_KEY;
    const raw = localStorage.getItem(key);
    if (!raw) return ['MSFT', 'AAPL', 'NVDA', 'SOFI'];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((s: string) => String(s).toUpperCase().trim()) : [];
  } catch {
    return ['MSFT', 'AAPL', 'NVDA', 'SOFI'];
  }
}

export function saveLocalWatchlist(watchlist: string[], userId?: string): void {
  try {
    const key = userId ? `${WATCHLIST_STORAGE_KEY}_${userId}` : WATCHLIST_STORAGE_KEY;
    const clean = Array.from(new Set(watchlist.map(s => String(s).toUpperCase().trim()).filter(Boolean)));
    localStorage.setItem(key, JSON.stringify(clean));
  } catch (e) {
    console.warn('Failed to save watchlist to localStorage:', e);
  }
}

export function loadLocalPortfolio(userId?: string): PortfolioHolding[] {
  try {
    const key = userId ? `${PORTFOLIO_STORAGE_KEY}_${userId}` : PORTFOLIO_STORAGE_KEY;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalPortfolio(holdings: PortfolioHolding[], userId?: string): void {
  try {
    const key = userId ? `${PORTFOLIO_STORAGE_KEY}_${userId}` : PORTFOLIO_STORAGE_KEY;
    localStorage.setItem(key, JSON.stringify(holdings));
  } catch (e) {
    console.warn('Failed to save portfolio to localStorage:', e);
  }
}
