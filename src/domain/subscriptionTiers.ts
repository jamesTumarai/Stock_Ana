export type SubscriptionTierId = 'free' | 'pro' | 'institutional';

export type FeatureKey =
  | 'standard_analyze'
  | 'deep_think'
  | 'reverse_dcf_sandbox'
  | 'portfolio_tracking'
  | 'unlimited_holdings'
  | 'realtime_alerts'
  | 'multi_scenario_matrix'
  | 'export_pdf_json'
  | 'custom_wacc_templates';

export interface TierDefinition {
  id: SubscriptionTierId;
  name: {
    en: string;
    th: string;
  };
  tagline: {
    en: string;
    th: string;
  };
  priceMonthlyUsd: number;
  priceMonthlyThb: number;
  monthlyAnalysisQuota: number; // e.g. 5, 100, Infinity
  maxHoldings: number; // e.g. 5, 50, Infinity
  maxAlerts: number; // e.g. 3, 50, Infinity
  allowedModels: string[];
  features: Record<FeatureKey, boolean>;
}

export const SUBSCRIPTION_TIERS: Record<SubscriptionTierId, TierDefinition> = {
  free: {
    id: 'free',
    name: {
      en: 'Explorer',
      th: 'ผู้เริ่มต้น (Explorer)',
    },
    tagline: {
      en: 'Foundational US equity research & SEC-verified statements',
      th: 'วิเคราะห์หุ้นสหรัฐฯ พื้นฐานพร้อมงบการเงินจริงที่ตรวจสอบจาก SEC',
    },
    priceMonthlyUsd: 0,
    priceMonthlyThb: 0,
    monthlyAnalysisQuota: 5,
    maxHoldings: 5,
    maxAlerts: 3,
    allowedModels: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-2.0-flash'],
    features: {
      standard_analyze: true,
      deep_think: false,
      reverse_dcf_sandbox: true,
      portfolio_tracking: true,
      unlimited_holdings: false,
      realtime_alerts: true,
      multi_scenario_matrix: false,
      export_pdf_json: true,
      custom_wacc_templates: false,
    },
  },
  pro: {
    id: 'pro',
    name: {
      en: 'Pro Analyst',
      th: 'นักวิเคราะห์มืออาชีพ (Pro)',
    },
    tagline: {
      en: 'Advanced valuation sandbox, multi-scenario matrices & unlimited portfolio tracking',
      th: 'แบบจำลองประเมินมูลค่าขั้นสูง เมทริกซ์หลายสถานการณ์ และพอร์ตไม่จำกัด',
    },
    priceMonthlyUsd: 29,
    priceMonthlyThb: 990,
    monthlyAnalysisQuota: 100,
    maxHoldings: 50,
    maxAlerts: 50,
    allowedModels: [
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-2.0-flash',
      'gemini-2.5-pro',
      'gemini-1.5-pro',
    ],
    features: {
      standard_analyze: true,
      deep_think: true,
      reverse_dcf_sandbox: true,
      portfolio_tracking: true,
      unlimited_holdings: true,
      realtime_alerts: true,
      multi_scenario_matrix: true,
      export_pdf_json: true,
      custom_wacc_templates: false,
    },
  },
  institutional: {
    id: 'institutional',
    name: {
      en: 'Institutional Desk',
      th: 'สถาบันการเงิน (Institutional)',
    },
    tagline: {
      en: 'Unlimited research quotas, custom WACC hurdles & priority compute bandwidth',
      th: 'โควตาการวิเคราะห์ไม่จำกัด เทมเพลต WACC สถาบัน และสิทธิพิเศษการประมวลผล',
    },
    priceMonthlyUsd: 199,
    priceMonthlyThb: 6900,
    monthlyAnalysisQuota: Infinity,
    maxHoldings: Infinity,
    maxAlerts: Infinity,
    allowedModels: [
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-2.0-flash',
      'gemini-2.5-pro',
      'gemini-1.5-pro',
    ],
    features: {
      standard_analyze: true,
      deep_think: true,
      reverse_dcf_sandbox: true,
      portfolio_tracking: true,
      unlimited_holdings: true,
      realtime_alerts: true,
      multi_scenario_matrix: true,
      export_pdf_json: true,
      custom_wacc_templates: true,
    },
  },
};

/**
 * Returns tier definition with fallback to 'free' tier.
 */
export function getTierDefinition(tierId?: string | null): TierDefinition {
  if (!tierId) return SUBSCRIPTION_TIERS.free;
  const normalized = tierId.trim().toLowerCase() as SubscriptionTierId;
  return SUBSCRIPTION_TIERS[normalized] ?? SUBSCRIPTION_TIERS.free;
}
