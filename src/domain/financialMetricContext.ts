import { ReportData } from '../types';
import { FinancialAiInsight } from '../utils/financialAiInsights';

export type BusinessArchetype =
  | 'bank'
  | 'lender'
  | 'fintech'
  | 'insurer'
  | 'asset_manager'
  | 'broker_exchange'
  | 'saas_software'
  | 'semiconductor'
  | 'hardware_device'
  | 'industrial_manufacturing'
  | 'retail'
  | 'digital_marketplace'
  | 'reit'
  | 'energy_commodity'
  | 'utility'
  | 'telecom'
  | 'early_stage'
  | 'general_operating';

export interface BusinessClassificationEvidence {
  archetype: BusinessArchetype;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  strongSignals: string[];
  supportingSignals: string[];
  conflictingSignals: string[];
  primaryArchetype: BusinessArchetype;
  secondaryBusinessLines: string[];
}

export interface ResolvedBusinessClassification {
  primaryArchetype: BusinessArchetype;
  secondaryBusinessLines: string[];
  sector: string;
  industry: string;
  subIndustry?: string;
  evidence: BusinessClassificationEvidence;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export type MetricValueState =
  | 'REPORTED'
  | 'CALCULATED'
  | 'NOT_APPLICABLE'
  | 'NOT_AVAILABLE';

export type MetricInterpretationRole =
  | 'PRIMARY'
  | 'SECONDARY'
  | 'CONTEXT_ONLY'
  | 'NOT_MEANINGFUL';

export type MetricApplicability =
  | 'PRIMARY'
  | 'RELEVANT'
  | 'SECONDARY'
  | 'CONTEXT_ONLY'
  | 'NOT_MEANINGFUL_FOR_PRIMARY_INTERPRETATION';

export type IndustryStandardStatus =
  | 'STANDARD_ACCOUNTING_METRIC'
  | 'INDUSTRY_STANDARD_METRIC'
  | 'LUMINA_DERIVED_METRIC'
  | 'GENERIC_DERIVED_RATIO';

export type PeriodType =
  | 'POINT_IN_TIME'
  | 'QUARTER'
  | 'YTD'
  | 'TTM'
  | 'ANNUALIZED'
  | 'DERIVED_RATIO';

export interface RelatedMetricItem {
  key: string;
  name: string;
  nameTh: string;
  valueStr?: string;
}

export interface MetricInterpretationContext {
  metricKey: string;
  metricName: string;
  metricNameTh: string;
  businessArchetype: BusinessArchetype;
  archetypeLabelEn: string;
  archetypeLabelTh: string;
  sector: string;
  industry: string;
  applicability: MetricApplicability;
  applicabilityLabelEn: string;
  applicabilityLabelTh: string;
  industryStandardStatus: IndustryStandardStatus;
  statusLabelEn: string;
  statusLabelTh: string;
  formula: string;
  formulaTh: string;
  periodType: PeriodType;
  provenance: 'SEC_VERIFIED' | 'DETERMINISTIC_DERIVED' | 'COMPANY_REPORTED' | 'UNAVAILABLE';
  isFinancialSectorGuardActive: boolean;
  interpretationCaveats: string[];
  interpretationCaveatsTh: string[];
  relatedMetrics: RelatedMetricItem[];
  denominatorCaveats: string[];
  denominatorCaveatsTh: string[];
  aiUsagePolicy: string;
  isCalculableButLimited: boolean;
  isUnavailable: boolean;
  isNegative: boolean;
  isPeriodMismatch: boolean;
  valueState: MetricValueState;
  interpretationRole: MetricInterpretationRole;
  isSourceReconciled: boolean;
  provenanceStatus?: string;
}

export interface MetricContextOptions {
  metricKey: string;
  metricName: string;
  metricNameTh?: string;
  reportData?: Partial<ReportData> | any;
  ticker?: string;
  periods?: string[];
  historyValues?: (number | null | undefined)[];
  yoyPcts?: (number | null | undefined)[];
  unit?: string;
  isCurrency?: boolean;
  isThai?: boolean;
  isSourceReconciled?: boolean;
  provenanceStatus?: string;
}

/**
 * Deterministically resolves the authoritative Business Classification for any stock
 * using an evidence hierarchy:
 * - Strong evidence: official sector, official industry, statement template, primary revenue segments
 * - Supporting evidence: official business description, major business lines
 * - Conflicting signals: weak keywords in narrative (e.g. "financial services", "financing")
 *
 * Crucial invariants:
 * 1. Strong structured evidence wins over weak textual clues.
 * 2. Secondary financial activities (e.g. captive auto finance, retail credit cards, platform payments)
 *    do not convert the consolidated company into a bank/lender/fintech.
 * 3. Never falls back to using narrative description as the industry string.
 */
export function resolveBusinessClassification(
  reportOrData?: any,
  ticker?: string
): ResolvedBusinessClassification {
  const unwrapped = reportOrData?.data ? reportOrData.data : reportOrData;
  const data: Partial<ReportData> = unwrapped || {};
  const sym = (ticker || data.ticker || (data as any)?.symbol || '').toUpperCase().trim();

  const profile = data.company_profile;
  const rawSector = (profile?.sector || (profile as any)?.overview?.sector || '').trim();
  const rawIndustry = (profile?.industry || (profile as any)?.overview?.industry || '').trim();
  const sector = rawSector.toLowerCase();
  const industry = rawIndustry.toLowerCase();

  const businessSummary = (
    profile?.description ||
    profile?.overview?.description ||
    data?.comprehensive_analysis?.beginner_summary?.business_type_simple ||
    data?.comprehensive_analysis?.business_overview ||
    ''
  ).toLowerCase();

  const template = data.financial_statements?.statement_template;

  const strongSignals: string[] = [];
  const supportingSignals: string[] = [];
  const conflictingSignals: string[] = [];
  const secondaryBusinessLines: string[] = [];

  if (rawSector) strongSignals.push(`Sector: ${rawSector}`);
  if (rawIndustry) strongSignals.push(`Industry: ${rawIndustry}`);
  if (template) strongSignals.push(`Statement Template: ${template}`);

  // 1. Check Automotive / Motor Vehicles (Primary: industrial_manufacturing, Sub-industry: Auto Manufacturers)
  const isAutomotive =
    industry.includes('auto manufacturers') ||
    industry.includes('automotive') ||
    industry.includes('automobile') ||
    industry.includes('motor vehicle') ||
    industry.includes('trucks') ||
    ((sector.includes('consumer cyclical') || sector.includes('consumer discretionary') || sector.includes('industrials')) &&
      (industry.includes('auto') || industry.includes('vehicle') || businessSummary.includes('electric vehicles')));

  if (isAutomotive) {
    // Detect secondary financial/energy business lines
    if (businessSummary.includes('financing') || businessSummary.includes('lending') || businessSummary.includes('leasing') || businessSummary.includes('credit')) {
      secondaryBusinessLines.push('vehicle_financing');
      conflictingSignals.push('Secondary automotive financing/leasing activity noted; consolidated operating framework preserved');
    }
    if (businessSummary.includes('energy storage') || businessSummary.includes('solar') || businessSummary.includes('energy generation')) {
      secondaryBusinessLines.push('energy_storage');
      supportingSignals.push('Secondary energy generation and storage business noted');
    }
    if (businessSummary.includes('insurance')) {
      secondaryBusinessLines.push('insurance');
      conflictingSignals.push('Secondary vehicle insurance activity noted; does not override primary manufacturing archetype');
    }

    const primaryArchetype: BusinessArchetype = 'industrial_manufacturing';
    return {
      primaryArchetype,
      secondaryBusinessLines,
      sector: rawSector || 'Consumer Cyclical',
      industry: rawIndustry || 'Auto Manufacturers',
      subIndustry: 'Auto Manufacturers',
      confidence: 'HIGH',
      evidence: {
        archetype: primaryArchetype,
        confidence: 'HIGH',
        strongSignals,
        supportingSignals,
        conflictingSignals,
        primaryArchetype,
        secondaryBusinessLines,
      },
    };
  }

  // 2. Insurance
  if (
    industry.includes('insurance') ||
    sector.includes('insurance') ||
    template === 'insurance' ||
    businessSummary.includes('insurance carrier') ||
    businessSummary.includes('life insurance') ||
    businessSummary.includes('property and casualty')
  ) {
    const primaryArchetype: BusinessArchetype = 'insurer';
    return {
      primaryArchetype,
      secondaryBusinessLines,
      sector: rawSector || 'Financial Services',
      industry: rawIndustry || 'Insurance',
      subIndustry: rawIndustry,
      confidence: 'HIGH',
      evidence: {
        archetype: primaryArchetype,
        confidence: 'HIGH',
        strongSignals,
        supportingSignals,
        conflictingSignals,
        primaryArchetype,
        secondaryBusinessLines,
      },
    };
  }

  // 3. Asset Management
  if (
    industry.includes('asset management') ||
    industry.includes('wealth management') ||
    businessSummary.includes('asset management') ||
    businessSummary.includes('investment management')
  ) {
    const primaryArchetype: BusinessArchetype = 'asset_manager';
    return {
      primaryArchetype,
      secondaryBusinessLines,
      sector: rawSector || 'Financial Services',
      industry: rawIndustry || 'Asset Management',
      subIndustry: rawIndustry,
      confidence: 'HIGH',
      evidence: {
        archetype: primaryArchetype,
        confidence: 'HIGH',
        strongSignals,
        supportingSignals,
        conflictingSignals,
        primaryArchetype,
        secondaryBusinessLines,
      },
    };
  }

  // 4. Brokerage / Exchange / Capital Markets
  if (
    industry.includes('broker') ||
    industry.includes('exchange') ||
    industry.includes('capital market') ||
    businessSummary.includes('digital brokerage') ||
    businessSummary.includes('financial exchange')
  ) {
    const primaryArchetype: BusinessArchetype = 'broker_exchange';
    return {
      primaryArchetype,
      secondaryBusinessLines,
      sector: rawSector || 'Financial Services',
      industry: rawIndustry || 'Capital Markets',
      subIndustry: rawIndustry,
      confidence: 'HIGH',
      evidence: {
        archetype: primaryArchetype,
        confidence: 'HIGH',
        strongSignals,
        supportingSignals,
        conflictingSignals,
        primaryArchetype,
        secondaryBusinessLines,
      },
    };
  }

  const selectedModel = (data?.intrinsic_value as any)?.model_selection?.selected_model || (data?.intrinsic_value as any)?.model_type;
  if (selectedModel) strongSignals.push(`Valuation Model: ${selectedModel}`);

  // 5. FinTech / Digital Banking / Consumer Finance
  const isFintech =
    (sector.includes('financial') || template === 'banking' || selectedModel === 'fintech_pe') &&
    (selectedModel === 'fintech_pe' ||
      industry.includes('financial technology') ||
      industry.includes('fintech') ||
      industry.includes('digital bank') ||
      industry.includes('consumer finance') ||
      industry.includes('credit services') ||
      businessSummary.includes('digital banking') ||
      businessSummary.includes('financial technology') ||
      businessSummary.includes('fintech'));

  if (isFintech) {
    const primaryArchetype: BusinessArchetype = 'fintech';
    return {
      primaryArchetype,
      secondaryBusinessLines,
      sector: rawSector || 'Financial Services',
      industry: rawIndustry || 'Credit Services',
      subIndustry: rawIndustry,
      confidence: 'HIGH',
      evidence: {
        archetype: primaryArchetype,
        confidence: 'HIGH',
        strongSignals,
        supportingSignals,
        conflictingSignals,
        primaryArchetype,
        secondaryBusinessLines,
      },
    };
  }

  // 6. Commercial / Retail Banks
  if (
    template === 'banking' ||
    (industry.includes('bank') && !industry.includes('investment bank') && !industry.includes('food bank')) ||
    sector.includes('bank')
  ) {
    const primaryArchetype: BusinessArchetype = 'bank';
    return {
      primaryArchetype,
      secondaryBusinessLines,
      sector: rawSector || 'Financial Services',
      industry: rawIndustry || 'Banks',
      subIndustry: rawIndustry,
      confidence: 'HIGH',
      evidence: {
        archetype: primaryArchetype,
        confidence: 'HIGH',
        strongSignals,
        supportingSignals,
        conflictingSignals,
        primaryArchetype,
        secondaryBusinessLines,
      },
    };
  }

  // 7. Non-bank Lenders / Consumer Finance
  if (
    sector.includes('financial') &&
    (industry.includes('lending') ||
      industry.includes('mortgage') ||
      businessSummary.includes('loan origination') ||
      businessSummary.includes('consumer lending'))
  ) {
    const primaryArchetype: BusinessArchetype = 'lender';
    return {
      primaryArchetype,
      secondaryBusinessLines,
      sector: rawSector || 'Financial Services',
      industry: rawIndustry || 'Consumer Lending',
      subIndustry: rawIndustry,
      confidence: 'HIGH',
      evidence: {
        archetype: primaryArchetype,
        confidence: 'HIGH',
        strongSignals,
        supportingSignals,
        conflictingSignals,
        primaryArchetype,
        secondaryBusinessLines,
      },
    };
  }

  // 8. General Financial Services Guard: Sector Financial Services must never fall through to general_operating
  if (sector.includes('financial')) {
    const primaryArchetype: BusinessArchetype = selectedModel === 'ddm' ? 'bank' : selectedModel === 'fintech_pe' ? 'fintech' : 'lender';
    return {
      primaryArchetype,
      secondaryBusinessLines,
      sector: rawSector || 'Financial Services',
      industry: rawIndustry || 'Financial Services',
      subIndustry: rawIndustry,
      confidence: 'MEDIUM',
      evidence: {
        archetype: primaryArchetype,
        confidence: 'MEDIUM',
        strongSignals,
        supportingSignals,
        conflictingSignals,
        primaryArchetype,
        secondaryBusinessLines,
      },
    };
  }

  // 9. REIT / Real Estate
  if (
    template === 'reit' ||
    sector.includes('real estate') ||
    industry.includes('reit') ||
    industry.includes('real estate investment trust') ||
    businessSummary.includes('real estate investment trust')
  ) {
    const primaryArchetype: BusinessArchetype = 'reit';
    return {
      primaryArchetype,
      secondaryBusinessLines,
      sector: rawSector || 'Real Estate',
      industry: rawIndustry || 'REIT',
      subIndustry: rawIndustry,
      confidence: 'HIGH',
      evidence: {
        archetype: primaryArchetype,
        confidence: 'HIGH',
        strongSignals,
        supportingSignals,
        conflictingSignals,
        primaryArchetype,
        secondaryBusinessLines,
      },
    };
  }

  // 9. Early-stage / Pre-profit / Heavy Cash Burn
  const inc = data.financial_statements?.income_statement;
  const cf = data.financial_statements?.cash_flow;
  const grossMarginArr = (inc?.gross_margin_pct || []).filter(v => typeof v === 'number');
  const isNegativeGrossMargin = grossMarginArr.length > 0 && grossMarginArr[grossMarginArr.length - 1] < 0;
  const fcfArr = (cf?.free_cash_flow || []).filter(v => v !== null && v !== undefined).map(Number);
  const isConsecutiveNegativeFcf = fcfArr.length >= 2 && fcfArr.every(v => v < 0);
  const isSpaceOrHeavyTechGrowth =
    industry.includes('space') && !['aerospace & defense', 'defense'].includes(industry);

  if (isNegativeGrossMargin || isConsecutiveNegativeFcf || isSpaceOrHeavyTechGrowth) {
    const primaryArchetype: BusinessArchetype = 'early_stage';
    return {
      primaryArchetype,
      secondaryBusinessLines,
      sector: rawSector || 'Technology',
      industry: rawIndustry || 'Early-Stage Growth',
      subIndustry: rawIndustry,
      confidence: 'HIGH',
      evidence: {
        archetype: primaryArchetype,
        confidence: 'HIGH',
        strongSignals,
        supportingSignals,
        conflictingSignals,
        primaryArchetype,
        secondaryBusinessLines,
      },
    };
  }

  // 10. Cyclical / Energy / Commodity / Basic Materials
  if (
    sector.includes('energy') ||
    sector.includes('basic materials') ||
    industry.includes('oil') ||
    industry.includes('gas') ||
    industry.includes('mining') ||
    industry.includes('metal') ||
    industry.includes('shipping') ||
    industry.includes('airline') ||
    industry.includes('chemicals')
  ) {
    const primaryArchetype: BusinessArchetype = 'energy_commodity';
    return {
      primaryArchetype,
      secondaryBusinessLines,
      sector: rawSector || 'Energy',
      industry: rawIndustry || 'Commodity & Cyclical',
      subIndustry: rawIndustry,
      confidence: 'HIGH',
      evidence: {
        archetype: primaryArchetype,
        confidence: 'HIGH',
        strongSignals,
        supportingSignals,
        conflictingSignals,
        primaryArchetype,
        secondaryBusinessLines,
      },
    };
  }

  // 11. Utilities (Regulated)
  if (
    sector.includes('utilities') ||
    industry.includes('utility') ||
    industry.includes('electric') ||
    industry.includes('water') ||
    industry.includes('gas utility')
  ) {
    const primaryArchetype: BusinessArchetype = 'utility';
    return {
      primaryArchetype,
      secondaryBusinessLines,
      sector: rawSector || 'Utilities',
      industry: rawIndustry || 'Regulated Utility',
      subIndustry: rawIndustry,
      confidence: 'HIGH',
      evidence: {
        archetype: primaryArchetype,
        confidence: 'HIGH',
        strongSignals,
        supportingSignals,
        conflictingSignals,
        primaryArchetype,
        secondaryBusinessLines,
      },
    };
  }

  // 12. Telecom
  if (
    sector.includes('telecommunication') ||
    industry.includes('telecom')
  ) {
    const primaryArchetype: BusinessArchetype = 'telecom';
    return {
      primaryArchetype,
      secondaryBusinessLines,
      sector: rawSector || 'Communication Services',
      industry: rawIndustry || 'Telecom',
      subIndustry: rawIndustry,
      confidence: 'HIGH',
      evidence: {
        archetype: primaryArchetype,
        confidence: 'HIGH',
        strongSignals,
        supportingSignals,
        conflictingSignals,
        primaryArchetype,
        secondaryBusinessLines,
      },
    };
  }

  // 13. Semiconductor
  if (
    industry.includes('semiconductor') ||
    industry.includes('chip') ||
    businessSummary.includes('semiconductor')
  ) {
    const primaryArchetype: BusinessArchetype = 'semiconductor';
    return {
      primaryArchetype,
      secondaryBusinessLines,
      sector: rawSector || 'Technology',
      industry: rawIndustry || 'Semiconductors',
      subIndustry: rawIndustry,
      confidence: 'HIGH',
      evidence: {
        archetype: primaryArchetype,
        confidence: 'HIGH',
        strongSignals,
        supportingSignals,
        conflictingSignals,
        primaryArchetype,
        secondaryBusinessLines,
      },
    };
  }

  // 14. SaaS / Enterprise Software / Cloud
  if (
    industry.includes('software') ||
    industry.includes('cloud') ||
    (sector.includes('technology') && (businessSummary.includes('saas') || businessSummary.includes('subscription software')))
  ) {
    if (businessSummary.includes('payment') || businessSummary.includes('merchant')) {
      secondaryBusinessLines.push('merchant_payments');
    }
    const primaryArchetype: BusinessArchetype = 'saas_software';
    return {
      primaryArchetype,
      secondaryBusinessLines,
      sector: rawSector || 'Technology',
      industry: rawIndustry || 'Software',
      subIndustry: rawIndustry,
      confidence: 'HIGH',
      evidence: {
        archetype: primaryArchetype,
        confidence: 'HIGH',
        strongSignals,
        supportingSignals,
        conflictingSignals,
        primaryArchetype,
        secondaryBusinessLines,
      },
    };
  }

  // 15. Hardware / Consumer Electronics
  if (
    industry.includes('consumer electronics') ||
    industry.includes('computer hardware') ||
    industry.includes('hardware')
  ) {
    if (businessSummary.includes('payment') || businessSummary.includes('financial services')) {
      secondaryBusinessLines.push('payments_services');
    }
    const primaryArchetype: BusinessArchetype = 'hardware_device';
    return {
      primaryArchetype,
      secondaryBusinessLines,
      sector: rawSector || 'Technology',
      industry: rawIndustry || 'Consumer Electronics',
      subIndustry: rawIndustry,
      confidence: 'HIGH',
      evidence: {
        archetype: primaryArchetype,
        confidence: 'HIGH',
        strongSignals,
        supportingSignals,
        conflictingSignals,
        primaryArchetype,
        secondaryBusinessLines,
      },
    };
  }

  // 16. Industrial / Manufacturing
  if (
    sector.includes('industrials') ||
    industry.includes('manufacturing') ||
    industry.includes('machinery') ||
    industry.includes('aerospace & defense')
  ) {
    const primaryArchetype: BusinessArchetype = 'industrial_manufacturing';
    return {
      primaryArchetype,
      secondaryBusinessLines,
      sector: rawSector || 'Industrials',
      industry: rawIndustry || 'Manufacturing',
      subIndustry: rawIndustry,
      confidence: 'HIGH',
      evidence: {
        archetype: primaryArchetype,
        confidence: 'HIGH',
        strongSignals,
        supportingSignals,
        conflictingSignals,
        primaryArchetype,
        secondaryBusinessLines,
      },
    };
  }

  // 17. Retail / Consumer Omnichannel
  if (
    industry.includes('retail') ||
    industry.includes('discount store') ||
    industry.includes('store') ||
    industry.includes('supermarket') ||
    industry.includes('hypermarket') ||
    industry.includes('restaurant') ||
    industry.includes('apparel') ||
    industry.includes('grocery') ||
    industry.includes('specialty retail')
  ) {
    if (businessSummary.includes('credit card') || businessSummary.includes('financing')) {
      secondaryBusinessLines.push('credit_card_program');
    }
    const primaryArchetype: BusinessArchetype = 'retail';
    return {
      primaryArchetype,
      secondaryBusinessLines,
      sector: rawSector || 'Consumer Cyclical',
      industry: rawIndustry || 'Retail',
      subIndustry: rawIndustry,
      confidence: 'HIGH',
      evidence: {
        archetype: primaryArchetype,
        confidence: 'HIGH',
        strongSignals,
        supportingSignals,
        conflictingSignals,
        primaryArchetype,
        secondaryBusinessLines,
      },
    };
  }

  // 18. Digital Marketplace / Asset-light Consumer Platform
  if (
    businessSummary.includes('marketplace') ||
    (sector.includes('consumer') && (businessSummary.includes('platform') || businessSummary.includes('digital')) && !industry.includes('retail'))
  ) {
    const primaryArchetype: BusinessArchetype = 'digital_marketplace';
    return {
      primaryArchetype,
      secondaryBusinessLines,
      sector: rawSector || 'Consumer Discretionary',
      industry: rawIndustry || 'Digital Platform',
      subIndustry: rawIndustry,
      confidence: 'HIGH',
      evidence: {
        archetype: primaryArchetype,
        confidence: 'HIGH',
        strongSignals,
        supportingSignals,
        conflictingSignals,
        primaryArchetype,
        secondaryBusinessLines,
      },
    };
  }

  // 19. Default General Operating Company
  const defaultArchetype: BusinessArchetype = 'general_operating';
  return {
    primaryArchetype: defaultArchetype,
    secondaryBusinessLines,
    sector: rawSector || 'General',
    industry: rawIndustry || 'Commercial',
    subIndustry: rawIndustry,
    confidence: 'MEDIUM',
    evidence: {
      archetype: defaultArchetype,
      confidence: 'MEDIUM',
      strongSignals,
      supportingSignals,
      conflictingSignals,
      primaryArchetype: defaultArchetype,
      secondaryBusinessLines,
    },
  };
}

/**
 * Deterministically resolves the authoritative Business Archetype for any stock.
 */
export function resolveBusinessArchetype(reportOrData?: any, ticker?: string): BusinessArchetype {
  return resolveBusinessClassification(reportOrData, ticker).primaryArchetype;
}

const ARCHETYPE_METADATA: Record<BusinessArchetype, { labelEn: string; labelTh: string; isFinancial: boolean }> = {
  bank: { labelEn: 'Commercial / Depository Bank', labelTh: 'ธนาคารพาณิชย์ / สถาบันรับฝากเงิน', isFinancial: true },
  lender: { labelEn: 'Lender & Credit Services', labelTh: 'ธุรกิจสินเชื่อและบริการทางการเงิน', isFinancial: true },
  fintech: { labelEn: 'FinTech & Digital Banking Platform', labelTh: 'แพลตฟอร์มฟินเทคและธนาคารดิจิทัล', isFinancial: true },
  insurer: { labelEn: 'Insurance Underwriter & Carrier', labelTh: 'ธุรกิจประกันภัยและรับประกันภัย', isFinancial: true },
  asset_manager: { labelEn: 'Asset & Wealth Management', labelTh: 'ธุรกิจบริหารสินทรัพย์และการจัดการความมั่งคั่ง', isFinancial: true },
  broker_exchange: { labelEn: 'Securities Brokerage & Financial Exchange', labelTh: 'ธุรกิจนายหน้าซื้อขายหลักทรัพย์และตลาดการเงิน', isFinancial: true },
  saas_software: { labelEn: 'SaaS & Enterprise Software', labelTh: 'ซอฟต์แวร์ระดับองค์กรและคลาวด์แพลตฟอร์ม', isFinancial: false },
  semiconductor: { labelEn: 'Semiconductors & Chip Design', labelTh: 'เซมิคอนดักเตอร์และอุปกรณ์ไมโครชิป', isFinancial: false },
  hardware_device: { labelEn: 'Hardware & Consumer Electronics', labelTh: 'อุปกรณ์ฮาร์ดแวร์และอิเล็กทรอนิกส์สำหรับผู้บริโภค', isFinancial: false },
  industrial_manufacturing: { labelEn: 'Industrial & Manufacturing', labelTh: 'อุตสาหกรรมและการผลิตสินค้าทุน', isFinancial: false },
  retail: { labelEn: 'Retail & Consumer Services', labelTh: 'ค้าปลีกและบริการผู้บริโภค', isFinancial: false },
  digital_marketplace: { labelEn: 'Digital Marketplace & Asset-Light Platform', labelTh: 'ดิจิทัลมาร์เก็ตเพลสและแพลตฟอร์มไร้สต็อก', isFinancial: false },
  reit: { labelEn: 'Real Estate Investment Trust (REIT)', labelTh: 'กองทรัสต์เพื่อการลงทุนในอสังหาริมทรัพย์ (REIT)', isFinancial: false },
  energy_commodity: { labelEn: 'Energy, Mining & Cyclical Commodity', labelTh: 'พลังงาน เหมืองแร่ และสินค้าโภคภัณฑ์ตามวัฏจักร', isFinancial: false },
  utility: { labelEn: 'Regulated Utility', labelTh: 'สาธารณูปโภคที่มีการกำกับดูแล', isFinancial: false },
  telecom: { labelEn: 'Telecommunications & Network Infrastructure', labelTh: 'โทรคมนาคมและโครงสร้างพื้นฐานเครือข่าย', isFinancial: false },
  early_stage: { labelEn: 'Early-Stage / High Cash Burn / Pre-Profit', labelTh: 'ธุรกิจระยะเริ่มต้น / กระแสเงินสดยังติดลบ / ยังไม่มีกำไร', isFinancial: false },
  general_operating: { labelEn: 'General Operating Company', labelTh: 'บริษัทดำเนินธุรกิจเชิงพาณิชย์ทั่วไป', isFinancial: false }
};

/**
 * Builds the deterministic, business-aware interpretation context for any clicked metric.
 */
export function getMetricInterpretationContext(options: MetricContextOptions): MetricInterpretationContext {
  const {
    metricKey,
    metricName,
    metricNameTh,
    reportData,
    ticker,
    periods = [],
    historyValues = [],
    yoyPcts = [],
    unit = '',
    isCurrency = false,
    isSourceReconciled = true,
    provenanceStatus
  } = options;

  const data: Partial<ReportData> = reportData?.data ? reportData.data : (reportData || {});
  const archetype = resolveBusinessArchetype(data, ticker);
  const archetypeMeta = ARCHETYPE_METADATA[archetype];
  const sector = data.company_profile?.sector || 'General';
  const industry = data.company_profile?.industry || 'Commercial';

  const isFinancialSector = archetypeMeta.isFinancial;
  const isDepositoryOrLender = archetype === 'bank' || archetype === 'lender' || archetype === 'fintech';

  const validHistory = historyValues.filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
  const latestValue = validHistory.length > 0 ? validHistory[validHistory.length - 1] : null;
  const isUnavailable = latestValue === null;
  const isNegative = latestValue !== null && latestValue < 0;

  // Period mismatch / YoY validation
  let isPeriodMismatch = false;
  if (periods.length >= 2) {
    const p1 = periods[periods.length - 1];
    const p2 = periods[periods.length - 2];
    // Check if mixing annual (FY) with quarterly (Q)
    const isQ1 = p1.includes('Q');
    const isQ2 = p2.includes('Q');
    if (isQ1 !== isQ2) {
      isPeriodMismatch = true;
    }
  }

  // Statements data for related metrics
  const inc = data.financial_statements?.income_statement;
  const bs = data.financial_statements?.balance_sheet;
  const cf = data.financial_statements?.cash_flow;

  // Defaults
  let applicability: MetricApplicability = 'PRIMARY';
  let industryStandardStatus: IndustryStandardStatus = 'STANDARD_ACCOUNTING_METRIC';
  let formula = '';
  let formulaTh = '';
  let periodType: PeriodType = isCurrency ? 'QUARTER' : 'DERIVED_RATIO';
  let provenance: MetricInterpretationContext['provenance'] = 'DETERMINISTIC_DERIVED';
  let isFinancialSectorGuardActive = false;
  const interpretationCaveats: string[] = [];
  const interpretationCaveatsTh: string[] = [];
  const denominatorCaveats: string[] = [];
  const denominatorCaveatsTh: string[] = [];
  const relatedMetrics: RelatedMetricItem[] = [];

  if (!isSourceReconciled) {
    interpretationCaveats.push(
      'Source reconciliation between filing tables is not verified. Bounded confidence required; values should not be treated as fully reconciled SEC figures.'
    );
    interpretationCaveatsTh.push(
      'ยังไม่ได้ตรวจสอบการกระทบยอดแหล่งข้อมูลระหว่างตารางงบการเงิน ต้องใช้ความรอบคอบในการตีความระดับ Bounded Confidence โดยไม่ระบุว่าเป็นตัวเลขที่กระทบยอดตรงกับ SEC ครบถ้วนแล้ว'
    );
  }

  // Helper to extract last numeric value string
  const getLastValStr = (arr?: (number | null | undefined)[], isPct = false, isDollar = false): string | undefined => {
    if (!arr || arr.length === 0) return undefined;
    const v = arr.filter((x): x is number => x !== null && x !== undefined && !isNaN(x)).pop();
    if (v === undefined) return undefined;
    if (isPct) return `${v.toFixed(1)}%`;
    if (isDollar) {
      const sign = v < 0 ? '-' : '';
      const abs = Math.abs(v);
      return abs >= 1000 ? `${sign}$${(abs / 1000).toFixed(2)}B` : `${sign}$${abs.toFixed(2)}M`;
    }
    return String(v);
  };

  // =========================================================================
  // METRIC SPECIFIC BUSINESS RULES MATRIX
  // =========================================================================

  switch (metricKey) {
    // -----------------------------------------------------------------------
    // 1. Gross Margin / Gross Profit
    // -----------------------------------------------------------------------
    case 'gross_margin':
    case 'gross_profit': {
      formula = 'Gross Margin = (Revenue - Direct Cost of Sales) / Revenue';
      formulaTh = 'อัตรากำไรขั้นต้น = (รายได้รวม - ต้นทุนขายโดยตรง) / รายได้รวม';
      periodType = 'DERIVED_RATIO';

      if (isDepositoryOrLender || archetype === 'insurer') {
        applicability = 'CONTEXT_ONLY';
        industryStandardStatus = 'LUMINA_DERIVED_METRIC';
        interpretationCaveats.push(
          'Gross Margin is not a primary standard banking or lending KPI. For financial institutions, funding and interest expenses represent operating inventory and raw materials rather than traditional COGS. Lumina calculates this ratio for exploratory context, but it should not be interpreted as operating leverage or manufacturing efficiency.'
        );
        interpretationCaveatsTh.push(
          'อัตรากำไรขั้นต้น (Gross Margin) ไม่ใช่ดัชนีชี้วัดหลักตามมาตรฐานธุรกิจธนาคารหรือสินเชื่อ เนื่องจากต้นทุนดอกเบี้ยและเงินฝากคือวัตถุดิบในการดำเนินงาน ไม่ใช่ต้นทุนขาย (COGS) แบบบริษัททั่วไป Lumina คำนวณอัตราส่วนนี้เพื่อให้สำรวจความต่อเนื่องของงบ แต่ไม่ควรนำมาสรุปเรื่อง Operating Leverage หรือประสิทธิภาพการผลิตเพียงลำพัง'
        );
        // Related metrics for banking/lending
        if (inc?.net_interest_margin_pct) relatedMetrics.push({ key: 'nim', name: 'Net Interest Margin (NIM)', nameTh: 'ส่วนต่างดอกเบี้ยสุทธิ', valueStr: getLastValStr(inc.net_interest_margin_pct, true) });
        if (bs?.deposits) relatedMetrics.push({ key: 'deposits', name: 'Deposits', nameTh: 'ฐานเงินฝาก', valueStr: getLastValStr(bs.deposits, false, true) });
        if (inc?.operating_expenses && inc?.revenue) relatedMetrics.push({ key: 'efficiency_ratio', name: 'Efficiency Ratio', nameTh: 'อัตราส่วนต้นทุนต่อรายได้', valueStr: getLastValStr(inc.operating_expenses) });
        if (inc?.net_income && bs?.total_equity) relatedMetrics.push({ key: 'roe', name: 'ROE', nameTh: 'ผลตอบแทนต่อส่วนผู้ถือหุ้น', valueStr: getLastValStr(inc.net_income) });
      } else if (archetype === 'early_stage') {
        applicability = 'PRIMARY';
        industryStandardStatus = 'STANDARD_ACCOUNTING_METRIC';
        interpretationCaveats.push(
          'For early-stage growth companies, gross margin demonstrates whether basic unit economics are viable before heavy overhead and R&D burn.'
        );
        interpretationCaveatsTh.push(
          'สำหรับธุรกิจระยะเริ่มต้น อัตรากำไรขั้นต้นเป็นตัวบ่งชี้ว่า Unit Economics พื้นฐานมีความคุ้มทุนหรือไม่ ก่อนหักค่าใช้จ่ายการวิจัยและพัฒนา (R&D) ที่สูง'
        );
        if (inc?.revenue) relatedMetrics.push({ key: 'revenue', name: 'Revenue', nameTh: 'รายได้รวม', valueStr: getLastValStr(inc.revenue, false, true) });
        if (cf?.free_cash_flow) relatedMetrics.push({ key: 'fcf', name: 'Free Cash Flow', nameTh: 'กระแสเงินสดอิสระ', valueStr: getLastValStr(cf.free_cash_flow, false, true) });
      } else {
        applicability = 'PRIMARY';
        industryStandardStatus = 'STANDARD_ACCOUNTING_METRIC';
        if (inc?.operating_income) relatedMetrics.push({ key: 'operating_income', name: 'Operating Income', nameTh: 'กำไรจากการดำเนินงาน', valueStr: getLastValStr(inc.operating_income, false, true) });
        if (inc?.cogs) relatedMetrics.push({ key: 'cogs', name: 'COGS', nameTh: 'ต้นทุนขาย', valueStr: getLastValStr(inc.cogs, false, true) });
      }
      break;
    }

    // -----------------------------------------------------------------------
    // 2. EBITDA Margin / EBITDA
    // -----------------------------------------------------------------------
    case 'ebitda_margin':
    case 'ebitda': {
      formula = 'EBITDA Margin = (Operating Income + Depreciation & Amortization) / Revenue';
      formulaTh = 'อัตรากำไร EBITDA = (กำไรจากการดำเนินงาน + ค่าเสื่อมและค่าตัดจำหน่าย) / รายได้รวม';
      periodType = 'DERIVED_RATIO';
      industryStandardStatus = 'GENERIC_DERIVED_RATIO';

      if (isDepositoryOrLender) {
        applicability = 'SECONDARY';
        interpretationCaveats.push(
          'EBITDA Margin is not generally the primary analytical lens for banking and lending economics, where debt and deposits represent funding inventory rather than corporate debt service. Avoid assuming higher EBITDA margin automatically equals superior operational quality, and do not infer cash conversion quality or ordinary corporate leverage from EBITDA alone.'
        );
        interpretationCaveatsTh.push(
          'อัตรากำไร EBITDA (EBITDA Margin) ไม่ใช่ดัชนีชี้วัดหลักสำหรับธุรกิจการเงินและสินเชื่อ เนื่องจากหนี้สินและเงินฝากเป็นวัตถุดิบในการระดมทุน ไม่ใช่ภาระหนี้สินทางการเงินทั่วไป การมี EBITDA สูงไม่ได้สะท้อนคุณภาพการแปลงเป็นเงินสดเหมือนบริษัททั่วไป และไม่ควรนำมาสรุปเรื่องภาระหนี้สินของธนาคาร'
        );
        if (inc?.operating_income) relatedMetrics.push({ key: 'operating_income', name: 'Operating Income', nameTh: 'กำไรจากการดำเนินงาน', valueStr: getLastValStr(inc.operating_income, false, true) });
        if (inc?.net_income) relatedMetrics.push({ key: 'net_income', name: 'Net Income', nameTh: 'กำไรสุทธิ', valueStr: getLastValStr(inc.net_income, false, true) });
      } else if (archetype === 'energy_commodity') {
        applicability = 'PRIMARY';
        interpretationCaveats.push(
          'EBITDA for commodity and cyclical companies is highly sensitive to commodity price swings. Single-period margin expansion or contraction should be evaluated against full-cycle normalized profitability.'
        );
        interpretationCaveatsTh.push(
          'EBITDA ของธุรกิจสินค้าโภคภัณฑ์และวัฏจักรมีความอ่อนไหวสูงต่อราคาตลาด การขยายตัวหรือหดตัวในไตรมาสเดียวควรประเมินเทียบกับค่าเฉลี่ยตลอดทั้งวัฏจักรเศรษฐกิจ'
        );
      } else if (archetype === 'utility' || archetype === 'telecom') {
        applicability = 'PRIMARY';
        interpretationCaveats.push(
          'For capital-intensive utilities and telecom, high EBITDA supports massive infrastructure depreciation and regulated debt service.'
        );
        interpretationCaveatsTh.push(
          'สำหรับสาธารณูปโภคและโทรคมนาคมที่ใช้เงินลงทุนสูง EBITDA เป็นดัชนีสำคัญที่รองรับค่าเสื่อมราคาโครงสร้างพื้นฐานและการชำระหนี้สินภายใต้การกำกับดูแล'
        );
      } else {
        applicability = 'PRIMARY';
        if (inc?.operating_income) relatedMetrics.push({ key: 'operating_income', name: 'Operating Income', nameTh: 'กำไรจากการดำเนินงาน', valueStr: getLastValStr(inc.operating_income, false, true) });
        if (cf?.depreciation) relatedMetrics.push({ key: 'depreciation', name: 'Depreciation', nameTh: 'ค่าเสื่อมราคา', valueStr: getLastValStr(cf.depreciation, false, true) });
      }
      break;
    }

    // -----------------------------------------------------------------------
    // 3. Free Cash Flow (FCF), FCF Margin, FCF to Sales, FCF to Net Income
    // -----------------------------------------------------------------------
    case 'fcf':
    case 'free_cash_flow':
    case 'fcf_to_sales':
    case 'fcf_margin':
    case 'fcf_to_net_income': {
      formula = metricKey === 'fcf_to_net_income'
        ? 'Cash Conversion Ratio = Free Cash Flow / Net Income'
        : 'Free Cash Flow = Operating Cash Flow - Capital Expenditures (CapEx)';
      formulaTh = metricKey === 'fcf_to_net_income'
        ? 'อัตราการแปลงกำไรเป็นเงินสด = กระแสเงินสดอิสระ / กำไรสุทธิ'
        : 'กระแสเงินสดอิสระ = กระแสเงินสดจากการดำเนินงาน - ค่าใช้จ่ายฝ่ายทุน (CapEx)';
      periodType = metricKey === 'fcf' ? 'QUARTER' : 'DERIVED_RATIO';

      if (isFinancialSector) {
        applicability = 'NOT_MEANINGFUL_FOR_PRIMARY_INTERPRETATION';
        isFinancialSectorGuardActive = true;
        industryStandardStatus = 'GENERIC_DERIVED_RATIO';
        interpretationCaveats.push(
          'Financial Sector Guard active: Generic Free Cash Flow (FCF) and cash conversion ratios are difficult or inappropriate to interpret for financial institutions where loan originations, customer deposits, and trading assets flow through operating cash flow. An extreme or negative FCF conversion ratio does not indicate operational deterioration or poor business quality.'
        );
        interpretationCaveatsTh.push(
          'Financial Sector Guard มีผลบังคับใช้: กระแสเงินสดอิสระ (FCF) และอัตราการแปลงกำไรเป็นเงินสดแบบทั่วไป ไม่สามารถนำมาประเมินสถาบันการเงินได้ตรงๆ เนื่องจากเงินรับฝาก การปล่อยสินเชื่อ และสินทรัพย์หมุนเวียนทางการเงินถูกบันทึกในกระแสเงินสดดำเนินงาน อัตราส่วน FCF ที่ติดลบหรือสูงผิดปกติไม่ได้บ่งชี้ว่าธุรกิจมีปัญหาหรือคุณภาพการดำเนินงานแย่'
        );
        if (inc?.net_income) relatedMetrics.push({ key: 'net_income', name: 'Net Income', nameTh: 'กำไรสุทธิ', valueStr: getLastValStr(inc.net_income, false, true) });
        if (bs?.total_equity) relatedMetrics.push({ key: 'total_equity', name: 'Total Equity', nameTh: 'ส่วนของผู้ถือหุ้น', valueStr: getLastValStr(bs.total_equity, false, true) });
      } else if (archetype === 'reit') {
        applicability = 'SECONDARY';
        interpretationCaveats.push(
          'For REITs, standard FCF includes large accounting depreciation that distorts operational cash generation. Institutional real estate analysis prioritizes FFO and AFFO when verified.'
        );
        interpretationCaveatsTh.push(
          'สำหรับธุรกิจ REIT กระแสเงินสดอิสระทั่วไป (FCF) ถูกกระทบจากค่าเสื่อมราคาทางบัญชีจำนวนมาก การวิเคราะห์อสังหาริมทรัพย์ระดับสถาบันจึงให้ความสำคัญกับ FFO และ AFFO มากกว่าเมื่อมีข้อมูล'
        );
      } else if (archetype === 'early_stage') {
        applicability = 'PRIMARY';
        interpretationCaveats.push(
          'For early-stage growth companies, negative FCF reflects intentional capital expenditure and growth investments. Monitor cash balance and runway alongside burn rate.'
        );
        interpretationCaveatsTh.push(
          'สำหรับธุรกิจระยะเริ่มต้น FCF ที่ติดลบสะท้อนการเร่งลงทุนขยายกิจการ ควรติดตามยอดเงินสดคงเหลือและระยะเวลาที่เงินสดจะเพียงพอ (Runway) ควบคู่กับอัตราการเผาเงินสด'
        );
        if (bs?.cash_and_equivalents) relatedMetrics.push({ key: 'cash', name: 'Cash & Equivalents', nameTh: 'เงินสดและรายการเทียบเท่า', valueStr: getLastValStr(bs.cash_and_equivalents, false, true) });
      } else {
        applicability = 'PRIMARY';
        industryStandardStatus = 'STANDARD_ACCOUNTING_METRIC';
        if (cf?.operating_cash_flow) relatedMetrics.push({ key: 'ocf', name: 'Operating Cash Flow', nameTh: 'กระแสเงินสดจากการดำเนินงาน', valueStr: getLastValStr(cf.operating_cash_flow, false, true) });
        if (cf?.capex) relatedMetrics.push({ key: 'capex', name: 'CapEx', nameTh: 'ค่าใช้จ่ายฝ่ายทุน', valueStr: getLastValStr(cf.capex, false, true) });
        if (inc?.net_income) relatedMetrics.push({ key: 'net_income', name: 'Net Income', nameTh: 'กำไรสุทธิ', valueStr: getLastValStr(inc.net_income, false, true) });
      }

      // Check denominator distortion on fcf_to_net_income
      if (metricKey === 'fcf_to_net_income' && inc?.net_income) {
        const lastNi = inc.net_income[inc.net_income.length - 1];
        if (lastNi !== null && lastNi !== undefined) {
          if (Math.abs(lastNi) < 1 || lastNi < 0 || (latestValue !== null && Math.abs(latestValue) > 1000)) {
            denominatorCaveats.push(
              'Denominator Distortion: Net Income is near-zero or negative, causing the mathematical cash-conversion ratio to appear extreme. Do not interpret this magnitude as catastrophic operational breakdown.'
            );
            denominatorCaveatsTh.push(
              'ตัวหารบิดเบือน: กำไรสุทธิมีค่าใกล้ศูนย์หรือติดลบ ทำให้อัตราส่วนทางคณิตศาสตร์แกว่งตัวรุนแรงผิดปกติ ไม่ควรสรุปจากขนาดตัวเลขเพียงอย่างเดียวว่าเป็นวิกฤตการดำเนินงาน'
            );
          }
        }
      }
      break;
    }

    // -----------------------------------------------------------------------
    // 4. ROE, ROA, ROIC
    // -----------------------------------------------------------------------
    case 'roe':
    case 'roa':
    case 'roic': {
      formula = metricKey === 'roe'
        ? 'ROE (Annualized) = (Net Income * 4) / Total Equity'
        : metricKey === 'roa'
        ? 'ROA (Annualized) = (Net Income * 4) / Total Assets'
        : 'ROIC (Annualized) = NOPAT / (Total Debt + Equity - Cash)';
      formulaTh = metricKey === 'roe'
        ? 'ROE (ปรับรายปี) = (กำไรสุทธิ * 4) / ส่วนของผู้ถือหุ้นรวม'
        : metricKey === 'roa'
        ? 'ROA (ปรับรายปี) = (กำไรสุทธิ * 4) / สินทรัพย์รวม'
        : 'ROIC (ปรับรายปี) = กำไรจากการดำเนินงานหลังภาษี / เงินลงทุนสุทธิ';
      periodType = 'ANNUALIZED';
      industryStandardStatus = 'GENERIC_DERIVED_RATIO';

      if (archetype === 'early_stage') {
        applicability = 'CONTEXT_ONLY';
        interpretationCaveats.push(
          'For early-stage or pre-profit companies with negative or negligible equity, ROE and ROA denominators can produce mathematically extreme or misleading percentages. Focus on revenue trajectory, cash balance, and burn rate instead.'
        );
        interpretationCaveatsTh.push(
          'สำหรับบริษัทระยะเริ่มต้นหรือยังไม่มีกำไร ซึ่งมีส่วนของผู้ถือหุ้นติดลบหรือต่ำมาก ตัวหารของ ROE/ROA จะทำให้ได้เปอร์เซ็นต์ที่บิดเบือนหรือสูงเกินจริง ควรเน้นดูการเติบโตของรายได้ ยอดเงินสดคงเหลือ และอัตราการเผาเงินสด (Burn Rate) แทน'
        );
        denominatorCaveats.push('Near-zero or negative equity denominator distorts the calculated return percentage.');
        denominatorCaveatsTh.push('ส่วนของผู้ถือหุ้นติดลบหรือใกล้ศูนย์ ทำให้ตัวเลขอัตราผลตอบแทนทางคณิตศาสตร์บิดเบือน');
      } else if (isDepositoryOrLender || archetype === 'insurer') {
        applicability = 'PRIMARY';
        interpretationCaveats.push(
          'ROE is a premier indicator of banking and financial profitability. Evaluate alongside asset quality, equity multiplier, and reserve coverage.'
        );
        interpretationCaveatsTh.push(
          'ROE เป็นดัชนีชี้วัดผลการดำเนินงานหลักของธุรกิจธนาคารและการเงิน ควรประเมินควบคู่กับคุณภาพสินทรัพย์ อัตราส่วนหนี้สินต่อทุน และการตั้งสำรองหนี้สงสัยจะสูญ'
        );
      } else {
        applicability = 'PRIMARY';
      }
      break;
    }

    // -----------------------------------------------------------------------
    // 5. Current Ratio & Quick Ratio (Solvency)
    // -----------------------------------------------------------------------
    case 'current_ratio':
    case 'quick_ratio': {
      formula = metricKey === 'current_ratio'
        ? 'Current Ratio = Total Current Assets / Total Current Liabilities'
        : 'Quick Ratio = (Current Assets - Inventory) / Total Current Liabilities';
      formulaTh = metricKey === 'current_ratio'
        ? 'อัตราส่วนสภาพคล่อง = สินทรัพย์หมุนเวียนรวม / หนี้สินหมุนเวียนรวม'
        : 'อัตราส่วนสภาพคล่องเร็ว = (สินทรัพย์หมุนเวียนรวม - สินค้าคงเหลือ) / หนี้สินหมุนเวียนรวม';
      periodType = 'POINT_IN_TIME';
      industryStandardStatus = 'STANDARD_ACCOUNTING_METRIC';

      if (isFinancialSector) {
        applicability = 'NOT_MEANINGFUL_FOR_PRIMARY_INTERPRETATION';
        interpretationCaveats.push(
          'Working capital ratios like Current Ratio and Quick Ratio are designed for non-financial commercial firms. Financial institutions manage liquidity through reserve requirements, high-quality liquid assets (HQLA), and funding facilities rather than traditional current assets vs liabilities.'
        );
        interpretationCaveatsTh.push(
          'อัตราส่วนสภาพคล่องหมุนเวียน (Current / Quick Ratio) ถูกออกแบบมาสำหรับบริษัทพาณิชย์ทั่วไป สถาบันการเงินและประกันภัยบริหารสภาพคล่องผ่านการดำรงสินทรัพย์สภาพคล่อง (HQLA), เงินสำรองประกันภัย และวงเงินสินเชื่อ ไม่ใช่อัตราส่วนสินทรัพย์หมุนเวียนทั่วไป'
        );
      } else {
        applicability = 'PRIMARY';
      }
      break;
    }

    // -----------------------------------------------------------------------
    // 6. Inventory Turnover, DIO, DPO, CCC (Working Capital)
    // -----------------------------------------------------------------------
    case 'inventory_turnover':
    case 'dio':
    case 'dpo':
    case 'ccc': {
      formula = metricKey === 'inventory_turnover'
        ? 'Inventory Turnover = (COGS * 4) / Inventory'
        : metricKey === 'ccc'
        ? 'Cash Conversion Cycle = DSO + DIO - DPO'
        : 'Working capital turnover days metric';
      formulaTh = metricKey === 'inventory_turnover'
        ? 'อัตราหมุนเวียนสินค้าคงเหลือ = (ต้นทุนขาย * 4) / สินค้าคงเหลือ'
        : metricKey === 'ccc'
        ? 'วงจรเงินสด = ระยะเวลาเก็บหนี้ + ระยะเวลาขายสินค้า - ระยะเวลาชำระหนี้'
        : 'อัตราหมุนเวียนเงินทุนหมุนเวียน';
      periodType = 'DERIVED_RATIO';
      industryStandardStatus = 'STANDARD_ACCOUNTING_METRIC';

      if (isFinancialSector || archetype === 'saas_software' || archetype === 'digital_marketplace') {
        applicability = 'NOT_MEANINGFUL_FOR_PRIMARY_INTERPRETATION';
        interpretationCaveats.push(
          'Inventory turnover and Cash Conversion Cycle have little or no economic meaning for asset-light software, digital platforms, or financial service firms with no physical inventory.'
        );
        interpretationCaveatsTh.push(
          'อัตราหมุนเวียนสินค้าคงเหลือและวงจรเงินสด (CCC) ไม่มีความหมายเชิงเศรษฐกิจสำหรับธุรกิจซอฟต์แวร์ ดิจิทัลแพลตฟอร์ม หรือสถาบันการเงินที่ไม่มีสินค้าคงคลังจริง'
        );
      } else if (archetype === 'industrial_manufacturing' || archetype === 'retail') {
        applicability = 'PRIMARY';
        interpretationCaveats.push(
          'Inventory velocity and working capital efficiency are vital indicators of supply chain execution and cash generation.'
        );
        interpretationCaveatsTh.push(
          'การหมุนเวียนสินค้าคงคลังและประสิทธิภาพเงินทุนหมุนเวียนเป็นดัชนีสำคัญที่สะท้อนการบริหารห่วงโซ่อุปทานและการสร้างกระแสเงินสด'
        );
      } else {
        applicability = 'SECONDARY';
      }
      break;
    }

    // -----------------------------------------------------------------------
    // 7. Banking Specific KPIs (NIM, Deposits, LDR, Efficiency Ratio)
    // -----------------------------------------------------------------------
    case 'nim':
    case 'deposit_growth':
    case 'loan_deposit_ratio':
    case 'efficiency_ratio': {
      periodType = metricKey === 'deposit_growth' ? 'POINT_IN_TIME' : 'DERIVED_RATIO';
      industryStandardStatus = 'INDUSTRY_STANDARD_METRIC';

      if (isDepositoryOrLender) {
        applicability = 'PRIMARY';
      } else {
        applicability = 'NOT_MEANINGFUL_FOR_PRIMARY_INTERPRETATION';
        interpretationCaveats.push('This banking-specific metric is not applicable to non-depository commercial businesses.');
        interpretationCaveatsTh.push('ดัชนีชี้วัดเฉพาะธุรกิจธนาคารนี้ไม่สามารถนำมาปรับใช้กับบริษัทพาณิชย์ทั่วไป');
      }
      break;
    }

    // -----------------------------------------------------------------------
    // 8. Solvency & Capital Structure (Debt to Equity, Debt to Asset, Equity Ratio)
    // -----------------------------------------------------------------------
    case 'debt_to_equity':
    case 'debt_to_asset':
    case 'equity_ratio': {
      formula = metricKey === 'debt_to_equity'
        ? 'Debt to Equity = Total Debt / Total Equity'
        : metricKey === 'debt_to_asset'
        ? 'Debt to Asset = (Total Debt / Total Assets) * 100'
        : 'Equity Ratio = (Total Equity / Total Assets) * 100';
      formulaTh = metricKey === 'debt_to_equity'
        ? 'อัตราส่วนหนี้สินต่อทุน (D/E) = หนี้สินรวม / ส่วนของผู้ถือหุ้นรวม'
        : metricKey === 'debt_to_asset'
        ? 'อัตราส่วนหนี้สินต่อสินทรัพย์รวม = (หนี้สินรวม / สินทรัพย์รวม) * 100'
        : 'อัตราส่วนทุนต่อสินทรัพย์รวม = (ส่วนของผู้ถือหุ้นรวม / สินทรัพย์รวม) * 100';
      periodType = 'POINT_IN_TIME';
      industryStandardStatus = 'STANDARD_ACCOUNTING_METRIC';

      if (isDepositoryOrLender) {
        applicability = 'SECONDARY';
        interpretationCaveats.push(
          'For banks and lenders, leverage is managed via regulatory capital ratios (e.g. CET1, Tier 1 Leverage) rather than unweighted gross debt-to-equity.'
        );
        interpretationCaveatsTh.push(
          'สำหรับสถาบันการเงิน การก่อหนี้ถูกกำกับด้วยอัตราส่วนเงินกองทุนตามเกณฑ์ทางการ (เช่น CET1, Tier 1) มากกว่าอัตราส่วนหนี้สินต่อทุนแบบไม่ถ่วงน้ำหนักความเสี่ยง'
        );
      } else {
        applicability = 'PRIMARY';
      }

      // Negative equity or extreme leverage guard
      if (metricKey === 'debt_to_equity' && isNegative) {
        denominatorCaveats.push(
          'Negative Equity: The company has negative stockholders equity (accumulated deficit or heavy share repurchases), causing the D/E ratio to be mathematically negative.'
        );
        denominatorCaveatsTh.push(
          'ส่วนของผู้ถือหุ้นติดลบ: บริษัทมีส่วนของผู้ถือหุ้นติดลบ (จากขาดทุนสะสมหรือการซื้อหุ้นคืนจำนวนมาก) ทำให้อัตราส่วน D/E มีค่าติดลบทางคณิตศาสตร์'
        );
      }
      break;
    }

    // -----------------------------------------------------------------------
    // Default Fallback
    // -----------------------------------------------------------------------
    default: {
      applicability = 'RELEVANT';
      industryStandardStatus = 'STANDARD_ACCOUNTING_METRIC';
      break;
    }
  }

  // Provenance handling
  if (isUnavailable) {
    provenance = 'UNAVAILABLE';
  } else if (metricKey === 'nim' || metricKey === 'revenue' || metricKey === 'net_income' || metricKey === 'operating_income') {
    provenance = 'SEC_VERIFIED';
  } else {
    provenance = 'DETERMINISTIC_DERIVED';
  }

  // AI Usage Policy
  const aiUsagePolicy = [
    `SELECTED_METRIC_SUBJECT_ANCHOR: The explanation must remain focused on ${metricName}. Do not replace it with another metric.`,
    `BUSINESS_ARCHETYPE: ${archetypeMeta.labelEn} (${archetype}).`,
    `APPLICABILITY: ${applicability}.`,
    isFinancialSectorGuardActive ? 'FINANCIAL_SECTOR_GUARD: ACTIVE. Do not infer operational failure from generic FCF conversion.' : '',
    interpretationCaveats.length > 0 ? `CAVEATS: ${interpretationCaveats.join(' ')}` : '',
    denominatorCaveats.length > 0 ? `DENOMINATOR_GUARD: ${denominatorCaveats.join(' ')}` : '',
    isPeriodMismatch ? 'PERIOD_MISMATCH: Historical sequence mixes non-comparable period structures. Do not claim valid trend.' : '',
    'NO_UNSOURCED_BENCHMARKS: Explain directionality without inventing arbitrary numeric industry thresholds.',
    'STRICT_STRENGTHS_AND_WATCHOUTS: Ground strengths and watchouts in the selected metric and its caveats. If no clear strength can be concluded, state that plainly rather than generating generic company-wide filler.'
  ].filter(Boolean).join('\n');

  const applicabilityLabels: Record<MetricApplicability, { en: string; th: string }> = {
    PRIMARY: { en: 'Primary KPI', th: 'ตัวชี้วัดหลัก' },
    RELEVANT: { en: 'Relevant Metric', th: 'ตัวชี้วัดที่เกี่ยวข้อง' },
    SECONDARY: { en: 'Supporting Metric', th: 'ตัวชี้วัดเสริม' },
    CONTEXT_ONLY: { en: 'Context Metric', th: 'ข้อมูลบริบท' },
    NOT_MEANINGFUL_FOR_PRIMARY_INTERPRETATION: { en: 'Limited Interpretation', th: 'จำกัดการตีความ' }
  };

  const statusLabels: Record<IndustryStandardStatus, { en: string; th: string }> = {
    STANDARD_ACCOUNTING_METRIC: { en: 'Standard Accounting', th: 'มาตรฐานบัญชีสากล' },
    INDUSTRY_STANDARD_METRIC: { en: 'Industry Standard', th: 'มาตรฐานเฉพาะอุตสาหกรรม' },
    LUMINA_DERIVED_METRIC: { en: 'Lumina Derived', th: 'อัตราส่วนคำนวณ Lumina' },
    GENERIC_DERIVED_RATIO: { en: 'Generic Ratio', th: 'อัตราส่วนทางการเงินทั่วไป' }
  };

  const interpretationRole: MetricInterpretationRole =
    applicability === 'PRIMARY' ? 'PRIMARY' :
    applicability === 'RELEVANT' ? 'SECONDARY' :
    applicability === 'SECONDARY' ? 'SECONDARY' :
    applicability === 'CONTEXT_ONLY' ? 'CONTEXT_ONLY' : 'NOT_MEANINGFUL';

  let valueState: MetricValueState = 'CALCULATED';
  if (isUnavailable) {
    valueState = 'NOT_AVAILABLE';
  } else if (provenance === 'SEC_VERIFIED' || (provenance as any) === 'COMPANY_REPORTED') {
    valueState = 'REPORTED';
  } else {
    valueState = 'CALCULATED';
  }

  return {
    metricKey,
    metricName,
    metricNameTh: metricNameTh || metricName,
    businessArchetype: archetype,
    archetypeLabelEn: archetypeMeta.labelEn,
    archetypeLabelTh: archetypeMeta.labelTh,
    sector,
    industry,
    applicability,
    applicabilityLabelEn: applicabilityLabels[applicability].en,
    applicabilityLabelTh: applicabilityLabels[applicability].th,
    industryStandardStatus,
    statusLabelEn: statusLabels[industryStandardStatus].en,
    statusLabelTh: statusLabels[industryStandardStatus].th,
    formula,
    formulaTh,
    periodType,
    provenance,
    isFinancialSectorGuardActive,
    interpretationCaveats,
    interpretationCaveatsTh,
    relatedMetrics,
    denominatorCaveats,
    denominatorCaveatsTh,
    aiUsagePolicy,
    isCalculableButLimited: applicability === 'CONTEXT_ONLY' || applicability === 'SECONDARY' || applicability === 'NOT_MEANINGFUL_FOR_PRIMARY_INTERPRETATION',
    isUnavailable,
    isNegative,
    isPeriodMismatch,
    valueState,
    interpretationRole,
    isSourceReconciled,
    provenanceStatus: provenanceStatus || (isSourceReconciled ? 'SEC_RECONCILED' : 'Source reconciliation not verified')
  };
}

/**
 * Builds the comprehensive, business-aware Gemini prompt for analyzing a selected metric.
 */
export function buildFinancialMetricAnalysisPrompt(
  context: MetricInterpretationContext,
  options: {
    normalizedCompanyName: string;
    normalizedTicker: string;
    periods: string[];
    historyValues: (number | null | undefined)[];
    yoyPcts: (number | null | undefined)[];
    unit: string;
    isCurrency: boolean;
    widerContext?: Record<string, any>;
    redFlags?: string[];
    isThai?: boolean;
  }
): string {
  const {
    normalizedCompanyName,
    normalizedTicker,
    periods = [],
    historyValues = [],
    yoyPcts = [],
    unit = '',
    isCurrency = false,
    widerContext = {},
    redFlags = [],
    isThai = true
  } = options;

  // Format historical sequence
  const missingPeriods = (periods || []).filter((_, idx) => historyValues[idx] === null || historyValues[idx] === undefined);
  const availablePeriods = (periods || []).filter((_, idx) => historyValues[idx] !== null && historyValues[idx] !== undefined);
  const partialNote = missingPeriods.length > 0
    ? `\n- PARTIAL SERIES NOTE: Verified data is available only for [${availablePeriods.join(', ')}]. Missing periods: [${missingPeriods.join(', ')}]. Analyze ONLY the available periods. Do NOT claim continuous 4-quarter history or interpolate missing periods.`
    : '';

  const historySummary = (periods || []).map((p: string, idx: number) => {
    const val = historyValues[idx];
    const yoy = yoyPcts[idx];
    if (val === null || val === undefined) return `${p}: -`;
    let valStr = '';
    if (isCurrency || unit === '$' || unit === 'M') {
      const abs = Math.abs(val);
      const sign = val < 0 ? '-' : '';
      valStr = abs >= 1000 ? `${sign}$${(abs / 1000).toFixed(2)}B` : `${sign}$${abs.toFixed(2)}M`;
    } else if (unit === '%') {
      valStr = `${val.toFixed(1)}%`;
    } else {
      valStr = `${val}${unit ? ' ' + unit : ''}`;
    }
    const yoyStr = yoy !== null && yoy !== undefined ? ` (${yoy >= 0 ? '+' : ''}${yoy.toFixed(1)}% YoY)` : '';
    return `${p}: ${valStr}${yoyStr}`;
  }).join(', ');

  const contextSummary = Object.entries(widerContext || {})
    .filter(([_, v]) => Array.isArray(v) && v.length > 0)
    .map(([k, v]) => `${k}: ${(v as any[]).slice(-4).join(', ')}`)
    .join('\n');

  const relatedMetricsSummary = context.relatedMetrics.length > 0
    ? context.relatedMetrics.map(m => `- ${m.name} (${m.nameTh}): ${m.valueStr || 'Available in report'}`).join('\n')
    : 'None specified';

  const redFlagsSummary = (redFlags || []).slice(0, 3).join('; ');

  return `You are an elite Senior Wall Street Equity Research Analyst (CFA Charterholder) analyzing a selected financial metric for **${normalizedCompanyName} (${normalizedTicker})**.

======================================================================
1. BUSINESS CLASSIFICATION & DETERMINISTIC DOMAIN CONTEXT
======================================================================
- Business Archetype: ${context.archetypeLabelEn} (${context.businessArchetype})
- Sector: ${context.sector} | Industry: ${context.industry}
- Selected Metric: ${context.metricName} (${context.metricKey})
- Metric Applicability: ${context.applicabilityLabelEn} (${context.applicability})
- Metric Value State: ${context.valueState} | Interpretation Role: ${context.interpretationRole}
- Industry Standard Status: ${context.statusLabelEn} (${context.industryStandardStatus})
- Formula / Provenance: ${context.formula || 'Standard calculation'} [${context.provenance}]
- Financial Sector Guard Active: ${context.isFinancialSectorGuardActive ? 'YES (FCF / Cash Conversion guarded for financial model)' : 'NO'}
${!context.isSourceReconciled ? '- Provenance Status: Source reconciliation between filing tables is NOT verified. Bounded confidence required. Do NOT describe values as fully SEC-reconciled.\n' : ''}
${context.interpretationCaveats.length > 0 ? `SPECIFIC BUSINESS CAVEATS:\n${context.interpretationCaveats.map(c => `- ${c}`).join('\n')}\n` : ''}
${context.denominatorCaveats.length > 0 ? `DENOMINATOR / MAGNITUDE GUARDS:\n${context.denominatorCaveats.map(c => `- ${c}`).join('\n')}\n` : ''}

======================================================================
2. HISTORICAL DATA & RETRIEVED CONTEXT
======================================================================
- Historical Sequence: ${historySummary}${partialNote}
${contextSummary ? `- Wider Financial Statement Context (recent periods in $M):\n${contextSummary}\n` : ''}
- Verified Related Metrics for this Archetype:
${relatedMetricsSummary}
${redFlagsSummary ? `- Related Red Flags from SEC filings: ${redFlagsSummary}\n` : ''}

======================================================================
3. CRITICAL INSTITUTIONAL ANALYSIS RULES
======================================================================
1. SELECTED METRIC MUST REMAIN THE SUBJECT:
   - Analyze ${context.metricName} directly. Do NOT substitute another metric as the primary subject.
   - If the metric has limited primary relevance for this business model (e.g. Gross Margin or EBITDA Margin for a bank/lender), explicitly explain why, note how Lumina calculates it, and reference related metrics without abandoning the selected metric.
2. BUSINESS-AWARE INTERPRETATION:
   - For banks/lenders/fintech: Do NOT apply generic operating-company cash-flow or operating leverage templates. Recognize that debt and deposits represent funding inventory.
   - For REITs: Acknowledge depreciation distortion on standard metrics; point to FFO/AFFO without fabricating numbers.
   - For Cyclicals/Energy: Contextualize margins within commodity price cycles; do not assume single-period trends are permanently durable.
   - For Early-stage: Account for small or negative denominator distortions on return ratios (ROE/ROIC).
3. FINANCIAL SECTOR GUARD:
   ${context.isFinancialSectorGuardActive
     ? '- Generic FCF and cash conversion ratios are guarded for this institution. Do NOT claim negative or extreme FCF conversion proves operational failure or weak business quality.'
     : '- Normal cash flow and operating conversion rules apply.'}
4. KEY STRENGTHS & WATCHOUTS:
   - Ground Key Strengths in the selected metric and verified evidence. If no clear strength can be concluded from this metric alone, state: "${isThai ? 'ไม่สามารถสรุปข้อดีที่ชัดเจนได้จากตัวชี้วัดนี้เพียงลำพัง' : 'No clear strength can be concluded from this metric alone.'}". Do NOT provide generic canned praise.
   - Watchouts must relate specifically to the selected metric and its business caveats. Do NOT repeat the exact same company-wide risks (e.g. SBC or personal loan defaults) for every metric.
5. NO UNSOURCED BENCHMARKS:
   - Explain directionality (e.g. expanding vs contracting, higher is generally favorable). Do NOT invent arbitrary numerical thresholds (e.g. "good gross margin > 70%").
6. MISSING & NEGATIVE DATA:
   - If data is unavailable, state data is unavailable. Never substitute zero or invent numbers.
   - Analyze legitimately negative numbers accurately without converting them to missing.
7. LANGUAGE & TONE:
   - ${isThai ? 'ตอบเป็นภาษาไทยระดับนักวิเคราะห์สถาบัน (Equity Research) ชัดเจน ตรงประเด็น กระชับ ใช้ศัพท์การเงินสากล (EBITDA, ROE, FCF, NIM) อย่างถูกต้อง' : 'Respond in professional Wall Street Equity Research English.'}
8. RECONCILIATION CONFIDENCE BOUNDS:
   - ${!context.isSourceReconciled ? 'Source reconciliation between filing tables is NOT verified. Maintain bounded confidence; do NOT state or imply that statement lines reconcile with audited precision.' : 'Source reconciliation verified across SEC filing tables.'}

OUTPUT FORMAT:
Respond STRICTLY with a raw JSON object wrapped in \`\`\`json ... \`\`\` matching this schema:
{
  "status": "warning" | "neutral" | "good" | "excellent",
  "status_label_th": "สรุปสถานะสั้นๆ 3-7 คำ",
  "status_label_en": "Short status label 3-7 words",
  "what_is_it_th": "คำจำกัดความ/ความหมายของตัวชี้วัดนี้ในบริบทของโมเดลธุรกิจ 1-2 ประโยคชัดเจน",
  "what_is_it_en": "Clear 1-2 sentence definition of this metric in the context of this business model",
  "interpretation_th": "วิเคราะห์เชิงลึก 2-4 ประโยค ระบุตัวเลขจริง ชี้แนวโน้ม ความเกี่ยวข้องกับโมเดลธุรกิจ และผลกระทบ",
  "interpretation_en": "In-depth 2-4 sentence analysis citing figures, trend, business model relevance, and impact",
  "pros_th": ["ข้อดีหรือผลเชิงบวกที่เป็นจริงจากตัวชี้วัดนี้ 1-2 ข้อ (หรือระบุว่าไม่สามารถสรุปข้อดีได้ชัดเจน)"],
  "pros_en": ["Realistic positive aspects from this metric (or state no clear strength concluded)"],
  "benchmark_th": "เกณฑ์มาตรฐานหรือแนวทางอ้างอิงเชิงทิศทางสำหรับธุรกิจประเภทนี้ (ไม่ประดิษฐ์ตัวเลขเกณฑ์ลอยๆ)",
  "benchmark_en": "Directional rule of thumb for this business archetype (no unsourced numerical thresholds)",
  "watchouts_th": "จุดเฝ้าระวังและความเสี่ยงที่เกี่ยวข้องโดยตรงกับตัวชี้วัดนี้และข้อจำกัดของโมเดลธุรกิจ",
  "watchouts_en": "Key financial risks directly relevant to this metric and business model caveats"
}`;
}

/**
 * Generates a high-fidelity, business-aware local fallback insight when Gemini is offline,
 * loading, or unavailable, ensuring deterministic financial integrity.
 */
export function getBusinessAwareLocalFallback(
  context: MetricInterpretationContext,
  latestValue: number | string | null | undefined,
  isThai: boolean = true
): FinancialAiInsight {
  const isUnavailable = latestValue === null || latestValue === undefined;
  const numVal = typeof latestValue === 'number' ? latestValue : null;

  if (isUnavailable || numVal === null) {
    return {
      key: context.metricKey,
      name: context.metricName,
      name_th: context.metricNameTh,
      category: 'operating',
      status: 'neutral',
      status_label_th: 'ไม่มีข้อมูล',
      status_label_en: 'Data unavailable',
      what_is_it_th: `${context.metricNameTh}: ${context.formulaTh || 'ไม่มีข้อมูลเพียงพอสำหรับอธิบายตัวชี้วัดนี้'}`,
      what_is_it_en: `${context.metricName}: ${context.formula || 'Data unavailable for this metric.'}`,
      interpretation_th: 'ยังไม่มีข้อมูลที่เพียงพอสำหรับการวิเคราะห์ตัวชี้วัดนี้ (ไม่มีข้อมูล จึงไม่สร้างค่าหรือข้อสรุปทดแทนตามหลัก Financial Integrity)',
      interpretation_en: 'Insufficient data to analyze this metric. (Data unavailable; no substitute value or conclusion was generated under Financial Integrity.)',
      pros_th: ['ยังไม่มีข้อมูลที่เพียงพอสำหรับการประเมินข้อดี'],
      pros_en: ['Insufficient data to evaluate specific strengths.'],
      benchmark_th: 'ไม่มีข้อมูลที่ตรวจสอบได้',
      benchmark_en: 'Data unavailable',
      watchouts_th: 'รอข้อมูลงบการเงินจากแหล่งอ้างอิงก่อนประเมิน',
      watchouts_en: 'Wait for sourced financial-statement data before evaluating this metric.'
    };
  }

  // Format value string
  const valStr = typeof numVal === 'number' ? `${numVal.toFixed(1)}%` : String(latestValue);

  // Business-specific local fallback text
  let status: FinancialAiInsight['status'] = 'good';
  let statusLabelTh = `สถานะปกติ (${valStr})`;
  let statusLabelEn = `Normal Range (${valStr})`;
  let whatIsItTh = context.formulaTh ? `สูตร: ${context.formulaTh}` : `ตัวชี้วัด ${context.metricNameTh}`;
  let whatIsItEn = context.formula ? `Formula: ${context.formula}` : `Metric: ${context.metricName}`;
  let interpretationTh = `ตัวชี้วัด ${context.metricNameTh} อยู่ที่ ${valStr} สำหรับโมเดลธุรกิจ ${context.archetypeLabelTh}`;
  let interpretationEn = `${context.metricName} stands at ${valStr} for ${context.archetypeLabelEn}.`;
  let prosTh: string[] = [];
  let prosEn: string[] = [];
  let benchmarkTh = 'เกณฑ์อ้างอิงเชิงทิศทาง: ค่าที่เติบโตสอดคล้องกับขนาดธุรกิจ';
  let benchmarkEn = 'Directional Rule of Thumb: Growth in tandem with business scale.';
  let watchoutsTh = 'ติดตามความสม่ำเสมอของผลการดำเนินงานในไตรมาสถัดไป';
  let watchoutsEn = 'Monitor quarterly consistency in subsequent periods.';

  if (context.isFinancialSectorGuardActive) {
    status = 'neutral';
    statusLabelTh = 'Financial Sector Guard มีผลบังคับใช้';
    statusLabelEn = 'Financial Sector Guard Active';
    whatIsItTh = context.interpretationCaveatsTh[0] || whatIsItTh;
    whatIsItEn = context.interpretationCaveats[0] || whatIsItEn;
    interpretationTh = `สำหรับธุรกิจ ${context.archetypeLabelTh} ตัวเลขกระแสเงินสดอิสระ (FCF) และอัตราส่วนการแปลงเงินสดทั่วไปถูกบิดเบือนจากการปล่อยสินเชื่อและเงินรับฝาก จึงไม่สะท้อนปัญหาการดำเนินงาน`;
    interpretationEn = `For ${context.archetypeLabelEn}, generic FCF and cash conversion are distorted by lending/deposit flows and do not indicate operational failure.`;
    prosTh = ['ประเมินมูลค่าตามส่วนของผู้ถือหุ้นและเงินกองทุนแทน FCF'];
    prosEn = ['Valued using equity multiples and solvency rather than FCF'];
    benchmarkTh = 'เกณฑ์อ้างอิง: ไม่ใช้ FCF ในการประเมินคุณภาพสถาบันการเงิน';
    benchmarkEn = 'Rule of Thumb: Generic FCF is not applicable for financial institutions.';
    watchoutsTh = 'มุ่งเน้นการตรวจสอบความเพียงพอของเงินกองทุน คุณภาพสินเชื่อ และส่วนต่างดอกเบี้ยแทน';
    watchoutsEn = 'Focus on capital adequacy, credit quality, and interest margins instead.';
  } else if (context.applicability === 'CONTEXT_ONLY' || context.applicability === 'NOT_MEANINGFUL_FOR_PRIMARY_INTERPRETATION') {
    status = 'neutral';
    statusLabelTh = `ข้อมูลบริบท (${valStr})`;
    statusLabelEn = `Context Metric (${valStr})`;
    whatIsItTh = context.interpretationCaveatsTh[0] || whatIsItTh;
    whatIsItEn = context.interpretationCaveats[0] || whatIsItEn;
    interpretationTh = `ตัวชี้วัด ${context.metricNameTh} อยู่ที่ ${valStr} ซึ่งคำนวณไว้เพื่อให้เห็นภาพรวม แต่ไม่ใช่ตัวชี้วัดหลักของธุรกิจ ${context.archetypeLabelTh}`;
    interpretationEn = `${context.metricName} is ${valStr}. Calculated for exploratory context, but not a primary KPI for ${context.archetypeLabelEn}.`;
    prosTh = [isThai ? 'ไม่สามารถสรุปข้อดีที่ชัดเจนได้จากตัวชี้วัดนี้เพียงลำพัง' : 'No clear strength can be concluded from this metric alone.'];
    prosEn = ['No clear strength can be concluded from this metric alone.'];
    benchmarkTh = 'เกณฑ์อ้างอิง: พิจารณาควบคู่กับตัวชี้วัดเฉพาะอุตสาหกรรม';
    benchmarkEn = 'Rule of Thumb: Interpret alongside sector-specific KPIs.';
    watchoutsTh = context.interpretationCaveatsTh[0] || watchoutsTh;
    watchoutsEn = context.interpretationCaveats[0] || watchoutsEn;
  }

  return {
    key: context.metricKey,
    name: context.metricName,
    name_th: context.metricNameTh,
    category: 'operating',
    status,
    status_label_th: statusLabelTh,
    status_label_en: statusLabelEn,
    what_is_it_th: whatIsItTh,
    what_is_it_en: whatIsItEn,
    interpretation_th: interpretationTh,
    interpretation_en: interpretationEn,
    pros_th: prosTh,
    pros_en: prosEn,
    benchmark_th: benchmarkTh,
    benchmark_en: benchmarkEn,
    watchouts_th: watchoutsTh,
    watchouts_en: watchoutsEn
  };
}
