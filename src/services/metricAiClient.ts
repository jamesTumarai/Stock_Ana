import type { SelectedFinancialMetric } from '../domain/selectedFinancialMetric';
import type { MetricInterpretationContext } from '../domain/financialMetricContext';
import { buildMetricAiRequest, METRIC_AI_CONTEXT_VERSION, METRIC_AI_MAX_REQUEST_BYTES, metricAiPayloadBytes } from '../domain/metricAiRequest';
import { ANALYST_FAILURE_CODES, verifiedAnalystValidationFailure, deterministicMetricInsight, renderVerifiedAnalystOutput, type AnalystFallbackReason, type VerifiedAnalystOutput } from '../domain/financialAnalystContract';
import type { FinancialAiInsight } from '../utils/financialAiInsights';

export interface MetricClientResult { insight?: FinancialAiInsight; reason?: AnalystFallbackReason }
export async function fetchMetricAi(selected: SelectedFinancialMetric, context: MetricInterpretationContext,
  options: { requestId: string; ticker: string; companyName?: string; isThai: boolean; compareMode: 'yoy'|'qoq'|'hide'; signal: AbortSignal;
    fetcher: typeof fetch; isCurrent: () => boolean; onRequest?: () => void;
    diagnostic?: (metadata: Record<string, unknown>) => void }): Promise<MetricClientResult> {
  const current = () => !options.signal.aborted && options.isCurrent();
  if (!current()) return { reason: 'AI_STALE_REQUEST_DISCARDED' };
  if (!selected.dataQuality.eligibleForAi) return { reason: selected.dataQuality.reasonCode || 'INSUFFICIENT_VERIFIED_DATA' };
  const body = buildMetricAiRequest(selected, context, options), bytes = metricAiPayloadBytes(body);
  if (bytes > METRIC_AI_MAX_REQUEST_BYTES) return { reason: 'AI_CONTEXT_TOO_LARGE' };
  const meta = { requestId: options.requestId, ticker: options.ticker, metricKey: selected.metricKey, payloadBytes: bytes };
  try {
    options.onRequest?.();
    const response = await options.fetcher('/api/analyze-metric', { method: 'POST', signal: options.signal,
      headers: { 'Content-Type': 'application/json', 'X-Metric-Request-Id': options.requestId }, body: JSON.stringify(body) });
    if (!current()) return { reason: 'AI_STALE_REQUEST_DISCARDED' };
    let json: any;
    try { json = await response.json(); } catch {
      const reason: AnalystFallbackReason = response.status === 413 ? 'AI_REQUEST_TOO_LARGE' : response.status === 401 ? 'AI_AUTH_REQUIRED' : response.status === 429 ? 'AI_RATE_LIMITED' : 'AI_RESPONSE_INVALID_JSON';
      options.diagnostic?.({ ...meta, httpStatus: response.status, reason });
      return current() ? { reason } : { reason: 'AI_STALE_REQUEST_DISCARDED' };
    }
    if (!current()) return { reason: 'AI_STALE_REQUEST_DISCARDED' };
    if (!response.ok || json?.success !== true) {
      const known = ANALYST_FAILURE_CODES.includes(json?.code || json?.fallbackReason);
      const reason: AnalystFallbackReason = response.status === 413 ? 'AI_REQUEST_TOO_LARGE' : response.status === 401 ? 'AI_AUTH_REQUIRED' : response.status === 429 ? 'AI_RATE_LIMITED' : known ? json.code || json.fallbackReason : 'AI_PROVIDER_ERROR';
      options.diagnostic?.({ ...meta, httpStatus: response.status, reason });
      return { reason };
    }
    if (json.requestId !== options.requestId || json.contextVersion !== METRIC_AI_CONTEXT_VERSION || json.metricKey !== selected.metricKey || json.dataIdentity !== selected.identity) {
      options.diagnostic?.({ ...meta, httpStatus: response.status, reason: 'AI_STALE_REQUEST_DISCARDED' });
      return { reason: 'AI_STALE_REQUEST_DISCARDED' };
    }
    const failure = verifiedAnalystValidationFailure(json.output, selected);
    if (failure || json.insight?.engine !== 'GEMINI' || typeof json.model !== 'string' || !json.model.trim()) {
      const reason = failure || 'AI_RESPONSE_SCHEMA_INVALID';
      options.diagnostic?.({ ...meta, httpStatus: response.status, reason });
      return { reason };
    }
    const insight = renderVerifiedAnalystOutput(json.output as VerifiedAnalystOutput, deterministicMetricInsight(selected, context), json.model);
    options.diagnostic?.({ ...meta, httpStatus: response.status, model: json.model, schemaSucceeded: true, numericSucceeded: true });
    return { insight };
  } catch (error) {
    if (!current()) return { reason: 'AI_STALE_REQUEST_DISCARDED' };
    const code = (error as { code?: string })?.code;
    const reason: AnalystFallbackReason = code === 'AUTH_REQUIRED' ? 'AI_AUTH_REQUIRED' : 'AI_PROVIDER_ERROR';
    options.diagnostic?.({ ...meta, reason });
    return { reason };
  }
}

export function metricAiFailureLabel(reason: AnalystFallbackReason, isThai: boolean): string {
  const labels: Partial<Record<AnalystFallbackReason, [string, string]>> = {
    AI_CONTEXT_TOO_LARGE: ['บริบทตัวชี้วัดใหญ่เกินไป', 'Metric context too large'], AI_REQUEST_TOO_LARGE: ['คำขอใหญ่เกินขีดจำกัด', 'Request exceeds size limit'],
    AI_REQUEST_INVALID: ['รูปแบบคำขอไม่ถูกต้อง', 'Invalid metric request'], AI_AUTH_REQUIRED: ['เข้าสู่ระบบเพื่อใช้ Gemini', 'Sign in to use Gemini'],
    AI_RATE_LIMITED: ['ถึงขีดจำกัดการเรียก Gemini', 'Gemini request limit reached'], AI_SERVER_MISCONFIGURED: ['การตั้งค่า AI ฝั่งเซิร์ฟเวอร์ไม่ถูกต้อง', 'Server AI configuration invalid'],
    AI_API_KEY_MISSING: ['ยังไม่ได้ตั้งค่า Gemini API key', 'Gemini API key missing'], AI_MODEL_UNAVAILABLE: ['รุ่น Gemini นี้ไม่พร้อมใช้งาน', 'Gemini model unavailable'],
    AI_PROVIDER_TIMEOUT: ['Gemini ใช้เวลานานเกินกำหนด', 'Gemini request timed out'], AI_PROVIDER_UNAVAILABLE: ['Gemini ไม่พร้อมใช้งานชั่วคราว', 'Gemini temporarily unavailable'],
    AI_PROVIDER_ERROR: ['การเรียก Gemini ไม่สำเร็จ', 'Gemini request failed'], AI_SOURCE_UNAVAILABLE: ['ดึงข้อมูลที่ตรวจสอบได้ไม่สำเร็จ', 'Verified source retrieval failed'],
    AI_RESPONSE_EMPTY: ['Gemini ไม่ส่งเนื้อหากลับ', 'Gemini returned no content'], AI_RESPONSE_INVALID_JSON: ['คำตอบ Gemini ไม่ใช่ JSON ที่อ่านได้', 'Gemini returned invalid JSON'],
    AI_RESPONSE_SCHEMA_INVALID: ['รูปแบบคำตอบ Gemini ไม่ผ่านการตรวจ', 'Gemini response schema rejected'], AI_NUMERIC_VALIDATION_FAILED: ['คำตอบ AI อ้างตัวเลขนอกข้อมูลที่ตรวจสอบได้', 'AI cited unsupported financial numbers'],
    AI_EVIDENCE_VALIDATION_FAILED: ['คำตอบ AI อ้างแนวโน้มของรายการที่ยังตรวจสอบไม่ได้', 'AI cited a trend for an unavailable companion'],
    AI_STALE_REQUEST_DISCARDED: ['ละทิ้งคำตอบที่ไม่ตรงกับข้อมูลปัจจุบัน', 'Outdated response discarded'], INSUFFICIENT_VERIFIED_DATA: ['ข้อมูลงวดที่ตรวจสอบได้ไม่เพียงพอ', 'Insufficient verified metric history'],
    UNSUPPORTED_METRIC: ['ตัวชี้วัดนี้ยังไม่รองรับ AI', 'Metric not supported for AI'], NOT_APPLICABLE: ['ตัวชี้วัดนี้ไม่เหมาะกับธุรกิจ', 'Metric not applicable'],
  };
  return labels[reason]?.[isThai ? 0 : 1] || reason;
}
