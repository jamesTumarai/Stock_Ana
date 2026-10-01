import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { buildSecVerifiedIntegrationPackage } from './secIntegration';
import { METRIC_SPECS } from './secFinancialMapper';
import { resolveReportedEarnings } from '../../domain/reportedEarnings';
import { validateAndPrepareReport } from '../../utils/reportValidation';
import { persistReport, readPersistedReport, reportHistoryRecord, type ReportPersistenceStore } from '../reportPersistenceService';
import { assertPayloadSize } from '../../utils/reportPersistence';
import { reconcileCanonicalTtmFlow } from '../../domain/canonicalTtmFlow';
import type { ReportData } from '../../types';

const load = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const cross = load('verified-cross-sector-2026');
const captures = [load('verified-completion-2026'), load('verified-aapl-2026'),
  ...cross.bundles.filter((b: any) => ['MSFT','SOFI','JPM','PLD','CRSP','CRM'].includes(b.identity.ticker))];

for (const bundle of captures) test(`${bundle.identity.ticker}: authoritative data → completed partial → bounded save → history → exact reopen`, async () => {
  const ticker = bundle.identity.ticker, pkg = buildSecVerifiedIntegrationPackage(structuredClone(bundle)), fs = pkg.financialStatements!;
  assert.ok(fs?.periods.length >= 4, 'Four-quarter source fixtures remain usable');
  if (ticker === 'AAPL' || ticker === 'TSLA') assert.ok(fs.periods.length >= 8, 'Full-history controls retain more than the four displayed quarters');
  for (const [section, metric] of [['income_statement','revenue'],['balance_sheet','total_assets'],['cash_flow','operating_cash_flow']]) {
    const key = `${section}.${metric}`;
    for (const v of pkg.canonicalFinancials!.values[key].slice(-4)) {
      assert.equal(typeof v.value, 'number', `${ticker} must not lose ${key}`);
      assert.ok(v.source?.documentUrl && v.accession, 'Accepted facts keep filing identity');
      const spec = METRIC_SPECS.find(s => `${s.statement}.${s.metric}` === key)!;
      const sourceCandidates = spec.concepts.flatMap(concept => bundle.companyFacts.facts?.['us-gaap']?.[concept]?.units?.[spec.unit] || []);
      // Raw companyfacts can label annual fy by the calendar start year (CRM).
      // The mapper anchors the canonical FY to the compatible filing cohort.
      // Here prove source concept/unit/accession/end reaches the resolver.
      // Independent Q4/YTD arithmetic and fiscal-window suites check its value.
      assert.ok(sourceCandidates.some((f: any) => f.end === v.periodEnd && f.accn === v.accession && Number.isFinite(f.val)),
        `${ticker} ${key} ${v.period}: actual SEC fact must reach the canonical resolver without a false N/A`);
    }
  }
  const earnings = resolveReportedEarnings(fs)!;
  assert.ok(earnings && earnings.verification === 'verified');
  if (['MSFT','AAPL'].includes(ticker)) {
    assert.equal(earnings.scope, 'PARENT');
    assert.deepEqual(fs.income_statement.net_income, fs.periods.map(() => null), 'Do not relabel parent earnings as total');
    assert.equal(pkg.canonicalFinancials!.values['income_statement.net_income'], undefined);
  }
  for (const [scope, vals] of Object.entries(fs.income_statement)) if (Array.isArray(vals)) assert.equal(vals.length, fs.periods.length, scope);
  const revenue = reconcileCanonicalTtmFlow(pkg.canonicalFinancials, 'income_statement.revenue');
  assert.equal(revenue.canonicalValue, fs.income_statement.revenue.slice(-4).reduce((sum, v) => sum! + v!, 0));
  const draft = { ticker, generated_at: '2026-09-29T01:00:00Z', analysis_type: 'fundamental',
    company_profile: { sector: ticker === 'SOFI' || ticker === 'JPM' ? 'Financial Services' : ticker === 'PLD' ? 'Real Estate' : 'Technology',
      overview: { company_name: bundle.identity.title } }, summary: 'Captured-source regression control, AI/valuation deliberately unavailable.',
    financial_statements: fs, canonical_financials: pkg.canonicalFinancials,
    verdict: { summary: 'Test thesis; immutable source report.', key_takeaways: [], conviction_score: null } } as unknown as ReportData;
  const ready = validateAndPrepareReport(draft, ticker);
  assert.equal(ready.canPersist, true, JSON.stringify(ready.validation.issues));
  assert.equal(ready.report!.report_completion!.executionStatus, 'COMPLETED');
  assert.equal(ready.report!.report_completion!.coverageStatus, 'PARTIAL');
  assert.equal(ready.validation.issues.some(i => i.code === 'STATEMENT_PERIOD_LENGTH_MISMATCH'), false);
  const docs = new Map<string, any>();
  const store: ReportPersistenceStore = {
    async write(path, data) { assertPayloadSize(data, path); docs.set(path, structuredClone(data)); },
    async read(path) { return structuredClone(docs.get(path)); },
    async publish(path) { assert.ok(docs.has(`${path}/sections/_manifest`)); docs.get(path).persistenceState = 'ready'; },
  };
  const id = `recovery_${ticker}`, summary = await persistReport(store, ready.report!, { reportId: id, userId: 'test_owner', language: 'Thai' });
  assert.equal(summary.flags.executionStatus, 'COMPLETED'); assert.equal(summary.flags.coverageStatus, 'PARTIAL');
  assert.equal(docs.get(`reports/${id}`).persistenceState, 'ready');
  const history = reportHistoryRecord(id, docs.get(`reports/${id}`));
  assert.equal(history.ticker, ticker); assert.equal(history.executionStatus,'COMPLETED');
  assert.equal(history.coverageStatus,'PARTIAL'); assert.equal(history.persistenceStatus,'SUCCEEDED');
  const restored = await readPersistedReport(store, id);
  assert.deepEqual(restored.financial_statements?.income_statement, ready.report!.financial_statements!.income_statement);
  // JSON has one zero representation; a signed -0 cash outflow is still zero.
  assert.deepEqual(restored.financial_statements?.cash_flow, JSON.parse(JSON.stringify(ready.report!.financial_statements!.cash_flow)));
  assert.equal(resolveReportedEarnings(restored.financial_statements)?.scope, earnings.scope);
  assert.deepEqual(restored.report_completion, ready.report!.report_completion);
});

test('a corrupted canonical array remains fatal; optional valuation is quarantined with synchronized header and history', () => {
  const pkg = buildSecVerifiedIntegrationPackage(structuredClone(captures.find(b => b.identity.ticker === 'MSFT')));
  const report = { ticker: 'MSFT', generated_at: '2026-09-29T01:00:00Z', financial_statements: pkg.financialStatements,
    canonical_financials: pkg.canonicalFinancials, intrinsic_value: { summary: { base_case_fair_value: 123 }, current_price: 'bad' },
    canonical_executive_snapshot: { canonicalValuation: { baseFairValue: 999 } } } as unknown as ReportData;
  const optional = validateAndPrepareReport(report, 'MSFT');
  assert.equal(optional.canPersist, true);
  assert.equal(optional.report!.canonical_executive_snapshot.canonicalValuation.baseFairValue, null);
  const wrongTicker = validateAndPrepareReport(report, 'AAPL'); assert.equal(wrongTicker.canPersist, false);
  const sourceMismatch = structuredClone(report); sourceMismatch.canonical_financials!.ticker = 'AAPL';
  assert.equal(validateAndPrepareReport(sourceMismatch, 'MSFT').canPersist, false);
  const duplicate = structuredClone(report); duplicate.canonical_financials!.periods[1] = duplicate.canonical_financials!.periods[0];
  assert.equal(validateAndPrepareReport(duplicate, 'MSFT').canPersist, false);
  const corrupt = structuredClone(report); corrupt.financial_statements!.income_statement.revenue = [];
  assert.equal(validateAndPrepareReport(corrupt, 'MSFT').canPersist, false);
});

test('scope reader cannot promote model parent earnings or splice scopes between periods', () => {
  const pkg = buildSecVerifiedIntegrationPackage(structuredClone(captures.find(b => b.identity.ticker === 'MSFT'))), fs = pkg.financialStatements!;
  const bad = structuredClone(fs); delete bad.verified_dataset;
  assert.equal(resolveReportedEarnings(bad), null);
  const source = fs.verified_dataset!.values['income_statement.net_income_parent'];
  source.at(-2)!.verification = 'unverified';
  const result = resolveReportedEarnings(fs)!;
  assert.equal(result.scope, 'PARENT'); assert.equal(result.values.at(-2), null);
  assert.equal(resolveReportedEarnings({ periods: ['Q1 2026'] } as any), null, 'Missing optional income section must not throw');
});

test('quarantined optional bank/REIT values never reappear in canonical header or saved summary', () => {
  for (const model of ['ddm_model','reit_model','cyclical_model']) {
    const report = { ticker: 'SCOPE_TEST', generated_at: '2026-09-29T01:00:00Z', intrinsic_value: {
      selected_model: {model_type:model==='ddm_model'?'ddm':model==='reit_model'?'reit_affo':'dcf_cyclical'},
      current_price: 50, summary: {base_case_fair_value:100}, [model]: {scenarios: {base:{fair_value_per_share:100}}},
    } } as unknown as ReportData;
    const result = validateAndPrepareReport(report, report.ticker, {requireMarketSnapshot:true});
    assert.equal(result.canPersist,true); assert.equal(result.report!.canonical_executive_snapshot.canonicalValuation.baseFairValue,null);
    assert.equal(result.report!.report_completion!.coverageStatus,'PARTIAL');
  }
});

test('fatal completion cannot bypass the persistence boundary, and pending writes are not called succeeded', async () => {
  let writes = 0;
  const store: ReportPersistenceStore = { async write(){writes++;},async read(){return undefined;},async publish(){writes++;} };
  await assert.rejects(()=>persistReport(store, {ticker:'CORRUPT',report_completion:{executionStatus:'FAILED',coverageStatus:'PARTIAL',missingSections:['financial_statements'],fatalIssueCodes:['CORRUPTED_CANONICAL_PERIOD_MODEL']}} as ReportData,
    {reportId:'fatal_test',userId:'test_owner',language:'English'}),/fatal structural/);
  assert.equal(writes,0);
  assert.equal(reportHistoryRecord('pending',{persistenceVersion:2,persistenceState:'saving',flags:{}}).persistenceStatus,'IN_PROGRESS');
});

test('cross-company CIK contamination is rejected before mapping and cannot become a completed report', () => {
  const wrong = structuredClone(captures.find(b => b.identity.ticker === 'MSFT'));
  wrong.companyFacts.cik = 1318605;
  const pkg = buildSecVerifiedIntegrationPackage(wrong);
  assert.equal(pkg.canonicalFinancials, null);
  assert.equal(pkg.dcfCoverage.issues[0].code,'SEC_COMPANY_IDENTITY_MISMATCH');
  const report = {ticker:'MSFT',generated_at:'2026-09-29T01:00:00Z',sec_verification:{ticker:'MSFT',status:'unavailable',error:{code:'SEC_COMPANY_IDENTITY_MISMATCH'}}} as ReportData;
  const result = validateAndPrepareReport(report,'MSFT');
  assert.equal(result.canPersist,false);
  assert.equal(result.report!.report_completion!.executionStatus,'FAILED');
});
