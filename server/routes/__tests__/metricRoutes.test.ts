import { METRIC_MEANING_REGISTRY } from '../../../src/domain/financialMetricMeaning';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import express, {type RequestHandler} from 'express';
import type {Server} from 'node:http';
import {readFileSync} from 'node:fs';
import {buildSecVerifiedIntegrationPackage} from '../../../src/services/sec/secIntegration';
import {selectFinancialMetric} from '../../../src/domain/selectedFinancialMetric';
import {getMetricInterpretationContext} from '../../../src/domain/financialMetricContext';
import {buildMetricAiRequest} from '../../../src/domain/metricAiRequest';
import {registerMetricRoutes} from '../metricRoutes';
import {instrumentMetricRequest} from '../../middleware/metricAiDiagnostics';
import {createRequireFirebaseAuth} from '../../auth/firebaseAuth';
import type {AnalystProvider} from '../../services/verifiedMetricAnalyst';
const pkg=buildSecVerifiedIntegrationPackage(JSON.parse(readFileSync(new URL('../../../src/services/sec/fixtures/verified-completion-2026.json',import.meta.url),'utf8')));
const selected=selectFinancialMetric(pkg.financialStatements!,'revenue',pkg.financialStatements!.periods.slice(-4));
const context=getMetricInterpretationContext({metricKey:'revenue',metricName:'Revenue',reportData:pkg.financialStatements!,historyValues:selected.values,periods:selected.periods,isSourceReconciled:true});
const output={metricKey:'revenue',what_is_it_th:METRIC_MEANING_REGISTRY.revenue.th,what_is_it_en:METRIC_MEANING_REGISTRY.revenue.en,synthesis:{th:'รายได้ต้องดูพร้อมกำไร',en:'Read revenue alongside profit.'},strengths:{th:[],en:[]},watchouts:{th:'รายได้ไม่ใช่เงินสด',en:'Revenue is not cash.'},ruleOfThumb:{th:'พิจารณาแนวโน้มรายได้ที่ตรวจสอบได้',en:'Review accepted revenue history.'},referencedMetricKeys:['revenue'],status:'neutral',statusLabels:{th:'ข้อมูลตรวจสอบได้',en:'Verified data'}};
const payload=(requestId='route-test')=>buildMetricAiRequest(selected,context,{requestId,ticker:'TSLA',isThai:true,compareMode:'yoy'});
async function withRoute(provider:AnalystProvider|undefined, run:(post:(body:unknown,headers?:Record<string,string>)=>Promise<Response>)=>Promise<void>, sourceFailure=false){
  const app=express();app.use('/api/analyze-metric',instrumentMetricRequest);app.use(express.json({limit:'1mb'}));
  app.use((error:any,_req:any,res:any,next:any)=>error.type==='entity.too.large'?res.status(413).json({code:'PAYLOAD_TOO_LARGE'}):next(error));
  const rate:RequestHandler=(req,res,next)=>req.get('X-Test-Rate')?void res.status(429).json({code:'RATE_LIMITED'}):next();
  registerMetricRoutes(app,createRequireFirebaseAuth(async token=>{assert.equal(token,'test-token');return {uid:'test-user'};}),rate,
    {fetchPackage:async()=>{if(sourceFailure)throw Error('source unavailable');return pkg;},provider});
  let server!:Server;
  await new Promise<void>(resolve=>{server=app.listen(0,'127.0.0.1',()=>resolve());});
  const port=(server.address() as {port:number}).port;
  try{await run((body,headers={})=>fetch(`http://127.0.0.1:${port}/api/analyze-metric`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer test-token',...headers},body:JSON.stringify(body)}));}
  finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
}
test('HTTP 200 returns current request identity, bilingual rendered insight and validated-success cache only',async()=>{
  let calls=0;
  await withRoute(async()=>{calls++;return JSON.stringify(output);},async post=>{
    const first=await post(payload());assert.equal(first.status,200);const result:any=await first.json();
    assert.equal(result.success,true);assert.equal(result.insight.engine,'GEMINI');assert.equal(result.insight.interpretation_en,output.synthesis.en);assert.equal(result.requestId,'route-test');
    const second:any=await (await post(payload('route-next'))).json();assert.equal(second.requestId,'route-next');assert.equal(second.cached,true);assert.equal(calls,1);
  });
});
test('parser 413 and compact-contract 413 are exact request failures without calling Gemini',async()=>{
  let called=false;
  await withRoute(async()=>{called=true;return '';},async post=>{
    for(const size of [40_000,1_100_000]){
      const response=await post({...payload(),rawStatement:'x'.repeat(size)});assert.equal(response.status,413);assert.equal((await response.json() as any).code,'AI_REQUEST_TOO_LARGE');
    }
    assert.equal(called,false);
  });
});
test('HTTP auth and rate failures are not mislabeled provider failures',async()=>{
  await withRoute(async()=>JSON.stringify(output),async post=>{
    const unauthorized=await post(payload(),{Authorization:''});assert.equal(unauthorized.status,401);assert.equal((await unauthorized.json() as any).code,'AI_AUTH_REQUIRED');
    const quota=await post(payload(),{'X-Test-Rate':'blocked'});assert.equal(quota.status,429);assert.equal((await quota.json() as any).code,'AI_RATE_LIMITED');
  });
});
test('source failures remain distinguishable from Gemini outages',async()=>{
  let called=false;
  await withRoute(async()=>{called=true;return '';},async post=>{const response=await post(payload());assert.equal(response.status,502);assert.equal((await response.json() as any).code,'AI_SOURCE_UNAVAILABLE');assert.equal(called,false);},true);
});
test('empty/malformed/unsupported Gemini replies are never cached as success',async()=>{
  for(const [text,code] of [['','AI_RESPONSE_EMPTY'],['not JSON','AI_RESPONSE_INVALID_JSON'],[JSON.stringify({...output,synthesis:{th:'987654321',en:'987654321'}}),'AI_NUMERIC_VALIDATION_FAILED']] as const){
    let calls=0;
    await withRoute(async()=>{calls++;return text;},async post=>{
      for(let i=0;i<2;i++){const response=await post(payload());assert.equal(response.status,502);assert.equal((await response.json() as any).code,code);}
      assert.equal(calls,2);
    });
  }
});
test('missing key returns 503 before source/provider work',async()=>{
  const saved=process.env.GEMINI_API_KEY;delete process.env.GEMINI_API_KEY;
  try{await withRoute(undefined,async post=>{const response=await post(payload());assert.equal(response.status,503);assert.equal((await response.json() as any).code,'AI_API_KEY_MISSING');});}
  finally{if(saved!==undefined)process.env.GEMINI_API_KEY=saved;}
});
test('tampered values, duplicate periods and forbidden full-report field rejected before provider',async()=>{
  let calls=0;
  await withRoute(async()=>{calls++;return JSON.stringify(output);},async post=>{
    const altered=payload();altered.current.value=999999;
    assert.equal((await post(altered)).status,409);
    const duplicate=payload();duplicate.history.push(duplicate.history[0]);assert.equal((await post(duplicate)).status,400);
    assert.equal((await post({...payload(),reportData:{}})).status,400);
    assert.equal((await post({...payload(),history:{map:'invalid'}})).status,400);
    assert.equal(calls,0);
  });
});
