import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mapSecBundleToCanonicalFinancials,type SecCompanyBundleLike} from './secFinancialMapper';
import {attachVerifiedOperatingSegments} from './secOperatingSegments';
import {attachReportedEarningsTableFacts} from './secStatementCompletion';
import {attachSecResearchEvidence} from './secResearchEvidence';
import {resolveIssuerNonGaapTtm} from '../../domain/issuerNonGaapTtm';
import {resolveResearchEvents,buildResearchIntegrity} from '../../domain/reportResearchIntegrity';

function bundle():SecCompanyBundleLike {
  const facts=(value:number)=>[1,2,3,4].map(q=>({start:'2026-01-01',end:['2026-03-31','2026-06-30','2026-09-30','2026-12-31'][q-1],val:value*q*1e6,fy:2026,fp:q===4?'FY':`Q${q}`,form:q===4?'10-K':'10-Q',filed:'2027-02-01',accn:`quarter-${q}`}));
  const concept=(value:number)=>({units:{USD:facts(value)}});
  return {identity:{cik:'0000123456',ticker:'GENERIC',title:'Generic issuer'},retrievedAt:'2027-02-02T00:00:00Z',
    submissions:{cik:'0000123456',filings:{recent:{accessionNumber:[1,2,3,4].map(q=>`quarter-${q}`),primaryDocument:[1,2,3,4].map(q=>`filing-${q}.htm`),form:['10-Q','10-Q','10-Q','10-K'],filingDate:['2027-02-01','2027-02-01','2027-02-01','2027-02-01']}}},
    companyFacts:{cik:123456,facts:{'us-gaap':{Revenues:concept(100),SellingAndMarketingExpense:concept(20),GeneralAndAdministrativeExpense:concept(10),ResearchAndDevelopmentExpenseSoftwareExcludingAcquiredInProcessCost:concept(5)}}},filingDocuments:[]} as SecCompanyBundleLike;
}
const doc=(html:string)=>({html,accession:'quarter-4',documentUrl:'https://www.sec.gov/Archives/edgar/data/123456/quarter4/exhibit.htm',form:'8-K',filingDate:'2027-02-01'});
test('expense scope and SG&A component derivation are period-true and missing is not zero',()=>{
  const b=bundle(),ds=mapSecBundleToCanonicalFinancials(b)!;
  assert.equal(ds.values['income_statement.research_and_development'],undefined);
  assert.deepEqual(ds.values['income_statement.research_and_development_excluding_acquired'].map(f=>f.value),[5,5,5,5]);
  assert.deepEqual(ds.values['income_statement.selling_general_administrative'].map(f=>f.value),[30,30,30,30]);
  delete b.companyFacts.facts!['us-gaap'].GeneralAndAdministrativeExpense;
  assert.equal(mapSecBundleToCanonicalFinancials(b)!.values['income_statement.selling_general_administrative'],undefined);
});
test('direct SG&A disclosure wins over component derivation',()=>{
  const b=bundle(),gaap=b.companyFacts.facts!['us-gaap'];
  gaap.SellingGeneralAndAdministrativeExpense={units:{USD:gaap.SellingAndMarketingExpense.units.USD.map(f=>({...f,val:f.val*2}))}};
  assert.deepEqual(mapSecBundleToCanonicalFinancials(b)!.values['income_statement.selling_general_administrative'].map(f=>f.value),[40,40,40,40]);
});
test('operating segment context never contaminates consolidated statements and conflicting parts are suppressed',()=>{
  const b=bundle(),ds=mapSecBundleToCanonicalFinancials(b)!;
  const html='<xbrli:unit id="usd"><xbrli:measure>iso4217:USD</xbrli:measure></xbrli:unit><xbrli:context id="segment"><xbrli:entity><xbrli:identifier>123456</xbrli:identifier><xbrli:segment><xbrldi:explicitMember dimension="us-gaap:StatementBusinessSegmentsAxis">issuer:PlatformMember</xbrldi:explicitMember></xbrli:segment></xbrli:entity><xbrli:period><xbrli:startDate>2026-10-01</xbrli:startDate><xbrli:endDate>2026-12-31</xbrli:endDate></xbrli:period></xbrli:context><ix:nonfraction name="us-gaap:Revenues" contextRef="segment" unitRef="usd" scale="6">60</ix:nonfraction>';
  b.filingDocuments=[doc(html)];const mapped=attachVerifiedOperatingSegments(ds,b);
  assert.equal(mapped.values['income_statement.revenue'].at(-1)!.value,100);assert.equal(mapped.operatingSegments![0].values['income_statement.revenue'][0].value,60);
  b.filingDocuments=[doc(html+html.match(/<ix:nonfraction[\s\S]+/)![0].replace('>60<','>70<'))];
  const conflict=attachVerifiedOperatingSegments(ds,b);assert.equal(conflict.operatingSegments!.length,0);assert.ok(conflict.provenanceWarnings.some(w=>w.code==='SEGMENT_FACT_CONFLICT'));
});
test('filed AFFO and FFO quarters stay separate and use the canonical TTM aggregator',()=>{
  const b=bundle(),ds=mapSecBundleToCanonicalFinancials(b)!;
  b.filingDocuments=[doc('<table><tr><th>USD in millions</th><th>Q1 2026</th><th>Q2 2026</th><th>Q3 2026</th><th>Q4 2026</th></tr><tr><td>AFFO</td><td>10</td><td>11</td><td>12</td><td>13</td></tr><tr><td>FFO</td><td>15</td><td>16</td><td>17</td><td>18</td></tr></table>')];
  const mapped=attachReportedEarningsTableFacts(ds,b);assert.equal(resolveIssuerNonGaapTtm(mapped,'AFFO')?.value,46);assert.equal(resolveIssuerNonGaapTtm(mapped,'FFO')?.value,66);
  assert.equal(mapped.values['income_statement.affo'],undefined,'Issuer non-GAAP cannot replace GAAP statement values');
  mapped.issuerReportedNonGaap=mapped.issuerReportedNonGaap!.filter(f=>f.period!=='Q2 2026');assert.equal(resolveIssuerNonGaapTtm(mapped,'AFFO'),null);
});
test('independent filing evidence confirms guidance while model confirmation flags alone do not',()=>{
  const b=bundle(),ds=mapSecBundleToCanonicalFinancials(b)!;
  b.filingDocuments=[doc('<table><tr><th>Revenue outlook ($ in millions)</th><th>FY 2027 guidance</th></tr><tr><td>Total revenue</td><td>450 - 500</td></tr></table>')];
  const independent=attachSecResearchEvidence(ds,b);
  assert.equal(independent.verifiedManagementGuidance![0].guidanceLow,450);
  assert.equal(buildResearchIntegrity({ticker:'GENERIC',canonical_financials:independent}).activeGuidance[0].guidanceHigh,500);
  const fake={catalysts_and_events:{items:[{date:'2027-02-01',title:'Launch',description:'',category:'product',issuer_confirmed:true,source_confidence:'ISSUER_CONFIRMED',source:doc('').documentUrl,date_type:'EVENT_DATE'}]}} as any;
  assert.equal(resolveResearchEvents(fake).events[0].issuerConfirmed,false);
  assert.equal(buildResearchIntegrity({ticker:'GENERIC',management_guidance_history:independent.verifiedManagementGuidance}).activeGuidance.length,0);
});
