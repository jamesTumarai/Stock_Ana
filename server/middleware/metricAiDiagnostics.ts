import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { METRIC_AI_CONTEXT_VERSION } from '../../src/domain/metricAiRequest';
export function metricAiDiagnostic(stage: string, metadata: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'production') console.info('[metric-ai]', stage, metadata);
}
export const instrumentMetricRequest: RequestHandler = (req, res, next) => {
  const header = req.get('X-Metric-Request-Id');
  res.locals.metricRequestId = header && /^[A-Za-z0-9_-]{1,100}$/.test(header) ? header : randomUUID();
  const start = Date.now();
  metricAiDiagnostic('received', { requestId: res.locals.metricRequestId, payloadBytes: Number(req.get('Content-Length')) || null });
  const json = res.json.bind(res);
  res.json = (body: any) => {
    if (res.statusCode >= 400) {
      const code = res.statusCode === 413 ? 'AI_REQUEST_TOO_LARGE' : res.statusCode === 401 ? 'AI_AUTH_REQUIRED' : res.statusCode === 429 ? 'AI_RATE_LIMITED' : body?.code === 'INVALID_JSON' ? 'AI_REQUEST_INVALID' : body?.code || body?.fallbackReason || 'AI_PROVIDER_ERROR';
      body = { ...body, success: false, code, fallbackReason: code, requestId: res.locals.metricRequestId, contextVersion: METRIC_AI_CONTEXT_VERSION };
    }
    return json(body);
  };
  res.once('finish', () => metricAiDiagnostic('http-complete', { requestId: res.locals.metricRequestId, httpStatus: res.statusCode, durationMs: Date.now() - start }));
  next();
};
