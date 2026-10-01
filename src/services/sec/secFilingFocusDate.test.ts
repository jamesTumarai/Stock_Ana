import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseInlineFilingDate } from './secStatementCompletion';
import { buildSecVerifiedIntegrationPackage } from './secIntegration';

test('DEI dates use explicit English date transforms, reject ambiguous locale dates and calendar rollover', () => {
  assert.equal(parseInlineFilingDate('<span>June 30,</span> <b>2026</b>','ixt:date-monthname-day-year-en'),'2026-06-30');
  assert.equal(parseInlineFilingDate('Feb 29, 2024','ixt:datemonthdayyearen'),'2024-02-29');
  assert.equal(parseInlineFilingDate('30 June 2026','ixt:date-day-monthname-year-en'),'2026-06-30');
  assert.equal(parseInlineFilingDate('2026-06-30'),'2026-06-30');
  for(const [value,format] of [['06/07/2026',''],['June 30, 2026','unknown-transform'],['February 29, 2026','ixt:date-monthname-day-year-en'],['2026-02-30','']]) {
    assert.equal(parseInlineFilingDate(value,format),null);
  }
});

test('current filed DEI focus recovers the exact newest standalone quarter when companyfacts lags', () => {
  const capture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/filing-focus-date-public-2026-09-30.json.gz',import.meta.url))).toString());
  const pkg=buildSecVerifiedIntegrationPackage(capture.bundle),ds=pkg.canonicalFinancials!;
  assert.equal(ds.periods.at(-1),'Q2 2026');
  const revenue=ds.values['income_statement.revenue'].at(-1)!;
  assert.equal(revenue.value,2425.452);
  assert.equal(revenue.periodStart,'2026-04-01');
  assert.equal(revenue.periodEnd,'2026-06-30');
  assert.equal(revenue.periodType,'standalone_quarter');
  assert.match(revenue.source!.documentUrl!,/pld-20260630\.htm$/);
  assert.equal(revenue.verification,'verified');
  // An unrelated outer inline disclosure must not swallow a nested DEI field.
  const nested=structuredClone(capture.bundle);
  nested.filingDocuments[0].html=nested.filingDocuments[0].html.replace(/(<ix:nonNumeric\b[^>]*name="dei:DocumentFiscalYearFocus"[^>]*>[\s\S]*?<\/ix:nonNumeric>)/i,
    '<ix:nonNumeric name="issuer:DisclosureText">$1</ix:nonNumeric>');
  assert.equal(buildSecVerifiedIntegrationPackage(nested).canonicalFinancials?.periods.at(-1),'Q2 2026');
  const invalid=structuredClone(capture.bundle);
  invalid.filingDocuments[0].html=invalid.filingDocuments[0].html.replaceAll('ixt:date-monthname-day-year-en','ixt:unsupported-date');
  assert.equal(buildSecVerifiedIntegrationPackage(invalid).canonicalFinancials?.periods.at(-1),'Q1 2026');
  const unrelated=structuredClone(capture.bundle);
  unrelated.filingDocuments[0].html=unrelated.filingDocuments[0].html.replace(/<ix:(?:nonNumeric|nonFraction)\b(?=[^>]*name="dei:DocumentFiscalYearFocus")[^>]*>/gi,
    (tag:string)=>tag.replace(/contextRef="[^"]+"/i,'contextRef="unrelated-entity-context"'));
  assert.equal(buildSecVerifiedIntegrationPackage(unrelated).canonicalFinancials?.periods.at(-1),'Q1 2026');
});
