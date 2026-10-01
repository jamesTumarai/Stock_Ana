import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveBusinessClassification } from './financialMetricContext';

test('primary property services override investment-management subsidiaries and a contradictory REIT template',()=>{
  const report:any={company_profile:{sector:'Real Estate',industry:'Real Estate Services',
    description:'Facilities and property advisory services; an investment management subsidiary serves real estate investment trusts.'},
    financial_statements:{statement_template:'reit'}};
  const classification=resolveBusinessClassification(report);
  assert.equal(classification.primaryArchetype,'general_operating');
  assert.ok(classification.secondaryBusinessLines.includes('investment_management'));
  assert.ok(classification.evidence.conflictingSignals.some(signal=>signal.includes('REIT template rejected')));
});
test('sector-only real estate and references to REIT clients cannot establish issuer REIT economics',()=>{
  for(const description of ['', 'Advisory services for real estate investment trusts.']){
    assert.notEqual(resolveBusinessClassification({company_profile:{sector:'Real Estate',description}}).primaryArchetype,'reit');
  }
  assert.equal(resolveBusinessClassification({company_profile:{sector:'Real Estate',industry:'REIT - Industrial'}}).primaryArchetype,'reit');
  assert.equal(resolveBusinessClassification({company_profile:{description:'The company operates as a real estate investment trust.'}}).primaryArchetype,'reit');
});
test('explicit multi-sector holding descriptions use conglomerate economics rather than a financial subsidiary',()=>{
  assert.equal(resolveBusinessClassification({company_profile:{sector:'Financial Services',industry:'Multi-Sector Holdings & Financials'}}).primaryArchetype,'conglomerate');
});
