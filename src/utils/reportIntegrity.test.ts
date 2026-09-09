import assert from 'node:assert/strict';
import { normalizeReport, periodChanges } from './reportIntegrity';
import type { ReportData } from '../types';

const periods = ['Q4 2025','Q1 2026','Q2 2026','Q3 2026'];
assert.deepEqual(periodChanges([10,20,30,40], periods, 'yoy'), [null,null,null,null]);
assert.deepEqual(periodChanges([10,20,30,40], periods, 'qoq'), [null,100,50,33.33]);
assert.deepEqual(periodChanges([10,20], ['Q1 2025','Q1 2026'], 'yoy'), [null,100]);
assert.deepEqual(periodChanges([10,20], ['Q1 2025','Q3 2025'], 'qoq'), [null,null]);
assert.deepEqual(periodChanges([0,0], ['Q1 2025','Q1 2026'], 'yoy'), [null,null]);
assert.deepEqual(periodChanges([null,20], ['Q1 2025','Q1 2026'], 'yoy'), [null,null]);
const source = {
  ticker: 'AAPL', financial_statements: { periods, balance_sheet: {cash_and_equivalents:[1,2,3,39544],short_term_investments:[1,2,3,22855],total_debt:[1,2,3,84344],total_equity:[1,2,3,107520]},income_statement:{eps:[1.85,2.84,2.01,2.02]} },
  five_pillars:{ growth:{},profitability:{},balance_sheet:{},yields:{},peer_matrix:[] },
  company_profile:{ stock_price:319.97 }, findings:[],
} as unknown as ReportData;
const before = structuredClone(source);
const result = normalizeReport(source);
assert.equal(result.five_pillars!.balance_sheet.is_net_cash, false);
assert.equal(result.five_pillars!.balance_sheet.net_cash_or_debt_b, 21.95);
assert.equal(result.five_pillars!.balance_sheet.total_cash_and_investments_b, 62.4);
assert.deepEqual(result.financial_statements!.income_statement,source.financial_statements!.income_statement);
const canonical = (result as ReportData & { canonical_financials?: any }).canonical_financials;
assert.ok(canonical, 'Normalization should attach canonical financial provenance when statements exist');
assert.equal(canonical.values['balance_sheet.cash_and_equivalents'][3].value, 39544);
assert.equal(canonical.values['balance_sheet.cash_and_equivalents'][3].verification, 'unverified');
assert.equal(canonical.sourceCoverage.verifiedValues, 0);
assert.deepEqual(source,before);
for (const ticker of ['AAPL','SOFI','NVDA','TSLA','UNKNOWN']) {
  const empty = normalizeReport({ticker} as ReportData);
  assert.equal(empty.financial_statements,undefined);
  assert.equal(empty.morningstar_research,undefined);
  assert.equal(empty.forecast_dashboard,undefined);
  assert.equal((empty as ReportData & { canonical_financials?: any }).canonical_financials, undefined);
}
const missing = structuredClone(source);
missing.financial_statements!.balance_sheet!.cash_and_equivalents![3] = null;
assert.equal(normalizeReport(missing).five_pillars!.balance_sheet.net_cash_or_debt_b,undefined);
const zero = structuredClone(source);
zero.financial_statements!.balance_sheet!.cash_and_equivalents![3]=0;
zero.financial_statements!.balance_sheet!.short_term_investments![3]=0;
assert.equal(normalizeReport(zero).five_pillars!.balance_sheet.total_cash_and_investments_b,0);

const marketSynced = normalizeReport({
  ticker: 'AAPL',
  generated_at: '2026-09-09T00:00:00Z',
  summary: 'test',
  company_profile: { stock_price: 100, price_change: 0, price_change_pct: 0 },
  intrinsic_value: {
    current_price: 101,
    summary: { fair_value_range_low: null, fair_value_range_high: null, base_case_fair_value: null, margin_of_safety_pct: null },
  },
  technical_analysis: { key_levels: { current_price: 102, support: [], resistance: [] } },
  forecast_dashboard: {
    total_analysts: 1,
    consensus_rating: 'Hold',
    ratings_breakdown: { buy_count: 0, buy_pct: 0, hold_count: 1, hold_pct: 100, sell_count: 0, sell_pct: 0 },
    price_target: { high: 140, mean: 120, low: 90, current_price: 103 },
    institutions: [],
    analysts: [],
  },
} as unknown as ReportData, 'AAPL', {
  AAPL: {
    symbol: 'AAPL',
    price: 110,
    change: 2,
    changePercent: 1.85,
    marketCap: '$3.20T',
    marketCapRaw: 3_200_000_000_000,
    provider: 'Yahoo Finance',
    asOf: '2026-09-09T16:00:00.000Z',
    retrievedAt: '2026-09-09T16:00:01.000Z',
  },
});

assert.equal(marketSynced.company_profile!.stock_price, 110);
assert.equal(marketSynced.company_profile!.price_change, 2);
assert.equal(marketSynced.company_profile!.price_change_pct, 1.85);
assert.equal(marketSynced.intrinsic_value!.current_price, 110);
assert.equal(marketSynced.technical_analysis!.key_levels.current_price, 110);
assert.equal(marketSynced.forecast_dashboard!.price_target.current_price, 110);
assert.equal(marketSynced.forecast_dashboard!.price_target.implied_upside_pct, 9.09);
const snapshot = (marketSynced as ReportData & { market_snapshot?: { price: number; provider?: string; isRealtime: boolean } }).market_snapshot;
assert.equal(snapshot?.price, 110);
assert.equal(snapshot?.provider, 'Yahoo Finance');
assert.equal(snapshot?.isRealtime, false);
assert.equal(source.company_profile!.stock_price,319.97);
console.log('Report integrity regression checks passed');
