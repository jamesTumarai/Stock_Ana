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
assert.deepEqual(source,before);
for (const ticker of ['AAPL','SOFI','NVDA','TSLA','UNKNOWN']) {
  const empty = normalizeReport({ticker} as ReportData);
  assert.equal(empty.financial_statements,undefined);
  assert.equal(empty.morningstar_research,undefined);
  assert.equal(empty.forecast_dashboard,undefined);
}
const missing = structuredClone(source);
missing.financial_statements!.balance_sheet!.cash_and_equivalents![3] = null;
assert.equal(normalizeReport(missing).five_pillars!.balance_sheet.net_cash_or_debt_b,undefined);
const zero = structuredClone(source);
zero.financial_statements!.balance_sheet!.cash_and_equivalents![3]=0;
zero.financial_statements!.balance_sheet!.short_term_investments![3]=0;
assert.equal(normalizeReport(zero).five_pillars!.balance_sheet.total_cash_and_investments_b,0);
assert.equal(normalizeReport(source,'AAPL',{AAPL:{price:330}}).company_profile!.stock_price,330);
assert.equal(source.company_profile!.stock_price,319.97);
console.log('Report integrity regression checks passed');
