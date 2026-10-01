import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {buildSecVerifiedIntegrationPackage} from '../services/sec/secIntegration';
import {selectFinancialMetric} from './selectedFinancialMetric';
import {getMetricInterpretationContext} from './financialMetricContext';
import {canonicalMetricMeaning} from './financialMetricMeaning';
import {metricAssessmentPolicy,metricDeltaTone,selectedMetricAssessment} from './metricAssessmentPolicy';
import {deterministicMetricInsight,verifiedAnalystValidationFailure,type VerifiedAnalystOutput} from './financialAnalystContract';
import {buildVerifiedAnalystPrompt,requestVerifiedMetricAnalyst} from '../../server/services/verifiedMetricAnalyst';
const fs=buildSecVerifiedIntegrationPackage(JSON.parse(readFileSync(new URL('../services/sec/fixtures/verified-completion-2026.json',import.meta.url),'utf8'))).financialStatements!;
function scope(key:string){
  const selected=selectFinancialMetric(fs,key,fs.periods.slice(-4));
  const context=getMetricInterpretationContext({metricKey:key,metricName:selected.definition!.meaning!.name,reportData:fs,periods:selected.periods,historyValues:selected.values,isSourceReconciled:true});
  return{selected,context};
}
const keys=['revenue','gross_margin','operating_expenses','operating_margin','net_income','total_assets','inventory','total_debt','operating_cash_flow','free_cash_flow','roic','current_ratio'];
for(const key of keys)test(`${key}: verified context, evidence policy, distinct teaching and company-first analysis`,async()=>{
  const {selected,context}=scope(key),before=JSON.stringify(selected),meaning=canonicalMetricMeaning(context),evidence=selectedMetricAssessment(selected,context);
  const fallback=deterministicMetricInsight(selected,context);
  assert.equal(fallback.status,'neutral');assert.equal(fallback.what_is_it_th,meaning.th);
  assert.match(meaning.th,/วัดอะไร:.*โดยทั่วไป:.*ควรดูคู่กับ:/s);
  assert.ok(fallback.watchouts_en.includes(evidence.watch.en));
  assert.ok(fallback.interpretation_en.includes(evidence.evidence.en));
  assert.doesNotMatch(fallback.interpretation_en,/^.*(?:is defined as|means|measures)\b/i);
  const prompt=buildVerifiedAnalystPrompt(selected,context),facts=JSON.parse(prompt.slice(prompt.lastIndexOf('\n')+1));
  assert.deepEqual(facts.relatedMetrics,selected.relatedMetrics);assert.equal(facts.assessmentEvidence.policy,evidence.policy);
  const response:VerifiedAnalystOutput={metricKey:key,what_is_it_th:meaning.th,what_is_it_en:meaning.en,synthesis:{th:`ข้อมูลที่ตรวจสอบล่าสุด: ${evidence.evidence.th}`,en:`Accepted current condition: ${evidence.evidence.en}`},strengths:{th:[],en:[]},watchouts:evidence.watch,ruleOfThumb:{th:'ใช้ข้อมูลที่ตรวจสอบและรักษาวิธีคำนวณตามรายการ',en:'Use verified relationships and retain the reported method.'},referencedMetricKeys:[key],status:'neutral',statusLabels:{th:'ดูบริบท',en:'Review context'}};
  // Meaning is educational while all numerical company data stays in selection.
  assert.equal(verifiedAnalystValidationFailure(response,selected),undefined);
  const result=await requestVerifiedMetricAnalyst(selected,context,{provider:async()=>JSON.stringify(response)});
  if (selected.dataQuality.eligibleForAi) {assert.ok(result.output);assert.equal(result.output.what_is_it_en,meaning.en);}
  else assert.equal(result.output,undefined,'Approximate ROIC retains its existing deterministic-only guard');
  assert.equal(JSON.stringify(selected),before,'Assessment cannot replace formulas, signs or verified values');
});

test('context-dependent balances, costs and range metrics cannot acquire a positive badge from sign alone',async()=>{
  for(const key of ['total_assets','inventory','total_debt','capex','current_ratio','quick_ratio','dpo']){
    const {selected,context}=scope(key),isolated={...selected,relatedMetrics:{},currentValue:100,values:[80,90,95,100]};
    const assessment=selectedMetricAssessment(isolated,context);
    assert.equal(assessment.assessment,'unclear',key);
    assert.equal(deterministicMetricInsight(isolated,context).status,'neutral',key);
    assert.deepEqual(deterministicMetricInsight(isolated,context).pros_en,[],key);
    const meaning=canonicalMetricMeaning(context);
    const provider:VerifiedAnalystOutput={metricKey:key,what_is_it_th:meaning.th,what_is_it_en:meaning.en,synthesis:{th:'ข้อมูลล่าสุดยังต้องดูคุณภาพของรายการและผลตอบแทนร่วมกัน',en:'The latest observation needs related quality and return evidence.'},strengths:{th:['ยอดที่มีอยู่'],en:['An existing positive balance.']},watchouts:assessment.watch,ruleOfThumb:{th:'ดูข้อมูลที่เกี่ยวข้อง',en:'Assess related evidence.'},referencedMetricKeys:[key],status:'good',statusLabels:{th:'ดี',en:'Good'}};
    const result=await requestVerifiedMetricAnalyst(isolated,context,{provider:async()=>JSON.stringify(provider)});
    if (isolated.dataQuality.eligibleForAi) {
      assert.ok(result.output,key);assert.equal(result.output.status,'neutral',key);assert.deepEqual(result.output.strengths,{th:[],en:[]},key);
    } else assert.equal(result.output,undefined,'Ineligible approximate metrics must keep the existing guard');
  }
  assert.equal(metricDeltaTone('total_assets',30),'text-stone-500');assert.equal(metricDeltaTone('change_inventory',20),'text-stone-500');
  assert.equal(metricAssessmentPolicy('roic'),'DIRECT_HIGHER_BETTER');assert.equal(metricAssessmentPolicy('current_ratio'),'RANGE_DEPENDENT');
});

test('OCF sees signed working capital and investment shortfall; OPEX sees pressure on margin and revenue',()=>{
  const ocf=scope('operating_cash_flow'),opex=scope('operating_expenses');
  assert.deepEqual(ocf.selected.relatedMetrics.change_receivables,[-907,45,561,-184]);
  assert.deepEqual(ocf.selected.relatedMetrics.change_inventory,[1991,-214,-2255,592]);
  assert.equal(selectedMetricAssessment(ocf.selected,ocf.context).assessment,'mixed');
  assert.match(deterministicMetricInsight(ocf.selected,ocf.context).interpretation_en,/capital spending exceeded.*free cash flow negative/);
  assert.equal(selectedMetricAssessment(opex.selected,opex.context).assessment,'mixed');
  assert.match(deterministicMetricInsight(opex.selected,opex.context).interpretation_en,/does not establish that expenses outgrew revenue/);
  const pressure={...opex.selected,values:[90,100,100,125],relatedMetrics:{...opex.selected.relatedMetrics,revenue:[90,100,100,110],operating_margin:[10,10,10,8]}};
  assert.equal(selectedMetricAssessment(pressure,opex.context).assessment,'unfavorable');
  assert.match(deterministicMetricInsight(pressure,opex.context).interpretation_en,/expenses grew faster than revenue while operating margin compressed/);
});

test('a missing or conflicting companion cannot invalidate a verified direct selected fact or become accepted context',()=>{
  const data=structuredClone(fs),last=data.period_snapshots!.at(-1)!;
  last.rejected['income_statement.operating_income']='Duplicate/conflicting source';
  delete last.observations['income_statement.operating_income'];
  const revenue=selectFinancialMetric(data,'revenue',data.periods.slice(-4));
  assert.equal(revenue.dataQuality.eligibleForAi,true);assert.equal(revenue.currentValue,28236);
  assert.equal(revenue.relatedMetrics.operating_margin,undefined,'Unverified companions cannot enter the analyst observation context');
  assert.equal(selectedMetricAssessment({...scope('total_assets').selected,relatedMetrics:{}},scope('total_assets').context).assessment,'unclear');
});

test('sector guards retain banking, insurance, REIT, SaaS, manufacturer and pre-profit context',()=>{
  for(const businessArchetype of ['industrial_manufacturing','saas_software','bank','lender','insurer','reit','early_stage'] as const){
    const {selected,context}=scope('total_assets'),business={...context,businessArchetype};
    const isolated={...selected,relatedMetrics:{}};
    assert.equal(selectedMetricAssessment(isolated,business).assessment,'unclear');
    assert.equal(deterministicMetricInsight(isolated,business).status,'neutral');
    const facts=JSON.parse(buildVerifiedAnalystPrompt(isolated,business).split('\n').at(-1)!);
    assert.equal(facts.businessArchetype,businessArchetype);
  }
  const {selected,context}=scope('free_cash_flow');
  assert.equal(selectedMetricAssessment(selected,{...context,businessArchetype:'bank',isFinancialSectorGuardActive:true}).assessment,'not_applicable');
});

test('unavailable companions cannot acquire factual trend prose, while explicit limitations and future checks remain valid',()=>{
  const {selected,context}=scope('total_assets'),meaning=canonicalMetricMeaning(context);
  assert.equal(selected.relatedMetrics.roic,undefined,'Approximate ROIC is not an accepted analyst observation');
  const output:VerifiedAnalystOutput={metricKey:'total_assets',what_is_it_th:meaning.th,what_is_it_en:meaning.en,
    synthesis:{th:'ฐานสินทรัพย์เพิ่มพร้อม ROIC และ ROA ปรับตัวลดลง',en:'Assets increased while ROIC and ROA declined.'},
    strengths:{th:[],en:[]},watchouts:{th:'ติดตามประสิทธิภาพทุน',en:'Watch capital efficiency.'},
    ruleOfThumb:{th:'ดูบริบท',en:'Assess accepted relationships.'},referencedMetricKeys:['total_assets'],status:'neutral',statusLabels:{th:'ดูบริบท',en:'Review context'}};
  assert.equal(verifiedAnalystValidationFailure(output,selected),'AI_EVIDENCE_VALIDATION_FAILED');
  output.synthesis={th:'ยังไม่สามารถประเมินแนวโน้ม ROIC จากข้อมูลที่ตรวจสอบได้ ควรติดตาม ROIC เมื่อมีข้อมูลเพิ่ม',en:'ROIC is unavailable, so its trend cannot be assessed. Watch whether ROIC improves when verified data becomes available.'};
  assert.equal(verifiedAnalystValidationFailure(output,selected),undefined);
  output.synthesis={th:'ฐานสินทรัพย์ยังต้องดูรายการที่เกี่ยวข้อง',en:'The asset base needs companion evidence.'};
  output.strengths.en=['ROIC improved and supports capital efficiency.'];
  assert.equal(verifiedAnalystValidationFailure(output,selected),'AI_EVIDENCE_VALIDATION_FAILED');
});

test('mixed contextual relationships do not force strengths; numeric rejection still precedes presentation policy',async()=>{
  const {selected,context}=scope('operating_cash_flow'),meaning=canonicalMetricMeaning(context);
  const response:VerifiedAnalystOutput={metricKey:selected.metricKey,what_is_it_th:meaning.th,what_is_it_en:meaning.en,
    synthesis:{th:'เงินสดดำเนินงานเป็นบวก แต่รายจ่ายฝ่ายทุนสูงกว่าและ FCF ติดลบ',en:'Operating cash is positive, but capital spending exceeds it and FCF is negative.'},
    strengths:{th:['เงินสดที่เป็นบวกดีต่อกิจการ'],en:['Positive operating cash is a strength.']},watchouts:{th:'ติดตามเงินสดหลังลงทุน',en:'Watch post-investment cash.'},
    ruleOfThumb:{th:'ประเมินรายการที่เกี่ยวข้อง',en:'Assess related evidence.'},referencedMetricKeys:['operating_cash_flow','capex','free_cash_flow'],status:'good',statusLabels:{th:'ดี',en:'Good'}};
  const accepted=await requestVerifiedMetricAnalyst(selected,context,{provider:async()=>JSON.stringify(response)});
  assert.equal(accepted.output?.status,'neutral');assert.deepEqual(accepted.output?.strengths,{th:[],en:[]});
  response.strengths.en=['Unsupported amount 987654321.'];
  const rejected=await requestVerifiedMetricAnalyst(selected,context,{provider:async()=>JSON.stringify(response)});
  assert.equal(rejected.fallbackReason,'AI_NUMERIC_VALIDATION_FAILED');assert.equal(rejected.output,undefined);
});
