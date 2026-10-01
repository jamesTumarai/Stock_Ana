import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {buildSecVerifiedIntegrationPackage} from './secIntegration';
import type {SecCompanyBundleLike} from './secFinancialMapper';
import {resolveCurrentBalanceSheetSnapshot} from '../../domain/currentBalanceSheetSnapshot';

const captured = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/standalone-debt-family-public-2026-09-30.json.gz',import.meta.url))).toString());
const input = (): SecCompanyBundleLike => structuredClone(captured.bundle);
const currentDebt = (bundle: SecCompanyBundleLike) => buildSecVerifiedIntegrationPackage(bundle).canonicalFinancials!
  .values['balance_sheet.total_debt'].find(f => f.period === 'Q2 2026');

test('real standard disjoint debt family includes leases without counting warehouse/paper children twice',()=>{
  const pkg = buildSecVerifiedIntegrationPackage(input());
  const debt = pkg.canonicalFinancials!.values['balance_sheet.total_debt'].find(f=>f.period==='Q2 2026')!;
  assert.equal(debt.value,8322);
  assert.equal(debt.verification,'verified');
  assert.equal(debt.sourceComponents?.length,5);
  assert.ok(debt.sourceComponents?.every(f=>f.periodEnd==='2026-06-30'&&f.unit==='USD_M'&&f.source?.documentUrl));
  assert.deepEqual(debt.sourceComponents?.map(f=>f.value),[2293,69,5731,74,155]);
  assert.equal(resolveCurrentBalanceSheetSnapshot({ticker:'CBRE',canonical_financials:pkg.canonicalFinancials}).netCash,
    null,'Unverified short-term investments are not an invented zero');
});

test('overlapping long-term aggregate keeps the conservative ambiguity guard',()=>{
  const bundle=input(), facts=bundle.companyFacts.facts!['us-gaap'];
  const latest=facts.LongTermDebtCurrent.units.USD.find(f=>f.end==='2026-06-30'&&!f.start)!;
  facts.LongTermDebt={units:{USD:[{...latest,val:5800000000}]}};
  assert.equal(currentDebt(bundle)?.value,null);
});

test('missing lease leg, mixed instants, and foreign units cannot produce a current debt total',()=>{
  const missing=input();
  missing.companyFacts.facts!['us-gaap'].FinanceLeaseLiabilityCurrent.units.USD = [];
  assert.equal(currentDebt(missing)?.value,null);
  const dated=input();
  dated.companyFacts.facts!['us-gaap'].LongTermDebtCurrent.units.USD.forEach(f=>{if(f.end==='2026-06-30')f.end='2026-06-29';});
  assert.equal(currentDebt(dated)?.value,null);
  const foreign=input(), facts=foreign.companyFacts.facts!['us-gaap'];
  facts.ShortTermBorrowings.units.EUR=facts.ShortTermBorrowings.units.USD;
  facts.ShortTermBorrowings.units.USD=[];
  assert.equal(currentDebt(foreign)?.value,null);
});
