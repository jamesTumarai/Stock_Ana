export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  tier: 'flash' | 'pro' | 'standard';
}

export const MODEL_PRICING_CATALOG: Record<string, ModelPricing> = {
  // Gemini Flash family (Standard institutional models in Lumina)
  'gemini-3.8-flash': { inputPerMillion: 0.10, outputPerMillion: 0.40, tier: 'flash' },
  'gemini-3.7-flash': { inputPerMillion: 0.10, outputPerMillion: 0.40, tier: 'flash' },
  'gemini-2.0-flash': { inputPerMillion: 0.10, outputPerMillion: 0.40, tier: 'flash' },
  'gemini-1.5-flash': { inputPerMillion: 0.075, outputPerMillion: 0.30, tier: 'flash' },

  // Gemini Pro family
  'gemini-2.5-pro': { inputPerMillion: 1.25, outputPerMillion: 5.00, tier: 'pro' },
  'gemini-1.5-pro': { inputPerMillion: 1.25, outputPerMillion: 5.00, tier: 'pro' },
};

const DEFAULT_PRICING: ModelPricing = {
  inputPerMillion: 0.10,
  outputPerMillion: 0.40,
  tier: 'standard',
};

export interface TokenCostEstimate {
  model: string;
  totalTokens: number;
  promptTokens: number | null;
  completionTokens: number | null;
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
  totalCostThb: number | null;
  formattedCostUsd: string;
  formattedCostThb: string | null;
  pricingTier: 'flash' | 'pro' | 'standard';
  isEstimatedBreakdown?: boolean;
}

export interface EstimateCostOptions {
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  model?: string;
  fxRateUsdThb?: number;
}

/**
 * Resolves the active model pricing tier with fallback to standard pricing.
 */
export function getModelPricing(modelName?: string): ModelPricing {
  if (!modelName) return DEFAULT_PRICING;
  const normalized = modelName.trim().toLowerCase();
  for (const [key, pricing] of Object.entries(MODEL_PRICING_CATALOG)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return pricing;
    }
  }
  if (normalized.includes('pro')) {
    return MODEL_PRICING_CATALOG['gemini-1.5-pro'];
  }
  return DEFAULT_PRICING;
}

/**
 * Deterministic token cost estimator for Gemini AI inferences.
 * If prompt/completion breakdown is omitted, institutional default distribution
 * (75% input context/filings, 25% output report) is applied for cost calculation,
 * while promptTokens and completionTokens remain null (never fabricated as actual counts).
 * When fxRateUsdThb is omitted, totalCostThb and formattedCostThb return null.
 */
export function estimateTokenCost(options: EstimateCostOptions): TokenCostEstimate {
  const model = options.model?.trim() || 'gemini-3.8-flash';
  const pricing = getModelPricing(model);

  const rawTotal = Math.max(0, options.totalTokens ?? 0);
  const hasExplicitPrompt = typeof options.promptTokens === 'number' && options.promptTokens >= 0;
  const hasExplicitCompletion = typeof options.completionTokens === 'number' && options.completionTokens >= 0;

  let promptTokens: number | null = null;
  let completionTokens: number | null = null;
  let inputCostUsd = 0;
  let outputCostUsd = 0;
  let isEstimatedBreakdown = false;

  if (hasExplicitPrompt || hasExplicitCompletion) {
    promptTokens = Math.max(0, options.promptTokens ?? 0);
    completionTokens = Math.max(0, options.completionTokens ?? 0);
    inputCostUsd = (promptTokens / 1_000_000) * pricing.inputPerMillion;
    outputCostUsd = (completionTokens / 1_000_000) * pricing.outputPerMillion;
  } else if (rawTotal > 0) {
    isEstimatedBreakdown = true;
    promptTokens = null;
    completionTokens = null;
    const estimatedPromptTokens = rawTotal * 0.75;
    const estimatedCompletionTokens = rawTotal * 0.25;
    inputCostUsd = (estimatedPromptTokens / 1_000_000) * pricing.inputPerMillion;
    outputCostUsd = (estimatedCompletionTokens / 1_000_000) * pricing.outputPerMillion;
  }

  const effectiveTotal = (promptTokens !== null && completionTokens !== null)
    ? promptTokens + completionTokens
    : rawTotal;

  const totalCostUsd = inputCostUsd + outputCostUsd;

  let totalCostThb: number | null = null;
  let formattedCostThb: string | null = null;

  if (typeof options.fxRateUsdThb === 'number' && options.fxRateUsdThb > 0) {
    totalCostThb = Number((totalCostUsd * options.fxRateUsdThb).toFixed(4));
    formattedCostThb = formatCostThb(totalCostThb);
  }

  return {
    model,
    totalTokens: effectiveTotal,
    promptTokens,
    completionTokens,
    inputCostUsd: Number(inputCostUsd.toFixed(6)),
    outputCostUsd: Number(outputCostUsd.toFixed(6)),
    totalCostUsd: Number(totalCostUsd.toFixed(6)),
    totalCostThb,
    formattedCostUsd: formatCostUsd(totalCostUsd),
    formattedCostThb,
    pricingTier: pricing.tier,
    isEstimatedBreakdown,
  };
}

export function formatCostUsd(costUsd: number): string {
  if (costUsd <= 0) return '$0.00';
  if (costUsd < 0.01) {
    return `$${costUsd.toFixed(4)}`;
  }
  return `$${costUsd.toFixed(3)}`;
}

export function formatCostThb(costThb: number): string {
  if (costThb <= 0) return '฿0.00';
  if (costThb < 0.05) {
    return `< ฿0.05`;
  }
  return `฿${costThb.toFixed(2)}`;
}
