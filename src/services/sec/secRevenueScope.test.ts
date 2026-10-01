import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { mapSecBundleToCanonicalFinancials, mapSecBundleToAnnualRevenueHistory, type SecCompanyBundleLike } from './secFinancialMapper';
import { reconcileCanonicalTtmFlow } from '../../domain/canonicalTtmFlow';
import { reconcileCanonicalFlowAndMultipleNarrative, type CanonicalExecutiveSnapshot } from '../../domain/canonicalExecutiveSnapshot';

// Public SEC observations, captured independently of AI or private reports.
const captured: { bundle: SecCompanyBundleLike } = JSON.parse(gunzipSync(readFileSync(new URL(
  './fixtures/total-revenue-scope-public-2026-10-01.json.gz', import.meta.url,
))).toString('utf8'));
const bundle = () => structuredClone(captured.bundle);

test('issuer total revenue outranks its customer-contract subtotal in current quarters and canonical TTM', () => {
  const source = bundle();
  const data = mapSecBundleToCanonicalFinancials(source)!;
  const revenue = data.values['income_statement.revenue'];
  assert.equal(revenue.at(-1)!.value, 101808);
  assert.equal(revenue.at(-1)!.concept, 'Revenues');
  assert.deepEqual(revenue.slice(-4).map(item => item.value), [94972, 94232, 93675, 101808]);
  assert.equal(reconcileCanonicalTtmFlow(data, 'income_statement.revenue').canonicalValue, 384687);
  assert.deepEqual(source, captured.bundle); // Selecting a definition never rewrites source facts.
  assert.equal(mapSecBundleToAnnualRevenueHistory(source).at(-1)!.value, 371444);
  assert.equal(mapSecBundleToAnnualRevenueHistory(source).at(-1)!.definition, 'Revenues');
});

test('customer-contract revenue remains available when no total-revenue family exists', () => {
  const source = bundle();
  delete source.companyFacts.facts['us-gaap'].Revenues;
  const data = mapSecBundleToCanonicalFinancials(source)!;
  assert.equal(data.values['income_statement.revenue'].at(-1)!.value, 70115);
  assert.equal(reconcileCanonicalTtmFlow(data, 'income_statement.revenue').canonicalValue, 259733);
});

test('a current total-revenue series never fills a missing quarter with a narrower subtotal', () => {
  const source = bundle();
  // Remove every duration ending at Q1. Q2 standalone still exists; its YTD
  // cannot reconstruct Q1 without verified same-definition source operands.
  source.companyFacts.facts['us-gaap'].Revenues.units.USD = source.companyFacts.facts['us-gaap'].Revenues.units.USD
    .filter(fact => fact.end !== '2026-03-31');
  const data = mapSecBundleToCanonicalFinancials(source)!;
  assert.equal(data.values['income_statement.revenue'].find(item => item.period === 'Q1 2026')?.value ?? null, null);
  assert.ok(data.values['income_statement.revenue'].every(item => item.value === null || item.concept === 'Revenues'));
  assert.equal(reconcileCanonicalTtmFlow(data, 'income_statement.revenue').canonicalValue, null);
});

test('stale total-revenue facts cannot replace a current customer-contract definition', () => {
  const source = bundle();
  source.companyFacts.facts['us-gaap'].Revenues.units.USD = source.companyFacts.facts['us-gaap'].Revenues.units.USD
    .filter(fact => fact.end! < '2025-01-01');
  const data = mapSecBundleToCanonicalFinancials(source)!;
  assert.equal(data.values['income_statement.revenue'].at(-1)!.value, 70115);
  assert.equal(mapSecBundleToAnnualRevenueHistory(source).at(-1)!.definition, 'RevenueFromContractWithCustomerExcludingAssessedTax');
});

test('annual history does not borrow a longer subtotal series to manufacture a growth window', () => {
  const source = bundle();
  source.companyFacts.facts['us-gaap'].Revenues.units.USD = source.companyFacts.facts['us-gaap'].Revenues.units.USD
    .filter(fact => fact.end! >= '2025-01-01');
  const history = mapSecBundleToAnnualRevenueHistory(source);
  assert.equal(history.length, 1);
  assert.equal(history[0].value, 371444);
  assert.equal(history[0].definition, 'Revenues');
});

test('current Thai TTM phrasing and English prose reconcile to the same exact sum', () => {
  const snapshot = { growth: { revenueTtm: 384687 }, market: {} } as CanonicalExecutiveSnapshot;
  const text = reconcileCanonicalFlowAndMultipleNarrative(
    'รายได้รอบ TTM ยืนเหนือ 383,929 ล้านดอลลาร์; รายได้รวมรอบ TTM 383,929 ล้านดอลลาร์; TTM Revenue $383.929 billion', snapshot,
  );
  assert.match(text, /รายได้รอบ TTM ยืนเหนือ 384,687 ล้านดอลลาร์/);
  assert.match(text, /รายได้รวมรอบ TTM 384,687 ล้านดอลลาร์/);
  assert.match(text, /TTM Revenue \$384\.69 billion/);
});
