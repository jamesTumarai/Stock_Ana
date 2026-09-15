import {
  AggregateTickerExposure,
  ComputedPortfolioPosition,
  ComputedUserPortfolio,
  MultiPortfolioAllocationSummary,
  OverallTickerLimit,
  PortfolioComputedHolding,
  PortfolioHolding,
  UserPortfolio
} from '../types';

const round = (value: number, digits = 1): number => Number(value.toFixed(digits));

export function normalizeOptionalPct(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function derivePositionTargetOverallPct(
  portfolioTargetPctOfTotal: number | null | undefined,
  positionTargetPctWithinPortfolio: number | null | undefined
): number | null {
  const portfolioTarget = normalizeOptionalPct(portfolioTargetPctOfTotal);
  const positionTarget = normalizeOptionalPct(positionTargetPctWithinPortfolio);
  if (portfolioTarget === null || positionTarget === null) return null;
  return round((portfolioTarget * positionTarget) / 100, 4);
}

export function validatePortfolioConfiguration(
  portfolios: UserPortfolio[],
  candidate?: UserPortfolio
): string | null {
  const next = candidate
    ? [...portfolios.filter(portfolio => portfolio.id !== candidate.id), candidate]
    : portfolios;

  for (const portfolio of next) {
    if (!portfolio.name.trim()) return 'PORTFOLIO_NAME_REQUIRED';
    const target = normalizeOptionalPct(portfolio.target_pct_of_total);
    const max = normalizeOptionalPct(portfolio.max_pct_of_total);
    if (target !== null && (target < 0 || target > 100)) return 'PORTFOLIO_TARGET_OUT_OF_RANGE';
    if (max !== null && (max < 0 || max > 100)) return 'PORTFOLIO_MAX_OUT_OF_RANGE';
    if (target !== null && max !== null && target > max) return 'PORTFOLIO_TARGET_ABOVE_MAX';
  }

  const totalTarget = next.reduce((sum, portfolio) => (
    sum + (normalizeOptionalPct(portfolio.target_pct_of_total) ?? 0)
  ), 0);
  return totalTarget > 100.000001 ? 'PORTFOLIO_TARGET_TOTAL_ABOVE_100' : null;
}

export function validatePositionConfiguration(
  holdings: PortfolioHolding[],
  candidate: PortfolioHolding
): string | null {
  const target = normalizeOptionalPct(candidate.target_weight_pct);
  const max = normalizeOptionalPct(candidate.max_weight_pct);
  if (target !== null && (target < 0 || target > 100)) return 'POSITION_TARGET_OUT_OF_RANGE';
  if (max !== null && (max < 0 || max > 100)) return 'POSITION_MAX_OUT_OF_RANGE';
  if (target !== null && max !== null && target > max) return 'POSITION_TARGET_ABOVE_MAX';

  const portfolioId = candidate.portfolio_id ?? null;
  if (portfolioId === null && (target !== null || max !== null)) return 'UNASSIGNED_POSITION_LIMIT_NOT_ALLOWED';

  const siblings = holdings.filter(holding =>
    holding.id !== candidate.id && (holding.portfolio_id ?? null) === portfolioId
  );
  const totalTarget = siblings.reduce((sum, holding) => (
    sum + (normalizeOptionalPct(holding.target_weight_pct) ?? 0)
  ), target ?? 0);
  return totalTarget > 100.000001 ? 'POSITION_TARGET_TOTAL_ABOVE_100' : null;
}

export function findDuplicatePosition(
  holdings: PortfolioHolding[],
  candidate: Pick<PortfolioHolding, 'id' | 'ticker' | 'portfolio_id'>
): PortfolioHolding | null {
  const ticker = candidate.ticker.toUpperCase().trim();
  const portfolioId = candidate.portfolio_id ?? null;
  return holdings.find(holding =>
    holding.id !== candidate.id
    && holding.ticker.toUpperCase().trim() === ticker
    && (holding.portfolio_id ?? null) === portfolioId
  ) || null;
}

export function upsertUserPortfolio(
  portfolios: UserPortfolio[],
  candidate: UserPortfolio
): { portfolios: UserPortfolio[]; error: string | null } {
  const error = validatePortfolioConfiguration(portfolios, candidate);
  if (error) return { portfolios, error };
  const exists = portfolios.some(portfolio => portfolio.id === candidate.id);
  return {
    portfolios: exists
      ? portfolios.map(portfolio => portfolio.id === candidate.id ? candidate : portfolio)
      : [...portfolios, candidate],
    error: null
  };
}

export function deleteUserPortfolioSafely(
  portfolios: UserPortfolio[],
  holdings: PortfolioHolding[],
  portfolioId: string
): { portfolios: UserPortfolio[]; error: 'PORTFOLIO_NOT_FOUND' | 'PORTFOLIO_NOT_EMPTY' | null } {
  if (!portfolios.some(portfolio => portfolio.id === portfolioId)) {
    return { portfolios, error: 'PORTFOLIO_NOT_FOUND' };
  }
  if (holdings.some(holding => (holding.portfolio_id ?? null) === portfolioId)) {
    return { portfolios, error: 'PORTFOLIO_NOT_EMPTY' };
  }
  return { portfolios: portfolios.filter(portfolio => portfolio.id !== portfolioId), error: null };
}

export function computeMultiPortfolioAllocation(
  portfolios: UserPortfolio[],
  computedHoldings: PortfolioComputedHolding[],
  tickerLimits: OverallTickerLimit[] = [],
  unassignedName = 'Unassigned'
): MultiPortfolioAllocationSummary {
  const portfolioMap = new Map(portfolios.map(portfolio => [portfolio.id, portfolio]));
  const normalizedPositions = computedHoldings.map(holding => {
    const requestedId = holding.portfolio_id ?? null;
    const portfolioId = requestedId && portfolioMap.has(requestedId) ? requestedId : null;
    return { holding, portfolioId };
  });

  const isFullyPriced = normalizedPositions.every(({ holding }) => typeof holding.market_value === 'number');
  const unpricedHoldingsCount = normalizedPositions.filter(({ holding }) => typeof holding.market_value !== 'number').length;
  const knownPricedValue = round(normalizedPositions.reduce((sum, { holding }) => (
    sum + (typeof holding.market_value === 'number' ? holding.market_value : 0)
  ), 0), 2);
  const totalInvestedMarketValue = isFullyPriced ? knownPricedValue : null;
  const configuredTargetPct = round(portfolios.reduce((sum, portfolio) => (
    sum + (normalizeOptionalPct(portfolio.target_pct_of_total) ?? 0)
  ), 0), 4);

  const groups: Array<{ portfolio: UserPortfolio | null; id: string | null; name: string }> = portfolios.map(portfolio => ({
    portfolio,
    id: portfolio.id,
    name: portfolio.name
  }));
  if (normalizedPositions.some(position => position.portfolioId === null)) {
    groups.push({ portfolio: null, id: null, name: unassignedName });
  }

  const computedPortfolios: ComputedUserPortfolio[] = groups.map(group => {
    const groupHoldings = normalizedPositions.filter(position => position.portfolioId === group.id);
    const unpricedCount = groupHoldings.filter(({ holding }) => typeof holding.market_value !== 'number').length;
    const pricedCount = groupHoldings.length - unpricedCount;
    const knownValue = round(groupHoldings.reduce((sum, { holding }) => (
      sum + (typeof holding.market_value === 'number' ? holding.market_value : 0)
    ), 0), 2);
    const groupFullyPriced = unpricedCount === 0;
    const marketValue = groupFullyPriced ? knownValue : null;
    const actualPct = isFullyPriced && knownPricedValue > 0 ? round((knownValue / knownPricedValue) * 100) : (isFullyPriced ? 0 : null);
    const target = group.portfolio ? normalizeOptionalPct(group.portfolio.target_pct_of_total) : null;
    const max = group.portfolio ? normalizeOptionalPct(group.portfolio.max_pct_of_total) : null;
    const drift = actualPct !== null && target !== null ? round(actualPct - target) : null;
    const excess = actualPct !== null && max !== null && actualPct > max ? round(actualPct - max) : null;
    const status = !isFullyPriced
      ? 'INCOMPLETE_PRICING' as const
      : excess !== null
        ? 'ABOVE_MAX' as const
        : max === null
          ? 'NO_LIMIT_SET' as const
          : 'WITHIN_LIMIT' as const;

    return {
      portfolio: group.portfolio,
      portfolio_id: group.id,
      name: group.name,
      known_priced_value: knownValue,
      market_value: marketValue,
      actual_pct_of_total: actualPct,
      target_pct_of_total: target,
      max_pct_of_total: max,
      drift_pct_points: drift,
      holdings_count: groupHoldings.length,
      priced_holdings_count: pricedCount,
      unpriced_holdings_count: unpricedCount,
      pricing_coverage_pct: groupHoldings.length > 0 ? round((pricedCount / groupHoldings.length) * 100) : 100,
      status,
      excess_pct_points: excess
    };
  });

  const computedPortfolioMap = new Map(computedPortfolios.map(portfolio => [portfolio.portfolio_id, portfolio]));
  const computedPositions: ComputedPortfolioPosition[] = normalizedPositions.map(({ holding, portfolioId }) => {
    const portfolioSummary = computedPortfolioMap.get(portfolioId)!;
    const portfolio = portfolioId ? portfolioMap.get(portfolioId) || null : null;
    const target = normalizeOptionalPct(holding.target_weight_pct);
    const max = normalizeOptionalPct(holding.max_weight_pct);
    const marketValue = typeof holding.market_value === 'number' ? holding.market_value : null;
    const pctWithin = marketValue !== null
      && portfolioSummary.market_value !== null
      && portfolioSummary.market_value > 0
      ? round((marketValue / portfolioSummary.market_value) * 100)
      : null;
    const pctTotal = marketValue !== null && totalInvestedMarketValue !== null && totalInvestedMarketValue > 0
      ? round((marketValue / totalInvestedMarketValue) * 100)
      : null;
    const derivedTarget = derivePositionTargetOverallPct(portfolio?.target_pct_of_total, target);
    const excess = pctWithin !== null && max !== null && pctWithin > max ? round(pctWithin - max) : null;
    const status = !isFullyPriced || portfolioSummary.unpriced_holdings_count > 0
      ? 'INCOMPLETE_PRICING' as const
      : excess !== null
        ? 'ABOVE_MAX' as const
        : max === null
          ? 'NO_LIMIT_SET' as const
          : 'WITHIN_LIMIT' as const;

    return {
      holding,
      portfolio_id: portfolioId,
      portfolio_name: portfolioSummary.name,
      pct_within_portfolio: pctWithin,
      pct_of_total: pctTotal,
      target_pct_within_portfolio: target,
      max_pct_within_portfolio: max,
      derived_target_pct_of_total: derivedTarget,
      status,
      excess_pct_points: excess
    };
  });

  const limitMap = new Map(tickerLimits.map(limit => [limit.ticker.toUpperCase().trim(), limit]));
  const tickerMap = new Map<string, ComputedPortfolioPosition[]>();
  for (const position of computedPositions) {
    const ticker = position.holding.ticker.toUpperCase().trim();
    tickerMap.set(ticker, [...(tickerMap.get(ticker) || []), position]);
  }

  const aggregateTickers: AggregateTickerExposure[] = Array.from(tickerMap.entries()).map(([ticker, positions]) => {
    const allTickerPositionsPriced = positions.every(position => typeof position.holding.market_value === 'number');
    const tickerKnownValue = round(positions.reduce((sum, position) => (
      sum + (typeof position.holding.market_value === 'number' ? position.holding.market_value : 0)
    ), 0), 2);
    const totalMarketValue = allTickerPositionsPriced ? tickerKnownValue : null;
    const totalPct = isFullyPriced && totalInvestedMarketValue !== null && totalInvestedMarketValue > 0
      ? round((tickerKnownValue / totalInvestedMarketValue) * 100)
      : null;
    const derivedTargets = positions.map(position => position.derived_target_pct_of_total);
    const aggregateTarget = derivedTargets.every(value => value !== null)
      ? round(derivedTargets.reduce<number>((sum, value) => sum + (value || 0), 0), 4)
      : null;
    const overallMax = normalizeOptionalPct(limitMap.get(ticker)?.max_pct_of_total);
    const excess = totalPct !== null && overallMax !== null && totalPct > overallMax ? round(totalPct - overallMax) : null;
    const status = !isFullyPriced
      ? 'INCOMPLETE_PRICING' as const
      : excess !== null
        ? 'ABOVE_MAX' as const
        : overallMax === null
          ? 'NO_LIMIT_SET' as const
          : 'WITHIN_LIMIT' as const;

    return {
      ticker,
      total_market_value: totalMarketValue,
      total_pct_of_total: totalPct,
      aggregate_derived_target_pct_of_total: aggregateTarget,
      portfolios: positions.map(position => ({
        portfolio_id: position.portfolio_id,
        portfolio_name: position.portfolio_name,
        market_value: position.holding.market_value ?? null,
        pct_of_total: position.pct_of_total,
        derived_target_pct_of_total: position.derived_target_pct_of_total
      })),
      overall_max_pct: overallMax,
      status,
      excess_pct_points: excess
    };
  }).sort((a, b) => (b.total_market_value ?? -1) - (a.total_market_value ?? -1));

  return {
    is_fully_priced: isFullyPriced,
    total_invested_market_value: totalInvestedMarketValue,
    known_priced_value: knownPricedValue,
    unpriced_holdings_count: unpricedHoldingsCount,
    configured_target_pct: configuredTargetPct,
    unallocated_target_pct: round(Math.max(0, 100 - configuredTargetPct), 4),
    portfolios: computedPortfolios,
    positions: computedPositions,
    aggregate_tickers: aggregateTickers
  };
}
