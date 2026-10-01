import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { filingPlainText, parseFilingInlineFacts } from './secStatementCompletion';
import { buildSecVerifiedIntegrationPackage } from './secIntegration';
import { resolveFundamentalMetrics } from '../../domain/valuation/metricRegistry';
import { resolveAdaptiveValuationRun } from '../../domain/valuation/adaptiveValuationPolicy';

test('encoded punctuation preserves reviewed presentation labels and explicitly tagged zero, not missing values', () => {
  assert.equal(filingPlainText('<td>Total stockholders&#8217; equity&nbsp;</td>'), 'Total stockholders’ equity');
  assert.equal(filingPlainText('Total shareholders&#x2019; equity'), 'Total shareholders’ equity');
  assert.equal(filingPlainText('a &amp; b &quot;c&quot; &apos;d&apos;'), 'a & b "c" \'d\'');
  assert.equal(filingPlainText('&#1114112; &#xD800; &unknown;'), '&#1114112; &#xD800; &unknown;');
  const html='<xbrli:context id="c"><xbrli:entity><xbrli:identifier>1</xbrli:identifier></xbrli:entity><xbrli:period><xbrli:instant>2026-06-30</xbrli:instant></xbrli:period></xbrli:context>'
    +'<xbrli:unit id="u"><xbrli:measure>iso4217:USD</xbrli:measure></xbrli:unit>'
    +'<ix:nonfraction name="us-gaap:PreferredStockValue" contextRef="c" unitRef="u" format="ixt:zerodash">&#8212;</ix:nonfraction>';
  assert.equal(parseFilingInlineFacts(html,'1')[0]?.value,0);
  assert.equal(parseFilingInlineFacts(html.replace('&#8212;',''),'1').length,0);
  assert.equal(parseFilingInlineFacts(html,'2').length,0);
});

test('public encoded primary equity rows recover common capital and TTM ROE without an issuer exception', () => {
  const capture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/encoded-equity-public-2026-09-30.json.gz',import.meta.url))).toString());
  const pkg=buildSecVerifiedIntegrationPackage(capture.bundle);
  const ds=pkg.canonicalFinancials!;
  const current=ds.values['balance_sheet.common_equity'].at(-1)!;
  assert.equal(current.periodEnd,'2026-06-30');
  assert.equal(current.value,9541);
  assert.equal(current.verification,'verified');
  assert.equal(current.mappingEvidence?.definition,'Total stockholders’ equity');
  assert.equal(current.mappingEvidence?.policy,'EXACT_PRIMARY_STATEMENT_ROW');
  assert.equal(ds.values['balance_sheet.preferred_equity'].at(-1)?.value,0);
  assert.equal(ds.values['balance_sheet.common_equity'].find(f=>f.periodEnd==='2025-06-30')?.value,8072);
  const metrics=resolveFundamentalMetrics({ticker:ds.ticker,canonical_financials:ds,
    financial_statements:pkg.financialStatements,
    company_profile:{sector:'Financial Services',industry:'Brokerage'}},ds.ticker);
  assert.equal(metrics.roe.status,'CALCULATED');
  assert.ok(Math.abs(metrics.roe.value!-2072/((9541+8072)/2)*100)<0.01);
  const report:any={ticker:ds.ticker,canonical_financials:ds,financial_statements:pkg.financialStatements,
    company_profile:{sector:'Financial Services',industry:'Brokerage'},
    sec_verification:{ticker:ds.ticker,dcf_financial_inputs:{generated_by:'sec-verified-financial-inputs-v1',ticker:ds.ticker}},
    // ROE recovery does not establish a current, economically equivalent class
    // denominator. The old 2021 aggregate must not enable an apparent fair value.
    intrinsic_value:{ddm_model:{assumptions:{cost_of_equity_pct:10,terminal_growth_pct:3}}}};
  const run=resolveAdaptiveValuationRun(report);
  assert.equal(pkg.shareSnapshot!.currentCommonSharesOutstanding,null);
  assert.equal(run.baseFairValue,null);
  assert.deepEqual(resolveAdaptiveValuationRun(structuredClone(report)),run);
  const otherScope=structuredClone(capture.bundle);
  for(const doc of otherScope.filingDocuments)doc.html=doc.html.replaceAll('Total stockholders&#8217; equity','Total stockholders&#8217; equity including non-controlling interests');
  assert.equal(buildSecVerifiedIntegrationPackage(otherScope).canonicalFinancials?.values['balance_sheet.common_equity'].at(-1)?.value,null);
  // Exact independent source context remains mandatory; malformed entity identity
  // must not pass just because the monetary totals still add up.
  const wrong=structuredClone(capture.bundle);wrong.identity.cik='2';
  assert.equal(buildSecVerifiedIntegrationPackage(wrong).canonicalFinancials,null);
});
