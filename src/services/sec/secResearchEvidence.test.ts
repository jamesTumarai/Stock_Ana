import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mapSecBundleToCanonicalFinancials} from './secFinancialMapper';
import {attachSecResearchEvidence} from './secResearchEvidence';
import {resolveGuidanceRegistry} from '../../domain/reportResearchIntegrity';

test('an issuer withdrawal supersedes earlier guidance without new units or invented zero amounts',()=>{
  const bundle=JSON.parse(readFileSync(new URL('./fixtures/verified-completion-2026.json',import.meta.url),'utf8'));
  const ds=mapSecBundleToCanonicalFinancials({...bundle,filingDocuments:[]})!;
  const document=(date:string,html:string)=>({accession:date,form:'8-K',filingDate:date,
    documentUrl:`https://www.sec.gov/Archives/edgar/data/${Number(bundle.identity.cik)}/${date.replaceAll('-','')}/release.htm`,html});
  bundle.filingDocuments=[
    document('2026-08-01','<table><tr><td>Guidance in millions, USD</td><td>FY 2027</td></tr><tr><td>Revenue</td><td>100 - 120</td></tr></table>'),
    // A withdrawal has no amount or new currency to parse.
    document('2026-09-01','<table><tr><td>Guidance update</td><td>FY 2027</td></tr><tr><td>Revenue</td><td>Withdrawn</td></tr></table>')];
  const evidence=attachSecResearchEvidence(ds,bundle);
  assert.equal(evidence.verifiedManagementGuidance!.length,2);
  const withdrawn=evidence.verifiedManagementGuidance!.find(g=>g.status==='WITHDRAWN')!;
  assert.equal(withdrawn.guidanceLow,100);assert.equal(withdrawn.guidanceHigh,120);
  assert.equal(withdrawn.issuedDate,'2026-09-01');
  assert.equal(resolveGuidanceRegistry(evidence.verifiedManagementGuidance!).active.length,0);
});
