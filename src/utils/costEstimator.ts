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
  tier: 'flash',
};

export interface TokenCostEstimate {
  model: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
  totalCostThb: number | null;
  formattedCostUsd: string;
  formattedCostThb: string | null;
  pricingTier: 'flash' | 'pro' | 'standard';
}

export interface EstimateCostOptions {
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  model?: string;
  fxRateUsdThb?: number;
}

/**
 * Resolves the active model pricing tier with fallback to Flash standard pricing.
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
 * Pure deterministic token cost estimator for Gemini AI inferences.
 * If prompt/completion breakdown is omitted, institutional default distribution
 * (75% input context/filings, 25% output report) is applied.
 */
export function estimateTokenCost(options: EstimateCostOptions): TokenCostEstimate {
  const model = options.model?.trim() || 'gemini-3.8-flash';
  const pricing = getModelPricing(model);

  const rawTotal = Math.max(0, options.totalTokens ?? 0);
  let promptTokens = Math.max(0, options.promptTokens ?? 0);
  let completionTokens = Math.max(0, options.completionTokens ?? 0);

  if (promptTokens === 0 && completionTokens === 0 && rawTotal > 0) {
    promptTokens = Math.round(rawTotal * 0.75);
    completionTokens = rawTotal - promptTokens;
  } else if (rawTotal === 0 && (promptTokens > 0 || completionTokens > 0)) {
    // Total derived from components
  }

  const effectiveTotal = promptTokens + completionTokens > 0 ? promptTokens + completionTokens : rawTotal;

  const inputCostUsd = (promptTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCostUsd = (completionTokens / 1_000_000) * pricing.outputPerMillion;
  const totalCostUsd = inputCostUsd + outputCostUsd;

  const fxRate = options.fxRateUsdThb && options.fxRateUsdThb > 0 ? options.fxRateUsdThb : 35.0;
  const totalCostThb = totalCostUsd * fxRate;

  return {
    model,
    totalTokens: effectiveTotal,
    promptTokens,
    completionTokens,
    inputCostUsd: Number(inputCostUsd.toFixed(6)),
    outputCostUsd: Number(outputCostUsd.toFixed(6)),
    totalCostUsd: Number(totalCostUsd.toFixed(6)),
    totalCostThb: Number(totalCostThb.toFixed(4)),
    formattedCostUsd: formatCostUsd(totalCostUsd),
    formattedCostThb: formatCostThb(totalCostThb),
    pricingTier: pricing.tier,
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
