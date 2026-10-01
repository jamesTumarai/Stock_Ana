import assert from 'node:assert/strict';
import {test} from 'node:test';
import {calculateEarningsReactions,fetchEarningsReactions} from '../earningsReactionService';
const chart={meta:{symbol:'UNSEEN',exchangeTimezoneName:'America/New_York'},timestamp:['2026-09-24T20:00:00Z','2026-09-25T20:00:00Z','2026-09-28T20:00:00Z'].map(s=>Date.parse(s)/1000),indicators:{quote:[{close:[100,110,99]}]}};
test('independent market observations use next trading session; weekends are not interpolated',()=>{
  const result=calculateEarningsReactions(['2026-09-24','2026-09-25','2026-09-26'],chart,'2026-09-29');
  assert.equal(result[0].value,10);assert.equal(result[1].value,-10);assert.equal(result[1].afterDate,'2026-09-28');
  assert.equal(result[2].value,null);assert.match(result[2].reason!,/SESSION_CLOSE_UNAVAILABLE/);
});
test('split/timezone ambiguity fails closed and provider failure stays independent of earnings surprises',async()=>{
  const split={...chart,events:{splits:{one:{date:chart.timestamp[1]}}}};
  assert.equal(calculateEarningsReactions(['2026-09-24'],split,'2026-09-29')[0].reason,'CORPORATE_ACTION_WINDOW_NOT_COMPARABLE');
  assert.equal(calculateEarningsReactions(['2026-09-24'],{...chart,meta:{}},'2026-09-29')[0].reason,'EXCHANGE_TIMEZONE_UNAVAILABLE');
  const failing=(async()=>new Response('{}',{status:503})) as typeof fetch;
  assert.equal((await fetchEarningsReactions('UNSEEN',['2026-09-24'],failing))[0].reason,'HISTORICAL_MARKET_SOURCE_FETCH_FAILED');
});
test('historical market class aliases keep A/B identity while using the provider symbol',async()=>{
  let request='';
  const fetcher=(async(url:unknown)=>{request=String(url);return new Response(JSON.stringify({chart:{result:[{...chart,meta:{...chart.meta,symbol:'TEST-B'}}]}}));}) as typeof fetch;
  assert.equal((await fetchEarningsReactions('TEST.B',['2026-09-24'],fetcher))[0].value,10);
  assert.match(request,/chart\/TEST-B\?/);
  assert.equal((await fetchEarningsReactions('TEST.A',['2026-09-24'],fetcher))[0].value,null);
});
