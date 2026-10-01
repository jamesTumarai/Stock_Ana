import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectValuationModel } from './modelSelector';

test('long-runway selection depends on latest disclosed growth, not ticker membership or first quarter', () => {
  const report: any = {company_profile:{sector:'Technology',industry:'Enterprise Software'},
    financial_statements:{periods:['Q1 2026','Q2 2026'],income_statement:{revenue:[100,110],net_income:[10,12],yoy_revenue_growth_pct:[50,10]},cash_flow:{free_cash_flow:[8,9]}}};
  const first = detectValuationModel(report, 'TSLA'), other = detectValuationModel(report,'GENERIC');
  assert.equal(first.model_type, other.model_type);
  assert.notEqual(first.model_type, 'dcf_multistage');
  report.financial_statements.income_statement.yoy_revenue_growth_pct = [10,50];
  assert.equal(detectValuationModel(report,'GENERIC').model_type,'dcf_multistage');
});

test('maturity and space policy follows disclosed business context for previously known and unseen symbols',()=>{
  const generic:any={company_profile:{sector:'Technology',industry:'Enterprise Software'}};
  assert.equal(detectValuationModel(generic,'VZ').model_type,detectValuationModel(generic,'UNSEEN').model_type);
  const telecom:any={company_profile:{industry:'Radiotelephone Communications'}};
  assert.equal(detectValuationModel(telecom,'UNSEEN').model_type,'dcf_gordon');
  const early:any={company_profile:{industry:'Enterprise Software'},financial_statements:{income_statement:{},cash_flow:{free_cash_flow:[-2,-1]}}};
  assert.equal(detectValuationModel(early,'RKLB').model_name_en,detectValuationModel(early,'UNSEEN').model_name_en);
});
