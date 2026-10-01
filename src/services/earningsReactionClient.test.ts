import assert from 'node:assert/strict';
import {test} from 'node:test';
import {enrichEarningsReactions} from './earningsReactionClient';
import {resolveEarningsEligibility} from '../domain/earningsEligibility';

test('failed historical-price fetch clears model reactions but preserves actuals, estimates and beats',async()=>{
  const original=globalThis.fetch;
  try {
    globalThis.fetch=async()=>{throw Error('source unavailable');};
    const earnings:any={past_earnings_history:[{period:'Q2 2026',report_date:'2026-08-05',eps_actual:2,eps_estimate:1,stock_reaction_1d_pct:99}]};
    await enrichEarningsReactions('UNSEEN',earnings,new AbortController().signal);
    const result=resolveEarningsEligibility(earnings.past_earnings_history);
    assert.equal(result.beatRatePct,100);assert.equal(result.avgSurprise,100);assert.equal(result.avg1DayMove,null);
    assert.equal(earnings.past_earnings_history[0].reaction_observation.value,null);
  } finally {globalThis.fetch=original;}
});

test('market reaction observations are accepted only for the requested company and date',async()=>{
  const original=globalThis.fetch;
  try {
    const earnings:any={past_earnings_history:[{period:'Q2 2026',report_date:'2026-08-05',eps_actual:2,eps_estimate:1,stock_reaction_1d_pct:99}]};
    globalThis.fetch=async()=>new Response(JSON.stringify({ticker:'OTHER',reactions:[{reportDate:'2026-08-05',provider:'Yahoo Finance',value:5}]}));
    await enrichEarningsReactions('UNSEEN',earnings,new AbortController().signal);
    assert.equal(earnings.past_earnings_history[0].stock_reaction_1d_pct,undefined);
    globalThis.fetch=async()=>new Response(JSON.stringify({ticker:'UNSEEN',reactions:[{reportDate:'2026-08-05',provider:'Yahoo Finance',value:5}]}));
    await enrichEarningsReactions('UNSEEN',earnings,new AbortController().signal);
    assert.equal(earnings.past_earnings_history[0].stock_reaction_1d_pct,5);
  } finally {globalThis.fetch=original;}
});
