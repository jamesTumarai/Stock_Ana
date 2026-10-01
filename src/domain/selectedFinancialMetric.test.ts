import { METRIC_MEANING_REGISTRY } from './financialMetricMeaning';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {buildSecVerifiedIntegrationPackage} from '../services/sec/secIntegration';
import {selectFinancialMetric,metricPeriodChanges,formatMetricChange,financialMetricDataIdentity} from './selectedFinancialMetric';
import {validateVerifiedAnalystOutput,MetricRequestSequence,analystCacheKey,deterministicMetricInsight} from './financialAnalystContract';
import {getMetricInterpretationContext} from './financialMetricContext';
const fixture=()=>JSON.parse(readFileSync(new URL('../services/sec/fixtures/verified-completion-2026.json',import.meta.url),'utf8'));
const statements=()=>buildSecVerifiedIntegrationPackage(fixture()).financialStatements!;
test('rates use pp; zero baselines remain valid for absolute deltas; money retains relative percent',()=>{
  assert.deepEqual(metricPeriodChanges('operating_margin',[17.24,16.83],['Q2 2025','Q2 2026'],'yoy'),[null,-0.41]);
  assert.equal(formatMetricChange('operating_margin',-0.41),'-0.41 pp');
  assert.deepEqual(metricPeriodChanges('gross_margin',[0,4],['Q1 2025','Q1 2026'],'yoy'),[null,4]);
  assert.equal(metricPeriodChanges('revenue',[100,150],['Q1 2025','Q1 2026'],'yoy')[1],50);
  assert.equal(metricPeriodChanges('revenue',[0,150],['Q1 2025','Q1 2026'],'yoy')[1],null);
  assert.equal(formatMetricChange('nim',metricPeriodChanges('nim',[2.9,3.1],['Q1 2025','Q1 2026'],'yoy')[1]),'+20.00 bps');
});
test('days, multiple, per-share and annual changes retain own semantics; gaps never compare adjacent slots',()=>{
  const periods=['Q1 2025','Q1 2026'];
  assert.equal(formatMetricChange('dso',metricPeriodChanges('dso',[40,30],periods,'yoy')[1]),'-10.00D');
  assert.equal(formatMetricChange('current_ratio',metricPeriodChanges('current_ratio',[1.3,1.7],periods,'yoy')[1]),'+0.40x');
  assert.equal(formatMetricChange('eps',metricPeriodChanges('eps',[0.2,0.3],periods,'yoy')[1]),'+0.10 / share');
  assert.equal(metricPeriodChanges('revenue',[100,150],['FY2025','FY2026'],'yoy')[1],50);
  assert.equal(metricPeriodChanges('operating_margin',[10,20],['Q1 2025','Q3 2025'],'qoq')[1],null);
});
test('Gross Margin → Operating Margin → Revenue → Assets → OCF → ROIC selection follows its own accepted series',()=>{
  const fs=statements(),periods=fs.periods.slice(-4);
  const selected=['gross_margin','operating_margin','revenue','total_assets','ocf','roic'].map(key=>selectFinancialMetric(fs,key,periods));
  assert.deepEqual(selected.map(m=>m.metricKey),['gross_margin','operating_margin','revenue','total_assets','ocf','roic']);
  assert.notDeepEqual(selected[0].values,selected[1].values);
  assert.equal(selected[2].currentValue,28236);assert.equal(selected[3].currentValue,148524);assert.equal(selected[4].currentValue,4697);
  assert.equal(selected[5].currentValue,fs.indicator_details?.roic.at(-1)?.value);
  for(const m of selected.slice(0,5)) assert.equal(m.dataQuality.eligibleForAi,true);
});
test('global partial/failed unrelated coverage preserves selected verified margin; relevant conflict blocks it',()=>{
  const fs=statements();fs.quality_status='partial';fs.validation_summary!.reconciliation_status='failed';
  fs.validation_summary!.failed_guards=['BALANCE_SHEET_IMBALANCE: Q2 2026'];
  assert.equal(selectFinancialMetric(fs,'operating_margin',fs.periods.slice(-4)).dataQuality.eligibleForAi,true);
  assert.equal(selectFinancialMetric(fs,'total_assets',fs.periods.slice(-4)).dataQuality.status,'CONFLICT');
  fs.period_snapshots!.at(-1)!.rejected['income_statement.operating_income']='Duplicate/conflicting source';
  assert.equal(selectFinancialMetric(fs,'operating_margin',fs.periods.slice(-4)).dataQuality.eligibleForAi,false);
});
test('unverified or mutated legacy arrays cannot become authoritative selected facts; conflict matching is exact',()=>{
  const fs=statements(),periods=fs.periods.slice(-4);
  fs.income_statement.revenue[fs.periods.length-1]=987654;
  assert.equal(selectFinancialMetric(fs,'revenue',periods).currentValue,28236);
  fs.verified_dataset!.provenanceWarnings.push({code:'INLINE_SOURCE_CONFLICT',severity:'warning',message:'cash_flow.distributions_to_noncontrolling_interests: Q2 2026; conflict'});
  assert.equal(selectFinancialMetric(fs,'total_assets',periods).dataQuality.eligibleForAi,true,'Cash-flow text is not a conflict in the cash asset');
  delete fs.verified_dataset;
  assert.deepEqual(selectFinancialMetric(fs,'revenue',periods).values,[null,null,null,null]);
});
test('one verified period gives current-only deterministic explanation and no live AI eligibility',()=>{
  const fs=statements(),m=selectFinancialMetric(fs,'operating_margin',[fs.periods.at(-1)!]);
  assert.equal(m.dataQuality.eligibleForAi,false);
  const context=getMetricInterpretationContext({metricKey:m.metricKey,metricName:'Operating Margin',reportData:fs,periods:m.periods,historyValues:m.values,isSourceReconciled:true});
  const fallback=deterministicMetricInsight(m,context);assert.equal(fallback.engine,'DETERMINISTIC');assert.match(fallback.interpretation_en,/trend cannot be established/);
  assert.equal(selectFinancialMetric(fs,'profitability_heading',m.periods).dataQuality.reasonCode,'UNSUPPORTED_METRIC');
  assert.equal(selectFinancialMetric(fs,'capital_stock',m.periods).currentValue,null,'Capital Stock cannot alias a narrower Common Stock observation');
});
test('output contract rejects stale metric keys, fabricated values, references and accounting overrides',()=>{
  const fs=statements(),m=selectFinancialMetric(fs,'revenue',fs.periods.slice(-4));
  const output={metricKey:'revenue',what_is_it_th:METRIC_MEANING_REGISTRY.revenue.th,what_is_it_en:METRIC_MEANING_REGISTRY.revenue.en,synthesis:{th:'รายได้ 28,236M',en:'Revenue 28.236B'},strengths:{th:[],en:[]},watchouts:{th:'ตรวจธุรกิจ',en:'Review context'},ruleOfThumb:{th:'ดูคู่กำไร',en:'Compare with sourced profits'},referencedMetricKeys:['revenue'],status:'neutral',statusLabels:{th:'ข้อมูลตรวจสอบได้',en:'Verified data'}};
  assert.equal(validateVerifiedAnalystOutput(output,m),true);
  assert.equal(validateVerifiedAnalystOutput({...output,metricKey:'gross_margin'},m),false);
  assert.equal(validateVerifiedAnalystOutput({...output,synthesis:{th:'Revenue 987654',en:'Revenue 987654'}},m),false);
  assert.equal(validateVerifiedAnalystOutput({...output,currentValue:999},m),false);
  assert.equal(validateVerifiedAnalystOutput({...output,synthesis:{th:'2026 M',en:'Revenue 2026 M'}},m),false,'A fiscal year cannot become a fabricated accounting amount');
  assert.equal(validateVerifiedAnalystOutput({...output,synthesis:{th:'Q2 2026: 28236M',en:'Q2 2026: 28236M'}},m),true);
  assert.equal(validateVerifiedAnalystOutput({...output,referencedMetricKeys:['not_in_context']},m),false);
});
test('request generations reject delayed A after B and after unmount; cache changes with filings/values/data',async()=>{
  const sequence=new MetricRequestSequence(),a=sequence.next(),b=sequence.next();
  await new Promise(resolve=>setTimeout(resolve,2));assert.equal(sequence.accepts(a),false);assert.equal(sequence.accepts(b),true);
  sequence.invalidate();assert.equal(sequence.accepts(b),false);
  const fs=statements(),m=selectFinancialMetric(fs,'revenue',fs.periods.slice(-4));
  const first=financialMetricDataIdentity(fs),key=analystCacheKey('TSLA',m,true);
  fs.verified_dataset!.values['income_statement.revenue'].at(-1)!.source!.retrievedAt='2099-01-01';
  assert.equal(financialMetricDataIdentity(fs),first);
  fs.verified_dataset!.values['income_statement.revenue'].at(-1)!.accession='changed-filing';
  assert.notEqual(financialMetricDataIdentity(fs),first);
  assert.notEqual(analystCacheKey('TSLA',selectFinancialMetric(fs,'revenue',m.periods),true),key);
});
