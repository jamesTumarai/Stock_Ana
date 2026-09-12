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

export const SUGGESTED_WATCHLIST_TICKERS = ['MSFT', 'AAPL', 'NVDA', 'SOFI'];

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
      computed_holdings: [],
      priced_holdings_count: 0,
      unpriced_holdings_count: 0,
      pricing_coverage_pct: 100,
      priced_market_value: 0,
      unpriced_cost_basis: 0,
      is_fully_priced: true
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

  // 2. Aggregate totals & track pricing coverage (P1-4: No fake cost-basis substitution)
  let pricedMarketValue = 0;
  let unpricedCostBasis = 0;
  let totalCostBasis = 0;
  let pricedHoldingsCount = 0;
  let unpricedHoldingsCount = 0;

  for (const item of computedList) {
    totalCostBasis += item.total_cost;
    if (typeof item.market_value === 'number' && Number.isFinite(item.market_value)) {
      pricedMarketValue += item.market_value;
      pricedHoldingsCount++;
    } else {
      unpricedCostBasis += item.total_cost;
      unpricedHoldingsCount++;
    }
  }

  pricedMarketValue = Number(pricedMarketValue.toFixed(2));
  unpricedCostBasis = Number(unpricedCostBasis.toFixed(2));
  totalCostBasis = Number(totalCostBasis.toFixed(2));

  const totalHoldingsCount = holdings.length;
  const isFullyPriced = unpricedHoldingsCount === 0;
  const pricingCoveragePct = totalHoldingsCount > 0
    ? Number(((pricedHoldingsCount / totalHoldingsCount) * 100).toFixed(1))
    : 100;

  // If any holding is unpriced, total market value and total unrealized P/L are strictly UNAVAILABLE (null).
  const totalMarketValue = isFullyPriced ? pricedMarketValue : null;
  const totalUnrealizedPnl = isFullyPriced
    ? Number((pricedMarketValue - totalCostBasis).toFixed(2))
    : null;
  const totalUnrealizedPnlPct = (isFullyPriced && totalCostBasis > 0)
    ? Number((((pricedMarketValue - totalCostBasis) / totalCostBasis) * 100).toFixed(2))
    : null;

  // 3. Compute allocations and concentration across priced holdings
  let topConcentration = 0;
  const sectorMap: Record<string, number> = {};
  let weightedMosNumerator = 0;
  let weightedMosDenominator = 0;

  // Baseline for allocation is priced market value if available; otherwise cost basis
  const allocationBase = pricedMarketValue > 0 ? pricedMarketValue : totalCostBasis;

  for (const item of computedList) {
    const itemVal = typeof item.market_value === 'number' ? item.market_value : 0;
    const alloc = allocationBase > 0 ? Number(((itemVal / allocationBase) * 100).toFixed(1)) : 0;
    item.allocation_pct = alloc;

    if (alloc > topConcentration) {
      topConcentration = alloc;
    }

    if (itemVal > 0) {
      const sectorName = item.sector?.trim() || 'Other';
      sectorMap[sectorName] = (sectorMap[sectorName] || 0) + itemVal;

      if (typeof item.margin_of_safety_pct === 'number' && itemVal > 0) {
        weightedMosNumerator += (item.margin_of_safety_pct * itemVal);
        weightedMosDenominator += itemVal;
      }
    }
  }

  // 4. Sector breakdown sorted by weight descending
  const sectorBreakdown: PortfolioSectorExposure[] = Object.entries(sectorMap)
    .map(([sec, val]) => ({
      sector: sec,
      market_value: Number(val.toFixed(2)),
      allocation_pct: pricedMarketValue > 0 ? Number(((val / pricedMarketValue) * 100).toFixed(1)) : 0
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
    computed_holdings: computedList,
    priced_holdings_count: pricedHoldingsCount,
    unpriced_holdings_count: unpricedHoldingsCount,
    pricing_coverage_pct: pricingCoveragePct,
    priced_market_value: pricedMarketValue,
    unpriced_cost_basis: unpricedCostBasis,
    is_fully_priced: isFullyPriced
  };
}

function getSafeLocalStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) return (globalThis as any).localStorage;
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    return null;
  }
  return null;
}

export function loadLocalWatchlist(userId?: string): string[] {
  try {
    const storage = getSafeLocalStorage();
    if (!storage) return [];
    const key = userId ? `${WATCHLIST_STORAGE_KEY}_${userId}` : WATCHLIST_STORAGE_KEY;
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((s: string) => String(s).toUpperCase().trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function saveLocalWatchlist(watchlist: string[], userId?: string): void {
  try {
    const storage = getSafeLocalStorage();
    if (!storage) return;
    const key = userId ? `${WATCHLIST_STORAGE_KEY}_${userId}` : WATCHLIST_STORAGE_KEY;
    const clean = Array.from(new Set(watchlist.map(s => String(s).toUpperCase().trim()).filter(Boolean)));
    storage.setItem(key, JSON.stringify(clean));
  } catch (e) {
    console.warn('Failed to save watchlist to localStorage:', e);
  }
}

export function loadLocalPortfolio(userId?: string): PortfolioHolding[] {
  try {
    const storage = getSafeLocalStorage();
    if (!storage) return [];
    const key = userId ? `${PORTFOLIO_STORAGE_KEY}_${userId}` : PORTFOLIO_STORAGE_KEY;
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalPortfolio(holdings: PortfolioHolding[], userId?: string): void {
  try {
    const storage = getSafeLocalStorage();
    if (!storage) return;
    const key = userId ? `${PORTFOLIO_STORAGE_KEY}_${userId}` : PORTFOLIO_STORAGE_KEY;
    storage.setItem(key, JSON.stringify(holdings));
  } catch (e) {
    console.warn('Failed to save portfolio to localStorage:', e);
  }
}
