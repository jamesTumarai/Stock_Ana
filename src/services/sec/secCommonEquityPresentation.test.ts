import assert from 'node:assert/strict';
import {test} from 'node:test';
import {attachCommonEquityFromVerifiedPresentation} from './secCommonEquityPresentation';
import {verifiedFixtureFromStatements} from '../../domain/__tests__/verifiedFixtureBuilder';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {buildSecVerifiedIntegrationPackage} from './secIntegration';
import {resolveFundamentalMetrics} from '../../domain/valuation/metricRegistry';
import {resolveAdaptiveValuationRun} from '../../domain/valuation/adaptiveValuationPolicy';

const fixture=()=>{
  const ds=verifiedFixtureFromStatements({periods:['Q2 2026'],income_statement:{revenue:[50]},
    balance_sheet:{stockholders_equity:[100],total_assets:[200],total_liabilities:[100]},cash_flow:{}} as any);
  ds.ticker='UNKNOWN';
  delete ds.values['balance_sheet.common_equity']; // Exercise source recovery, not the synthetic fixture convention.
  const fact=(name:string,value:number)=>`<ix:nonfraction name="us-gaap:${name}" contextRef="c" unitRef="usd" scale="6" decimals="-6" ${value<0?'sign="-"':''}>${Math.abs(value)}</ix:nonfraction>`;
  const row=(name:string,value:number)=>`<tr><td>${name}</td><td>${fact(name,value)}</td></tr>`;
  const html=`<xbrli:context id="c"><xbrli:entity><xbrli:identifier>1</xbrli:identifier></xbrli:entity><xbrli:period><xbrli:instant>2026-06-30</xbrli:instant></xbrli:period></xbrli:context>
    <xbrli:unit id="usd"><xbrli:measure>iso4217:USD</xbrli:measure></xbrli:unit>
    <table><tr><td>Total assets</td></tr><tr><td>Total liabilities</td></tr>
    ${row('CommonStockValue',10)}${row('AdditionalPaidInCapital',110)}${row('AccumulatedOtherComprehensiveIncomeLossNetOfTax',2)}${row('RetainedEarningsAccumulatedDeficit',-22)}${row('StockholdersEquity',100)}</table>`;
  const bundle:any={identity:{ticker:'UNKNOWN',cik:'1'},filingDocuments:[{documentUrl:'https://www.sec.gov/Archives/edgar/data/1/test/filing.htm',accession:'test',filingDate:'2026-08-01',html}]};
  return {ds,bundle,row};
};
test('a complete common-capital bridge recovers equity without manufacturing zero preferred equity',()=>{
  const {ds,bundle}=fixture(),before=JSON.stringify(ds);
  const result=attachCommonEquityFromVerifiedPresentation(ds,bundle);
  const equity=result.values['balance_sheet.common_equity'][0];
  assert.equal(equity.value,100);assert.equal(equity.verification,'verified');
  assert.equal(equity.type,'derived');assert.equal(equity.sourceComponents?.length,4);
  assert.equal(equity.canonicalMetric,'common_equity');
  assert.ok(equity.sourceComponents!.every(component=>component.canonicalMetric===undefined));
  assert.equal(equity.mappingEvidence?.policy,'COMPLETE_COMMON_CAPITAL_BRIDGE');
  assert.equal(result.values['balance_sheet.preferred_equity'],undefined);
  assert.equal(JSON.stringify(ds),before);
});
test('incomplete, ambiguous, foreign or incompatible bridges cannot recover common equity',()=>{
  for(const change of ['missing','other','preferred','foreign','duration','currency','mismatch','identity','duplicate']){
    const {ds,bundle,row}=fixture();let html=bundle.filingDocuments[0].html;
    if(change==='missing')html=html.replace(row('RetainedEarningsAccumulatedDeficit',-22),'');
    if(change==='other')html=html.replace(row('StockholdersEquity',100),row('OtherEquity',0)+row('StockholdersEquity',100));
    if(change==='preferred')html=html.replace('<table>','<table><tr><td>Preferred stock</td></tr>');
    if(change==='foreign')bundle.identity.cik='2';
    if(change==='duration')html=html.replaceAll('xbrli:instant','xbrli:endDate');
    if(change==='currency')html=html.replace('iso4217:USD','iso4217:EUR');
    if(change==='mismatch')html=html.replace(row('StockholdersEquity',100),row('StockholdersEquity',105));
    if(change==='identity')bundle.identity.ticker='OTHER';
    if(change==='duplicate')html=html.replace(row('AdditionalPaidInCapital',110),row('AdditionalPaidInCapital',110)+row('AdditionalPaidInCapital',111));
    bundle.filingDocuments[0].html=html;
    assert.equal(attachCommonEquityFromVerifiedPresentation(ds,bundle).values['balance_sheet.common_equity']?.[0]?.value??null,null,change);
  }
});
test('reported zero is a component; omission of that component is not zero',()=>{
  const {ds,bundle,row}=fixture();
  bundle.filingDocuments[0].html=bundle.filingDocuments[0].html.replace(row('AccumulatedOtherComprehensiveIncomeLossNetOfTax',2),row('AccumulatedOtherComprehensiveIncomeLossNetOfTax',0)).replace(row('RetainedEarningsAccumulatedDeficit',-22),row('RetainedEarningsAccumulatedDeficit',-20));
  assert.equal(attachCommonEquityFromVerifiedPresentation(ds,bundle).values['balance_sheet.common_equity'][0].value,100);
  bundle.filingDocuments[0].html=bundle.filingDocuments[0].html.replace(row('AccumulatedOtherComprehensiveIncomeLossNetOfTax',0),'');
  assert.equal(attachCommonEquityFromVerifiedPresentation(ds,bundle).values['balance_sheet.common_equity']?.[0]?.value??null,null);
});
test('captured public common-capital statements restore source-derived ROE and enable an equity model',()=>{
  const capture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/verified-common-capital-public-2026-09-30.json.gz',import.meta.url))).toString());
  const pkg=buildSecVerifiedIntegrationPackage(capture.bundle),ds=pkg.canonicalFinancials!;
  const report:any={ticker:ds.ticker,company_profile:{sector:'Financial Services',industry:'Fintech - Consumer Finance'},
    canonical_financials:ds,financial_statements:pkg.financialStatements,
    sec_verification:{ticker:ds.ticker,dcf_financial_inputs:{generated_by:'sec-verified-financial-inputs-v1',ticker:ds.ticker,
      current_shares_outstanding_m:pkg.shareSnapshot!.currentCommonSharesOutstanding!.sharesM,share_as_of:pkg.shareSnapshot!.currentCommonSharesOutstanding!.end}},
    // Explicit TEST assumptions, not source facts or company forecasts.
    intrinsic_value:{ddm_model:{assumptions:{cost_of_equity_pct:10,terminal_growth_pct:3}}}};
  const metrics=resolveFundamentalMetrics(report,ds.ticker);
  assert.equal(ds.values['balance_sheet.common_equity'].at(-1)?.value,11076.227);
  assert.equal(metrics.roe.status,'CALCULATED');assert.ok(Math.abs(metrics.roe.value!-7.09)<0.01);
  assert.equal(metrics.roe.reasonTh,undefined);assert.equal(metrics.roe.reason,undefined);
  assert.equal(metrics.roe.inputsUsed?.commonNetIncomeTtm,636.264);
  const run=resolveAdaptiveValuationRun(report);
  assert.equal(run.primaryMethod,'RESIDUAL_INCOME');assert.ok(run.baseFairValue!>0);
  assert.match(run.fallbackReason!,/SOTP/);
  assert.deepEqual(resolveAdaptiveValuationRun(structuredClone(report)),run);
});
