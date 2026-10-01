import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateFinancialStatements,detectStatementTemplate} from '../../statementValidator';
import type {FinancialStatementsData} from '../../../types';

const fixture = (): FinancialStatementsData => ({
  periods:['Q1 2026'], income_statement:{revenue:[1000],net_income:[100]},
  balance_sheet:{total_assets:[5000],total_liabilities:[3000],total_equity:[2000],cash_and_equivalents:[1000]},
  cash_flow:{operating_cash_flow:[120],capex:[20],free_cash_flow:[100]},
});
test('a balanced equation is partial when source and cash reconciliation are absent',()=>{
  const r=validateFinancialStatements(fixture());
  assert.equal(r.is_balanced,true); assert.equal(r.reconciliation_status,'partial');
  assert.equal(r.impossible_guards_passed,false); assert.equal(r.ratio_reliability_warning,true);
  assert.equal(r.filing_source,undefined); assert.equal(r.filing_date,undefined);
});
test('filing labels carry the actual URL and filing date without claiming numeric verification',()=>{
  const f=fixture();f.source={document_url:'https://www.sec.gov/Archives/example.htm',document_type:'10-Q',filing_date:'2026-05-01'};
  const r=validateFinancialStatements(f);assert.equal(r.filing_source,'10-Q · https://www.sec.gov/Archives/example.htm');
  assert.equal(r.reconciliation_status,'partial');
});
test('hard balance failure suppresses return-ratio reliability',()=>{
  const f=fixture();f.balance_sheet.total_liabilities=[2000];
  const r=validateFinancialStatements(f);assert.equal(r.is_balanced,false);assert.equal(r.reconciliation_status,'failed');
  assert.ok(r.failed_guards?.some(g=>g.includes('BALANCE_SHEET_IMBALANCE')));assert.ok(r.flagged_metrics?.roe);
});
test('assets cannot be smaller than disclosed cash or banking deposits',()=>{
  for(const key of ['cash_and_equivalents','deposits'] as const){
    const f=fixture();f.balance_sheet[key]=[6000]; const r=validateFinancialStatements(f,'banking');
    assert.equal(r.reconciliation_status,'failed');assert.equal(r.impossible_guards_passed,false);
  }
});
test('NCI is included once in combined equity, with mezzanine separately',()=>{
  const f=fixture();f.balance_sheet.total_equity=[1980];f.balance_sheet.stockholders_equity=[1900];
  f.balance_sheet.noncontrolling_interest=[80];f.balance_sheet.redeemable_noncontrolling_interest=[20];
  const r=validateFinancialStatements(f);assert.equal(r.discrepancy_amount?.[0],0);
  assert.equal(r.is_balanced,true);assert.equal(r.reconciliation_components?.[0].noncontrollingInterest,80);
  assert.equal(r.reconciliation_status,'partial','Matching candidate equation does not verify mezzanine presentation scope');
  assert.equal(r.reconciliation_components?.[0].redeemableScopeUnresolved,1);
});
test('a disclosed parent-equity equation may reconcile without inventing consolidated equity or NCI',()=>{
  const f=fixture();delete f.balance_sheet.total_equity;f.balance_sheet.stockholders_equity=[2000];
  const r=validateFinancialStatements(f);assert.equal(r.discrepancy_amount?.[0],0);assert.equal(r.reconciliation_status,'partial');
  assert.equal(r.is_balanced,true);assert.equal(f.balance_sheet.total_equity,undefined);
  assert.equal(f.balance_sheet.noncontrolling_interest,undefined);
  assert.ok(r.passed_guards?.some(g=>g.startsWith('REPORTED_PARENT_BALANCE_EQUATION_OK_SCOPE_PARTIAL')));
  f.balance_sheet.stockholders_equity=[1900];
  const missingScope=validateFinancialStatements(f);
  assert.equal(missingScope.reconciliation_status,'unavailable');
  assert.equal(missingScope.failed_guards?.length,0,'Undisclosed NCI might explain a parent-scope delta; do not claim failure');
});
test('FCF contradicting its OCF and CapEx inputs is a hard failure',()=>{
  const f=fixture();f.cash_flow.free_cash_flow=[80];const r=validateFinancialStatements(f);
  assert.ok(r.failed_guards?.some(g=>g.includes('FCF_IDENTITY_MISMATCH')));
});
test('restricted cash beginning/change/ending and activity plus FX reconciliations are distinct checks',()=>{
  const f=fixture();Object.assign(f.cash_flow,{beginning_cash:[100],ending_cash:[105],net_change_cash:[5],investing_cash_flow:[-100],financing_cash_flow:[-20],exchange_rate_effect:[5]});
  let r=validateFinancialStatements(f);assert.ok(r.passed_guards?.some(g=>g.includes('CASH_RECONCILIATION_OK')));
  assert.ok(r.passed_guards?.some(g=>g.includes('CASH_FLOW_ACTIVITY_RECONCILIATION_OK')));
  f.cash_flow.exchange_rate_effect=[0];r=validateFinancialStatements(f);
  assert.ok(r.failed_guards?.some(g=>g.includes('CASH_FLOW_ACTIVITY_RECONCILIATION_FAILED')));
});
test('zero goodwill and a linear history do not trigger issuer-specific fabrication or M&A assumptions',()=>{
  const f=fixture();f.balance_sheet.goodwill=[0];
  for(const ticker of ['SOFI','TSLA','UNKNOWN']){
    const r=validateFinancialStatements(f,'standard',{ticker},ticker);
    assert.equal(r.failed_guards?.length,0);assert.equal(r.reconciliation_status,'partial');
  }
});
test('business model controls sector applicability; ticker and broad Financial Services do not force banking',()=>{
  const cases=[['Technology','Semiconductors','standard'],['Financial Services','Banks - Regional','banking'],['Financial Services','Payment Processing','standard'],['Financial Services','Property & Casualty Insurance','insurance'],['Real Estate','Industrial REIT','reit'],['Healthcare','Biotechnology','biotech'],['Energy','Oil & Gas','cyclical']];
  for(const [sector,industry,template] of cases)assert.equal(detectStatementTemplate({company_profile:{sector,industry}} as any),template);
  assert.equal(detectStatementTemplate({ticker:'SOFI',company_profile:{sector:'Financial Services'}} as any),'standard');
});
