import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHoldingMetrics,
  calculatePortfolioSummary,
  loadLocalWatchlist,
  saveLocalWatchlist,
  loadLocalPortfolio,
  saveLocalPortfolio,
  SUGGESTED_WATCHLIST_TICKERS
} from '../portfolioEngine';
import { PortfolioHolding } from '../../types';

describe('portfolioEngine', () => {
  it('calculateHoldingMetrics: calculates market value, pnl, and margin of safety correctly', () => {
    const holding: PortfolioHolding = {
      ticker: 'MSFT',
      quantity: 10,
      average_cost: 400,
      sector: 'Technology'
    };

    const computed = calculateHoldingMetrics(holding, 450, 500);

    assert.equal(computed.total_cost, 4000);
    assert.equal(computed.current_price, 450);
    assert.equal(computed.market_value, 4500);
    assert.equal(computed.unrealized_pnl, 500);
    assert.equal(computed.unrealized_pnl_pct, 12.5); // (450 - 400) / 400 * 100
    assert.equal(computed.fair_value, 500);
    assert.equal(computed.margin_of_safety_pct, 11.1); // (500 - 450) / 450 * 100 = 11.11 -> 11.1%
  });

  it('calculateHoldingMetrics: handles loss and negative margin of safety', () => {
    const holding: PortfolioHolding = {
      ticker: 'SOFI',
      quantity: 100,
      average_cost: 15,
      sector: 'Financials'
    };

    const computed = calculateHoldingMetrics(holding, 12, 10);

    assert.equal(computed.total_cost, 1500);
    assert.equal(computed.market_value, 1200);
    assert.equal(computed.unrealized_pnl, -300);
    assert.equal(computed.unrealized_pnl_pct, -20);
    assert.equal(computed.margin_of_safety_pct, -16.7); // (10 - 12) / 12 * 100 = -16.67%
  });

  it('calculateHoldingMetrics: gracefully handles missing price or zero quantities', () => {
    const holding: PortfolioHolding = {
      ticker: 'NVDA',
      quantity: 0,
      average_cost: 0
    };

    const computed = calculateHoldingMetrics(holding, null, null);

    assert.equal(computed.total_cost, 0);
    assert.equal(computed.market_value, null);
    assert.equal(computed.unrealized_pnl, null);
    assert.equal(computed.unrealized_pnl_pct, null);
    assert.equal(computed.margin_of_safety_pct, null);
  });

  it('calculatePortfolioSummary: aggregates totals, allocations, sectors and concentration alert', () => {
    const holdings: PortfolioHolding[] = [
      { ticker: 'MSFT', quantity: 10, average_cost: 400, sector: 'Technology' },
      { ticker: 'AAPL', quantity: 10, average_cost: 200, sector: 'Technology' },
      { ticker: 'JPM', quantity: 5, average_cost: 200, sector: 'Financials' }
    ];

    const quotes = {
      MSFT: 450, // MV = 4500
      AAPL: 220, // MV = 2200
      JPM: 200   // MV = 1000
    };

    const latestReports = {
      MSFT: { intrinsic_value: { summary: { base_case_fair_value: 500 } } }, // MoS: 11.1%
      AAPL: { intrinsic_value: { summary: { base_case_fair_value: 250 } } }, // MoS: 13.6%
      JPM: { intrinsic_value: { summary: { base_case_fair_value: 200 } } }   // MoS: 0%
    };

    const summary = calculatePortfolioSummary(holdings, quotes, latestReports);

    assert.equal(summary.holdings_count, 3);
    assert.equal(summary.total_cost_basis, 7000); // 4000 + 2000 + 1000
    assert.equal(summary.total_market_value, 7700); // 4500 + 2200 + 1000
    assert.equal(summary.total_unrealized_pnl, 700);
    assert.equal(summary.total_unrealized_pnl_pct, 10); // 700 / 7000 * 100 = 10%

    // MSFT allocation: 4500 / 7700 = 58.4% -> Triggers concentration risk alert (>= 30%)
    assert.equal(summary.top_holding_concentration_pct, 58.4);
    assert.equal(summary.concentration_risk_alert, true);

    // Sector breakdown
    assert.equal(summary.sector_breakdown.length, 2);
    assert.equal(summary.sector_breakdown[0].sector, 'Technology');
    assert.equal(summary.sector_breakdown[0].market_value, 6700); // 4500 + 2200
    assert.equal(summary.sector_breakdown[1].sector, 'Financials');
    assert.equal(summary.sector_breakdown[1].market_value, 1000);

    // Weighted Margin of Safety
    assert.ok(typeof summary.weighted_margin_of_safety_pct === 'number');
    assert.ok(summary.weighted_margin_of_safety_pct > 0);
  });

  it('calculatePortfolioSummary: handles empty portfolio gracefully', () => {
    const summary = calculatePortfolioSummary([]);

    assert.equal(summary.holdings_count, 0);
    assert.equal(summary.total_market_value, 0);
    assert.equal(summary.total_cost_basis, 0);
    assert.equal(summary.total_unrealized_pnl, 0);
    assert.equal(summary.top_holding_concentration_pct, 0);
    assert.equal(summary.concentration_risk_alert, false);
    assert.equal(summary.sector_breakdown.length, 0);
    assert.equal(summary.weighted_margin_of_safety_pct, null);
    assert.equal(summary.is_fully_priced, true);
    assert.equal(summary.pricing_coverage_pct, 100);
  });

  it('calculatePortfolioSummary: unpriced holdings must NOT substitute cost basis for market value (P1-4)', () => {
    const holdings: PortfolioHolding[] = [
      { ticker: 'MSFT', quantity: 10, average_cost: 400, sector: 'Technology' }, // Total Cost = 4000
      { ticker: 'AMZN', quantity: 10, average_cost: 150, sector: 'Consumer' }     // Total Cost = 1500 (No quote!)
    ];

    const quotes = {
      MSFT: 450 // MV = 4500
      // AMZN quote missing
    };

    const summary = calculatePortfolioSummary(holdings, quotes);

    assert.equal(summary.holdings_count, 2);
    assert.equal(summary.total_cost_basis, 5500); // 4000 + 1500

    // P1-4 INVARIANT: Total Market Value & Total P/L MUST NOT be fabricated by substituting cost basis!
    assert.equal(summary.total_market_value, null);
    assert.equal(summary.total_unrealized_pnl, null);
    assert.equal(summary.total_unrealized_pnl_pct, null);

    // Telemetry tracks pricing coverage accurately
    assert.equal(summary.is_fully_priced, false);
    assert.equal(summary.priced_holdings_count, 1);
    assert.equal(summary.unpriced_holdings_count, 1);
    assert.equal(summary.pricing_coverage_pct, 50.0);
    assert.equal(summary.priced_market_value, 4500);
    assert.equal(summary.unpriced_cost_basis, 1500);
    assert.equal(summary.computed_holdings.every(holding => holding.allocation_pct === 0), true);
    assert.equal(summary.top_holding_concentration_pct, 0);
    assert.equal(summary.concentration_risk_alert, false);
    assert.equal(summary.sector_breakdown.every(sector => sector.allocation_pct === 0), true);
  });

  it('loadLocalWatchlist: returns empty array when storage is empty, without masquerading starter tickers (P1-5)', () => {
    // Setup in-memory mock for globalThis.localStorage in Node test environment
    const storageMap = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (key: string) => storageMap.get(key) ?? null,
      setItem: (key: string, val: string) => storageMap.set(key, String(val)),
      removeItem: (key: string) => storageMap.delete(key),
      clear: () => storageMap.clear()
    };

    const testUserId = 'test_user_empty_watchlist_' + Date.now();

    // Verify empty storage returns empty array []
    const emptyList = loadLocalWatchlist(testUserId);
    assert.deepEqual(emptyList, []);

    // Verify starter suggestions exist as separate export
    assert.ok(Array.isArray(SUGGESTED_WATCHLIST_TICKERS));
    assert.deepEqual(SUGGESTED_WATCHLIST_TICKERS, ['MSFT', 'AAPL', 'NVDA', 'SOFI']);

    // Verify explicit user save and load works
    saveLocalWatchlist(['TSLA', 'GOOGL'], testUserId);
    const savedList = loadLocalWatchlist(testUserId);
    assert.deepEqual(savedList, ['TSLA', 'GOOGL']);
  });
});
