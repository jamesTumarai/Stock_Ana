import assert from 'node:assert/strict';
import {test} from 'node:test';
import {verifiedFixtureFromStatements} from './verifiedFixtureBuilder';
import {resolveAdaptiveValuationRun} from '../valuation/adaptiveValuationPolicy';
import {buildMethodSensitivity} from '../valuation/methodSensitivity';
import {adaptSecCanonicalToFinancialStatements} from '../../services/sec/secLegacyAdapter';
import {resolveRevenueLevel,auditReportRevenueHierarchy} from '../revenueHierarchy';
import {resolveCanonicalShareholderYield} from '../canonicalShareholderYield';
import {summarizeInsiderExecutions} from '../insiderEventSemantics';
import {resolveValuationDispersion} from '../valuationDispersion';
import {compareResearchVersions} from '../reportVersionCompare';
import {attachSecResearchEvidence} from '../../services/sec/secResearchEvidence';
import {resolveResearchEvents,buildResearchIntegrity} from '../reportResearchIntegrity';

/** Explicit synthetic economics, NOT observations of the named companies.
 * Names exercise generic routing only. Live/source-capture tests are separate. */
const fixture=(ticker:string,industry:string,sector:string)=>{
 const fill=(n:number)=>Array(5).fill(n),ds=verifiedFixtureFromStatements({periods:['Q2 2025','Q3 2025','Q4 2025','Q1 2026','Q2 2026'],
 income_statement:{revenue:fill(25),net_income:fill(4),net_income_common:fill(4),operating_income:fill(6)},
 balance_sheet:{total_assets:fill(200),total_liabilities:fill(100),total_equity:fill(100),stockholders_equity:fill(100),common_equity:fill(100),total_debt:fill(10),cash_and_equivalents:fill(10),short_term_investments:fill(0)},
 cash_flow:{operating_cash_flow:fill(5),capex:fill(1),free_cash_flow:fill(4),dividends_common:fill(0),repurchase_of_common_stock:fill(2),issuance_of_common_stock:fill(1)}} as any);
 ds.ticker=ticker;
 return {ticker,generated_at:'2026-09-30T00:00:00Z',summary:'Fixture',company_profile:{sector,industry},canonical_financials:ds,financial_statements:adaptSecCanonicalToFinancialStatements(ds),
 market_snapshot:{ticker,price:100,dataKind:'market_quote',provider:'Independent test quote',marketCapRaw:1e9},
 sec_verification:{ticker,dcf_financial_inputs:{generated_by:'sec-verified-financial-inputs-v1',ticker,share_as_of:'2026-07-15',current_shares_outstanding_m:1}},
 intrinsic_value:{ddm_model:{assumptions:{cost_of_equity_pct:10,terminal_growth_pct:3}},dcf_model:{inputs:{isValid:true},assumptions:{wacc_pct:10,terminal_growth_pct:3,projection_years:5},scenarios:{bear:{revenue_cagr_pct:2,terminal_margin_pct:10},base:{revenue_cagr_pct:5,terminal_margin_pct:16},bull:{revenue_cagr_pct:8,terminal_margin_pct:20}}}}} as any;
};
const matrix=[
 ['ADBE','Software - Application','Technology','FCFF_DCF'],['TSLA','Auto Manufacturers','Consumer Cyclical','FCFF_DCF'],
 ['NVDA','Semiconductors','Technology','FCFF_DCF'],['MSFT','Software - Infrastructure','Technology','FCFF_DCF'],['AAPL','Consumer Electronics','Technology','FCFF_DCF'],
 ['GOOGL','Internet Content & Information','Communication Services','FCFF_DCF'],['META','Internet Content & Information','Communication Services','FCFF_DCF'],
 ['AMZN','Internet Retail','Consumer Cyclical','FCFF_DCF'],['PLTR','Software - Infrastructure','Technology','FCFF_DCF'],['CRM','Software - Application','Technology','FCFF_DCF'],
 ['SOFI','Fintech - Consumer Finance','Financial Services','SOTP'],['HOOD','Capital Markets - Brokerage','Financial Services','SOTP'],
 ['JPM','Banks - Diversified','Financial Services','RESIDUAL_INCOME'],['BAC','Banks - Diversified','Financial Services','RESIDUAL_INCOME'],
 ['CB','Insurance - Property & Casualty','Financial Services','RESIDUAL_INCOME'],['O','REIT - Retail','Real Estate','AFFO_MULTIPLE'],
 ['BRK.B','Diversified Holding Company','Financial Services','SOTP'],['CAT','Farm & Heavy Construction Machinery','Industrials','FCFF_DCF'],
 ['UNH','Healthcare Plans','Healthcare','FCFF_DCF'],['RIVN','Biotechnology','Healthcare','PEER_EV_SALES'],['COST','Discount Stores','Consumer Defensive','FCFF_DCF']
];
for(const [ticker,industry,sector,method]of matrix)test(`synthetic routing/determinism ${ticker}: ${method}`,()=>{
 const report=fixture(ticker,industry,sector),ds=report.canonical_financials;
 if(method==='SOTP'){
  ds.operatingSegments=[['First',0.6],['Second',0.4]].map(([name,weight])=>({id:name,name,axis:'SegmentsAxis',member:name,values:{'income_statement.revenue':ds.values['income_statement.revenue'].map((v:any)=>({...v,value:v.value*Number(weight)}))}}));
  report.intrinsic_value.sotp_model={components:ds.operatingSegments.map((s:any)=>({name:s.name,segmentId:s.id,financialMetric:'income_statement.revenue',inputBasis:'TTM',valuationMultiple:2,valuationBasis:'EQUITY'})),corporateAdjustments:-10};
 }
 if(method==='AFFO_MULTIPLE')ds.issuerReportedNonGaap=ds.values['income_statement.revenue'].slice(-4).map((f:any)=>({metric:'companyReportedAFFO',value:1,unit:'USD_M',period:f.period,periodStart:f.periodStart,periodEnd:f.periodEnd,source:{...f.source,filingDate:'2026-08-01'},verification:'ISSUER_REPORTED_NON_GAAP'}));
 if(method==='PEER_EV_SALES'){
  for(const key of ['income_statement.net_income','income_statement.net_income_common','cash_flow.free_cash_flow','cash_flow.operating_cash_flow'])ds.values[key].forEach((f:any)=>f.value=-1);
  report.financial_statements=adaptSecCanonicalToFinancialStatements(ds);
 }
 if(['AFFO_MULTIPLE','PEER_EV_SALES'].includes(method))report.peer_comparison={peers:[2,3,4].map(n=>({ticker:`PX${n}`,companyName:`Observed ${n}`,archetype:method==='AFFO_MULTIPLE'?'reit':'biotech',industry,sector,subIndustry:industry,revenueModels:['product_sales'],majorBusinessLines:[industry],geography:'US',lifecycle:'growth',profitabilityState:'profitable',capitalIntensity:'moderate',regulatoryType:'standard',scaleTier:'mid',metrics:{[method==='AFFO_MULTIPLE'?'p_affo_multiple':'ev_sales']:{value:n,unit:'x',period:'TTM Q2 2026',source:'Yahoo independent quote + SEC source snapshot',status:'VERIFIED',reportedOrDerived:'DERIVED'}}}))};
 const first=resolveAdaptiveValuationRun(report),second=resolveAdaptiveValuationRun(structuredClone(report));
 assert.equal(first.primaryMethod,method);assert.ok(first.baseFairValue!>0);assert.deepEqual(second,first);assert.equal(first.inputCoverage?.available,first.inputCoverage?.required);
 const grid=buildMethodSensitivity(first);if(grid)assert.equal(grid.values[grid.baseRow][grid.baseColumn],first.baseFairValue);
 report.intrinsic_value.ddm_model.assumptions.cost_of_equity_pct=11;report.intrinsic_value.dcf_model.assumptions.wacc_pct=11;
 if(method==='SOTP')report.intrinsic_value.sotp_model.components[0].valuationMultiple=3;
 const changed=resolveAdaptiveValuationRun(report);
 if(!['AFFO_MULTIPLE','PEER_EV_SALES'].includes(method)){assert.notEqual(changed.assumptionHash,first.assumptionHash);assert.notEqual(changed.baseFairValue,first.baseFairValue);}
});
test('bank common equity and current-share evidence cannot be guessed from total equity or bare numeric envelopes',()=>{
 const report=fixture('GEN','Banks - Diversified','Financial Services');
 delete report.canonical_financials.values['balance_sheet.common_equity'];report.financial_statements=adaptSecCanonicalToFinancialStatements(report.canonical_financials);
 assert.equal(resolveAdaptiveValuationRun(report).baseFairValue,null);
 const operating=fixture('GEN','Software','Technology');delete operating.sec_verification.dcf_financial_inputs.share_as_of;
 assert.equal(resolveAdaptiveValuationRun(operating).baseFairValue,null);
});
test('hierarchy drilldown keeps parents separate and binds reconciliation to the exact canonical period',()=>{
 const items=[{id:'sub',name:'Subscription',revenue_usd:80,ratio_pct:80},{id:'product',name:'Product',revenue_usd:20,ratio_pct:20},{id:'a',parent_id:'sub',name:'A',revenue_usd:50,ratio_pct:50},{id:'b',parent_id:'sub',name:'B',revenue_usd:30,ratio_pct:30}];
 assert.equal(resolveRevenueLevel(items,'Q2 2026',null).items.length,2);
 const child=resolveRevenueLevel(items,'Q2 2026','sub');assert.deepEqual(child.items.map(i=>i.ratio_pct),[62.5,37.5]);
 const report=fixture('GEN','Software','Technology');report.business_analysis={revenue_breakdown:{period:'TTM Q2 2026',by_business:items}};
 assert.deepEqual(auditReportRevenueHierarchy(report),[]);report.business_analysis.revenue_breakdown.period='TTM Q1 2025';assert.ok(auditReportRevenueHierarchy(report).length);
});
test('cash yield preserves disclosed zero, rejects wrong identity and never treats unknown issuance as zero',()=>{
 const report=fixture('GEN','Software','Technology');assert.equal(resolveCanonicalShareholderYield(report).totalPct,0.4);
 report.canonical_financials.ticker='WRONG';assert.equal(resolveCanonicalShareholderYield(report).totalPct,null);
 report.canonical_financials.ticker='GEN';delete report.canonical_financials.values['cash_flow.issuance_of_common_stock'];assert.equal(resolveCanonicalShareholderYield(report).totalPct,null);
});
test('zero-share plans/gifts/withholding/vesting are not insider purchases or executed sales',()=>{
 const types=[['plan adoption',0],['planned sale',0],['gift',30],['tax withholding',20],['RSU vesting',10],['sell',0],['sell',12],['buy',5]];
 assert.deepEqual(summarizeInsiderExecutions(types.map(([transaction_type,shares_count])=>({transaction_type,shares_count,date:'2026-09-30',insider_name:'Test'})) as any),{purchases:1,sales:1,plans:2,other:4});
});
test('dispersion neither averages external estimates nor fills missing external assumptions',()=>{
 const report=fixture('GEN','Software','Technology');report.intrinsic_value.canonical_run=resolveAdaptiveValuationRun(report);
 report.morningstar_research={has_coverage:true,fair_value_estimate:200,fair_value_date:'2026-09-01'};
 report.forecast_dashboard={price_target:{mean:300},as_of_date:'2026-09-02'};
 const before=JSON.stringify(report),rows=resolveValuationDispersion(report);assert.equal(rows.length,4);assert.equal(JSON.stringify(report),before);
 assert.match(rows[2].basis,/not established/);
});
test('version compare shows financial facts and saved report thesis without mutating the older version',()=>{
 const before=fixture('GEN','Software','Technology'),after=structuredClone(before);before.verdict={summary:'Old thesis',key_takeaways:[],conviction_score:60};after.verdict={summary:'New thesis',key_takeaways:[],conviction_score:62};
 after.canonical_financials.values['income_statement.revenue'].at(-1).value=30;
 const snapshot=JSON.stringify(before),result=compareResearchVersions(before,after);assert.ok(result.rows.some(row=>row.key==='Financial fact: income_statement.revenue'));assert.ok(result.rows.some(row=>row.key==='Report thesis'));assert.equal(JSON.stringify(before),snapshot);
});
test('business KPI source tables require explicit period/units and keep ARR separate from GAAP revenue',()=>{
 const report=fixture('GEN','Software','Technology');
 const bundle={identity:{cik:'1'},retrievedAt:'2026-09-30T00:00:00Z',filingDocuments:[{documentUrl:'https://www.sec.gov/Archives/edgar/data/1/fixture/source.htm',filingDate:'2026-08-01',accession:'fixture',form:'8-K',html:'<table><caption>USD in millions</caption><tr><th>Metric</th><th>Q2 2026</th></tr><tr><td>Annual recurring revenue</td><td>120</td></tr><tr><td>Net interest margin</td><td>3.5%</td></tr></table>'}]} as any;
 const ds=attachSecResearchEvidence(report.canonical_financials,bundle);assert.equal(ds.verifiedBusinessKpis?.find(k=>k.key==='arr')?.value,120);assert.equal(ds.values['income_statement.revenue'].at(-1)?.value,25);
 bundle.filingDocuments[0].html=bundle.filingDocuments[0].html.replace('USD','EUR');assert.equal(attachSecResearchEvidence(report.canonical_financials,bundle).verifiedBusinessKpis?.some(k=>k.key==='arr'),false);
});
test('source event dates keep their own type despite conflicting model labels; share history uses compatible point-in-time dates',()=>{
 const report=fixture('GEN','Software','Technology'),source='https://www.sec.gov/Archives/edgar/data/1/fixture/source.htm';
 report.canonical_financials.verifiedResearchEvents=[{eventId:'filing',eventType:'filing',eventDate:'2026-08-01',eventDateType:'FILING_DATE',source,issuerConfirmed:true}];
 report.catalysts_and_events={items:[{event_id:'filing',category:'filing',date:'2026-08-01',date_type:'EVENT_DATE',title:'Filing',description:'',source}]};assert.equal(resolveResearchEvents(report).events[0].eventDateType,'FILING_DATE');
 report.canonical_financials.commonShareObservations=[{sharesM:1,end:'2025-07-15',source:{documentUrl:source}},{sharesM:1.1,end:'2026-07-15',source:{documentUrl:source}}];
 assert.equal(buildResearchIntegrity(report).capitalAllocation.find(m=>m.key==='net_common_share_count_change_pct')?.value,10);
});
