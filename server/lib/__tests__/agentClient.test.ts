import assert from 'node:assert/strict';
import {test} from 'node:test';
import {streamInteraction} from '../agentClient';
const collect=async(response:Response,idleTimeoutMs=100)=>{
 const result=[];for await(const event of streamInteraction(response,{idleTimeoutMs}))result.push(event);return result;
};
test('SSE terminal frame survives EOF without a newline and data without a space',async()=>{
 assert.deepEqual(await collect(new Response('data:[DONE]')),[{type:'done'}]);
 assert.deepEqual(await collect(new Response('data: malformed\n\ndata: [DONE]\n\n')),[{type:'done'}]);
});
test('stalled provider stream cancels and returns an actionable failure rather than hanging forever',async()=>{
 let cancelled=false;
 const response=new Response(new ReadableStream({cancel(){cancelled=true;}}));
 const events=await collect(response,20);
 assert.equal(events.length,1);assert.equal(events[0].type,'error');
 assert.match(events[0].message!,/stream stalled/);assert.equal(cancelled,true);
});
