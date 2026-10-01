import { METRIC_MEANING_REGISTRY } from '../domain/financialMetricMeaning';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { buildSecVerifiedIntegrationPackage } from './sec/secIntegration';
import { selectFinancialMetric } from '../domain/selectedFinancialMetric';
import { getMetricInterpretationContext } from '../domain/financialMetricContext';
import { buildMetricAiRequest, METRIC_AI_CONTEXT_VERSION, metricAiPayloadBytes } from '../domain/metricAiRequest';
import { fetchMetricAi } from './metricAiClient';
const statements = buildSecVerifiedIntegrationPackage(JSON.parse(readFileSync(new URL('./sec/fixtures/verified-completion-2026.json', import.meta.url), 'utf8'))).financialStatements!;
const selected = selectFinancialMetric(statements, 'revenue', statements.periods.slice(-4));
const context = getMetricInterpretationContext({ metricKey: 'revenue', metricName: 'Revenue', reportData: statements, periods: selected.periods, historyValues: selected.values, isSourceReconciled: true });
const output = { metricKey: 'revenue', what_is_it_th: METRIC_MEANING_REGISTRY.revenue.th, what_is_it_en: METRIC_MEANING_REGISTRY.revenue.en, synthesis: { th: 'วิเคราะห์รายได้จากงบที่ตรวจสอบได้', en: 'Analyze revenue from accepted history.' }, strengths: { th: ['มีประวัติรายได้ที่ตรวจสอบได้'], en: ['Revenue has accepted history.'] }, watchouts: { th: 'รายได้ไม่ใช่กำไร', en: 'Revenue is not profit.' }, ruleOfThumb: { th: 'พิจารณารายได้พร้อมกำไร', en: 'Compare revenue with profit.' }, referencedMetricKeys: ['revenue'], status: 'neutral', statusLabels: { th: 'ข้อมูลตรวจสอบได้', en: 'Verified data' } };
const responseBody = (requestId = 'req-success') => ({ success: true, requestId, contextVersion: METRIC_AI_CONTEXT_VERSION, metricKey: selected.metricKey, dataIdentity: selected.identity, insight: { engine: 'GEMINI' }, model: 'actual-provider-model', output });
const options = (fetcher: typeof fetch, requestId = 'req-success') => ({ requestId, ticker: 'TSLA', companyName: 'Tesla', isThai: true, compareMode: 'yoy' as const, signal: new AbortController().signal, fetcher, isCurrent: () => true });
test('large realistic statement produces an allowlisted compact request, including Thai UTF8 bytes', () => {
  assert.ok(metricAiPayloadBytes(statements) > 1_000_000);
  const payload = buildMetricAiRequest(selected, context, {...options(fetch),companyName:'บริษัททดสอบ'});
  assert.ok(metricAiPayloadBytes(payload) < 10_000);
  assert.ok(metricAiPayloadBytes(payload) > JSON.stringify(payload).length);
  assert.doesNotMatch(JSON.stringify(payload), /verified_dataset|sourceBundle|financial_statements|rawFinancial|provenance|debug|modelVersion/);
  assert.equal(payload.current.value, selected.currentValue);
  assert.equal(payload.history.length, 4);
});
test('200 validated provider result renders synthesis and both provider meaning fields ahead of local definition', async () => {
  const result = await fetchMetricAi(selected, context, options(async () => Response.json(responseBody())));
  assert.equal(result.insight?.engine, 'GEMINI');
  assert.equal(result.insight?.interpretation_th, output.synthesis.th);
  assert.deepEqual(result.insight?.pros_en, output.strengths.en);
  assert.equal(result.insight?.watchouts_en, output.watchouts.en);
  assert.equal(result.insight?.benchmark_en, output.ruleOfThumb.en);
  assert.equal(result.insight?.status_label_th, output.statusLabels.th);
  assert.equal(result.insight?.what_is_it_th, output.what_is_it_th);
  assert.equal(result.insight?.what_is_it_en, output.what_is_it_en);
});
test('multiline research interpretation survives the client contract without forced strengths or stale prose',async()=>{
  const synthesis={th:'รายได้สะท้อนขนาดยอดขายของธุรกิจก่อนหักค่าใช้จ่าย\n\nการเพิ่มยอดขายต้องประเมินพร้อมกำไรและเงินสด ไม่ใช่ถือว่าเป็นการเติบโตที่ดีโดยอัตโนมัติ\n\nควรติดตามว่ากำไรดำเนินงานและกระแสเงินสดสอดคล้องกับรายได้หรือไม่ ข้อมูลยอดขายอย่างเดียวยังระบุแรงขับเคลื่อนด้านราคาไม่ได้',en:'Revenue measures sales before expenses.\n\nSales growth should be assessed with earnings and cash generation rather than treated as inherently favorable.\n\nWatch operating income and cash flow alongside revenue; sales alone cannot establish pricing as a driver.'};
  const body={...responseBody(),output:{...output,synthesis,strengths:{th:[],en:[]},watchouts:{th:'• ติดตามคุณภาพกำไรเมื่อรายได้เปลี่ยนแปลง\n• ตรวจการเปลี่ยนยอดขายเป็นเงินสด',en:'• Watch earnings quality as sales change.\n• Check cash conversion.'}}};
  const result=await fetchMetricAi(selected,context,options(async()=>Response.json(body)));
  assert.equal(result.insight?.engine,'GEMINI');assert.equal(result.insight?.interpretation_th,synthesis.th);assert.equal(result.insight?.interpretation_en,synthesis.en);
  assert.deepEqual(result.insight?.pros_th,[]);assert.equal(result.insight?.watchouts_th,body.output.watchouts.th);
  assert.ok(result.insight?.what_is_it_en,'Canonical definition is retained alongside richer prose');
});
test('413/401/429 and structured failures retain exact diagnosis, including non-JSON gateway response', async () => {
  for (const [status, code] of [[413,'AI_REQUEST_TOO_LARGE'],[401,'AI_AUTH_REQUIRED'],[429,'AI_RATE_LIMITED'],[503,'AI_API_KEY_MISSING'],[502,'AI_RESPONSE_INVALID_JSON']] as const) {
    const result = await fetchMetricAi(selected, context, options(async () => Response.json({code}, {status})));
    assert.equal(result.reason, code); assert.equal(result.insight, undefined);
  }
  assert.equal((await fetchMetricAi(selected, context, options(async () => new Response('Gateway too large', {status:413})))).reason, 'AI_REQUEST_TOO_LARGE');
  assert.equal((await fetchMetricAi(selected, context, options(async () => { throw Object.assign(Error('Sign in'), {code:'AUTH_REQUIRED'}); }))).reason, 'AI_AUTH_REQUIRED');
});
test('oversized local context is blocked before network or loading starts', async () => {
  let called = false;
  const huge = {...selected, periods: Array.from({length:10000},(_,i)=>`Q ${i}`), values:Array(10000).fill(1), changes:Array(10000).fill(null)};
  const result = await fetchMetricAi(huge, context, {...options(async () => {called=true;return Response.json({});}), onRequest:()=>{called=true;}});
  assert.equal(result.reason, 'AI_CONTEXT_TOO_LARGE'); assert.equal(called,false);
});
test('frontend rejects unsupported number, missing status and mismatched request/version before GEMINI engine', async () => {
  for (const [body, reason] of [
    [{...responseBody(),output:{...output,synthesis:{th:'99999999',en:'99999999'}}},'AI_NUMERIC_VALIDATION_FAILED'],
    [{...responseBody(),output:{...output,status:'unknown'}},'AI_RESPONSE_SCHEMA_INVALID'],
    [{...responseBody(),requestId:'stale'},'AI_STALE_REQUEST_DISCARDED'],
    [{...responseBody(),contextVersion:'old'},'AI_STALE_REQUEST_DISCARDED'],
  ] as const) assert.equal((await fetchMetricAi(selected, context, options(async()=>Response.json(body)))).reason,reason);
});
test('delayed Revenue cannot render after Operating Margin is selected, even if fetch ignores abort', async () => {
  let active='revenue', release!: (response:Response)=>void;
  const controller=new AbortController();
  const revenue = fetchMetricAi(selected,context,{...options(async()=>new Promise<Response>(resolve=>{release=resolve;})),signal:controller.signal,isCurrent:()=>active==='revenue'});
  active='operating_margin';controller.abort();
  const margin=selectFinancialMetric(statements,'operating_margin',selected.periods);
  const ctx=getMetricInterpretationContext({metricKey:'operating_margin',metricName:'Operating Margin',reportData:statements,historyValues:margin.values,periods:margin.periods,isSourceReconciled:true});
  const marginResult=await fetchMetricAi(margin,ctx,{...options(async()=>Response.json({...responseBody('req-margin'),metricKey:'operating_margin',dataIdentity:margin.identity,output:{...output,metricKey:'operating_margin',referencedMetricKeys:['operating_margin']}}),'req-margin'),isCurrent:()=>active==='operating_margin'});
  release(Response.json(responseBody()));
  assert.equal((await revenue).reason,'AI_STALE_REQUEST_DISCARDED');assert.equal(marginResult.insight?.metricKey,'operating_margin');
});
test('global partial coverage does not block an eligible metric request',async()=>{
  assert.equal(selected.dataQuality.eligibleForAi,true);
  assert.equal(statements.quality_status, 'partial');
  let called=false;
  const result=await fetchMetricAi(selected,context,options(async()=>{called=true;return Response.json(responseBody());}));
  assert.equal(called,true);assert.equal(result.insight?.engine,'GEMINI');
});
