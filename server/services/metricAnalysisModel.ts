export interface MetricAnalysisModelPolicy { primary: string; fallback?: string; configured: boolean }
export function resolveMetricAnalysisModel(env: NodeJS.ProcessEnv = process.env): MetricAnalysisModelPolicy {
  const primary = env.GEMINI_FINANCIAL_MODEL?.trim() || env.GEMINI_MODEL?.trim() || 'gemini-flash-latest';
  // Only one explicitly configured fallback; never guess a sequence of model versions.
  const fallback = env.GEMINI_FINANCIAL_FALLBACK_MODEL?.trim();
  const valid = (name: string) => /^gemini-[a-z0-9._-]{1,100}$/.test(name);
  return { primary, fallback: fallback && fallback !== primary ? fallback : undefined,
    configured: Boolean(env.GEMINI_API_KEY?.trim()) && valid(primary) && (!fallback || valid(fallback)) };
}
