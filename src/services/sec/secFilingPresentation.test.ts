import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { buildSecVerifiedIntegrationPackage } from './secIntegration';
import { attachDebtFromVerifiedFilingPresentation } from './secFilingPresentation';
import { mapSecBundleToCanonicalFinancials } from './secFinancialMapper';

const fixture = () => JSON.parse(readFileSync(new URL('./fixtures/verified-tsla-2026q2.json', import.meta.url), 'utf8'));
test('actual SEC balance-sheet presentation supplies same-instant current plus noncurrent debt and finance leases', () => {
  const pkg = buildSecVerifiedIntegrationPackage(fixture());
  const debt = pkg.canonicalFinancials!.values['balance_sheet.total_debt'].at(-1)!;
  assert.equal(debt.value, 9342);
  assert.deepEqual(debt.sourceComponents?.map(v => v.value), [1418,7924]);
  assert.ok(debt.sourceComponents?.every(v => v.periodEnd === '2026-06-30' && v.unit === 'USD_M'));
  assert.equal(debt.source?.authorityTier, 1);
});
test('foreign entity, wrong currency, duration-only context and non-SEC document cannot supply instant debt', () => {
  for (const change of ['foreign','currency','duration','url']) {
    const b = fixture();
    if (change === 'foreign') b.identity.cik = '9999999999';
    if (change === 'currency') b.filingDocuments[0].html = b.filingDocuments[0].html.replaceAll('iso4217:USD','iso4217:EUR');
    if (change === 'duration') b.filingDocuments[0].html = b.filingDocuments[0].html.replaceAll('<xbrli:instant>','<xbrli:endDate>').replaceAll('</xbrli:instant>','</xbrli:endDate>');
    if (change === 'url') b.filingDocuments[0].documentUrl = 'https://example.com/filing';
    const d = mapSecBundleToCanonicalFinancials(b)!; delete d.values['balance_sheet.total_debt'];
    assert.equal(attachDebtFromVerifiedFilingPresentation(d,b).values['balance_sheet.total_debt']?.at(-1)?.value ?? null,null);
  }
});
test('conflicting accepted debt facts remain unavailable with diagnostic metadata', () => {
  const b = fixture(), d = buildSecVerifiedIntegrationPackage(b).canonicalFinancials!;
  d.values['balance_sheet.total_debt'].at(-1)!.value = 9000;
  const result = attachDebtFromVerifiedFilingPresentation(d,b);
  assert.equal(result.values['balance_sheet.total_debt'].at(-1)!.value,null);
  assert.ok(result.provenanceWarnings.some(w => w.code === 'DEBT_PRESENTATION_DISAGREEMENT'));
});
