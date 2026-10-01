import type { PastEarningsItem } from '../types';
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
export function resolveEarningsEligibility(history: PastEarningsItem[], metric: 'eps' | 'revenue' = 'eps') {
  const actual = (q: PastEarningsItem) => metric === 'eps' ? q.eps_actual : q.revenue_actual_musd;
  const estimate = (q: PastEarningsItem) => metric === 'eps' ? q.eps_estimate : q.revenue_estimate_musd;
  const suppliedSurprise = (q: PastEarningsItem) => metric === 'eps' ? q.eps_surprise_pct : q.revenue_surprise_pct;
  // Duplicate/contradictory fiscal observations never count as multiple beats.
  const groups = new Map<string,PastEarningsItem[]>();
  for (const item of history) { const list=groups.get(item.period)||[];list.push(item);groups.set(item.period,list); }
  const observations = [...groups.values()].flatMap(group => {
    const signatures = new Set(group.map(q => JSON.stringify([actual(q),estimate(q),suppliedSurprise(q)])));
    return signatures.size === 1 ? [group[0]] : [];
  });
  const comparable = observations.filter(q => finite(actual(q)) && finite(estimate(q)));
  // Meet is not a beat. Labels are explanatory, never an alternate fact source.
  const beatsCount = comparable.filter(q => actual(q)! > estimate(q)!).length;
  const surprises = observations.flatMap(q => finite(actual(q))&&finite(estimate(q))&&estimate(q)!==0
    ? [(actual(q)!-estimate(q)!)/Math.abs(estimate(q)!)*100] : finite(suppliedSurprise(q))?[suppliedSurprise(q)!]:[]);
  // Reaction is a separately sourced historical close-to-close market observation.
  // Never derive it from today's quote or replace it with the earnings surprise.
  const reactions = [...groups.values()].flatMap(group => {
    const values = new Set(group.map(q=>q.stock_reaction_1d_pct).filter(finite));
    return values.size===1?[...values][0]:[];
  });
  const mean=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
  return {beatsCount,comparableCount:comparable.length,beatRatePct:comparable.length?Math.round(beatsCount/comparable.length*100):null,
    avgSurprise:mean(surprises),avg1DayMove:mean(reactions),
    reasons:{beatRate:comparable.length?null:'ACTUAL_AND_ESTIMATE_HISTORY_UNAVAILABLE',
      surprise:surprises.length?null:'SURPRISE_INPUTS_UNAVAILABLE',reaction:reactions.length?null:'HISTORICAL_MARKET_REACTION_UNAVAILABLE'}};
}
