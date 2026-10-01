import type { AnalysisReport } from '../types';
import type { PersistedJson, PersistedReportEnvelope, ReportSummary } from '../types/reportPersistence';
import { adaptSecCanonicalToFinancialStatements } from '../services/sec/secLegacyAdapter';
import { calculateVerifiedKeyIndicators } from '../domain/verifiedKeyIndicators';

export const REPORT_PERSISTENCE_LIMITS = {
  summaryHardBytes: 64 * 1024,
  documentSoftBytes: 128 * 1024,
  documentHardBytes: 256 * 1024,
  chunkBytes: 128 * 1024,
  totalHardBytes: 64 * 1024 * 1024,
  maxParts: 2048,
};
const encoder = new TextEncoder();
export const jsonByteSize = (value: unknown): number => encoder.encode(JSON.stringify(value) ?? 'null').byteLength;
export const utf8ByteSize = (value: string): number => encoder.encode(value).byteLength;
export async function checksumJson(json: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(json));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function assertPayloadSize(value: unknown, name: string, limit = REPORT_PERSISTENCE_LIMITS.documentHardBytes): number {
  const bytes = jsonByteSize(value);
  if (bytes > limit) throw new Error(`${name} is ${bytes} bytes; split limit is ${limit} bytes.`);
  return bytes;
}

const excluded = /^(?:debug(?:_.*)?|trace(?:_.*)?|_.*|ui_state|uiState|loading|isLoading|selectedTab|expandedRows|raw_model_context|rawModelContext|model_context|prompt|system_prompt|raw_prompt|raw_response|full_ai_response|ai_prompt|ai_response|agent_events|agent_trace)$/i;
const sourceKeys = new Set(['sourceBundle', 'source_bundle', 'companyfacts', 'company_facts', 'raw_sec', 'raw_sec_payload', 'raw_financial_statements']);
const historyKeys = new Set(['research_history', 'researchHistory', 'history_snapshots', 'report_history', 'past_reports', 'comparison_payloads', 'comparisonPayloads']);
const sectionKeys = new Set([
  'generated_at', 'ticker', 'summary', 'as_of_date', 'analysis_type', 'schema_version', 'generated_by_version',
  'validation', 'report_completion', 'generation_review', 'current_narrative_audit', 'sec_verification', 'canonical_financials', 'market_snapshot', 'report_provenance', 'verdict',
  'comprehensive_analysis', 'technical_analysis', 'financial_statements', 'key_indicators', 'valuation_ratios',
  'valuation_percentile_chart', 'valuation_dashboard', 'intrinsic_value', 'earnings_analysis', 'forecast_dashboard',
  'morningstar_research', 'peer_comparison', 'catalysts_and_events', 'insider_activity', 'smart_money',
  'corporate_actions', 'company_profile', 'business_analysis', 'five_pillars', 'deep_insights', 'findings',
  'financial_charts', 'final_report', 'chartImage', 'data_completeness', 'sotp_model', 'management_guidance_history',
]);
export interface ReportSavePlan {
  summary: ReportSummary;
  sections: Record<string, PersistedJson>;
  artifacts: Record<string, PersistedJson>;
  history: Record<string, PersistedJson>;
  aliases: PersistedReportEnvelope['aliases'];
  recomputedFields: string[];
  sizes: Record<string, number>;
}
const text = (value: unknown, max = 4000): string => typeof value === 'string' ? Array.from(value).slice(0, max).join('') : '';
const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
// Explicit unavailable canonical values must not resurrect a stale fallback price/valuation.
const firstDefined = (...values: unknown[]): unknown => values.find(value => value !== undefined);
const get = (root: any, path: string[]) => path.reduce((value, key) => value?.[key], root);
const set = (root: any, path: string[], value: unknown) => {
  let node = root;
  for (const key of path.slice(0, -1)) node = node[key] ??= {};
  node[path[path.length - 1]] = value;
};

/** Clone, don't mutate. Financial nulls and array positions are accounting evidence, not clutter. */
export function sanitizeReportForSave(report: AnalysisReport, options: { reportId: string; userId: string; language: string; now?: string }): ReportSavePlan {
  const artifacts: Record<string, PersistedJson> = {}, history: Record<string, PersistedJson> = {};
  let ordinal = 0;
  const clean = (value: unknown, path: string[], extract = true): PersistedJson | undefined => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.map((item, i) => clean(item, [...path, String(i)], extract) ?? null);
    if (typeof value !== 'object') return undefined;
    const output: Record<string, PersistedJson> = {};
    for (const [key, item] of Object.entries(value)) {
      if (excluded.test(key)) continue;
      if (extract && (sourceKeys.has(key) || historyKeys.has(key))) {
        const content = clean(item, [...path, key], false);
        if (content !== undefined && content !== null) {
          const id = `${sourceKeys.has(key) ? 'source' : 'snapshot'}_${ordinal++}`;
          (sourceKeys.has(key) ? artifacts : history)[id] = { originalPath: [...path, key], payload: content };
        }
        continue;
      }
      const result = clean(item, [...path, key], extract);
      if (result !== undefined && !(typeof result === 'object' && result !== null && !Array.isArray(result) && !Object.keys(result).length)) output[key] = result;
    }
    return Object.keys(output).length ? output : undefined;
  };
  const sections: Record<string, PersistedJson> = {};
  for (const [key, value] of Object.entries(report)) {
    // Canonical executive snapshot is fully recomputable from the accepted section inputs.
    if (key === 'canonical_executive_snapshot' || excluded.test(key)) continue;
    if (sourceKeys.has(key) || historyKeys.has(key)) {
      const result = clean(value, [key], false);
      if (result !== undefined) (sourceKeys.has(key) ? artifacts : history)[`extra_${ordinal++}`] = { originalPath: [key], payload: result };
    } else if (sectionKeys.has(key)) {
      const result = clean(value, [key]);
      if (result !== undefined) sections[key] = result;
    }
  }
  const aliases: PersistedReportEnvelope['aliases'] = [];
  const recomputedFields: string[] = [];
  const canonical = sections.canonical_financials as any;
  const financials = sections.financial_statements as any;
  if (canonical && financials) {
    const adapter = adaptSecCanonicalToFinancialStatements(canonical);
    const derived = { period_snapshots: adapter?.period_snapshots, indicator_details: adapter ? calculateVerifiedKeyIndicators(adapter) : undefined };
    for (const [key, value] of Object.entries(derived)) {
      const comparable = value === undefined ? undefined : clean(value, ['financial_statements', key], false);
      if (financials[key] !== undefined && comparable !== undefined && JSON.stringify(financials[key]) === JSON.stringify(comparable)) {
        delete financials[key]; recomputedFields.push(`financial_statements.${key}`);
      }
    }
  }
  for (const [target, source] of [
    [['financial_statements', 'verified_dataset'], ['canonical_financials']],
    [['sec_verification', 'canonical_financials'], ['canonical_financials']],
    [['key_indicators'], ['financial_statements', 'key_indicators']],
  ]) {
    const a = get(sections, target), b = get(sections, source);
    if (a !== undefined && b !== undefined && JSON.stringify(a) === JSON.stringify(b)) {
      const parent = get(sections, target.slice(0, -1)); delete parent[target[target.length - 1]];
      aliases.push({ target, source });
    }
  }
  const r = report as any, snapshot = r.canonical_executive_snapshot;
  const valuationRun = r.intrinsic_value?.canonical_run;
  const model = snapshot?.canonicalValuation?.modelType ?? r.intrinsic_value?.selected_model?.model_type;
  const valuation = r.intrinsic_value;
  const assumptions = model === 'ddm' || model === 'RESIDUAL_INCOME' || model === 'DIVIDEND_DISCOUNT'
      ? valuation?.ddm_model?.assumptions ?? {}
    : model === 'reit_affo' || model === 'AFFO_MULTIPLE' ? valuation?.reit_model?.assumptions ?? {}
    : model === 'SOTP' ? {
      corporateAdjustments: (r.sotp_model ?? valuation?.sotp_model)?.corporateAdjustments,
      netDebtOrCash: (r.sotp_model ?? valuation?.sotp_model)?.netDebtOrCash,
    }
    : model === 'relative_only' ? { primary_metric: valuation?.relative_only_model?.primary_metric, peer_median_multiple: valuation?.relative_only_model?.peer_median_multiple }
    : model === 'dcf_cyclical' ? { ...valuation?.cyclical_model?.historical_margins, cycle_length_years: valuation?.cyclical_model?.cycle_length_years }
    : valuation?.dcf_model?.assumptions ?? {};
  const selectedAssumptions: ReportSummary['valuationAssumptions'] = {};
  for (const [key, value] of Object.entries(assumptions).slice(0, 40)) {
    if (typeof value === 'number' && Number.isFinite(value) || typeof value === 'boolean' || value === null) selectedAssumptions[key] = value as number | boolean | null;
    else if (typeof value === 'string') selectedAssumptions[key] = text(value, 500);
  }
  if (typeof model === 'string') selectedAssumptions.model = text(model, 100);
  const summary: ReportSummary = {
    reportId: options.reportId, userId: options.userId, ticker: text(r.ticker, 12).toUpperCase(),
    companyName: text(snapshot?.identity?.companyName ?? r.company_profile?.overview?.company_name ?? r.company_profile?.company_name, 200),
    marketPrice: number(firstDefined(snapshot?.market?.currentPrice, snapshot?.facts?.currentPrice?.value, r.market_snapshot?.price, r.intrinsic_value?.current_price, r.intrinsic_value?.summary?.current_price, r.technical_analysis?.key_levels?.current_price)),
    fairValue: number(valuationRun ? valuationRun.baseFairValue : firstDefined(snapshot?.canonicalValuation?.baseFairValue, snapshot?.valuation?.fairValue, r.intrinsic_value?.summary?.base_case_fair_value, r.intrinsic_value?.dcf_model?.scenarios?.base?.fair_value_per_share)),
    convictionScore: number(firstDefined(snapshot?.conviction?.score, r.verdict?.conviction_score)), executiveSummary: text(r.summary, 12000),
    keyTakeaways: (Array.isArray(r.verdict?.key_takeaways) ? r.verdict.key_takeaways : []).slice(0, 12).map((item: unknown) => text(item, 1200)),
    thesisSummary: text(r.verdict?.summary, 4000), valuationAssumptions: selectedAssumptions,
    ...(valuationRun ? { valuationRun: {
      valuationRunId: valuationRun.valuationRunId,
      financialSnapshotId: valuationRun.financialSnapshotId,
      inputHash: valuationRun.inputHash,
      assumptionHash: valuationRun.assumptionHash,
      modelVersion: valuationRun.modelVersion,
      primaryMethod: valuationRun.primaryMethod,
      status: valuationRun.status,
    } } : {}),
    flags: { validationStatus: r.validation?.status ?? 'warning', analysisType: r.analysis_type ?? 'fundamental', marginOfSafetyPct: number(valuationRun ? valuationRun.marginOfSafetyPct : firstDefined(snapshot?.canonicalValuation?.marginOfSafetyPct, snapshot?.valuation?.marginOfSafetyPct, r.intrinsic_value?.summary?.margin_of_safety_pct)),
      ...(r.report_completion ? {
        executionStatus: r.report_completion.executionStatus,
        coverageStatus: r.report_completion.coverageStatus,
        consistencyStatus: r.report_completion.consistencyStatus,
        valuationStatus: r.report_completion.valuationStatus,
        qualityStatus: r.report_completion.qualityStatus,
        persistenceStatus: r.report_completion.persistenceStatus,
        missingSections: r.report_completion.missingSections,
      } : {}) },
    language: text(options.language, 20), generatedAt: text(r.generated_at, 60), createdAt: options.now ?? new Date().toISOString(),
    schemaVersion: number(r.schema_version) ?? 0, generatedByVersion: text(r.generated_by_version, 100), persistenceVersion: 2,
  };
  // Thai/other multi-byte prose must stay bounded in bytes, not just JS character counts.
  while (jsonByteSize(summary) > REPORT_PERSISTENCE_LIMITS.summaryHardBytes - 2048) {
    if (summary.executiveSummary.length > 1000) summary.executiveSummary = text(summary.executiveSummary, Math.floor(summary.executiveSummary.length / 2));
    else if (summary.keyTakeaways.length) summary.keyTakeaways.pop();
    else throw new Error('Report summary exceeds persistence budget.');
  }
  assertPayloadSize(summary, 'Report summary', REPORT_PERSISTENCE_LIMITS.summaryHardBytes);
  const sizes: Record<string, number> = { summary: jsonByteSize(summary) };
  for (const [kind, values] of Object.entries({ sections, artifacts, history })) for (const [key, value] of Object.entries(values)) sizes[`${kind}/${key}`] = jsonByteSize(value);
  const total = Object.values(sizes).reduce((sum, bytes) => sum + bytes, 0);
  if (total > REPORT_PERSISTENCE_LIMITS.totalHardBytes) throw new Error(`Report exceeds ${REPORT_PERSISTENCE_LIMITS.totalHardBytes} byte total budget; source archive needs external export.`);
  if (Object.keys(sizes).length > REPORT_PERSISTENCE_LIMITS.maxParts) throw new Error('Too many report parts.');
  return { summary, sections, artifacts, history, aliases, recomputedFields, sizes };
}

export function restoreReportSections(sections: Record<string, PersistedJson>, aliases: PersistedReportEnvelope['aliases'], recomputedFields: string[] = []): AnalysisReport {
  const result = structuredClone(sections);
  for (const alias of aliases) {
    if (!alias.source.length || !alias.target.length || [...alias.source, ...alias.target].some(key => ['__proto__', 'prototype', 'constructor'].includes(key))) throw new Error('Invalid report alias.');
    const value = get(result, alias.source);
    if (value === undefined) throw new Error('Report dependency missing.');
    set(result, alias.target, value);
  }
  if (recomputedFields.length) {
    const accepted = adaptSecCanonicalToFinancialStatements(result.canonical_financials as any);
    if (!accepted || !result.financial_statements) throw new Error('Saved accounting dependency missing.');
    const financials = result.financial_statements as Record<string, PersistedJson>;
    for (const key of recomputedFields) {
      if (key === 'financial_statements.period_snapshots') financials.period_snapshots = accepted.period_snapshots as unknown as PersistedJson;
      else if (key === 'financial_statements.indicator_details') financials.indicator_details = calculateVerifiedKeyIndicators(accepted) as unknown as PersistedJson;
      else throw new Error('Unsupported recomputable field.');
    }
  }
  return result as unknown as AnalysisReport;
}

/** Summary adapter keeps list/timeline callers compatible; it is never rendered as a full report. */
export function summaryReportPreview(summary: ReportSummary): AnalysisReport {
  return {
    ticker: summary.ticker, generated_at: summary.generatedAt, summary: summary.executiveSummary,
    analysis_type: summary.flags.analysisType as AnalysisReport['analysis_type'], schema_version: summary.schemaVersion,
    generated_by_version: summary.generatedByVersion,
    verdict: { summary: summary.thesisSummary, conviction_score: summary.convictionScore, key_takeaways: summary.keyTakeaways },
    intrinsic_value: { current_price: summary.marketPrice, summary: { current_price: summary.marketPrice, base_case_fair_value: summary.fairValue, dcf_fair_value: summary.fairValue, margin_of_safety_pct: summary.flags.marginOfSafetyPct } } as unknown as AnalysisReport['intrinsic_value'],
  };
}
