import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {buildSecVerifiedIntegrationPackage} from '../../../src/services/sec/secIntegration';
import {selectFinancialMetric} from '../../../src/domain/selectedFinancialMetric';
import {getMetricInterpretationContext} from '../../../src/domain/financialMetricContext';
import {requestVerifiedMetricAnalyst,buildVerifiedAnalystPrompt} from '../verifiedMetricAnalyst';
import {canonicalMetricMeaning} from '../../../src/domain/financialMetricMeaning';
import {resolveMetricAnalysisModel} from '../metricAnalysisModel';
const fs=buildSecVerifiedIntegrationPackage(JSON.parse(readFileSync(new URL('../../../src/services/sec/fixtures/verified-completion-2026.json',import.meta.url),'utf8'))).financialStatements!;
const selected=selectFinancialMetric(fs,'operating_margin',fs.periods.slice(-4));
const context=getMetricInterpretationContext({metricKey:selected.metricKey,metricName:'Operating Margin',reportData:fs,historyValues:selected.values,periods:selected.periods,isSourceReconciled:true});
const meaning=canonicalMetricMeaning(context);
const output={metricKey:selected.metricKey,what_is_it_th:meaning.th,what_is_it_en:meaning.en,synthesis:{th:'อัตรากำไรต้องดูพร้อมรายได้',en:'Operating margin must be assessed alongside revenue.'},strengths:{th:['ตัวชี้วัดมีข้อมูลตรวจสอบได้'],en:['The metric has accepted source history.']},watchouts:{th:'อัตรากำไรไม่ใช่กระแสเงินสด',en:'Operating margin does not measure cash conversion.'},ruleOfThumb:{th:'พิจารณาความต่อเนื่องของกำไรดำเนินงาน',en:'Assess persistence in operating profitability.'},referencedMetricKeys:[selected.metricKey,'revenue'],status:'neutral',statusLabels:{th:'ข้อมูลตรวจสอบได้',en:'Verified data'}};
test('structured Gemini synthesis passes validation for the selected metric only',async()=>{
  const result=await requestVerifiedMetricAnalyst(selected,context,{provider:async()=>JSON.stringify(output),model:'test-runtime-model'});
  assert.equal(result.output?.metricKey,'operating_margin');assert.equal(result.model,'test-runtime-model');assert.equal(result.fallbackReason,undefined);
  assert.deepEqual(result.output?.strengths,{th:[],en:[]},'Accepted source history alone is not an economic strength');
  const runtime=await requestVerifiedMetricAnalyst(selected,context,{provider:async()=>({text:JSON.stringify(output),modelVersion:'resolved-provider-version'}),model:'runtime-alias'});
  assert.equal(runtime.model,'resolved-provider-version','Runtime alias must not obscure the provider-reported model version');
});
test('deep bilingual paragraphs preserve selected facts and still reject an invented explanation number',async()=>{
  const deep={...output,synthesis:{
    th:'ข้อมูลล่าสุดมีอัตรากำไรที่ต้องพิจารณาร่วมกับรายได้และค่าใช้จ่าย ก่อนสรุปว่าบริษัทควบคุมต้นทุนได้ดีขึ้นหรือไม่\n\nค่าปัจจุบันต้องพิจารณาร่วมกับทิศทางรายได้และค่าใช้จ่าย ไม่อาจสรุปคุณภาพการเติบโตจากยอดขายเพียงอย่างเดียว\n\nความสัมพันธ์ระหว่างกำไรดำเนินงานกับรายได้ช่วยประเมินประสิทธิภาพ แต่ยังยืนยันแรงกดดันด้านราคาหรือส่วนผสมยอดขายไม่ได้ ควรติดตามว่ากำไรดำเนินงานฟื้นตัวควบคู่รายได้หรือไม่',
    en:'The latest observation requires revenue and expense context before assessing whether the company controls costs more effectively.\n\nThe selected margin should be assessed alongside revenue and operating expenses; sales alone do not establish growth quality.\n\nOperating income relative to revenue informs efficiency, but does not identify pricing or sales mix as a cause. Watch whether operating profitability improves alongside revenue.'},
    strengths:{th:[],en:[]},status:'warning',statusLabels:{th:'ต้องดูคุณภาพกำไร',en:'Profit quality requires attention'}};
  const before=JSON.stringify(selected);
  const result=await requestVerifiedMetricAnalyst(selected,context,{provider:async()=>JSON.stringify(deep)});
  assert.deepEqual(result.output,deep);assert.equal(result.output?.synthesis.th.split('\n\n').length,3);
  assert.equal(JSON.stringify(selected),before,'Deeper interpretation never replaces accounting inputs');
  const rejected=await requestVerifiedMetricAnalyst(selected,context,{provider:async()=>JSON.stringify({...deep,synthesis:{...deep.synthesis,en:`${deep.synthesis.en} Pricing contributed 987654321 dollars.`}})});
  assert.equal(rejected.fallbackReason,'AI_NUMERIC_VALIDATION_FAILED');assert.equal(rejected.output,undefined);
});
test('deep interpretation stays scoped to each selected metric and supplied business context',()=>{
  for(const [metricKey,businessArchetype] of [['revenue','automotive'],['operating_margin','retail'],['operating_cash_flow','saas_software'],['inventory','industrial_manufacturing'],['roic','bank']] as const){
    const metric=selectFinancialMetric(fs,metricKey,fs.periods.slice(-4));
    const scoped={...context,metricKey,metricName:metricKey,businessArchetype,sector:'Supplied sector',industry:'Supplied industry',interpretationCaveats:['Supplied interpretation limitation'],denominatorCaveats:['Supplied denominator limitation']};
    const prompt=buildVerifiedAnalystPrompt(metric,scoped);
    const facts=JSON.parse(prompt.slice(prompt.lastIndexOf('\n')+1));
    assert.equal(facts.metricKey,metric.metricKey);assert.equal(facts.businessArchetype,businessArchetype);
    assert.deepEqual(facts.values,metric.values);assert.deepEqual(facts.relatedMetrics,metric.relatedMetrics);
    assert.deepEqual(facts.interpretationCaveats,scoped.interpretationCaveats);assert.deepEqual(facts.denominatorCaveats,scoped.denominatorCaveats);
    assert.match(prompt,/three connected paragraphs/);assert.match(prompt,/do not infer causality or forecast/);
    assert.doesNotMatch(prompt,/two to four sentences|rawFinancialModel|executive_summary/);
  }
});
test('a decline in deeper prose must retain its supplied signed change; prompt cannot weaken the allowlist',async()=>{
  const change=-87654321.23;
  const declining={...selected,changes:[null,null,null,change]};
  const signed={...output,synthesis:{th:`แนวโน้มกำไรอ่อนลง\n\nค่าการเปลี่ยนแปลง ${change} pp\n\nควรติดตามค่าใช้จ่ายเทียบกับรายได้`,en:`Profitability weakened.\n\nSupplied change: ${change} pp.\n\nWatch expenses relative to revenue.`}};
  assert.ok((await requestVerifiedMetricAnalyst(declining,context,{provider:async()=>JSON.stringify(signed)})).output);
  const unsigned={...signed,synthesis:{...signed.synthesis,en:`${signed.synthesis.en} A decrease of ${Math.abs(change)} pp.`}};
  assert.equal((await requestVerifiedMetricAnalyst(declining,context,{provider:async()=>JSON.stringify(unsigned)})).fallbackReason,'AI_NUMERIC_VALIDATION_FAILED');
  assert.match(buildVerifiedAnalystPrompt(declining,context),/Preserve the exact sign/);
});
test('ratio interpretation retains the separate scale of related money and the verified currency',()=>{
  const foreign={...selected,currency:'JPY'};
  const prompt=buildVerifiedAnalystPrompt(foreign,context),facts=JSON.parse(prompt.slice(prompt.lastIndexOf('\n')+1));
  assert.equal(facts.unit,'%');assert.equal(facts.currency,'JPY');
  assert.equal(facts.relatedMetricUnits.revenue,'M');assert.equal(facts.relatedMetricUnits.operating_income,'M');
  assert.deepEqual(facts.relatedMetrics,selected.relatedMetrics,'Unit annotations do not rescale or replace accepted values');
  assert.match(prompt,/M means millions of the supplied currency/);
});
test('unsupported numbers / malformed schema / wrong selected metric return validation fallback',async()=>{
  for(const [content,reason] of [[JSON.stringify({...output,synthesis:{th:'999999',en:'999999'}}),'AI_NUMERIC_VALIDATION_FAILED'],[JSON.stringify({...output,metricKey:'revenue'}),'AI_RESPONSE_SCHEMA_INVALID'],['not JSON','AI_RESPONSE_INVALID_JSON']]) {
    const result=await requestVerifiedMetricAnalyst(selected,context,{provider:async()=>content});assert.equal(result.fallbackReason,reason);assert.equal(result.output,undefined);
  }
});
test('provider outage and timeout have distinct honest fallback reasons',async()=>{
  assert.equal((await requestVerifiedMetricAnalyst(selected,context,{provider:async()=>{throw Error('provider failure');}})).fallbackReason,'AI_PROVIDER_ERROR');
  assert.equal((await requestVerifiedMetricAnalyst(selected,context,{timeoutMs:3,provider:async()=>new Promise(()=>{})})).fallbackReason,'AI_PROVIDER_TIMEOUT');
});
test('ineligible current-only metric never calls provider; prompt contains accepted local context, no raw report arrays',async()=>{
  const one=selectFinancialMetric(fs,'operating_margin',[fs.periods.at(-1)!]);let called=false;
  const result=await requestVerifiedMetricAnalyst(one,context,{provider:async()=>{called=true;return '';}});
  assert.equal(called,false);assert.equal(result.fallbackReason,'INSUFFICIENT_VERIFIED_DATA');
  const prompt=buildVerifiedAnalystPrompt(selected,context);assert.match(prompt,/PERCENTAGE_POINT/);assert.match(prompt,/relatedMetrics/);assert.doesNotMatch(prompt,/red_flags|executive_summary|rawFinancialModel/);
  assert.match(prompt,/"comparisonMode":"yoy"/);assert.match(prompt,/NOT adjacent quarters/);
  assert.match(buildVerifiedAnalystPrompt(selected,context,'qoq'),/"comparisonMode":"qoq"/);
});
test('raw / fenced JSON accepted; empty and invalid schema produce precise codes',async()=>{
  assert.ok((await requestVerifiedMetricAnalyst(selected,context,{provider:async()=>`\n\x60\x60\x60json\n${JSON.stringify(output)}\n\x60\x60\x60\n`})).output);
  assert.equal((await requestVerifiedMetricAnalyst(selected,context,{provider:async()=>''})).fallbackReason,'AI_RESPONSE_EMPTY');
  assert.equal((await requestVerifiedMetricAnalyst(selected,context,{provider:async()=>JSON.stringify({...output,statusLabels:{en:'Only English'}})})).fallbackReason,'AI_RESPONSE_SCHEMA_INVALID');
});
test('only the configured fallback is attempted after real model/provider failure',async()=>{
  const tried:string[]=[];
  const provider=async (_p:string,model:string)=>{tried.push(model);if(model==='gemini-primary')throw Object.assign(Error('unavailable'),{status:503});return JSON.stringify(output);};
  const result=await requestVerifiedMetricAnalyst(selected,context,{provider,model:'gemini-primary',fallbackModel:'gemini-supported'});
  assert.deepEqual(tried,['gemini-primary','gemini-supported']);assert.equal(result.model,'gemini-supported');assert.ok(result.output);
  assert.equal((await requestVerifiedMetricAnalyst(selected,context,{provider:async()=>{throw Object.assign(Error('not found'),{status:404});},model:'gemini-primary',fallbackModel:'gemini-supported'})).fallbackReason,'AI_MODEL_UNAVAILABLE');
  assert.equal((await requestVerifiedMetricAnalyst(selected,context,{provider:async()=>{throw Object.assign(Error('busy'),{status:503});}})).fallbackReason,'AI_PROVIDER_UNAVAILABLE');
});
test('invalid JSON / unsupported numbers never trigger model retry',async()=>{
  for(const failure of ['json','numbers']){
    let calls=0;
    const result=await requestVerifiedMetricAnalyst(selected,context,{fallbackModel:'gemini-fallback',provider:async()=>{calls++;return failure==='json'?'broken':JSON.stringify({...output,synthesis:{th:'9999999',en:'9999999'}});}});
    assert.equal(calls,1);assert.equal(result.output,undefined);
  }
});
test('one configured model quota fallback is bounded and preserves 429 if both quotas are exhausted',async()=>{
  let calls=0;
  const result=await requestVerifiedMetricAnalyst(selected,context,{model:'gemini-primary',fallbackModel:'gemini-supported',provider:async(_p,model)=>{calls++;if(model==='gemini-primary')throw Object.assign(Error('quota'),{status:429});return JSON.stringify(output);}});
  assert.equal(calls,2);assert.ok(result.output);assert.equal(result.model,'gemini-supported');
  calls=0;
  const exhausted=await requestVerifiedMetricAnalyst(selected,context,{model:'gemini-primary',fallbackModel:'gemini-supported',provider:async()=>{calls++;throw Object.assign(Error('quota'),{status:429});}});
  assert.equal(calls,2);assert.equal(exhausted.fallbackReason,'AI_RATE_LIMITED');assert.equal(exhausted.providerStatus,429);
});
test('missing key and invalid model policy are distinct safe capabilities',async()=>{
  const saved=process.env.GEMINI_API_KEY;delete process.env.GEMINI_API_KEY;
  try{assert.equal((await requestVerifiedMetricAnalyst(selected,context)).fallbackReason,'AI_API_KEY_MISSING');}finally{if(saved!==undefined)process.env.GEMINI_API_KEY=saved;}
  assert.deepEqual(resolveMetricAnalysisModel({GEMINI_API_KEY:'test',GEMINI_FINANCIAL_MODEL:'gemini-valid',GEMINI_FINANCIAL_FALLBACK_MODEL:'gemini-supported'}),{primary:'gemini-valid',fallback:'gemini-supported',configured:true});
  assert.equal(resolveMetricAnalysisModel({GEMINI_API_KEY:'test',GEMINI_FINANCIAL_MODEL:'made up model'}).configured,false);
});
test('aborted selected metric stops immediately even when provider ignores its signal',async()=>{
  const controller=new AbortController();
  const pending=requestVerifiedMetricAnalyst(selected,context,{signal:controller.signal,provider:async()=>new Promise(()=>{}),fallbackModel:'gemini-fallback'});
  controller.abort();
  const result=await pending;
  assert.equal(result.fallbackReason,'AI_STALE_REQUEST_DISCARDED');assert.equal(result.output,undefined);
});
