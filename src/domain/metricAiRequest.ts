import { METRIC_CONTEXT_VERSION, type SelectedFinancialMetric } from './selectedFinancialMetric';
import type { MetricInterpretationContext } from './financialMetricContext';

// Invalidate meanings that predate beginner teaching and condition-first synthesis.
export const METRIC_AI_CONTEXT_VERSION = `${METRIC_CONTEXT_VERSION}:analyst-v8`;
export const METRIC_AI_MAX_REQUEST_BYTES = 32 * 1024;
export const metricAiPayloadBytes = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).byteLength;
export interface AnalyzeFinancialMetricRequest {
  requestId: string; contextVersion: string; dataIdentity: string;
  ticker: string; companyName: string; language: 'Thai' | 'English'; compareMode: 'yoy' | 'qoq' | 'hide';
  metric: { metricKey: string; label: string; labelTh: string; section: string; valueType: string; unit: string; formula: string; methodology: string; changeSemantic: string };
  current: { period: string; value: number | null; verificationStatus: string };
  history: { period: string; value: number | null; change: number | null; verificationStatus: string }[];
  relatedMetrics: { metricKey: string; period: string; value: number; verificationStatus: 'VERIFIED' }[];
  businessArchetype: string;
}
// Never serialize statements, provenance trees, drafts or report history here.
// Server re-resolves these values from SEC; client values are comparison context only.
export function buildMetricAiRequest(selected: SelectedFinancialMetric, context: MetricInterpretationContext,
  options: { requestId: string; ticker: string; companyName?: string; isThai: boolean; compareMode: 'yoy' | 'qoq' | 'hide' }): AnalyzeFinancialMetricRequest {
  const definition = selected.definition;
  const text = (value: unknown, max = 600) => typeof value === 'string' ? value.slice(0, max) : '';
  return {
    requestId: options.requestId, contextVersion: METRIC_AI_CONTEXT_VERSION, dataIdentity: selected.identity,
    ticker: options.ticker.trim().toUpperCase(), companyName: text(options.companyName, 160), language: options.isThai ? 'Thai' : 'English', compareMode: options.compareMode,
    metric: { metricKey: selected.metricKey, label: text(context.metricName, 160), labelTh: text(context.metricNameTh, 160), section: text(context.periodType, 80),
      valueType: definition?.valueType || '', unit: definition?.unit || '', formula: text(context.formula), methodology: text(context.periodType), changeSemantic: definition?.changeSemantic || '' },
    current: { period: selected.periods.at(-1) || '', value: selected.currentValue, verificationStatus: selected.dataQuality.currentVerified ? selected.dataQuality.status : 'UNAVAILABLE' },
    history: selected.periods.map((period, i) => ({ period, value: selected.values[i] ?? null, change: selected.changes[i] ?? null,
      verificationStatus: selected.dataQuality.historicalVerifiedPeriods.includes(period) ? 'VERIFIED' : 'UNAVAILABLE' })),
    relatedMetrics: Object.entries(selected.relatedMetrics).flatMap(([metricKey, values]) => selected.periods.flatMap((period, i) =>
      typeof values[i] === 'number' && Number.isFinite(values[i]) ? [{ metricKey, period, value: values[i] as number, verificationStatus: 'VERIFIED' as const }] : [])),
    businessArchetype: context.businessArchetype,
  };
}
