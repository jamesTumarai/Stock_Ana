import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {buildSecVerifiedIntegrationPackage} from './secIntegration';
import {mapSecBundleToCanonicalFinancials} from './secFinancialMapper';
import {normalizeDurationFactsToStandaloneQuarters} from './xbrlNormalizer';
import {workingCapitalCashEffect,formatWorkingCapitalCashEffect} from '../../domain/workingCapitalSemantics';
import {selectFinancialMetric,formatMetricChange,metricPeriodChanges} from '../../domain/selectedFinancialMetric';
import {getMetricInterpretationContext} from '../../domain/financialMetricContext';
import {buildVerifiedAnalystPrompt} from '../../../server/services/verifiedMetricAnalyst';
import {commonParentIncomeAlias,STATEMENT_SEMANTIC_LABELS} from '../../domain/statementSemanticLabels';
import {buildVerifiedStatementPeriods} from '../../domain/verifiedFinancialStatements';
import {verifiedMetricSeries} from '../../domain/financialSynthesisGuard';
import {aggregateQuarterlyToAnnual} from '../../utils/statementAggregation';
const fixture=()=>JSON.parse(readFileSync(new URL('./fixtures/verified-completion-2026.json',import.meta.url),'utf8'));
const pkg=()=>buildSecVerifiedIntegrationPackage(fixture());

test('old unqualified working-capital signs fail closed without invalidating other accepted statement lines',()=>{
  const canonical=structuredClone(pkg().canonicalFinancials!);
  for(const key of ['change_receivables','change_inventory','change_payables']) for(const value of canonical.values[`cash_flow.${key}`]||[]) delete value.valueSemantic;
  const snapshots=buildVerifiedStatementPeriods(canonical);
  const latest=snapshots.at(-1)!;
  assert.equal(latest.observations['cash_flow.change_inventory'],undefined);
  assert.equal(latest.observations['cash_flow.change_receivables'],undefined);
  assert.equal(latest.observations['cash_flow.operating_cash_flow'].value,4697);
  assert.equal(latest.observations['income_statement.revenue'].value,28236);
  const old=pkg().financialStatements!;
  for(const snapshot of old.period_snapshots!) for(const key of ['change_receivables','change_inventory','change_payables']) {
    const observation=snapshot.observations[`cash_flow.${key}`]; if(observation) delete observation.valueSemantic;
  }
  assert.deepEqual(verifiedMetricSeries(old,'change_inventory',old.periods.slice(-4)),[null,null,null,null]);
  assert.deepEqual(verifiedMetricSeries(old,'operating_cash_flow',old.periods.slice(-4)),[6238,3813,3937,4697]);
  const annual=aggregateQuarterlyToAnnual(old)!;
  assert.ok(annual);
  assert.ok(annual.period_snapshots!.every(snapshot=>!snapshot.observations['cash_flow.change_inventory']));
  const acceptedAnnual=aggregateQuarterlyToAnnual(pkg().financialStatements!)!;
  assert.ok(acceptedAnnual.period_snapshots!.some(snapshot=>snapshot.observations['cash_flow.change_inventory']?.valueSemantic==='CASH_FLOW_EFFECT'));
});

test('filed working-capital sequence has cash-effect signs through normalization, canonical table, formatting and Gemini',()=>{
  const p=pkg(), fs=p.financialStatements!;
  for(const [key,expected,display] of [
    ['change_receivables',[-907,45,561,-184],['-907M','+45M','+561M','-184M']],
    ['change_inventory',[1991,-214,-2255,592],['+1.991B','-214M','-2.255B','+592M']],
  ] as const){
    const canonical=p.canonicalFinancials!.values[`cash_flow.${key}`].slice(-4);
    assert.deepEqual(canonical.map(v=>v.value),expected);
    assert.ok(canonical.every(v=>v.valueSemantic==='CASH_FLOW_EFFECT'&&v.signNormalization?.multiplier===-1));
    assert.deepEqual(fs.cash_flow[key]!.slice(-4),expected);
    assert.deepEqual(expected.map(formatWorkingCapitalCashEffect),display);
    const selected=selectFinancialMetric(fs,key,fs.periods.slice(-4));
    assert.deepEqual(selected.values,expected);
    const context=getMetricInterpretationContext({metricKey:key,metricName:key,reportData:fs,periods:selected.periods,historyValues:selected.values,isSourceReconciled:true});
    const prompt=buildVerifiedAnalystPrompt(selected,context),facts=JSON.parse(prompt.slice(prompt.lastIndexOf('\n')+1));
    assert.deepEqual(facts.values,expected);assert.equal(facts.valueSemantic,'CASH_FLOW_EFFECT');
    assert.match(canonical[1].derivation!,/FY minus Q3 YTD/);
    assert.match(canonical[3].derivation!,/6M cumulative - 3M cumulative/);
  }
  assert.deepEqual(fs.cash_flow.operating_cash_flow.slice(-4),[6238,3813,3937,4697]);
  assert.deepEqual(fs.cash_flow.capex.slice(-4),[-2248,-2393,-2493,-5789]);
  assert.deepEqual(fs.cash_flow.free_cash_flow!.slice(-4),[3990,1420,1444,-1092]);
  assert.deepEqual(fs.income_statement.eps_diluted!.slice(-4),[0.39,0.24,0.13,0.32]);
  assert.deepEqual(fs.balance_sheet.net_ppe!.slice(-4),[39407,40643,43213,47255]);
  assert.deepEqual(fs.validation_summary!.failed_guards,[]);
});

test('generic positive and negative cumulative quarters convert once, preserving already signed effects and concept compatibility',()=>{
  const values=[10,-35,20,15],cumulative=values.map((_,i)=>values.slice(0,i+1).reduce((a,b)=>a+b,0));
  const facts=cumulative.map((val,i)=>({val,start:'2025-01-01',end:['2025-03-31','2025-06-30','2025-09-30','2025-12-31'][i],fy:2025,fp:['Q1','Q2','Q3','FY'][i],form:i===3?'10-K':'10-Q',accn:`fixture-${i}`,sourceUnit:'USD',sourceConcept:'us-gaap:IncreaseDecreaseInInventories',valueSemantic:'BALANCE_CHANGE' as const}));
  const normalized=normalizeDurationFactsToStandaloneQuarters(facts);
  assert.deepEqual(normalized.map(f=>f.value),values);
  assert.deepEqual(normalized.map(f=>workingCapitalCashEffect('IncreaseDecreaseInInventories',f.value)!.value),values.map(v=>-v));
  assert.deepEqual(normalized.map(f=>workingCapitalCashEffect('IncreaseDecreaseInInventories',f.value,'CASH_FLOW_EFFECT')!.value),values);
  assert.equal(workingCapitalCashEffect('IncreaseDecreaseInAccountsPayable',35)!.value,35);
  assert.equal(workingCapitalCashEffect('UnknownAccount',35),null);
  const mismatched=structuredClone(facts);mismatched[1].sourceConcept='other';
  assert.equal(normalizeDurationFactsToStandaloneQuarters(mismatched).some(f=>f.fiscalQuarter===2),false);
  const mixed=structuredClone(facts) as any[];mixed[1].valueSemantic='CASH_FLOW_EFFECT';
  assert.equal(normalizeDurationFactsToStandaloneQuarters(mixed).some(f=>f.fiscalQuarter===2),false);
  const already=fixture();
  for(const name of ['IncreaseDecreaseInAccountsReceivable','IncreaseDecreaseInInventories']) for(const f of already.companyFacts.facts['us-gaap'][name].units.USD){f.val=-f.val;f.valueSemantic='CASH_FLOW_EFFECT';}
  assert.deepEqual(mapSecBundleToCanonicalFinancials(already)!.values['cash_flow.change_receivables'].slice(-4).map(v=>v.value),[-907,45,561,-184]);
});

test('exact annual goodwill note survives omission only with unchanged same-date anchors, never forward-filled or restated',()=>{
  const p=pkg(),fs=p.financialStatements!;
  assert.deepEqual(fs.balance_sheet.goodwill!.slice(-4),[257,257,null,null]);
  const value=p.canonicalFinancials!.values['balance_sheet.goodwill'].find(v=>v.period==='Q4 2025')!;
  assert.equal(value.periodEnd,'2025-12-31');assert.equal(value.form,'10-K');
  assert.match(value.derivation!,/Exact-date authoritative note/);assert.match(value.source!.documentUrl!,/20251231/);
  const changed=fixture();
  const latest=changed.companyFacts.facts['us-gaap'].Assets.units.USD.filter(f=>f.end==='2025-12-31').sort((a,b)=>b.filed.localeCompare(a.filed))[0];
  latest.val+=1000000000;
  assert.equal(mapSecBundleToCanonicalFinancials(changed)!.values['balance_sheet.goodwill'].find(v=>v.period==='Q4 2025')!.value,null);
});

test('income dedup requires source identity, not amount; preferred/common and total scopes remain distinct',()=>{
  const fs=pkg().financialStatements!,periods=fs.periods.slice(-4);
  assert.equal(commonParentIncomeAlias(fs,periods),true);
  const different=structuredClone(fs);different.period_snapshots!.at(-1)!.observations['income_statement.net_income_common'].concept='NetIncomeLossAvailableToCommonStockholdersBasic';
  delete different.period_snapshots!.at(-1)!.observations['income_statement.net_income_common'].sourceComponents;
  assert.equal(commonParentIncomeAlias(different,periods),false,'Identical numbers from distinct attribution concepts cannot merge');
  const preferred=structuredClone(fs);preferred.period_snapshots!.at(-1)!.observations['income_statement.net_income_common'].value!-=1;
  assert.equal(commonParentIncomeAlias(preferred,periods),false);
  assert.notEqual(fs.income_statement.net_income.at(-1),fs.income_statement.net_income_common!.at(-1));
  assert.equal(STATEMENT_SEMANTIC_LABELS.other_income.en,'Other Income (Expense), Net');
  assert.match(STATEMENT_SEMANTIC_LABELS.aoci.en,/Accumulated Other Comprehensive Income/);
  assert.doesNotMatch(STATEMENT_SEMANTIC_LABELS.equity_compensation_and_option_proceeds.en,/Compensation/);
  assert.doesNotMatch(STATEMENT_SEMANTIC_LABELS.icf.en,/Continuing/);
});

test('synthetic investment-interest concept remains separate from interest expense and other income',()=>{
  const bundle=fixture(),facts=bundle.companyFacts.facts['us-gaap'];
  const expense=facts.InterestExpenseNonoperating||facts.InterestExpense;
  assert.ok(expense?.units.USD);
  facts.InvestmentIncomeInterest={units:{USD:expense.units.USD.map(f=>({...f,val:f.val*2}))}};
  const financials=buildSecVerifiedIntegrationPackage(bundle).financialStatements!;
  assert.deepEqual(financials.income_statement.interest_income?.slice(-4),[152,170,184,162]);
  assert.deepEqual(financials.income_statement.interest_expense?.slice(-4),[76,85,92,81]);
  assert.deepEqual(financials.income_statement.other_income?.slice(-4),[-28,-592,-535,590]);
});

test('ratio formulas retain common-income qualification and pp/days/x units with canonical ROIC',()=>{
  const fs=pkg().financialStatements!;
  assert.match(fs.indicator_details!.net_margin.at(-1)!.formula,/Common net income/);
  assert.match(fs.indicator_details!.fcf_to_net_income.at(-1)!.formula,/common net income/);
  assert.equal(fs.indicator_details!.roic.at(-1)!.formula,'TTM operating income × (1 - Tax rate) / Average (Stockholders equity + Debt - Cash - STI) × 100');
  assert.equal(formatMetricChange('operating_margin',-0.41),'-0.41 pp');
  assert.equal(formatMetricChange('dso',-10),'-10.00D');
  assert.equal(formatMetricChange('current_ratio',0.4),'+0.40x');
  assert.deepEqual(metricPeriodChanges('dso',[40,30],['Q2 2025','Q2 2026'],'yoy'),[null,-10]);
});
