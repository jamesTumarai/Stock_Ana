import assert from 'node:assert/strict';import {test} from 'node:test';
import {resolveCanonicalMultiples,sanitizeMultipleSemantics,reconcileReportMultiples} from './valuationDependencies';
import {resolveEarningsEligibility} from '../earningsEligibility';
test('negative observed multiples never retain positive thresholds/badges/percentiles',()=>{
  for(const name of ['EV/EBITDA','P/FCF','P/E','PEG Ratio','P/B']) {
    const item=sanitizeMultipleSemantics({name,value:-7.6,verdict:'expensive',own_5yr_percentile:80,peer_avg:10});
    assert.equal(item.value,null);assert.equal(item.rawValue,-7.6);assert.equal(item.verdict,'not_meaningful');assert.equal(item.own_5yr_percentile,null);
  }
});
test('P/B only needs market capitalization and compatible parent equity, not DCF/FCF/EBITDA',()=>{
  const report:any={ticker:'NEW',market_snapshot:{ticker:'NEW',price:10,marketCapRaw:100e6,provider:'test-market-provider',dataKind:'market_quote'},
    canonical_financials:{ticker:'NEW',generatedBy:'sec-xbrl',periods:['Q2 2026'],values:{'balance_sheet.stockholders_equity':[{metric:'stockholders_equity',statement:'balance_sheet',period:'Q2 2026',periodEnd:'2026-06-30',fiscalYear:2026,fiscalQuarter:2,value:50,unit:'USD_M',periodType:'instant',verification:'verified'}]}}};
  const ratios=resolveCanonicalMultiples(report);assert.equal(ratios.find(r=>r.name==='P/B')?.value,2);
  assert.equal(ratios.find(r=>r.name==='EV/EBITDA')?.status,'UNAVAILABLE');
});
test('earnings beat rate uses actual/estimate, meets are not beats, surprise and reaction eligible independently',()=>{
  const history:any=[{period:'Q1 2026',eps_actual:2,eps_estimate:1,beat_or_miss:'miss_both'},
    {period:'Q2 2026',eps_actual:1,eps_estimate:1,beat_or_miss:'beat_both'}];
  const r=resolveEarningsEligibility(history);assert.equal(r.beatRatePct,50);assert.equal(r.avgSurprise,50);assert.equal(r.avg1DayMove,null);
  const independent=resolveEarningsEligibility([{period:'Q3',eps_surprise_pct:8,stock_reaction_1d_pct:2} as any]);
  assert.equal(independent.beatRatePct,null);assert.equal(independent.avgSurprise,8);assert.equal(independent.avg1DayMove,2);
  assert.equal(resolveEarningsEligibility([...history,history[0]]).beatRatePct,50);
});

test('provider trailing multiple is independently eligible, but known negative canonical EPS overrides it',()=>{
  const report:any={ticker:'UNSEEN',market_snapshot:{ticker:'UNSEEN',price:10,trailingPE:15,provider:'observed-provider',dataKind:'market_quote'},
    canonical_financials:{generatedBy:'sec-xbrl',ticker:'UNSEEN',periods:['Q3 2025','Q4 2025','Q1 2026','Q2 2026'],values:{}}};
  assert.equal(resolveCanonicalMultiples(report)[0].status,'REPORTED');
  report.canonical_financials.values['income_statement.eps_diluted']=report.canonical_financials.periods.map((period:string)=>({period,value:-1,verification:'verified',periodType:'standalone_quarter',unit:'per_share'}));
  const negative=resolveCanonicalMultiples(report)[0];
  assert.equal(negative.value,null);assert.equal(negative.status,'VALUE_AVAILABLE_BUT_NOT_MEANINGFUL_FOR_MULTIPLE_COMPARISON');
  assert.equal(negative.verdict,'not_meaningful');
});

test('controlled ratio aliases cannot leave duplicate private AI facts beside verified multiples',()=>{
  const report:any={ticker:'UNSEEN',market_snapshot:{ticker:'UNSEEN',price:10,trailingPE:15,enterpriseToEbitda:12,provider:'observed-provider',dataKind:'market_quote'},
    canonical_financials:{ticker:'UNSEEN',generatedBy:'sec-xbrl',periods:[],values:{}},
    valuation_ratios:[{name:'Trailing P/E',value:99},{name:'P/E',value:100},{name:'EV/EBITDA',value:1}]};
  reconcileReportMultiples(report);
  assert.equal(report.valuation_ratios.filter((r:any)=>r.name==='P/E').length,1);
  assert.equal(report.valuation_ratios.find((r:any)=>r.name==='P/E').value,15);
  assert.equal(report.valuation_ratios.find((r:any)=>r.name==='EV/EBITDA').status,'REPORTED');
});

test('verified common earnings can support P/E independently of missing Q4 EPS, and losses override a positive provider ratio',()=>{
  const periods=['Q3 2025','Q4 2025','Q1 2026','Q2 2026'];
  const starts=['2025-07-01','2025-10-01','2026-01-01','2026-04-01'],ends=['2025-09-30','2025-12-31','2026-03-31','2026-06-30'];
  const facts=periods.map((period,i)=>({statement:'income_statement',metric:'net_income_common',period,periodStart:starts[i],periodEnd:ends[i],
    fiscalYear:i<2?2025:2026,fiscalQuarter:([3,4,1,2] as const)[i],value:2,unit:'USD_M',currency:'USD',verification:'verified',periodType:'standalone_quarter'}));
  const report:any={ticker:'UNSEEN',market_snapshot:{ticker:'UNSEEN',price:10,marketCapRaw:160e6,trailingPE:99,provider:'observed-provider',dataKind:'market_quote'},
    canonical_financials:{schemaVersion:2,generatedBy:'sec-xbrl',ticker:'UNSEEN',periods,values:{'income_statement.net_income_common':facts}}};
  assert.equal(resolveCanonicalMultiples(report)[0].value,20);
  assert.equal(resolveCanonicalMultiples(report)[0].status,'CALCULATED');
  facts.forEach(f=>f.value=-2);
  const loss=resolveCanonicalMultiples(report)[0];
  assert.equal(loss.value,null);assert.equal(loss.verdict,'not_meaningful');assert.equal(loss.rawValue,-20);
});
