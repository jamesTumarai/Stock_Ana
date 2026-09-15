import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PortfolioComputedHolding, PortfolioHolding, UserPortfolio } from '../../types';
import {
  computeMultiPortfolioAllocation,
  deleteUserPortfolioSafely,
  derivePositionTargetOverallPct,
  findDuplicatePosition,
  upsertUserPortfolio,
  validatePortfolioConfiguration,
  validatePositionConfiguration
} from '../multiPortfolioEngine';
import {
  loadLocalMultiPortfolioConfig,
  saveLocalMultiPortfolioConfig
} from '../portfolioEngine';
import { evaluateMultiPortfolioAlerts } from '../monitoringEngine';

const now = '2026-09-15T00:00:00.000Z';
const portfolio = (id: string, name: string, target?: number, max?: number): UserPortfolio => ({
  id,
  name,
  target_pct_of_total: target ?? null,
  max_pct_of_total: max ?? null,
  created_at: now,
  updated_at: now
});

const holding = (
  id: string,
  ticker: string,
  portfolioId: string | null,
  marketValue: number | null,
  target?: number,
  max?: number
): PortfolioComputedHolding => ({
  id,
  ticker,
  portfolio_id: portfolioId,
  quantity: 1,
  average_cost: marketValue ?? 10,
  target_weight_pct: target ?? null,
  max_weight_pct: max ?? null,
  current_price: marketValue,
  market_value: marketValue,
  total_cost: marketValue ?? 10,
  unrealized_pnl: marketValue === null ? null : 0,
  unrealized_pnl_pct: marketValue === null ? null : 0,
  allocation_pct: 0,
  fair_value: null,
  margin_of_safety_pct: null
});

describe('multiPortfolioEngine', () => {
  it('starts with no invented portfolio and keeps legacy holdings Unassigned', () => {
    const result = computeMultiPortfolioAllocation([], [holding('legacy', 'SOFI', null, 100)]);
    assert.equal(result.portfolios.length, 1);
    assert.equal(result.portfolios[0].portfolio, null);
    assert.equal(result.portfolios[0].name, 'Unassigned');
    assert.equal(result.positions[0].portfolio_id, null);
  });

  it('derives exact hierarchical target exposure (25% × 20% = 5%)', () => {
    assert.equal(derivePositionTargetOverallPct(25, 20), 5);
    assert.equal(derivePositionTargetOverallPct(null, 20), null);
    assert.equal(derivePositionTargetOverallPct(25, null), null);
  });

  it('computes actual portfolio, within-portfolio, and overall weights', () => {
    const portfolios = [portfolio('a', 'Portfolio A', 25, 30), portfolio('b', 'Portfolio B')];
    const result = computeMultiPortfolioAllocation(portfolios, [
      holding('msft-a', 'MSFT', 'a', 5_000, 20, 30),
      holding('other-a', 'AAPL', 'a', 20_000),
      holding('other-b', 'NVDA', 'b', 75_000)
    ]);
    const portfolioA = result.portfolios.find(item => item.portfolio_id === 'a')!;
    const msft = result.positions.find(item => item.holding.id === 'msft-a')!;
    assert.equal(result.total_invested_market_value, 100_000);
    assert.equal(portfolioA.actual_pct_of_total, 25);
    assert.equal(msft.pct_within_portfolio, 20);
    assert.equal(msft.pct_of_total, 5);
    assert.equal(msft.derived_target_pct_of_total, 5);
  });

  it('allows the same ticker in multiple portfolios and aggregates it once', () => {
    const portfolios = [portfolio('a', 'Long Term', 50), portfolio('b', 'AI Growth', 30)];
    const result = computeMultiPortfolioAllocation(portfolios, [
      holding('msft-a', 'MSFT', 'a', 5_000, 10),
      holding('msft-b', 'MSFT', 'b', 4_000, 10),
      holding('other', 'AAPL', 'a', 91_000)
    ], [{ ticker: 'MSFT', max_pct_of_total: 8, updated_at: now }]);
    const aggregate = result.aggregate_tickers.find(item => item.ticker === 'MSFT')!;
    assert.equal(result.positions.filter(item => item.holding.ticker === 'MSFT').length, 2);
    assert.equal(aggregate.total_market_value, 9_000);
    assert.equal(aggregate.total_pct_of_total, 9);
    assert.equal(aggregate.portfolios.length, 2);
    assert.equal(aggregate.overall_max_pct, 8);
    assert.equal(aggregate.status, 'ABOVE_MAX');
    assert.equal(aggregate.excess_pct_points, 1);
    assert.equal(aggregate.aggregate_derived_target_pct_of_total, 8);
  });

  it('shows aggregate exposure without alert status when no overall limit exists', () => {
    const result = computeMultiPortfolioAllocation([portfolio('a', 'A')], [
      holding('msft', 'MSFT', 'a', 9),
      holding('other', 'AAPL', 'a', 91)
    ]);
    const aggregate = result.aggregate_tickers.find(item => item.ticker === 'MSFT')!;
    assert.equal(aggregate.total_pct_of_total, 9);
    assert.equal(aggregate.overall_max_pct, null);
    assert.equal(aggregate.status, 'NO_LIMIT_SET');
  });

  it('detects portfolio and position maximum breaches in percentage points', () => {
    const portfolios = [portfolio('a', 'A', 25, 30), portfolio('b', 'B')];
    const result = computeMultiPortfolioAllocation(portfolios, [
      holding('msft', 'MSFT', 'a', 26_000, 20, 20),
      holding('aapl', 'AAPL', 'a', 5_000),
      holding('other', 'NVDA', 'b', 69_000)
    ]);
    const portfolioA = result.portfolios.find(item => item.portfolio_id === 'a')!;
    const msft = result.positions.find(item => item.holding.id === 'msft')!;
    assert.equal(portfolioA.actual_pct_of_total, 31);
    assert.equal(portfolioA.status, 'ABOVE_MAX');
    assert.equal(portfolioA.excess_pct_points, 1);
    assert.equal(msft.pct_within_portfolio, 83.9);
    assert.equal(msft.status, 'ABOVE_MAX');
    assert.equal(msft.excess_pct_points, 63.9);
  });

  it('fails closed for every exact allocation and limit when one price is missing', () => {
    const portfolios = [portfolio('a', 'A', 50, 60)];
    const result = computeMultiPortfolioAllocation(portfolios, [
      holding('msft', 'MSFT', 'a', 8_000, 50, 60),
      holding('eose', 'EOSE', 'a', null, 20, 25)
    ], [{ ticker: 'MSFT', max_pct_of_total: 5, updated_at: now }]);
    assert.equal(result.total_invested_market_value, null);
    assert.equal(result.portfolios[0].market_value, null);
    assert.equal(result.portfolios[0].actual_pct_of_total, null);
    assert.equal(result.portfolios[0].status, 'INCOMPLETE_PRICING');
    assert.equal(result.positions[0].pct_within_portfolio, null);
    assert.equal(result.positions[0].pct_of_total, null);
    assert.equal(result.positions[0].status, 'INCOMPLETE_PRICING');
    assert.equal(result.aggregate_tickers.find(item => item.ticker === 'MSFT')?.status, 'INCOMPLETE_PRICING');
  });

  it('validates portfolio target totals but allows independent maximum totals', () => {
    assert.equal(validatePortfolioConfiguration([
      portfolio('a', 'A', 50, 60), portfolio('b', 'B', 30, 60), portfolio('c', 'C', 20)
    ]), null);
    assert.equal(validatePortfolioConfiguration([
      portfolio('a', 'A', 50, 60), portfolio('b', 'B', 30, 60)
    ]), null);
    assert.equal(validatePortfolioConfiguration([
      portfolio('a', 'A', 60, 60), portfolio('b', 'B', 50, 60)
    ]), 'PORTFOLIO_TARGET_TOTAL_ABOVE_100');
  });

  it('validates position targets within one portfolio but not position maximum totals', () => {
    const existing: PortfolioHolding[] = [
      { id: 'a', ticker: 'MSFT', portfolio_id: 'p', quantity: 1, average_cost: 1, target_weight_pct: 30, max_weight_pct: 70 }
    ];
    assert.equal(validatePositionConfiguration(existing, {
      id: 'b', ticker: 'NVDA', portfolio_id: 'p', quantity: 1, average_cost: 1, target_weight_pct: 30, max_weight_pct: 70
    }), null);
    assert.equal(validatePositionConfiguration(existing, {
      id: 'b', ticker: 'NVDA', portfolio_id: 'p', quantity: 1, average_cost: 1, target_weight_pct: 80, max_weight_pct: 90
    }), 'POSITION_TARGET_TOTAL_ABOVE_100');
  });

  it('blocks duplicate ticker only inside the same portfolio', () => {
    const holdings: PortfolioHolding[] = [
      { id: 'a', ticker: 'MSFT', portfolio_id: 'long', quantity: 1, average_cost: 1 }
    ];
    assert.equal(findDuplicatePosition(holdings, { ticker: 'MSFT', portfolio_id: 'long' })?.id, 'a');
    assert.equal(findDuplicatePosition(holdings, { ticker: 'MSFT', portfolio_id: 'growth' }), null);
  });

  it('renames a portfolio without changing identity and blocks unsafe deletion', () => {
    const original = portfolio('stable-id', 'Long Term', 40, 50);
    const renamed = { ...original, name: 'Long-Term Compounders', updated_at: '2026-09-16T00:00:00.000Z' };
    const updated = upsertUserPortfolio([original], renamed);
    assert.equal(updated.error, null);
    assert.equal(updated.portfolios[0].id, 'stable-id');
    assert.equal(updated.portfolios[0].name, 'Long-Term Compounders');

    const blocked = deleteUserPortfolioSafely(updated.portfolios, [
      { id: 'h', ticker: 'MSFT', portfolio_id: 'stable-id', quantity: 1, average_cost: 1 }
    ], 'stable-id');
    assert.equal(blocked.error, 'PORTFOLIO_NOT_EMPTY');
    assert.equal(blocked.portfolios.length, 1);

    const deleted = deleteUserPortfolioSafely(updated.portfolios, [], 'stable-id');
    assert.equal(deleted.error, null);
    assert.equal(deleted.portfolios.length, 0);
  });

  it('isolates portfolio configuration and ticker limits by user UID', () => {
    const storageMap = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (key: string) => storageMap.get(key) ?? null,
      setItem: (key: string, value: string) => storageMap.set(key, value),
      removeItem: (key: string) => storageMap.delete(key),
      clear: () => storageMap.clear()
    };
    saveLocalMultiPortfolioConfig({
      version: 2,
      portfolios: [portfolio('long', 'Long Term', 50, 60)],
      ticker_limits: [{ ticker: 'MSFT', max_pct_of_total: 8, updated_at: now }]
    }, 'user-a');

    assert.equal(loadLocalMultiPortfolioConfig('user-a').portfolios[0].name, 'Long Term');
    assert.equal(loadLocalMultiPortfolioConfig('user-a').ticker_limits[0].max_pct_of_total, 8);
    assert.deepEqual(loadLocalMultiPortfolioConfig('user-b').portfolios, []);
    assert.deepEqual(loadLocalMultiPortfolioConfig().portfolios, []);
  });

  it('creates one stable alert per explicit breached maximum and suppresses alerts for partial pricing', () => {
    const complete = computeMultiPortfolioAllocation(
      [portfolio('a', 'A', 25, 30), portfolio('b', 'B')],
      [
        holding('msft-a', 'MSFT', 'a', 31_000, 20, 20),
        holding('msft-b', 'MSFT', 'b', 9_000),
        holding('other', 'AAPL', 'b', 60_000)
      ],
      [{ ticker: 'MSFT', max_pct_of_total: 35, updated_at: now }]
    );
    const first = evaluateMultiPortfolioAlerts(complete, new Set(), Date.parse(now));
    const second = evaluateMultiPortfolioAlerts(complete, new Set(first.map(alert => alert.id)), Date.parse(now) + 10_000);
    assert.equal(first.filter(alert => alert.type === 'PORTFOLIO_ALLOCATION_LIMIT').length, 1);
    assert.equal(first.filter(alert => alert.type === 'POSITION_PORTFOLIO_LIMIT').length, 1);
    assert.equal(first.filter(alert => alert.type === 'OVERALL_TICKER_EXPOSURE_LIMIT').length, 1);
    assert.deepEqual(first.map(alert => alert.id), second.map(alert => alert.id));
    assert.ok(second.every(alert => alert.isRead));

    const partial = computeMultiPortfolioAllocation(
      [portfolio('a', 'A', 25, 30)],
      [holding('msft-a', 'MSFT', 'a', 31_000, 20, 20), holding('missing', 'EOSE', 'a', null)],
      [{ ticker: 'MSFT', max_pct_of_total: 10, updated_at: now }]
    );
    assert.deepEqual(evaluateMultiPortfolioAlerts(partial, new Set(), Date.parse(now)), []);
  });
});
