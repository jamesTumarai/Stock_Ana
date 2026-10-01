import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shareClassProviderSymbol, sameShareClassTicker } from './tickerIdentity';
import { SecEdgarClient } from '../services/sec/secClient';

test('share-class provider aliases preserve class identity and unrelated suffixes',()=>{
  assert.equal(shareClassProviderSymbol(' test.a '),'TEST-A');
  assert.equal(shareClassProviderSymbol('TEST-A'),'TEST-A');
  assert.equal(sameShareClassTicker('TEST.A','TEST-A'),true);
  assert.equal(sameShareClassTicker('TEST.A','TEST-B'),false);
  assert.equal(sameShareClassTicker('TEST.A','TEST'),false);
  for(const ticker of ['USDTHB=X','TEST.LON','^INDEX','TEST.12'])assert.equal(shareClassProviderSymbol(ticker),ticker);
  assert.equal(sameShareClassTicker('',''),false);
});

test('SEC aliases resolve via the actual ticker index and retain the requested ticker plus listed class',async()=>{
  const records={0:{cik_str:1,ticker:'TEST-A',title:'Test issuer'},1:{cik_str:1,ticker:'TEST-B',title:'Test issuer'}};
  const client=new SecEdgarClient({userAgent:'Test contact@example.com',minIntervalMs:0,
    fetchImpl:(async()=>new Response(JSON.stringify(records),{status:200})) as typeof fetch});
  assert.deepEqual(await client.resolveTicker('TEST.A'),{cik:'0000000001',ticker:'TEST.A',listedTicker:'TEST-A',title:'Test issuer'});
  assert.equal((await client.resolveTicker('TEST.B'))?.listedTicker,'TEST-B');
  assert.equal(await client.resolveTicker('TEST.C'),null);
  assert.equal(await client.resolveTicker('TEST'),null);
});

test('conflicting class aliases cannot select an issuer, even when an exact spelling is present',async()=>{
  const records={0:{cik_str:1,ticker:'TEST.A',title:'One'},1:{cik_str:2,ticker:'TEST-A',title:'Two'}};
  const client=new SecEdgarClient({userAgent:'Test contact@example.com',minIntervalMs:0,
    fetchImpl:(async()=>new Response(JSON.stringify(records),{status:200})) as typeof fetch});
  assert.equal(await client.resolveTicker('TEST.A'),null);
  assert.equal(await client.resolveTicker('TEST-A'),null);
});
