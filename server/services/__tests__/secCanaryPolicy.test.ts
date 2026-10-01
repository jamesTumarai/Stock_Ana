import assert from 'node:assert/strict';import {test} from 'node:test';
import {classifyCanaryFilingPolicy,selectRotatingSecFilers} from '../secCanaryPolicy';
test('canary rotates the complete supplied SEC index by seed and deduplicates share-class CIKs',()=>{
  const index=Object.fromEntries(Array.from({length:100},(_,i)=>[String(i),{cik_str:i+1,ticker:'NEW'+i,title:'Unknown issuer'}]));
  index.extra={cik_str:1,ticker:'CLASS',title:'Duplicate issuer'};
  const first=selectRotatingSecFilers(index,'day-one',10);
  assert.deepEqual(first,selectRotatingSecFilers(index,'day-one',10));
  assert.notDeepEqual(first,selectRotatingSecFilers(index,'day-two',10));
  assert.equal(new Set(first.map(i=>i.cik_str)).size,10);
});
test('canary distinguishes 10-K/10-Q from foreign and pre-periodic filers',()=>{
  assert.equal(classifyCanaryFilingPolicy(['4','6-K','20-F']), 'FOREIGN_PERIODIC');
  assert.equal(classifyCanaryFilingPolicy(['4','10-Q/A','6-K']), 'US_PERIODIC');
  assert.equal(classifyCanaryFilingPolicy(['4','424B3','F-1']), 'NO_SUPPORTED_PERIODIC_FILING');
});
