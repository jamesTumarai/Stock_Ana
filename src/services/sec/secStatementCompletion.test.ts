import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {buildSecVerifiedIntegrationPackage} from './secIntegration';
import {mapSecBundleToCanonicalFinancials} from './secFinancialMapper';
import {attachReportedEarningsTableFacts,completeBundleFromInlineStatements,parseFilingInlineFacts} from './secStatementCompletion';
import {selectFinancialMetric} from '../../domain/selectedFinancialMetric';
import {calculateVerifiedKeyIndicators} from '../../domain/verifiedKeyIndicators';
const fixture=()=>JSON.parse(readFileSync(new URL('./fixtures/verified-completion-2026.json',import.meta.url),'utf8'));
test('primary consolidated total deficit includes disclosed other equity; it is not reconstructed as parent plus NCI',()=>{
  const b=fixture(),accession='0000000001-26-000001',end='2026-06-30';
  b.companyFacts.facts={'us-gaap':{Revenues:{units:{USD:[{val:1e6,start:'2026-04-01',end,fy:2026,fp:'Q2',form:'10-Q',accn:accession,filed:'2026-08-01'}]}}}};
  const context=`<xbrli:context id="current"><xbrli:entity><xbrli:identifier>${b.identity.cik}</xbrli:identifier></xbrli:entity><xbrli:period><xbrli:instant>${end}</xbrli:instant></xbrli:period></xbrli:context><xbrli:unit id="USD"><xbrli:measure>iso4217:USD</xbrli:measure></xbrli:unit>`;
  const row=(label:string,concept:string,value:number)=>`<tr><td>${label}</td><td><ix:nonfraction name="${concept}" contextRef="current" unitRef="USD" scale="6" decimals="-6" ${value<0?'sign="-"':''}>${Math.abs(value)}</ix:nonfraction></td></tr>`;
  b.filingDocuments=[{documentUrl:`https://www.sec.gov/Archives/edgar/data/${Number(b.identity.cik)}/000000000126000001/financials.htm`,accession,form:'10-Q',filingDate:'2026-08-01',html:context+'<table><tr><td>Consolidated shareholders equity</td></tr>'+row('Total assets','us-gaap:Assets',50)+row('Total liabilities','us-gaap:Liabilities',80)+row('Parent equity','us-gaap:StockholdersEquity',-40)+row('Noncontrolling interest','us-gaap:MinorityInterest',5)+row('Share application money','unknown:ShareApplicationMoney',5)+row('Total deficit','unknown:ConsolidatedTotalDeficitIncludingOtherEquity',-30)+'</table>'}];
  const pkg=buildSecVerifiedIntegrationPackage(b),ds=pkg.canonicalFinancials!;
  const total=ds.values['balance_sheet.total_equity'].find(v=>v.periodEnd===end)!;
  assert.equal(total.value,-30);assert.equal(total.verification,'verified');
  assert.match(total.source!.documentUrl!,/financials.htm/);
  assert.equal(total.sourceConcept,'unknown:ConsolidatedTotalDeficitIncludingOtherEquity');
  assert.equal(pkg.financialStatements!.validation_summary!.failed_guards.includes('BALANCE_SHEET_IMBALANCE'),false);
  // The extra equity component is not asserted to be common equity or cash.
  assert.notEqual(ds.values['balance_sheet.common_equity']?.at(-1)?.value,-30);
});
test('actual filed Q4 GAAP EPS and net PPE are completed without EPS subtraction or capex inference',()=>{
  const b=fixture(),before=mapSecBundleToCanonicalFinancials({...b,filingDocuments:[]})!,pkg=buildSecVerifiedIntegrationPackage(b),fs=pkg.financialStatements!;
  assert.equal(before.values['income_statement.eps_diluted'].find(v=>v.period==='Q4 2025')!.value,null);
  assert.deepEqual(fs.income_statement.eps_diluted!.slice(-4),[0.39,0.24,0.13,0.32]);
  assert.deepEqual(fs.balance_sheet.net_ppe!.slice(-4),[39407,40643,43213,47255]);
  const eps=pkg.canonicalFinancials!.values['income_statement.eps_diluted'].find(v=>v.period==='Q4 2025')!;
  assert.equal(eps.type,'reported');assert.match(eps.source!.documentUrl!,/exhibit991.htm/);assert.match(eps.derivation!,/Never FY minus YTD/);
});
test('non-GAAP Adjusted EBITDA stays separate; impairment-inclusive D&A cannot become Derived EBITDA',()=>{
  const p=buildSecVerifiedIntegrationPackage(fixture()),fs=p.financialStatements!;
  assert.deepEqual(fs.cash_flow.depreciation_amortization_and_impairment!.slice(-4),[1625,1643,1590,1619]);
  assert.equal(fs.indicator_details!.ebitda_margin.at(-1)!.value,null);
  assert.equal(p.canonicalFinancials!.issuerReportedNonGaap!.find(v=>v.metric==='companyReportedAdjustedEbitda'&&v.period==='Q4 2025')!.value,4154);
  assert.ok(p.canonicalFinancials!.issuerReportedNonGaap!.every(v=>v.verification==='ISSUER_REPORTED_NON_GAAP'));
  assert.equal(p.canonicalFinancials!.completionAudit!.find(v=>v.metric==='cash_flow.depreciation'&&v.period==='Q2 2026')!.reasonCode,'COMBINED_IMPAIRMENT_COMPONENT_NOT_SEPARABLE');
});
test('filing details populate gross and net debt cash flows; cash beginning/ending use exact same restricted/disposal basis',()=>{
  const p=buildSecVerifiedIntegrationPackage(fixture()),fs=p.financialStatements!;
  assert.deepEqual(fs.cash_flow.debt_issuance_payments!.slice(-4),[513,606,801,-44]);
  assert.deepEqual(fs.cash_flow.beginning_cash!.slice(-4),[16735,19584,17616,17655]);
  for(const b of p.canonicalFinancials!.cashFlowCashBalances!){
    assert.equal(Date.parse(b.startDate)-Date.parse(b.beginningSource.periodEnd!),86400000);
    assert.equal(b.endingSource.periodEnd,b.endDate);assert.match(b.basis,/RESTRICTED_CASH/);
  }
  assert.deepEqual(fs.validation_summary!.failed_guards,[]);
  assert.deepEqual(fs.balance_sheet.current_debt_and_finance_leases!.slice(-4),[1924,1640,1447,1418]);
  assert.equal(fs.balance_sheet.noncurrent_debt_and_finance_leases!.at(-1),7924);
  assert.deepEqual(fs.cash_flow.distributions_to_noncontrolling_interests!.slice(-4),[-20,-22,-70,-21],'Cash distribution rows must not be replaced by amounts in an equity rollforward');
});
test('rounded tax note matches source precision and equity rollforward distributions cannot contaminate cash flow',()=>{
  const b=fixture(),p=buildSecVerifiedIntegrationPackage(b),fs=p.financialStatements!;
  const source=b.filingDocuments.find(d=>d.documentUrl.includes('tsla-20251231'));
  const tax=parseFilingInlineFacts(source.html,b.identity.cik).filter(f=>f.concept==='us-gaap:IncomeTaxExpenseBenefit'&&f.end==='2025-12-31');
  assert.ok(tax.some(f=>f.value===1420000000&&f.roundingTolerance===5000000));
  assert.equal(fs.income_statement.income_tax_expense?.find((_,i)=>fs.periods[i]==='Q4 2025'),325);
  assert.equal(p.canonicalFinancials!.provenanceWarnings.some(w=>w.code==='INLINE_SOURCE_CONFLICT'),false);
  assert.equal(selectFinancialMetric(fs,'total_assets',fs.periods.slice(-4)).dataQuality.eligibleForAi,true);
});
test('incompatible/dimensional/non-USD inline facts do not fill a US-GAAP metric',()=>{
  const b=fixture(),doc=b.filingDocuments.find((d:any)=>d.html.includes('Property, plant'));
  assert.ok(parseFilingInlineFacts(doc.html,b.identity.cik).length);
  assert.equal(parseFilingInlineFacts(doc.html,'999999999').length,0);
  const mapped=mapSecBundleToCanonicalFinancials(b)!;
  for(const d of b.filingDocuments)d.html=d.html.replaceAll('iso4217:USD','iso4217:EUR');
  const completed=completeBundleFromInlineStatements(b,mapped);
  assert.equal(buildSecVerifiedIntegrationPackage(completed).financialStatements!.balance_sheet.net_ppe!.at(-1),null);
});
test('annual-only IFRS issuer supports selected-metric analyst without synthetic quarters / USD relabeling',()=>{
  const b=JSON.parse(readFileSync(new URL('./fixtures/verified-ifrs-annual-2026.json',import.meta.url),'utf8'));
  const p=buildSecVerifiedIntegrationPackage(b),fs=p.financialStatements!;
  assert.equal(fs.currency,'TWD');assert.equal(fs.fiscal_period_type,'annual');assert.ok(fs.periods.every(p=>p.startsWith('FY')));
  assert.equal(fs.income_statement.revenue.at(-1),2894307.7);
  assert.ok(fs.period_snapshots!.every(p=>p.periodType==='annual'&&p.currency==='TWD'));
  assert.equal(selectFinancialMetric(fs,'revenue',fs.periods.slice(-4)).dataQuality.eligibleForAi,true);
  assert.equal(selectFinancialMetric(fs,'operating_margin',fs.periods.slice(-4)).dataQuality.eligibleForAi,true);
  assert.equal(p.dcfCoverage.eligible,false);assert.ok(p.dcfCoverage.issues.some(i=>i.code==='SEC_NON_USD_VALUATION_UNAVAILABLE'));
  assert.deepEqual(fs.validation_summary!.failed_guards,[]);
  assert.equal(calculateVerifiedKeyIndicators(fs).roe.at(-1)!.value,null);
});
test('pure sourced D&A is normalized standalone and permits Derived EBITDA, separately from issuer adjustments',()=>{
  const capture=JSON.parse(readFileSync(new URL('./fixtures/verified-da-components-2026.json',import.meta.url),'utf8'));
  const fs=buildSecVerifiedIntegrationPackage(capture).financialStatements!;
  const i=fs.periods.length-1,da=fs.cash_flow.depreciation?.[i];assert.equal(typeof da,'number');
  const expected=Math.round((fs.income_statement.operating_income![i]!+da!)/fs.income_statement.revenue[i]! *10000)/100;
  assert.equal(fs.indicator_details!.ebitda_margin[i].value,expected);
  assert.match(fs.indicator_details!.ebitda_margin[i].formula,/Derived EBITDA/);
});
test('accretion-inclusive duration facts remain separate and cannot substitute for pure D&A',()=>{
  const capture=JSON.parse(readFileSync(new URL('./fixtures/verified-da-components-2026.json',import.meta.url),'utf8'));
  const taxonomy=capture.companyFacts.facts['us-gaap'];
  taxonomy.DepreciationAmortizationAndAccretionNet=taxonomy.Depreciation||taxonomy.AmortizationOfIntangibleAssets;
  delete taxonomy.Depreciation;delete taxonomy.AmortizationOfIntangibleAssets;
  const fs=buildSecVerifiedIntegrationPackage(capture).financialStatements!;
  assert.equal(typeof fs.cash_flow.depreciation_amortization_and_accretion!.at(-1),'number');
  assert.equal(fs.cash_flow.depreciation?.at(-1)??null,null);
  assert.equal(fs.indicator_details!.ebitda_margin.at(-1)!.value,null);
  assert.equal(fs.verified_dataset!.completionAudit!.find(v=>v.metric==='cash_flow.depreciation'&&v.period===fs.periods.at(-1))!.reasonCode,'COMBINED_ACCRETION_COMPONENT_NOT_SEPARABLE');
});
