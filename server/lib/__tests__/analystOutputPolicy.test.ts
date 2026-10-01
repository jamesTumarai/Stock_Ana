import assert from 'node:assert/strict';
import {test} from 'node:test';
import {hasUsableAnalystReport,selectAnalystReport} from '../analystOutputPolicy';
const primary=JSON.stringify({ticker:'NEW',verdict:{summary:'Completed primary'},generation_review:{status:'VALIDATOR_COMPLETED'}});
test('validator failure preserves a complete primary report and discloses incomplete review',()=>{
 const result=JSON.parse(selectAnalystReport(primary,'{"verdict":','NEW')!);
 assert.equal(result.verdict.summary,'Completed primary');assert.equal(result.generation_review.status,'PRIMARY_ONLY');
 assert.equal(selectAnalystReport('{','{"value":2}','NEW'),null);
 assert.equal(hasUsableAnalystReport(primary,'OTHER'),false);
});
test('valid validator JSON wins without blending two reports or accepting a fabricated review flag',()=>{
 const final=JSON.stringify({ticker:'NEW',verdict:{summary:'Reviewed'}});
 const result=JSON.parse(selectAnalystReport(primary,final,'NEW')!);
 assert.equal(result.verdict.summary,'Reviewed');assert.equal(result.generation_review.status,'VALIDATOR_COMPLETED');
});
