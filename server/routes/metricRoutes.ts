import type { Express, RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { fetchSecVerifiedIntegrationPackage } from '../../src/services/sec/secIntegration';
import { selectVerifiedSynthesisPeriodView } from '../../src/domain/financialSynthesisGuard';
import { FINANCIAL_METRIC_REGISTRY, selectFinancialMetric } from '../../src/domain/selectedFinancialMetric';
import { analystCacheKey, renderVerifiedAnalystOutput, deterministicMetricInsight, type AnalystFallbackReason } from '../../src/domain/financialAnalystContract';
import { getMetricInterpretationContext } from '../../src/domain/financialMetricContext';
import { METRIC_AI_CONTEXT_VERSION, METRIC_AI_MAX_REQUEST_BYTES, metricAiPayloadBytes } from '../../src/domain/metricAiRequest';
import { requestVerifiedMetricAnalyst, type AnalystProvider } from '../services/verifiedMetricAnalyst';
import { resolveMetricAnalysisModel } from '../services/metricAnalysisModel';
import { metricAiDiagnostic } from '../middleware/metricAiDiagnostics';
import type { FinancialAiInsight } from '../../src/utils/financialAiInsights';

export function registerMetricRoutes(app: Express, requireFirebaseAuth: RequestHandler, metricRateLimit: RequestHandler,
  dependencies: { fetchPackage?: typeof fetchSecVerifiedIntegrationPackage; provider?: AnalystProvider } = {}) {
  const cache = new Map<string, { expires: number; insight: FinancialAiInsight; output: unknown }>();
  app.post("/api/analyze-metric", requireFirebaseAuth, metricRateLimit, async (req, res, next) => { try {
    const body = req.body || {}, compact = Boolean(body.metric);
    const validBodyRequestId = typeof body.requestId === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(body.requestId);
    const requestId = validBodyRequestId ? body.requestId : res.locals.metricRequestId || randomUUID();
    res.locals.metricRequestId = requestId;
    const metricKey = compact ? body.metric?.metricKey : body.metricKey;
    const periods = compact ? Array.isArray(body.history) ? body.history.map((item: any) => item?.period) : undefined : body.periods;
    const isThai = compact ? body.language === 'Thai' : body.isThai !== false;
    const compareMode = body.compareMode || 'yoy';
    const ticker = typeof body.ticker === 'string' ? body.ticker.trim().toUpperCase() : '';
    const identity = { requestId, contextVersion: METRIC_AI_CONTEXT_VERSION, metricKey, dataIdentity: body.dataIdentity };
    const fail = (status: number, code: AnalystFallbackReason, error: string) => res.status(status).json({ ...identity, success: false, code, fallbackReason: code, error });
    const payloadBytes = metricAiPayloadBytes(body);
    if (payloadBytes > METRIC_AI_MAX_REQUEST_BYTES) return fail(413, 'AI_REQUEST_TOO_LARGE', 'Selected metric context exceeds compact request limit.');
    // Also support the old compact metadata-only client during a rolling release.
    // Neither contract accepts a report, statement, source bundle, draft or model ID.
    const fields = compact ? ['requestId','contextVersion','dataIdentity','ticker','companyName','language','compareMode','metric','current','history','relatedMetrics','businessArchetype']
      : ['ticker','metricKey','periods','dataIdentity','isThai','compareMode','requestId','contextVersion'];
    if (Object.keys(body).some(k => !fields.includes(k)) || (body.requestId !== undefined && !validBodyRequestId)
      || (req.get('X-Metric-Request-Id') && req.get('X-Metric-Request-Id') !== requestId)
      || (compact && (body.contextVersion !== METRIC_AI_CONTEXT_VERSION || !['Thai','English'].includes(body.language)
        || !Array.isArray(body.relatedMetrics) || body.relatedMetrics.length > 100 || !body.current)))
      return fail(400, 'AI_REQUEST_INVALID', 'Invalid compact metric context.');
    if (!/^[A-Z0-9.-]{1,12}$/.test(ticker) || typeof metricKey !== 'string' || !FINANCIAL_METRIC_REGISTRY[metricKey]
      || !Array.isArray(periods) || periods.length < 1 || periods.length > 20 || !periods.every(p => typeof p === 'string' && p.length < 55)
      || new Set(periods).size !== periods.length || !['yoy','qoq','hide'].includes(compareMode))
      return fail(400, 'UNSUPPORTED_METRIC', 'Invalid selected metric request.');
    metricAiDiagnostic('parsed-authorized-rate-accepted', { requestId, ticker, metricKey, payloadBytes });
    const policy = resolveMetricAnalysisModel();
    if (!dependencies.provider && !process.env.GEMINI_API_KEY?.trim()) return fail(503, 'AI_API_KEY_MISSING', 'Metric AI API key is missing.');
    if (!dependencies.provider && !policy.configured) return fail(503, 'AI_SERVER_MISCONFIGURED', 'Metric AI model policy is invalid.');
    let pkg: Awaited<ReturnType<typeof fetchSecVerifiedIntegrationPackage>>;
    try {
      pkg = await (dependencies.fetchPackage || fetchSecVerifiedIntegrationPackage)(ticker);
      metricAiDiagnostic('source-resolved', { requestId, ticker, metricKey, statementsAvailable: Boolean(pkg.financialStatements) });
    } catch {
      metricAiDiagnostic('source-failed', { requestId, ticker, metricKey });
      return fail(502, 'AI_SOURCE_UNAVAILABLE', 'Verified source retrieval failed; no provider request was made.');
    }
    const statements = pkg.financialStatements && selectVerifiedSynthesisPeriodView(pkg.financialStatements, periods);
    if (!statements) return fail(422, 'INSUFFICIENT_VERIFIED_DATA', 'Accepted period package unavailable.');
    const selected = selectFinancialMetric(statements, metricKey, periods, compareMode);
    if (typeof body.dataIdentity !== 'string' || body.dataIdentity !== selected.identity)
      return fail(409, 'INSUFFICIENT_VERIFIED_DATA', 'Source package changed; refresh report before synthesis.');
    // No client accounting number, verification flag or business classification becomes authority.
    if (compact && (body.current.period !== periods.at(-1) || body.current.value !== selected.currentValue
      || body.history.some((h: any, i: number) => h?.value !== selected.values[i] || h?.change !== selected.changes[i])
      || body.metric.unit !== selected.definition?.unit || body.metric.changeSemantic !== selected.definition?.changeSemantic
      || body.relatedMetrics.some((r: any) => !r || !Object.hasOwn(selected.relatedMetrics, r.metricKey) || !periods.includes(r.period)
        || r.value !== selected.relatedMetrics[r.metricKey]?.[periods.indexOf(r.period)])))
      return fail(409, 'INSUFFICIENT_VERIFIED_DATA', 'Selected metric context differs from accepted source values.');
    if (!selected.dataQuality.eligibleForAi) return fail(422, selected.dataQuality.reasonCode || 'INSUFFICIENT_VERIFIED_DATA', 'Selected verified metric history is insufficient.');
    const context = getMetricInterpretationContext({ metricKey, metricName: metricKey.replace(/_/g,' '), ticker,
      reportData: { financial_statements: statements, company_profile: { sector: pkg.sourceBundle?.submissions.sicDescription || '', industry: pkg.sourceBundle?.submissions.sicDescription || '' } },
      periods, historyValues: selected.values, yoyPcts: selected.changes, unit: selected.definition?.unit,
      isCurrency: selected.definition?.valueType === 'money', isThai, isSourceReconciled: selected.dataQuality.currentVerified });
    const key = analystCacheKey(ticker, selected, isThai, JSON.stringify(policy)), cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return res.json({ ...identity, success: true, cached: true, insight: cached.insight, output: cached.output, model: cached.insight.model });
    const controller = new AbortController();
    const onClose = () => { if (!res.writableEnded) controller.abort(); };
    res.once('close', onClose);
    try {
      const result = await requestVerifiedMetricAnalyst(selected, context, { model: policy.primary, fallbackModel: policy.fallback,
        provider: dependencies.provider, requestId, ticker, compareMode, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!result.output) {
        const reason = result.fallbackReason || 'AI_PROVIDER_ERROR';
        const status = reason === 'AI_RATE_LIMITED' ? 429 : reason === 'AI_PROVIDER_TIMEOUT' ? 504 :
          ['AI_RESPONSE_EMPTY','AI_RESPONSE_INVALID_JSON','AI_RESPONSE_SCHEMA_INVALID','AI_NUMERIC_VALIDATION_FAILED','AI_EVIDENCE_VALIDATION_FAILED'].includes(reason) ? 502 : 503;
        return fail(status, reason, 'Gemini analysis was not accepted; deterministic analysis remains available.');
      }
      const insight = renderVerifiedAnalystOutput(result.output, deterministicMetricInsight(selected, context), result.model);
      if (cache.size >= 300) cache.delete(cache.keys().next().value!);
      cache.set(key, { expires: Date.now() + 15 * 60_000, insight, output: result.output });
      return res.json({ ...identity, success: true, cached: false, insight, output: result.output, model: result.model, engine: 'GEMINI', dataQuality: selected.dataQuality });
    } finally { res.off('close', onClose); }
  } catch(error) {
    metricAiDiagnostic('handler-failed', { requestId: res.locals.metricRequestId, errorName: error instanceof Error ? error.name : 'Error' });
    if (!res.headersSent) res.status(500).json({success:false,code:'AI_SERVER_MISCONFIGURED',fallbackReason:'AI_SERVER_MISCONFIGURED',error:'Metric analysis handler failed.'});
    else next(error);
  } });
}
