import {
  PortfolioHolding,
  PortfolioComputedHolding,
  PortfolioSummary,
  PortfolioSectorExposure,
  MultiPortfolioConfig,
  OverallTickerLimit,
  UserPortfolio
} from '../types';

export const WATCHLIST_STORAGE_KEY = 'lumina_watchlist';
export const PORTFOLIO_STORAGE_KEY = 'lumina_portfolio_holdings';
export const USER_PORTFOLIOS_STORAGE_KEY = 'lumina_user_portfolios';
export const MULTI_PORTFOLIO_SCHEMA_VERSION = 2 as const;
export const PORTFOLIO_UPDATED_EVENT = 'lumina:portfolio-updated';

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

  // Exact allocation requires complete pricing. Missing price must never be replaced by cost basis.
  const allocationBase = isFullyPriced ? pricedMarketValue : 0;

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
      allocation_pct: isFullyPriced && pricedMarketValue > 0 ? Number(((val / pricedMarketValue) * 100).toFixed(1)) : 0
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
    concentration_risk_alert: isFullyPriced && topConcentration >= 30, // Suppressed when denominator pricing is incomplete
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
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(PORTFOLIO_UPDATED_EVENT));
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
    return Array.isArray(parsed)
      ? parsed.map((holding: PortfolioHolding, index: number) => ({
          ...holding,
          id: holding.id || `legacy-${index}-${String(holding.ticker || 'holding').toUpperCase().trim()}`,
          portfolio_id: holding.portfolio_id ?? null
        }))
      : [];
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
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(PORTFOLIO_UPDATED_EVENT));
  } catch (e) {
    console.warn('Failed to save portfolio to localStorage:', e);
  }
}

function sanitizeOptionalPct(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
}

function sanitizePortfolio(value: unknown): UserPortfolio | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<UserPortfolio>;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!id || !name) return null;
  const createdAt = typeof raw.created_at === 'string' && raw.created_at ? raw.created_at : new Date(0).toISOString();
  const updatedAt = typeof raw.updated_at === 'string' && raw.updated_at ? raw.updated_at : createdAt;
  return {
    id,
    name,
    target_pct_of_total: sanitizeOptionalPct(raw.target_pct_of_total),
    max_pct_of_total: sanitizeOptionalPct(raw.max_pct_of_total),
    notes: typeof raw.notes === 'string' && raw.notes.trim() ? raw.notes.trim() : undefined,
    created_at: createdAt,
    updated_at: updatedAt
  };
}

function sanitizeTickerLimit(value: unknown): OverallTickerLimit | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<OverallTickerLimit>;
  const ticker = typeof raw.ticker === 'string' ? raw.ticker.toUpperCase().trim() : '';
  const max = sanitizeOptionalPct(raw.max_pct_of_total);
  if (!ticker || max === null) return null;
  return {
    ticker,
    max_pct_of_total: max,
    updated_at: typeof raw.updated_at === 'string' && raw.updated_at ? raw.updated_at : new Date(0).toISOString()
  };
}

export function getUserPortfoliosStorageKey(userId?: string): string {
  return userId ? `${USER_PORTFOLIOS_STORAGE_KEY}_${userId}` : USER_PORTFOLIOS_STORAGE_KEY;
}

export function loadLocalMultiPortfolioConfig(userId?: string): MultiPortfolioConfig {
  const empty: MultiPortfolioConfig = {
    version: MULTI_PORTFOLIO_SCHEMA_VERSION,
    portfolios: [],
    ticker_limits: []
  };
  try {
    const storage = getSafeLocalStorage();
    if (!storage) return empty;
    const raw = storage.getItem(getUserPortfoliosStorageKey(userId));
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return empty;
    const portfolios = Array.isArray(parsed.portfolios)
      ? parsed.portfolios.map(sanitizePortfolio).filter((item: UserPortfolio | null): item is UserPortfolio => item !== null)
      : [];
    const tickerLimits = Array.isArray(parsed.ticker_limits)
      ? parsed.ticker_limits.map(sanitizeTickerLimit).filter((item: OverallTickerLimit | null): item is OverallTickerLimit => item !== null)
      : [];
    return {
      version: MULTI_PORTFOLIO_SCHEMA_VERSION,
      portfolios,
      ticker_limits: tickerLimits
    };
  } catch {
    return empty;
  }
}

export function saveLocalMultiPortfolioConfig(config: MultiPortfolioConfig, userId?: string): void {
  try {
    const storage = getSafeLocalStorage();
    if (!storage) return;
    const normalized: MultiPortfolioConfig = {
      version: MULTI_PORTFOLIO_SCHEMA_VERSION,
      portfolios: config.portfolios.map(sanitizePortfolio).filter((item: UserPortfolio | null): item is UserPortfolio => item !== null),
      ticker_limits: config.ticker_limits.map(sanitizeTickerLimit).filter((item: OverallTickerLimit | null): item is OverallTickerLimit => item !== null)
    };
    storage.setItem(getUserPortfoliosStorageKey(userId), JSON.stringify(normalized));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(PORTFOLIO_UPDATED_EVENT));
  } catch (error) {
    console.warn('Failed to save multi-portfolio configuration to localStorage:', error);
  }
}
