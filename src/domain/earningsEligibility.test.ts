import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveEarningsEligibility } from './earningsEligibility';
const row = {period:'Q1 2026',eps_actual:2,eps_estimate:1,revenue_actual_musd:90,revenue_estimate_musd:100,stock_reaction_1d_pct:0} as any;
test('EPS and Revenue have independent beats and surprises, preserving a zero price reaction',()=>{
  const eps=resolveEarningsEligibility([row],'eps'),revenue=resolveEarningsEligibility([row],'revenue');
  assert.equal(eps.beatRatePct,100);assert.equal(eps.avgSurprise,100);
  assert.equal(revenue.beatRatePct,0);assert.equal(revenue.avgSurprise,-10);assert.equal(eps.avg1DayMove,0);
});
test('duplicates do not inflate a sample and metric conflicts do not contaminate other metrics',()=>{
  assert.equal(resolveEarningsEligibility([row,row]).comparableCount,1);
  const conflict={...row,eps_actual:3};
  assert.equal(resolveEarningsEligibility([row,conflict],'eps').comparableCount,0);
  assert.equal(resolveEarningsEligibility([row,conflict],'revenue').comparableCount,1);
  assert.equal(resolveEarningsEligibility([row,conflict],'eps').avg1DayMove,0);
});
test('meet is not beat, a zero estimate has no computed percentage and missing history has reasons',()=>{
  const result=resolveEarningsEligibility([{...row,eps_actual:0,eps_estimate:0}]);
  assert.equal(result.beatRatePct,0);assert.equal(result.avgSurprise,null);
  assert.equal(resolveEarningsEligibility([]).reasons.beatRate,'ACTUAL_AND_ESTIMATE_HISTORY_UNAVAILABLE');
});
