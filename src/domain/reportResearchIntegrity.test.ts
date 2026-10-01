import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildResearchIntegrity,resolveGuidanceRegistry,resolveResearchEvents,resolveUpcomingEarningsEvent,reconcileRevenueHierarchy,compareCanonicalValuationRuns} from './reportResearchIntegrity';
import {verifiedFixtureFromStatements} from './__tests__/verifiedFixtureBuilder';
const fixture=()=>{
  const ds=verifiedFixtureFromStatements({periods:['Q1 2026','Q2 2026','Q3 2026','Q4 2026'],
    income_statement:{revenue:[100,100,100,100],net_income:[10,10,10,10],operating_income:[15,15,15,15]},
    balance_sheet:{cash_and_equivalents:[10,10,10,10]},cash_flow:{operating_cash_flow:[12,12,12,12],capex:[2,2,2,2],free_cash_flow:[10,10,10,10],
      dividends_common:[0,0,0,0],repurchase_of_common_stock:[2,2,2,2],issuance_of_common_stock:[1,1,1,1],stock_based_compensation:[1,1,1,1]}} as any);
  ds.ticker='GENERIC';return {ticker:'GENERIC',company_profile:{industry:'Software',sector:'Technology'},canonical_financials:ds,
    market_snapshot:{ticker:'GENERIC',dataKind:'market_quote',provider:'Test quote',marketCapRaw:1000e6}} as any;
};
test('historical earnings dates do not conflict with the next event and resolution uses the immutable report day',()=>{
  const report:any={generated_at:'2026-09-30T12:00:00Z',earnings_analysis:{next_earnings_date:'2026-10-20'},catalysts_and_events:{items:[
    {title:'Past earnings',category:'earnings',date:'2026-07-20',description:''},
    {title:'Next earnings',category:'earnings',date:'2026-10-20',description:''}]}};
  const registry=resolveResearchEvents(report);
  assert.equal(registry.diagnostics.includes('CROSS_SECTION_EARNINGS_DATE_CONFLICT'),false);
  assert.equal(resolveUpcomingEarningsEvent(registry.events,report.generated_at)!.eventDate,'2026-10-20');
  assert.equal(resolveUpcomingEarningsEvent(registry.events,'2026-10-21'),undefined);
  assert.equal(resolveUpcomingEarningsEvent(registry.events,undefined),undefined);
});
test('verified same TTM supports cash earnings and shareholder yield; zero dividends are data',()=>{
  const result=buildResearchIntegrity(fixture());
  assert.equal(result.earningsQuality.classification,'STRONG_CASH_BACKING');
  assert.equal(result.shareholderYield.dividendYieldPct,0);assert.equal(result.shareholderYield.netBuybackYieldPct,0.4);
  assert.equal(result.shareholderYield.totalPct,0.4);
});
test('missing issuance is not zero and negative income does not receive positive cash quality',()=>{
  const report=fixture();delete report.canonical_financials.values['cash_flow.issuance_of_common_stock'];
  report.canonical_financials.values['income_statement.net_income'].forEach((f:any)=>{f.value=-10;});
  const r=buildResearchIntegrity(report);assert.equal(r.shareholderYield.totalPct,null);
  assert.equal(r.earningsQuality.classification,'INSUFFICIENT_DATA');
});
test('financial funding cash flows keep reported amounts without industrial cash-conversion judgments',()=>{
  const report=fixture();report.company_profile={industry:'Banks - Diversified',sector:'Financial Services'};
  report.canonical_financials.values['cash_flow.operating_cash_flow'].forEach((f:any)=>f.value=-200);
  const quality=buildResearchIntegrity(report).earningsQuality;
  assert.equal(quality.classification,'NOT_APPLICABLE');
  assert.equal(quality.metrics.find(m=>m.key==='cash_flow.operating_cash_flow')?.value,-800);
  assert.equal(quality.metrics.find(m=>m.key==='cash_conversion')?.value,null);
  assert.equal(quality.metrics.find(m=>m.key==='cash_conversion')?.reason,'NOT_APPLICABLE_FINANCIAL_FUNDING_ECONOMICS');
});
test('same corporate event cannot have contradictory dates; unconfirmed dates stay estimated',()=>{
  const r=resolveResearchEvents({catalysts_and_events:{items:[
    {event_id:'earnings',title:'Quarterly earnings',category:'earnings',date:'2026-10-01',description:''},
    {event_id:'earnings',title:'Quarterly earnings',category:'earnings',date:'2026-10-02',description:''}]}});
  assert.equal(r.events[0].eventDate,null);assert.equal(r.events[0].eventDateType,'EXPECTED_DATE');
  assert.equal(r.diagnostics[0],'EVENT_DATE_CONFLICT:earnings');
});
const guidance=(date:string,low:number,status='ACTIVE')=>({metricKey:'revenue',guidanceLow:low,guidanceHigh:low+1,fiscalPeriod:'FY 2026',issuedDate:date,
  source:'https://issuer.example/earnings',sourceConfidence:'ISSUER_CONFIRMED',status}) as any;
test('latest authoritative active guidance wins; withdrawal and same-date conflict prevent stale guidance',()=>{
  const old=guidance('2026-02-01',100),fresh=guidance('2026-05-01',120);
  const result=resolveGuidanceRegistry([old,fresh]);assert.equal(result.active[0].guidanceLow,120);
  assert.equal(result.history[0].status,'SUPERSEDED');assert.equal(old.status,'ACTIVE','Inputs remain immutable');
  assert.equal(resolveGuidanceRegistry([old,{...fresh,status:'WITHDRAWN'}]).active.length,0);
  assert.ok(resolveGuidanceRegistry([fresh,{...fresh,guidanceLow:130,guidanceHigh:131}]).diagnostics.length);
  assert.equal(resolveGuidanceRegistry([old,{...fresh,guidanceLow:130}]).active.length,0,'Invalid newest guidance must not resurrect an older active range');
  const closed=resolveGuidanceRegistry([fresh],2026);
  assert.equal(closed.active.length,0);assert.equal(closed.history[0].guidanceLow,120);
  assert.ok(closed.diagnostics.includes('GUIDANCE_PERIOD_CLOSED:revenue|FY 2026'));
});
test('a lower hierarchy reconciles to its parent and period, not an unrelated consolidated total',()=>{
  const nodes=[{id:'subscription',parentId:null,period:'Q1 2026',value:80},{id:'product',parentId:null,period:'Q1 2026',value:20},
    {id:'customer_a',parentId:'subscription',period:'Q1 2026',value:50},{id:'customer_b',parentId:'subscription',period:'Q1 2026',value:30}];
  assert.deepEqual(reconcileRevenueHierarchy(nodes,{'Q1 2026':100}),[]);
  assert.ok(reconcileRevenueHierarchy(nodes.map(n=>n.id==='customer_b'?{...n,period:'Q2 2026'}:n),{'Q1 2026':100}).length);
});
test('headcount denominator mismatch is diagnosable and unavailable scoring confidence is explicit',()=>{
  const report=fixture();report.business_analysis={operational_efficiency:[{period:'FY 2026',headcount:100,headcount_basis:'POINT_IN_TIME',headcount_as_of:'2026-12-31',headcount_source:'https://issuer.example/10k',revenue_per_employee_k_usd:12}]};
  const r=buildResearchIntegrity(report);assert.ok(r.diagnostics.includes('EMPLOYEE_RATIO_DENOMINATOR_BASIS_MISMATCH:FY 2026'));
  assert.equal(r.scoreConfidence,'UNAVAILABLE');
});
test('version compare attributes assumption changes and flags same-run contradictory fair value',()=>{
  const run={inputHash:'a',assumptionHash:'b',modelVersion:'adaptive-valuation-v2',financialSnapshotId:'c',primaryMethod:'FCFF_DCF',baseFairValue:10,inputSnapshot:{revenueM:100},assumptionSnapshot:{waccPct:10}} as any;
  assert.equal(compareCanonicalValuationRuns({canonical_run:run} as any,{canonical_run:{...run,baseFairValue:20}} as any).status,'FAIL');
  const r=compareCanonicalValuationRuns({canonical_run:run} as any,{canonical_run:{...run,assumptionHash:'d',assumptionSnapshot:{waccPct:11}}} as any);
  assert.ok(r.changes.includes('assumptionSnapshot.waccPct'));
});
