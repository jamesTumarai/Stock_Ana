export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  tier: 'flash' | 'pro' | 'standard';
  source?: string;
  effectiveDate?: string;
  catalogVersion?: string;
}

export const PRICING_CATALOG_METADATA = {
  version: '2026.1',
  effectiveDate: '2025-11-01',
  source: 'Google Cloud Vertex AI / Gemini API Official Pricing',
};

export const MODEL_PRICING_CATALOG: Record<string, Omit<ModelPricing, 'source' | 'effectiveDate' | 'catalogVersion'>> = {
  // Gemini Flash family (Standard institutional models in Lumina)
  'gemini-3.8-flash': { inputPerMillion: 0.10, outputPerMillion: 0.40, tier: 'flash' },
  'gemini-3.7-flash': { inputPerMillion: 0.10, outputPerMillion: 0.40, tier: 'flash' },
  'gemini-2.0-flash': { inputPerMillion: 0.10, outputPerMillion: 0.40, tier: 'flash' },
  'gemini-1.5-flash': { inputPerMillion: 0.075, outputPerMillion: 0.30, tier: 'flash' },

  // Gemini Pro family
  'gemini-2.5-pro': { inputPerMillion: 1.25, outputPerMillion: 5.00, tier: 'pro' },
  'gemini-1.5-pro': { inputPerMillion: 1.25, outputPerMillion: 5.00, tier: 'pro' },
};

export interface TokenCostEstimate {
  isAvailable: boolean;
  reason?: string;
  model: string;
  totalTokens: number;
  promptTokens: number | null;
  completionTokens: number | null;
  inputCostUsd: number | null;
  outputCostUsd: number | null;
  totalCostUsd: number | null;
  totalCostThb: number | null;
  formattedCostUsd: string;
  formattedCostThb: string | null;
  pricingTier: 'flash' | 'pro' | 'standard' | null;
  isEstimatedBreakdown?: boolean;
  approximationNote?: string;
  approximationNoteTh?: string;
  pricingMetadata?: {
    source: string;
    effectiveDate: string;
    catalogVersion: string;
  };
}

export interface EstimateCostOptions {
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  model?: string;
  fxRateUsdThb?: number;
}

/**
 * Resolves the active model pricing tier.
 * Returns null if the model is unrecognized or absent from the pricing catalog.
 * Never guesses or falls back to arbitrary standard/pro pricing for unknown models.
 */
export function getModelPricing(modelName?: string): ModelPricing | null {
  if (!modelName) return null;
  const normalized = modelName.trim().toLowerCase();

  for (const [key, pricing] of Object.entries(MODEL_PRICING_CATALOG)) {
    if (normalized === key || normalized === `models/${key}`) {
      return {
        ...pricing,
        source: PRICING_CATALOG_METADATA.source,
        effectiveDate: PRICING_CATALOG_METADATA.effectiveDate,
        catalogVersion: PRICING_CATALOG_METADATA.version,
      };
    }
  }

  // Unknown model: fail closed
  return null;
}

/**
 * Deterministic token cost estimator for Gemini AI inferences.
 * If model pricing is unrecognized, returns isAvailable: false with reason.
 * If prompt/completion breakdown is omitted, institutional default distribution
 * (75% input context/filings, 25% output report) is applied for cost calculation,
 * clearly surfaced as an approximation assumption in approximationNote.
 * When fxRateUsdThb is omitted, totalCostThb and formattedCostThb return null.
 */
export function estimateTokenCost(options: EstimateCostOptions): TokenCostEstimate {
  const model = options.model?.trim() || 'gemini-3.8-flash';
  const pricing = getModelPricing(model);

  const rawTotal = Math.max(0, options.totalTokens ?? 0);
  const hasExplicitPrompt = typeof options.promptTokens === 'number' && options.promptTokens >= 0;
  const hasExplicitCompletion = typeof options.completionTokens === 'number' && options.completionTokens >= 0;

  if (!pricing) {
    return {
      isAvailable: false,
      reason: `Pricing unavailable for unrecognized model '${model}'.`,
      model,
      totalTokens: rawTotal,
      promptTokens: hasExplicitPrompt ? options.promptTokens! : null,
      completionTokens: hasExplicitCompletion ? options.completionTokens! : null,
      inputCostUsd: null,
      outputCostUsd: null,
      totalCostUsd: null,
      totalCostThb: null,
      formattedCostUsd: 'N/A',
      formattedCostThb: null,
      pricingTier: null,
    };
  }

  let promptTokens: number | null = null;
  let completionTokens: number | null = null;
  let inputCostUsd = 0;
  let outputCostUsd = 0;
  let isEstimatedBreakdown = false;
  let approximationNote: string | undefined;
  let approximationNoteTh: string | undefined;

  if (hasExplicitPrompt || hasExplicitCompletion) {
    promptTokens = Math.max(0, options.promptTokens ?? 0);
    completionTokens = Math.max(0, options.completionTokens ?? 0);
    inputCostUsd = (promptTokens / 1_000_000) * pricing.inputPerMillion;
    outputCostUsd = (completionTokens / 1_000_000) * pricing.outputPerMillion;
  } else if (rawTotal > 0) {
    isEstimatedBreakdown = true;
    approximationNote = 'Approximate token allocation used (75% input / 25% output assumption)';
    approximationNoteTh = 'ประมาณการสัดส่วนโทเค็น (สมมติฐาน 75% ข้อมูลนำเข้า / 25% ผลลัพธ์รายงาน)';
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
    isAvailable: true,
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
    approximationNote,
    approximationNoteTh,
    pricingMetadata: {
      source: pricing.source || PRICING_CATALOG_METADATA.source,
      effectiveDate: pricing.effectiveDate || PRICING_CATALOG_METADATA.effectiveDate,
      catalogVersion: pricing.catalogVersion || PRICING_CATALOG_METADATA.version,
    },
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
