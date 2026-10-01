import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import type { AnalysisReport } from '../types';
import { assertPayloadSize, jsonByteSize, REPORT_PERSISTENCE_LIMITS as limits, restoreReportSections, sanitizeReportForSave } from './reportPersistence';
import { persistReport, readPersistedReport, reportHistoryRecord, type ReportPersistenceStore } from '../services/reportPersistenceService';
import { buildSecVerifiedIntegrationPackage } from '../services/sec/secIntegration';
import { selectFinancialMetric } from '../domain/selectedFinancialMetric';

const options = { reportId: 'save_test_1', userId: 'owner_1', language: 'Thai', now: '2026-09-28T12:00:00.000Z' };
const base = (): AnalysisReport => ({ generated_at: options.now, ticker: 'TEST', summary: 'Test-only report', schema_version: 7, verdict: { summary: 'Thesis remains unchanged', conviction_score: 0, key_takeaways: ['Supported test takeaway'] } });
function memoryStore(blobs = false) {
  const docs = new Map<string, Record<string, any>>(), objects = new Map<string, string>(), writes: number[] = [], reads: string[] = [];
  const store: ReportPersistenceStore = {
    async write(path, data) { assertPayloadSize(data, path); writes.push(jsonByteSize(data)); if (docs.has(path)) throw new Error('Immutable existing part'); docs.set(path, structuredClone(data)); },
    async read(path) { reads.push(path); return docs.has(path) ? structuredClone(docs.get(path)!) : undefined; },
    async publish(path) { if (!docs.has(`${path}/sections/_manifest`)) throw new Error('Missing manifest'); docs.get(path)!.persistenceState = 'ready'; },
  };
  if (blobs) {
    store.uploadBlob = async (path, json) => { objects.set(path, json); };
    store.readBlob = async path => { if (!objects.has(path)) throw new Error('Missing object'); return objects.get(path)!; };
  }
  return { store, docs, objects, writes, reads };
}

test('11.5MB report saves and reads back without any oversized database request/root', async () => {
  const report = { ...base(), comprehensive_analysis: { business_overview: 'x'.repeat(11_500_000), scoring: { score: null } } } as unknown as AnalysisReport;
  const storage = memoryStore();
  assert.ok(jsonByteSize(report) > 11_500_000);
  await persistReport(storage.store, report, options);
  const main = storage.docs.get('reports/save_test_1')!;
  assert.ok(jsonByteSize(main) < limits.summaryHardBytes);
  assert.equal(main.data, undefined); assert.equal(main.financial_statements, undefined);
  assert.ok(Math.max(...storage.writes) < limits.documentHardBytes);
  assert.deepEqual(await readPersistedReport(storage.store, options.reportId), report);
});

test('History preserves a partial AI review without promoting it to fully validated output',async()=>{
  const report={...base(),generation_review:{status:'PRIMARY_ONLY',reason:'VALIDATOR_OUTPUT_UNAVAILABLE'},
    current_narrative_audit:[{metric:'roe',claimedValue:6.1,canonicalValue:7.09,period:'TTM ending Q2 2026'}]} as AnalysisReport;
  const storage=memoryStore();await persistReport(storage.store,report,options);
  const restored=await readPersistedReport(storage.store,options.reportId);
  assert.deepEqual(restored.generation_review,report.generation_review);
  assert.deepEqual(restored.current_narrative_audit,report.current_narrative_audit);
  assert.equal(storage.docs.get('reports/save_test_1')!.generation_review,undefined,'Main metadata remains compact');
});

test('sanitizer separates sources/history, strips model/debug/UI state and never mutates accounting null/zero arrays', () => {
  const report: any = { ...base(), financial_statements: { periods: ['Q1 2026', 'Q2 2026'], income_statement: { revenue: [0, null], eps: [null, -0.2] }, debug_trace: 'private', sourceBundle: { companyfacts: { facts: 'source only' } } }, raw_model_context: 'do not retain', prompt: 'private prompt', selectedTab: 'income', empty: {}, research_history: [{ report: 'old snapshot' }] };
  const before = structuredClone(report), plan = sanitizeReportForSave(report, options);
  assert.deepEqual(report, before);
  assert.deepEqual((plan.sections.financial_statements as any).income_statement, { revenue: [0, null], eps: [null, -0.2] });
  assert.equal((plan.sections.financial_statements as any).sourceBundle, undefined);
  assert.equal(JSON.stringify(plan).includes('private prompt'), false);
  assert.equal(JSON.stringify(plan).includes('do not retain'), false);
  assert.equal((plan.sections.financial_statements as any).debug_trace, undefined);
  assert.equal(Object.keys(plan.artifacts).length, 1); assert.equal(Object.keys(plan.history).length, 1);
  assert.equal(plan.summary.convictionScore, 0);
});

test('real captured SEC report retains selected values/source identity after dedupe and rehydration', async () => {
  const source = JSON.parse(readFileSync(new URL('../services/sec/fixtures/verified-completion-2026.json', import.meta.url), 'utf8'));
  const pkg = buildSecVerifiedIntegrationPackage(source), financials = pkg.financialStatements!;
  const report = { ...base(), ticker: 'TSLA', canonical_financials: financials.verified_dataset, financial_statements: financials };
  const plan = sanitizeReportForSave(report, options);
  assert.ok(plan.aliases.some(alias => alias.target.join('.') === 'financial_statements.verified_dataset'));
  assert.ok(plan.recomputedFields.includes('financial_statements.period_snapshots'));
  const storage = memoryStore(true); await persistReport(storage.store, report, options);
  const loaded = await readPersistedReport(storage.store, options.reportId);
  for (const metric of ['revenue', 'operating_margin', 'total_assets', 'ocf', 'roic', 'eps', 'debt']) {
    const before = selectFinancialMetric(financials, metric, financials.periods.slice(-4));
    const after = selectFinancialMetric(loaded.financial_statements!, metric, financials.periods.slice(-4));
    assert.deepEqual(after.values, before.values, metric); assert.equal(after.identity, before.identity, metric);
  }
  assert.deepEqual(loaded.financial_statements?.cash_flow, financials.cash_flow);
});

test('object storage stores only checked metadata refs, history is not eagerly read, checksum corruption rejects', async () => {
  const report = { ...base(), peer_comparison: { peers: [{ details: 'sector data'.repeat(50_000) }] }, research_history: [{ snapshot: 'history'.repeat(60_000) }] } as unknown as AnalysisReport;
  const storage = memoryStore(true); await persistReport(storage.store, report, options);
  assert.ok(storage.objects.size >= 2);
  const manifest = storage.docs.get('reports/save_test_1/sections/_manifest')!;
  assert.ok(manifest.history.length > 0);
  await readPersistedReport(storage.store, options.reportId);
  assert.equal(storage.reads.some(path => path.includes('/history/')), false);
  const peer = storage.docs.get('reports/save_test_1/sections/peer_comparison')!;
  assert.equal(peer.json, undefined);
  const artifact = storage.docs.get(`reports/save_test_1/artifacts/${peer.artifactId}`)!;
  assert.equal(artifact.backend, 'firebase-storage'); assert.equal(typeof artifact.checksum, 'string'); assert.equal(artifact.json, undefined);
  storage.objects.set(artifact.storagePath, 'corrupt');
  await assert.rejects(() => readPersistedReport(storage.store, options.reportId), /checksum/);
});

test('blob upload/read failure falls back once to bounded chunks and preserves emoji/control characters', async () => {
  const report = { ...base(), final_report: 'ไทย✨🌏\n\t"'.repeat(60_000), chartImage: 'z'.repeat(350_000) };
  const storage = memoryStore(); let attempts = 0;
  storage.store.uploadBlob = async () => { attempts++; throw new Error('Bucket unavailable'); };
  await persistReport(storage.store, report, options);
  assert.equal(attempts, 1);
  assert.deepEqual(await readPersistedReport(storage.store, options.reportId), report);
  const part = [...storage.docs.keys()].find(key => key.includes('_part_'))!;
  storage.docs.delete(part);
  await assert.rejects(() => readPersistedReport(storage.store, options.reportId), /chunk missing/);
});

test('partial write is never published or readable, and safety budget blocks before the first write', async () => {
  const storage = memoryStore(), write = storage.store.write;
  storage.store.write = async (path, data) => { if (path.includes('/sections/')) throw new Error('Interrupted write'); await write(path, data); };
  await assert.rejects(() => persistReport(storage.store, base(), options), /Interrupted/);
  assert.equal(storage.docs.get('reports/save_test_1')!.persistenceState, 'saving');
  await assert.rejects(() => readPersistedReport(storage.store, options.reportId), /incomplete/);
  const large = memoryStore();
  await assert.rejects(() => persistReport(large.store, { ...base(), final_report: 'x'.repeat(limits.totalHardBytes) }, options), /total budget/);
  assert.equal(large.docs.size, 0);
});

test('legacy inline reports remain readable without migration; summary-only list preserves timeline values', async () => {
  const storage = memoryStore(), legacy = base();
  storage.docs.set('reports/legacy', { data: legacy });
  assert.deepEqual(await readPersistedReport(storage.store, 'legacy'), legacy);
  const plan = sanitizeReportForSave({ ...base(), technical_analysis: { key_levels: { current_price: 123 } } } as unknown as AnalysisReport, options);
  const record = reportHistoryRecord(options.reportId, plan.summary);
  assert.equal(record.isSummaryOnly, true); assert.equal(record.data.intrinsic_value.current_price, 123);
  assert.equal(record.data.verdict.conviction_score, 0); assert.equal(record.data.generated_at, options.now);
  storage.docs.get('reports/legacy')!.deletedAt = options.now;
  await assert.rejects(() => readPersistedReport(storage.store, 'legacy'), /unavailable/);
});

test('byte thresholds use UTF8 and corrupted aliases/path traversal are rejected', () => {
  assert.equal(jsonByteSize('ก'), 5);
  assert.throws(() => assertPayloadSize({ x: 'ก'.repeat(100) }, 'small', 100), /split limit/);
  assert.throws(() => restoreReportSections({}, [{ source: ['ticker'], target: ['__proto__', 'x'] }]), /Invalid/);
});

test('selected bank/REIT assumptions never become industrial DCF inputs', () => {
  for (const [model, field] of [['ddm', 'ddm_model'], ['reit_affo', 'reit_model']]) {
    const report = { ...base(), intrinsic_value: { selected_model: { model_type: model }, [field]: { assumptions: { cost_of_equity_pct: 11, source_note: 'Selected sector model' } }, dcf_model: { assumptions: { wacc_pct: 99 } } } } as unknown as AnalysisReport;
    const summary = sanitizeReportForSave(report, options).summary;
    assert.equal(summary.valuationAssumptions.model, model);
    assert.equal(summary.valuationAssumptions.cost_of_equity_pct, 11);
    assert.equal(summary.valuationAssumptions.wacc_pct, undefined);
  }
});

test('main summary preserves explicit unavailable canonical valuation instead of resurrecting stale fallback', () => {
  const report = { ...base(), canonical_executive_snapshot: { market: { currentPrice: null }, canonicalValuation: { baseFairValue: null, marginOfSafetyPct: null }, conviction: { score: null } }, intrinsic_value: { current_price: 50, summary: { base_case_fair_value: 100, margin_of_safety_pct: 100 } } } as unknown as AnalysisReport;
  const summary = sanitizeReportForSave(report, options).summary;
  assert.equal(summary.marketPrice, null); assert.equal(summary.fairValue, null);
  assert.equal(summary.convictionScore, null); assert.equal(summary.flags.marginOfSafetyPct, null);
});

test('all captured sector/fiscal/currency models round-trip their accounting observations', async () => {
  const captures = JSON.parse(readFileSync(new URL('../services/sec/fixtures/verified-cross-sector-2026.json', import.meta.url), 'utf8'));
  const foreign = JSON.parse(readFileSync(new URL('../services/sec/fixtures/verified-ifrs-annual-2026.json', import.meta.url), 'utf8'));
  for (const source of [...captures.bundles.filter((b: any) => ['MSFT', 'CRM', 'NVDA', 'JPM', 'PGR', 'PLD', 'CRSP'].includes(b.identity.ticker)), foreign]) {
    const pkg = buildSecVerifiedIntegrationPackage(structuredClone(source)), fs = pkg.financialStatements!;
    assert.ok(fs?.verified_dataset, source.identity.ticker);
    const storage = memoryStore(true), report = { ...base(), ticker: source.identity.ticker, canonical_financials: fs.verified_dataset, financial_statements: fs };
    await persistReport(storage.store, report, options);
    const loaded = await readPersistedReport(storage.store, options.reportId);
    assert.equal(loaded.financial_statements?.currency, fs.currency);
    assert.equal(fs.currency, source.identity.ticker === 'TSM' ? 'TWD' : 'USD');
    assert.deepEqual(loaded.financial_statements?.periods, fs.periods);
    // JSON persistence intentionally omits undefined optional object keys.
    assert.deepEqual(JSON.parse(JSON.stringify(loaded.financial_statements?.period_snapshots)), JSON.parse(JSON.stringify(fs.period_snapshots)));
    assert.deepEqual(JSON.parse(JSON.stringify(loaded.financial_statements?.balance_sheet)), JSON.parse(JSON.stringify(fs.balance_sheet)));
    assert.deepEqual(loaded.verdict, report.verdict);
  }
});
