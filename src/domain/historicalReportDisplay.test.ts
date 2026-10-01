import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareHistoricalReportDisplay} from './historicalReportDisplay';
import {compareResearchVersions} from './reportVersionCompare';
import {extractReportFairValue} from '../utils/researchTimeline';

test('historical valuation, conviction and prose survive a newer model version without mutation',()=>{
  const saved={ticker:'GENERIC',generated_at:'2026-01-01T00:00:00Z',verdict:{summary:'Original research thesis',conviction_score:72,key_takeaways:['Original claim']},
    intrinsic_value:{canonical_run:{primaryMethod:'RESIDUAL_INCOME',modelVersion:'adaptive-valuation-v1',baseFairValue:42,marginOfSafetyPct:20},summary:{base_case_fair_value:42}}} as any;
  const before=JSON.stringify(saved),display=prepareHistoricalReportDisplay(saved);
  assert.equal(display.intrinsic_value!.canonical_run!.baseFairValue,42);assert.equal(display.verdict!.conviction_score,72);
  assert.equal(display.verdict!.summary,'Original research thesis');assert.equal(JSON.stringify(saved),before);
  assert.notEqual(display,saved);
});
test('legacy snapshot is labeled unverified, not silently replaced; unavailable run cannot resurrect DCF',()=>{
  const old={ticker:'GENERIC',generated_at:'2026-01-01T00:00:00Z',intrinsic_value:{summary:{base_case_fair_value:99}}} as any;
  const view=prepareHistoricalReportDisplay(old);assert.equal(view.intrinsic_value!.summary.base_case_fair_value,99);
  assert.ok(view.validation!.issues.some(i=>i.code==='LEGACY_VALUATION_UNVERIFIED'));
  old.intrinsic_value.canonical_run={baseFairValue:null};assert.equal(extractReportFairValue(old),null);
});
test('version compare separates market price, assumptions and coverage; a price move alone does not change intrinsic value',()=>{
  const run={financialSnapshotId:'a',inputHash:'b',assumptionHash:'c',modelVersion:'adaptive-valuation-v2',primaryMethod:'RESIDUAL_INCOME',baseFairValue:100,inputSnapshot:{bookValuePerShare:50},assumptionSnapshot:{costOfEquityPct:10}};
  const before={ticker:'GENERIC',generated_at:'2026-01-01',market_snapshot:{price:60},intrinsic_value:{canonical_run:run}} as any;
  const current=structuredClone(before);current.market_snapshot.price=80;
  const result=compareResearchVersions(before,current);assert.equal(result.status,'UNCHANGED');assert.deepEqual(result.rows.map(r=>r.key),['Market price']);
});
