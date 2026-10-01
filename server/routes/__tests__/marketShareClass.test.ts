import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleLiveQuotes } from '../marketRoutes';

test('live quote adapter restores caller class spelling and retains the actual quote timestamp',async()=>{
  const original=globalThis.fetch;const requests:string[]=[];
  let result:any;
  const response={statusCode:200,status(code:number){this.statusCode=code;return this;},json(body:unknown){result=body;}};
  try {
    globalThis.fetch=(async(url:unknown)=>{
      const path=String(url);requests.push(path);
      if(path.includes('/getcrumb'))return new Response('crumb');
      if(path.includes('/v7/'))return new Response(JSON.stringify({quoteResponse:{result:[]}}));
      if(path.includes('/v8/'))return new Response(JSON.stringify({chart:{result:[{meta:{symbol:'TEST-B',regularMarketPrice:100,regularMarketTime:1790798400}}]}}));
      return new Response('');
    }) as typeof fetch;
    await handleLiveQuotes({query:{symbols:'TEST.B'}},response);
    assert.equal(response.statusCode,200);
    assert.ok(requests.some(url=>url.includes('/chart/TEST-B?')));
    assert.equal(result.quotes['TEST.B'].symbol,'TEST.B');
    assert.equal(result.quotes['TEST.B'].providerSymbol,'TEST-B');
    assert.equal(result.quotes['TEST.B'].price,100);
    assert.equal(result.quotes['TEST.B'].asOf,new Date(1790798400*1000).toISOString());
    assert.notEqual(result.quotes['TEST.B'].asOf,result.asOf);
  } finally { globalThis.fetch=original; }
});

test('a chart response for a different share class cannot supply the requested price',async()=>{
  const original=globalThis.fetch;let result:any;
  const response={status(){return this;},json(body:unknown){result=body;}};
  try {
    globalThis.fetch=(async(url:unknown)=>{
      const path=String(url);
      if(path.includes('/getcrumb'))return new Response('crumb');
      if(path.includes('/v7/'))return new Response(JSON.stringify({quoteResponse:{result:[]}}));
      if(path.includes('/v8/'))return new Response(JSON.stringify({chart:{result:[{meta:{symbol:'TEST-A',regularMarketPrice:100}}]}}));
      return new Response('');
    }) as typeof fetch;
    await handleLiveQuotes({query:{symbols:'TEST.B'}},response);
    assert.equal(result.quotes['TEST.B'],undefined);
  } finally { globalThis.fetch=original; }
});
