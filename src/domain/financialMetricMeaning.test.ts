import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { buildSecVerifiedIntegrationPackage } from '../services/sec/secIntegration';
import { FINANCIAL_METRIC_REGISTRY, selectFinancialMetric } from './selectedFinancialMetric';
import { canonicalMetricMeaning, METRIC_MEANING_REGISTRY } from './financialMetricMeaning';
import { beginnerMeaningHasTeachingStructure } from './metricBeginnerEducation';
import { companyFirstSynthesis } from './financialAnalystStyle';
import { getMetricInterpretationContext, getBusinessAwareLocalFallback } from './financialMetricContext';
import { resolveAnalystMeaning, verifiedAnalystValidationFailure, renderVerifiedAnalystOutput, type VerifiedAnalystOutput } from './financialAnalystContract';
import { buildVerifiedAnalystPrompt, requestVerifiedMetricAnalyst, VERIFIED_ANALYST_RESPONSE_SCHEMA } from '../../server/services/verifiedMetricAnalyst';
const statements = buildSecVerifiedIntegrationPackage(JSON.parse(readFileSync(new URL('../services/sec/fixtures/verified-completion-2026.json', import.meta.url), 'utf8'))).financialStatements!;
function scope(key: string) {
  const selected = selectFinancialMetric(statements, key, statements.periods.slice(-4));
  const context = getMetricInterpretationContext({ metricKey: key, metricName: key.replace(/_/g, ' '), reportData: { financial_statements: statements }, periods: selected.periods, historyValues: selected.values, isSourceReconciled: true });
  return { selected, context };
}
function response(key: string): VerifiedAnalystOutput {
  return { metricKey: key, what_is_it_th: '', what_is_it_en: '', synthesis: { th: 'ข้อมูลที่เลือกควรประเมินพร้อมรายการที่เกี่ยวข้อง', en: 'Assess the selected observation alongside related accepted data.' }, strengths: { th: [], en: [] }, watchouts: { th: 'ข้อมูลรายการเดียวไม่ยืนยันความแข็งแกร่งของกิจการ', en: 'An isolated observation does not establish business quality.' }, ruleOfThumb: { th: 'ใช้ขอบเขตรายการและฐานงวดเดียวกัน', en: 'Use consistent line scope and period methodology.' }, referencedMetricKeys: [key], status: 'neutral', statusLabels: { th: 'พิจารณาบริบท', en: 'Context matters' } };
}
const cases = [
  ['revenue', /ยอดขายสินค้า/, /before costs/, /margins and operating cash/],
  ['operating_margin', /กำไรจากการดำเนินงานเทียบกับรายได้/, /before financing and tax/, /operating expenses/],
  ['ocf', /เงินสดสุทธิจากกิจกรรมดำเนินงาน/, /working-capital/, /Capital Expenditure/],
  ['total_assets', /ณ วันงบการเงิน/, /not market value/, /Total Liabilities.*Equity/s],
  ['current_ratio', /สินทรัพย์หมุนเวียนหารด้วยหนี้สินหมุนเวียน/, /at the same balance-sheet date/, /Payment Timing/],
  ['roic', /เงินลงทุนเฉลี่ย/, /after-tax operating profit/, /cost-of-capital evidence/],
  ['net_income', /กำไรที่เหลือหลังต้นทุน/, /bottom-line profit/, /Operating Cash Flow/],
  ['inventory', /วัตถุดิบ/, /working capital/, /Inventory Turnover/],
  ['dso', /ระยะเวลาเก็บเงิน/, /collection efficiency/, /Accounts Receivable/],
] as const;
for (const [key, thaiMeaning, semantics, comparison] of cases) test(`${key}: meaningful bilingual definition, trusted grounding and selected-only rendering`, () => {
  const { selected, context } = scope(key), before = JSON.stringify(selected), meaning = canonicalMetricMeaning(context);
  assert.match(meaning.th, thaiMeaning); assert.match(meaning.en, semantics); assert.match(meaning.en, comparison);
  assert.ok(meaning.th.length > 120 && meaning.en.length > 100);
  assert.doesNotMatch(meaning.th, /^ตัวชี้วัด\s/);
  for (const language of ['th', 'en'] as const) {
    assert.equal(beginnerMeaningHasTeachingStructure(meaning[language], language, []), true);
    assert.doesNotMatch(meaning[language], /Q[1-4] \d{4}|(?<![A-Za-z0-9])[-+]?\d|งวดล่าสุด|latest quarter/);
  }
  const education = selected.definition!.meaning!.education!;
  assert.ok(education.definition.th && education.measures.th && education.interpretation.th);
  assert.ok(education.companions.th.length >= 1 && education.companions.th.length <= 4);
  const prompt = buildVerifiedAnalystPrompt(selected, context), grounding = JSON.parse(prompt.slice(prompt.lastIndexOf('\n') + 1));
  assert.equal(grounding.formula, context.formula); assert.equal(grounding.methodology, context.periodType);
  assert.equal(grounding.name, selected.definition!.meaning!.name);
  assert.deepEqual(grounding.canonicalMeaning, selected.definition!.meaning);
  assert.deepEqual(grounding.relatedMetricKeys, Object.keys(selected.relatedMetrics));
  assert.deepEqual(new Set([...grounding.relatedMetricKeys,...grounding.unavailableCompanionMetricKeys]),new Set(selected.definition!.contextDependencies));
  for(const companion of grounding.relatedMetricKeys) assert.equal(typeof selected.relatedMetrics[companion].at(-1),'number','Only accepted current companions enter observation context');
  const normalized = resolveAnalystMeaning(response(key), selected, context) as VerifiedAnalystOutput;
  assert.equal(verifiedAnalystValidationFailure(normalized, selected), undefined);
  const unavailable = getBusinessAwareLocalFallback(context, null);
  assert.equal(unavailable.what_is_it_th, meaning.th, 'Meaning remains useful even without current numbers');
  const rendered = renderVerifiedAnalystOutput(normalized, unavailable, 'accepted-provider');
  assert.equal(rendered.what_is_it_en, meaning.en);
  assert.doesNotMatch(rendered.interpretation_en, /^(Revenue is|Operating Margin means|Net Income is)/i);
  assert.equal(JSON.stringify(selected), before, 'No values, formulas or period methodology are replaced');
});
test('every selectable registry metric has bilingual semantic grounding, including aliases and sectors', () => {
  for (const [key, entry] of Object.entries(FINANCIAL_METRIC_REGISTRY)) {
    assert.ok(entry.meaning, key);
    assert.ok(entry.meaning.th.length > 120, key); assert.ok(entry.meaning.en.length > 100, key);
    if (entry.canonicalKey !== key) assert.deepEqual(entry.meaning, FINANCIAL_METRIC_REGISTRY[entry.canonicalKey]?.meaning, key);
  }
});
test('invalid meaning is repaired independently, without a model retry or discarding valid synthesis', async () => {
  const { selected, context } = scope('revenue'), canonical = canonicalMetricMeaning(context);
  for (const invalid of ['', 'Revenue', 'Revenue '.repeat(40), 'ตัวชี้วัด Revenue', 'Revenue คือรายได้ของบริษัท', undefined, null, {}, 'Revenue has 987654321 of invented profit and cash. '.repeat(5)]) {
    let calls = 0;
    const raw = { ...response('revenue'), what_is_it_th: invalid, what_is_it_en: invalid };
    const result = await requestVerifiedMetricAnalyst(selected, context, { provider: async () => { calls++; return JSON.stringify(raw); } });
    assert.equal(calls, 1); assert.ok(result.output);
    assert.equal(result.output.what_is_it_th, canonical.th); assert.equal(result.output.what_is_it_en, canonical.en);
    assert.deepEqual(result.output.synthesis, raw.synthesis);
  }
});
test('natural Thai metric naming is accepted without forcing an English title', () => {
  for (const key of ['revenue', 'operating_margin', 'ocf', 'total_assets', 'current_ratio']) {
    const { selected, context } = scope(key);
    const thai = selected.definition!.meaning!.th;
    const normalized = resolveAnalystMeaning({ ...response(key), what_is_it_th: thai }, selected, context) as VerifiedAnalystOutput;
    assert.equal(normalized.what_is_it_th, thai, key);
  }
});
test('validated contextual Gemini meaning takes precedence; only an invalid language is replaced', async () => {
  const { selected, context } = scope('revenue'), canonical = canonicalMetricMeaning(context);
  const dynamic = { ...response('revenue'), what_is_it_th: `${canonical.th} คำอธิบายนี้แยกความหมายของรายได้ออกจากการวิเคราะห์บริษัท.`, what_is_it_en: `${canonical.en} This educational definition precedes the company-specific interpretation.` };
  const result = await requestVerifiedMetricAnalyst(selected, context, { provider: async () => JSON.stringify(dynamic) });
  assert.ok(result.output); assert.deepEqual(result.output, {...dynamic,statusLabels:{th:'บริบทผสม ต้องติดตาม',en:'Mixed evidence; follow up'}},'Teaching and synthesis remain provider-authored; the contextual assessment label follows verified mixed evidence');
  const rendered = renderVerifiedAnalystOutput(result.output, getBusinessAwareLocalFallback(context, null), result.model);
  assert.equal(rendered.what_is_it_th, dynamic.what_is_it_th); assert.equal(rendered.what_is_it_en, dynamic.what_is_it_en);
  const partial = resolveAnalystMeaning({ ...dynamic, what_is_it_th: 'Revenue' }, selected, context) as VerifiedAnalystOutput;
  assert.equal(partial.what_is_it_th, canonical.th); assert.equal(partial.what_is_it_en, dynamic.what_is_it_en);
  assert.ok(VERIFIED_ANALYST_RESPONSE_SCHEMA.required.includes('what_is_it_th'));
  assert.ok(VERIFIED_ANALYST_RESPONSE_SCHEMA.required.includes('what_is_it_en'));
});
test('switching metrics cannot retain a previous metric meaning, including response-key mismatch', () => {
  const meanings = new Set<string>();
  for (const [key] of cases) {
    const { selected, context } = scope(key), expected = canonicalMetricMeaning(context);
    const stale = response(key); stale.what_is_it_th = 'Gross Margin สะท้อนเศรษฐศาสตร์ของสินค้าและบริการก่อนค่าใช้จ่ายดำเนินงาน '.repeat(4);
    stale.what_is_it_en = 'Gross Margin assesses product economics before operating expenses. '.repeat(4);
    const normalized = resolveAnalystMeaning(stale, selected, context) as VerifiedAnalystOutput;
    assert.equal(normalized.what_is_it_th, expected.th); assert.equal(normalized.what_is_it_en, expected.en);
    assert.equal(verifiedAnalystValidationFailure({ ...normalized, metricKey: 'gross_margin' }, selected), 'AI_RESPONSE_SCHEMA_INVALID');
    meanings.add(expected.th);
  }
  assert.equal(meanings.size, cases.length);
});
test('meaning repair never weakens the core numeric allowlist or admits extra accounting fields', async () => {
  const { selected, context } = scope('revenue');
  for (const [extra, expected] of [[{ synthesis: { th: 'ตัวเลข 987654321', en: 'A fabricated 987654321 amount.' } }, 'AI_NUMERIC_VALIDATION_FAILED'], [{ currentValue: 987654321 }, 'AI_RESPONSE_SCHEMA_INVALID']] as const) {
    const result = await requestVerifiedMetricAnalyst(selected, context, { provider: async () => JSON.stringify({ ...response('revenue'), ...extra }) });
    assert.equal(result.fallbackReason, expected); assert.equal(result.output, undefined);
  }
});
test('bank liquidity meaning preserves the definition and the applicability limitation', () => {
  const { context } = scope('current_ratio');
  const bank = { ...context, businessArchetype: 'bank' as const, archetypeLabelTh:'ธนาคาร', archetypeLabelEn:'banks', applicability: 'NOT_MEANINGFUL_FOR_PRIMARY_INTERPRETATION' as const, interpretationCaveats: ['Bank liquidity requires sector-specific funding and reserve measures.'], interpretationCaveatsTh: ['สภาพคล่องธนาคารต้องใช้เกณฑ์แหล่งทุนและเงินสำรองเฉพาะอุตสาหกรรม'] };
  const meaning = canonicalMetricMeaning(bank);
  assert.match(meaning.th, /สินทรัพย์หมุนเวียนหารด้วยหนี้สินหมุนเวียน/);
  assert.match(meaning.th, /สำหรับธนาคาร.*ไม่ใช่ตัวชี้วัดหลัก/); assert.match(meaning.en, /Business context:.*banks/s);
});
test('cash reconciliation balances retain restricted-cash scope and cannot become net cash labels', () => {
  const { context } = scope('total_assets');
  for (const key of ['beginning_cash', 'ending_cash']) {
    const meaning = canonicalMetricMeaning({ ...context, metricKey: key, metricName: key, metricNameTh: key });
    assert.match(meaning.th, /เงินสดที่มีข้อจำกัด/); assert.match(meaning.en, /restricted cash/);
    assert.doesNotMatch(meaning.en, /^.*: Cash and Cash Equivalents/);
    assert.notEqual(meaning.th, canonicalMetricMeaning({ ...context, metricKey: 'cash' }).th);
  }
  assert.match(FINANCIAL_METRIC_REGISTRY.cash_and_investments.meaning!.en, /has not deducted debt/);
});

test('four-part educational prose rejects current values, circular and jargon-first definitions', () => {
  const { selected, context } = scope('revenue'), meaning = canonicalMetricMeaning(context);
  const bad = [
    meaning.en.replace('recognized sales of goods and services before costs and expenses.', 'Revenue Revenue Revenue Revenue Revenue.'),
    meaning.en.replace('In general:', 'Other information:'),
    `${meaning.en} Current quarter revenue is ${selected.currentValue}.`,
    `${meaning.en} The latest quarter improved.`,
    meaning.en.replace('Growing sales can be encouraging', 'Higher is always better'),
    canonicalMetricMeaning(scope('gross_margin').context).en,
  ];
  for (const what_is_it_en of bad) {
    const repaired = resolveAnalystMeaning({ ...response('revenue'), what_is_it_en }, selected, context) as VerifiedAnalystOutput;
    assert.equal(repaired.what_is_it_en, meaning.en, what_is_it_en);
  }
  const jargon = `NOPAT ${meaning.th}`;
  assert.equal(beginnerMeaningHasTeachingStructure(jargon, 'th', []), false);
});

test('synthesis starts with the current condition; trimming cannot conceal an unsupported number', async () => {
  const { selected, context } = scope('revenue');
  const company = { th:'ข้อมูลล่าสุดต้องพิจารณารายได้ร่วมกับกำไรและเงินสด ก่อนสรุปคุณภาพของยอดขาย', en:'The latest observation needs accepted profit and cash context before concluding sales quality.' };
  const textbook = { th:'รายได้คือยอดขายสินค้าและบริการก่อนหักต้นทุนและค่าใช้จ่าย', en:'Revenue measures sales before costs and expenses.' };
  for (const language of ['th', 'en'] as const) {
    assert.equal(companyFirstSynthesis(company[language], selected, context), company[language]);
    assert.equal(companyFirstSynthesis(`${textbook[language]}\n\n${company[language]}`, selected, context), company[language]);
    assert.equal(companyFirstSynthesis(`${textbook[language]} ${company[language]}`, selected, context), company[language]);
    assert.equal(companyFirstSynthesis(textbook[language], selected, context), '');
  }
  const providerOutput = { ...response('revenue'), synthesis: { th:`${textbook.th}\n\n${company.th}`, en:`${textbook.en}\n\n${company.en}` } };
  const result = await requestVerifiedMetricAnalyst(selected, context, { provider: async () => JSON.stringify(providerOutput) });
  assert.deepEqual(result.output?.synthesis, company);
  const rejected = await requestVerifiedMetricAnalyst(selected, context, { provider: async () => JSON.stringify({ ...providerOutput, synthesis: { ...providerOutput.synthesis, en:`Revenue measures 987654321 sales.\n\n${company.en}` } }) });
  assert.equal(rejected.fallbackReason, 'AI_NUMERIC_VALIDATION_FAILED');
  const onlyDefinition = await requestVerifiedMetricAnalyst(selected, context, { provider: async () => JSON.stringify({ ...providerOutput, synthesis: textbook }) });
  assert.equal(onlyDefinition.fallbackReason, 'AI_RESPONSE_SCHEMA_INVALID');
});

test('sector education is available without registering unsupported values or AI eligibility', () => {
  for (const key of ['affo','occupancy','cash_burn','runway']) {
    const definition = METRIC_MEANING_REGISTRY[key];
    assert.ok(definition.education, key);
    assert.equal(beginnerMeaningHasTeachingStructure(definition.th, 'th', []), true);
    assert.equal(beginnerMeaningHasTeachingStructure(definition.en, 'en', []), true);
    const selected = selectFinancialMetric(statements, key, statements.periods.slice(-4));
    assert.equal(selected.dataQuality.eligibleForAi, false);
    assert.equal(selected.dataQuality.reasonCode, 'UNSUPPORTED_METRIC');
    assert.equal(selected.currentValue, null);
  }
  const { context } = scope('inventory');
  assert.match(canonicalMetricMeaning({ ...context, businessArchetype:'bank', archetypeLabelTh:'ธนาคาร', archetypeLabelEn:'banks' }).en, /Business context:/);
  assert.match(canonicalMetricMeaning({ ...context, metricKey:'combined_ratio', businessArchetype:'retail' }).en, /Business context:/);
  assert.match(canonicalMetricMeaning({ ...context, metricKey:'ffo', businessArchetype:'bank' }).en, /Business context:/);
  for (const key of ['inventory','current_ratio','dpo','roic']) {
    const text = METRIC_MEANING_REGISTRY[key].education!.interpretation.en;
    assert.doesNotMatch(text, /higher is always better/i);
    assert.match(text, /but|not|consisten|depend|context|rather than/i);
  }
});
