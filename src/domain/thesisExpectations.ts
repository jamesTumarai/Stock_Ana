import { ReportData } from '../types';
import { ResearchMemorySnapshot, extractMemorySnapshot } from './investmentMemory';
import { unwrapHistoryRecord } from '../utils/researchTimeline';
import { detectValuationModel } from '../utils/valuation/modelSelector';
import { resolveBusinessArchetype, type BusinessArchetype } from './financialMetricContext';

export type ThesisStatus =
  | 'ACTIVE'
  | 'UNDER_REVIEW'
  | 'POTENTIALLY_CHALLENGED'
  | 'INVALIDATED_BY_USER'
  | 'ARCHIVED';

export type ThesisConfirmationStatus =
  | 'AI_DRAFT'
  | 'USER_CONFIRMED'
  | 'USER_EDITED'
  | 'SUPERSEDED';

export interface ActiveValuationAssumption {
  labelTh: string;
  labelEn: string;
  valueText: string;
  provenance?: 'DETERMINISTIC_DERIVATION' | 'AI_DRAFT' | 'VERIFIED_FACT' | 'USER_CONFIRMED' | 'MODEL_ASSUMPTION' | 'PROVIDER_REPORTED';
}

export interface ActiveValuationBasis {
  methodTitleTh: string;
  methodTitleEn: string;
  guardStatusTh?: string;
  guardStatusEn?: string;
  isGuarded: boolean;
  modelType: string | null;
  assumptions: ActiveValuationAssumption[];
}

export interface ThesisValuationSnapshot {
  modelType: string | null;
  methodTitleEn: string;
  methodTitleTh: string;
  isGuarded: boolean;
  guardStatusEn?: string;
  guardStatusTh?: string;
  assumptions: {
    waccPct?: number | null;
    terminalGrowthPct?: number | null;
    projectionYears?: number | null;
    revenueCagrPct?: number | null;
    terminalMarginPct?: number | null;
    [key: string]: any;
  };
  assumptionsList: ActiveValuationAssumption[];
  sourceReportId: string | null;
  capturedAt: string;
  provenance: string;
}

export interface InvestmentThesisRecord {
  thesisId: string;
  ticker: string;
  version: number;
  summary: string;
  keyDrivers: string[];
  keyAssumptions: string[];
  keyRisks: string[];
  catalysts: string[];
  invalidationConditions: string[];
  status: ThesisStatus;
  confirmationStatus: ThesisConfirmationStatus;
  sourceReportId: string | null;
  frozenValuationBasis?: ActiveValuationBasis;
  valuationSnapshot?: ThesisValuationSnapshot;
  createdAt: string;
  updatedAt: string;
  userId?: string;
  notes?: string;
}

export type BusinessCategory = 'operating' | 'financial' | 'reit' | 'cyclical' | 'early_stage';
export type EvaluationMode = 'AUTO' | 'MANUAL';

export type ExpectationMetric =
  | 'revenue'
  | 'revenue_growth_yoy_pct'
  | 'operating_margin_pct'
  | 'free_cash_flow'
  | 'net_income'
  | 'eps_diluted'
  | 'gross_margin_pct'
  | 'cash_and_equivalents'
  | 'net_cash'
  | 'deposits'
  | 'net_interest_margin'
  | 'tier_1_capital_ratio'
  | 'net_charge_off_rate'
  | 'combined_ratio_pct'
  | 'affo'
  | 'ffo'
  | 'occupancy_rate'
  | 'custom_event';

export interface ExpectationMetricDefinition {
  id: string;
  labelEn: string;
  labelTh: string;
  unit: string;
  category: 'FINANCIAL' | 'OPERATIONAL' | 'CREDIT' | 'CUSTOM';
  applicableBusinessTypes: BusinessCategory[];
  applicableArchetypes?: BusinessArchetype[];
  evaluationMode: EvaluationMode;
  supportedPeriods: ('QUARTER' | 'ANNUAL')[];
  descriptionTh?: string;
  descriptionEn?: string;
  availabilityReasonTh?: string;
  availabilityReasonEn?: string;
}

export const EXPECTATION_METRIC_REGISTRY: ExpectationMetricDefinition[] = [
  // 1. Operating / General Metrics
  {
    id: 'revenue',
    labelEn: 'Revenue',
    labelTh: 'รายได้รวม',
    unit: '$M',
    category: 'FINANCIAL',
    applicableBusinessTypes: ['operating', 'financial', 'reit', 'cyclical', 'early_stage'],
    evaluationMode: 'AUTO',
    supportedPeriods: ['QUARTER', 'ANNUAL'],
    descriptionTh: 'รายได้รวมตามงบการเงินที่รายงานต่อ ก.ล.ต. สหรัฐฯ (SEC)',
    descriptionEn: 'Total revenue from official SEC filing.'
  },
  {
    id: 'revenue_growth_yoy_pct',
    labelEn: 'YoY Revenue Growth',
    labelTh: 'อัตราเติบโตของรายได้ (YoY)',
    unit: '%',
    category: 'FINANCIAL',
    applicableBusinessTypes: ['operating', 'cyclical', 'early_stage'],
    applicableArchetypes: [
      'saas_software', 'semiconductor', 'hardware_device', 'industrial_manufacturing',
      'retail', 'digital_marketplace', 'early_stage', 'automotive', 'healthcare',
      'biotech', 'general_operating', 'energy_commodity', 'utility', 'telecom', 'fintech'
    ],
    evaluationMode: 'AUTO',
    supportedPeriods: ['QUARTER', 'ANNUAL'],
    descriptionTh: 'อัตราการเติบโตของรายได้เทียบกับไตรมาสเดียวกันของปีก่อนหน้า',
    descriptionEn: 'Year-over-year revenue growth percentage compared to prior-year period.'
  },
  {
    id: 'operating_margin_pct',
    labelEn: 'Operating Margin',
    labelTh: 'อัตรากำไรจากการดำเนินงาน',
    unit: '%',
    category: 'FINANCIAL',
    applicableBusinessTypes: ['operating', 'cyclical', 'early_stage'],
    applicableArchetypes: [
      'saas_software', 'semiconductor', 'hardware_device', 'industrial_manufacturing',
      'retail', 'digital_marketplace', 'early_stage', 'automotive', 'healthcare',
      'biotech', 'general_operating', 'energy_commodity', 'utility', 'telecom', 'fintech'
    ],
    evaluationMode: 'AUTO',
    supportedPeriods: ['QUARTER', 'ANNUAL'],
    descriptionTh: 'อัตรากำไรจากการดำเนินงาน (Operating Income / Revenue)',
    descriptionEn: 'Operating margin percentage from verified statement.'
  },
  {
    id: 'gross_margin_pct',
    labelEn: 'Gross Margin',
    labelTh: 'อัตรากำไรขั้นต้น',
    unit: '%',
    category: 'FINANCIAL',
    applicableBusinessTypes: ['operating', 'early_stage', 'cyclical'],
    applicableArchetypes: [
      'saas_software', 'semiconductor', 'hardware_device', 'industrial_manufacturing',
      'retail', 'digital_marketplace', 'early_stage', 'automotive', 'healthcare',
      'biotech', 'general_operating', 'energy_commodity', 'utility', 'telecom'
    ],
    evaluationMode: 'AUTO',
    supportedPeriods: ['QUARTER', 'ANNUAL'],
    descriptionTh: 'อัตรากำไรขั้นต้น (Gross Profit / Revenue)',
    descriptionEn: 'Gross margin percentage from verified statement.'
  },
  {
    id: 'free_cash_flow',
    labelEn: 'Free Cash Flow',
    labelTh: 'กระแสเงินสดอิสระ',
    unit: '$M',
    category: 'FINANCIAL',
    applicableBusinessTypes: ['operating', 'cyclical'],
    applicableArchetypes: [
      'saas_software', 'semiconductor', 'hardware_device', 'industrial_manufacturing',
      'retail', 'digital_marketplace', 'automotive', 'healthcare',
      'general_operating', 'energy_commodity', 'utility', 'telecom'
    ],
    evaluationMode: 'AUTO',
    supportedPeriods: ['QUARTER', 'ANNUAL'],
    descriptionTh: 'กระแสเงินสดจากการดำเนินงานหักค่าใช้จ่ายฝ่ายทุน (OCF - CapEx)',
    descriptionEn: 'Free cash flow (Operating cash flow less Capital expenditures).'
  },
  {
    id: 'net_income',
    labelEn: 'Net Income',
    labelTh: 'กำไรสุทธิ',
    unit: '$M',
    category: 'FINANCIAL',
    applicableBusinessTypes: ['operating', 'financial', 'reit', 'cyclical'],
    evaluationMode: 'AUTO',
    supportedPeriods: ['QUARTER', 'ANNUAL'],
    descriptionTh: 'กำไรสุทธิทางบัญชีตามมาตรฐาน GAAP',
    descriptionEn: 'GAAP net income from verified financial statement.'
  },
  {
    id: 'eps_diluted',
    labelEn: 'Diluted EPS',
    labelTh: 'กำไรต่อหุ้นปรับลด (EPS)',
    unit: '$/share',
    category: 'FINANCIAL',
    applicableBusinessTypes: ['operating', 'financial', 'cyclical'],
    applicableArchetypes: [
      'saas_software', 'semiconductor', 'hardware_device', 'industrial_manufacturing',
      'retail', 'digital_marketplace', 'automotive', 'healthcare',
      'general_operating', 'energy_commodity', 'utility', 'telecom',
      'bank', 'lender', 'fintech', 'insurer'
    ],
    evaluationMode: 'AUTO',
    supportedPeriods: ['QUARTER', 'ANNUAL'],
    descriptionTh: 'กำไรต่อหุ้นปรับลดตามมาตรฐาน GAAP',
    descriptionEn: 'Diluted earnings per share from official statement.'
  },
  {
    id: 'cash_and_equivalents',
    labelEn: 'Cash & Cash Equivalents',
    labelTh: 'เงินสดและรายการเทียบเท่าเงินสด',
    unit: '$M',
    category: 'FINANCIAL',
    applicableBusinessTypes: ['operating', 'early_stage'],
    applicableArchetypes: [
      'saas_software', 'semiconductor', 'hardware_device', 'industrial_manufacturing',
      'retail', 'digital_marketplace', 'early_stage', 'automotive', 'healthcare',
      'biotech', 'general_operating', 'energy_commodity', 'utility', 'telecom'
    ],
    evaluationMode: 'AUTO',
    supportedPeriods: ['QUARTER', 'ANNUAL'],
    descriptionTh: 'เงินสดและรายการเทียบเท่าเงินสดในงบดุล',
    descriptionEn: 'Cash and cash equivalents on balance sheet.'
  },
  {
    id: 'net_cash',
    labelEn: 'Net Cash',
    labelTh: 'สถานะเงินสดสุทธิ',
    unit: '$M',
    category: 'FINANCIAL',
    applicableBusinessTypes: ['operating', 'early_stage', 'cyclical'],
    applicableArchetypes: [
      'saas_software', 'semiconductor', 'hardware_device', 'industrial_manufacturing',
      'retail', 'digital_marketplace', 'early_stage', 'automotive', 'healthcare',
      'biotech', 'general_operating', 'energy_commodity', 'utility', 'telecom'
    ],
    evaluationMode: 'AUTO',
    supportedPeriods: ['QUARTER', 'ANNUAL'],
    descriptionTh: 'สถานะเงินสดสุทธิ = เงินสดและรายการเทียบเท่าเงินสด + เงินลงทุนระยะสั้น - หนี้สินทางการเงินตามข้อมูล canonical',
    descriptionEn: 'Net Cash = Cash & Cash Equivalents + Short-Term Investments - Canonical Debt.'
  },

  // 2. Financial Institutions / FinTech Metrics
  {
    id: 'deposits',
    labelEn: 'Total Deposits',
    labelTh: 'เงินฝากรวม (Total Deposits)',
    unit: '$M',
    category: 'CREDIT',
    applicableBusinessTypes: ['financial'],
    applicableArchetypes: ['bank', 'lender', 'fintech'],
    evaluationMode: 'MANUAL',
    supportedPeriods: ['QUARTER', 'ANNUAL'],
    availabilityReasonTh: 'ต้องตรวจสอบจากรายงาน 10-Q/10-K เนื่องจากเป็นตัวชี้วัดเฉพาะกลุ่มสถาบันการเงิน',
    availabilityReasonEn: 'Requires manual review from official 10-Q/10-K filing as specialized financial metric.'
  },
  {
    id: 'net_interest_margin',
    labelEn: 'Net Interest Margin (NIM)',
    labelTh: 'ส่วนต่างรายได้ดอกเบี้ยสุทธิ (NIM)',
    unit: '%',
    category: 'CREDIT',
    applicableBusinessTypes: ['financial'],
    applicableArchetypes: ['bank', 'lender', 'fintech'],
    evaluationMode: 'MANUAL',
    supportedPeriods: ['QUARTER', 'ANNUAL'],
    availabilityReasonTh: 'ต้องตรวจสอบจากรายงาน 10-Q/10-K เนื่องจากเป็นตัวชี้วัดเฉพาะกลุ่มสถาบันการเงิน',
    availabilityReasonEn: 'Requires manual review from official 10-Q/10-K filing as specialized financial metric.'
  },
  {
    id: 'tier_1_capital_ratio',
    labelEn: 'Tier 1 Capital Ratio',
    labelTh: 'อัตราส่วนเงินกองทุนชั้นที่ 1 (Tier 1)',
    unit: '%',
    category: 'CREDIT',
    applicableBusinessTypes: ['financial'],
    applicableArchetypes: ['bank', 'lender', 'fintech'],
    evaluationMode: 'MANUAL',
    supportedPeriods: ['QUARTER', 'ANNUAL'],
    availabilityReasonTh: 'ต้องตรวจสอบจากรายงาน 10-Q/10-K เนื่องจากเป็นตัวชี้วัดเฉพาะกลุ่มสถาบันการเงิน',
    availabilityReasonEn: 'Requires manual review from official 10-Q/10-K filing as regulatory capital ratio.'
  },
  {
    id: 'cet1_ratio',
    labelEn: 'Common Equity Tier 1 (CET1) Ratio',
    labelTh: 'อัตราส่วนเงินกองทุนชั้นที่ 1 ที่เป็นส่วนของผู้ถือหุ้นสามัญ (CET1)',
    unit: '%',
    category: 'CREDIT',
    applicableBusinessTypes: ['financial'],
    applicableArchetypes: ['bank', 'lender', 'fintech'],
    evaluationMode: 'MANUAL',
    supportedPeriods: ['QUARTER', 'ANNUAL'],
    availabilityReasonTh: 'ต้องตรวจสอบจากรายงาน 10-Q/10-K เนื่องจากเป็นตัวชี้วัดความเพียงพอของเงินกองทุนขั้นสูงสุด',
    availabilityReasonEn: 'Requires manual review from official 10-Q/10-K filing as core regulatory equity ratio.'
  },
  {
    id: 'net_charge_off_rate',
    labelEn: 'Net Charge-Off Rate (NCO)',
    labelTh: 'อัตราการตัดหนี้สูญสุทธิ (NCO)',
    unit: '%',
    category: 'CREDIT',
    applicableBusinessTypes: ['financial'],
    applicableArchetypes: ['bank', 'lender', 'fintech'],
    evaluationMode: 'MANUAL',
    supportedPeriods: ['QUARTER', 'ANNUAL'],
    availabilityReasonTh: 'ต้องตรวจสอบจากรายงาน 10-Q/10-K เนื่องจากเป็นตัวชี้วัดคุณภาพสินเชื่อ',
    availabilityReasonEn: 'Requires manual review from official 10-Q/10-K filing as credit quality metric.'
  },
  {
    id: 'combined_ratio_pct',
    labelEn: 'Combined Ratio',
    labelTh: 'อัตราส่วนรวมค่าใช้จ่ายสินไหมและดำเนินงาน (Combined Ratio)',
    unit: '%',
    category: 'CREDIT',
    applicableBusinessTypes: ['financial'],
    applicableArchetypes: ['insurer'],
    evaluationMode: 'MANUAL',
    supportedPeriods: ['QUARTER', 'ANNUAL'],
    availabilityReasonTh: 'ต้องตรวจสอบจากรายงาน 10-Q/10-K เนื่องจากเป็นตัวชี้วัดเฉพาะกลุ่มประกันภัย',
    availabilityReasonEn: 'Requires manual review from official 10-Q/10-K filing as specialized insurance underwriting metric.'
  },

  // 3. REIT Metrics (MANUAL REVIEW)
  {
    id: 'affo',
    labelEn: 'Adjusted Funds From Operations (AFFO)',
    labelTh: 'กระแสเงินสดปรับปรุงอสังหาฯ (AFFO)',
    unit: '$M',
    category: 'FINANCIAL',
    applicableBusinessTypes: ['reit'],
    applicableArchetypes: ['reit'],
    evaluationMode: 'MANUAL',
    supportedPeriods: ['QUARTER', 'ANNUAL'],
    availabilityReasonTh: 'ต้องตรวจสอบจากรายงาน 10-Q/10-K เนื่องจากเป็นตัวชี้วัด Non-GAAP เฉพาะกลุ่ม REIT',
    availabilityReasonEn: 'Requires manual review from official 10-Q/10-K filing as specialized Non-GAAP REIT metric.'
  },
  {
    id: 'ffo',
    labelEn: 'Funds From Operations (FFO)',
    labelTh: 'กระแสเงินสดจากการดำเนินงาน (FFO)',
    unit: '$M',
    category: 'FINANCIAL',
    applicableBusinessTypes: ['reit'],
    applicableArchetypes: ['reit'],
    evaluationMode: 'MANUAL',
    supportedPeriods: ['QUARTER', 'ANNUAL'],
    availabilityReasonTh: 'ต้องตรวจสอบจากรายงาน 10-Q/10-K เนื่องจากเป็นตัวชี้วัด Non-GAAP เฉพาะกลุ่ม REIT',
    availabilityReasonEn: 'Requires manual review from official 10-Q/10-K filing as specialized Non-GAAP REIT metric.'
  },
  {
    id: 'occupancy_rate',
    labelEn: 'Portfolio Occupancy Rate',
    labelTh: 'อัตราการเช่าพื้นที่เฉลี่ย',
    unit: '%',
    category: 'OPERATIONAL',
    applicableBusinessTypes: ['reit'],
    applicableArchetypes: ['reit'],
    evaluationMode: 'MANUAL',
    supportedPeriods: ['QUARTER', 'ANNUAL'],
    availabilityReasonTh: 'ต้องตรวจสอบจากรายงานผลการดำเนินงานของผู้บริหาร',
    availabilityReasonEn: 'Requires manual review from management operational report.'
  }
];

export function resolveBusinessCategory(reportInput: any, ticker?: string): BusinessCategory {
  const unwrapped = unwrapHistoryRecord(reportInput);
  const data: ReportData = unwrapped?.data || (reportInput?.data ? reportInput.data : reportInput) || {};
  const sym = (ticker || unwrapped?.ticker || data.ticker || (data as any)?.symbol || '').toUpperCase().trim();
  const archetype = resolveBusinessArchetype(data, sym);
  const detected = detectValuationModel(data, sym);

  if (archetype === 'reit' || detected.model_type === 'reit_affo') {
    return 'reit';
  }

  if (
    archetype === 'bank' ||
    archetype === 'lender' ||
    archetype === 'fintech' ||
    archetype === 'insurer' ||
    archetype === 'asset_manager' ||
    archetype === 'broker_exchange' ||
    detected.model_type === 'fintech_pe' ||
    detected.model_type === 'ddm'
  ) {
    return 'financial';
  }

  if (archetype === 'early_stage' || archetype === 'biotech' || detected.model_type === 'relative_only') {
    return 'early_stage';
  }

  if (archetype === 'energy_commodity' || archetype === 'utility') {
    return 'cyclical';
  }

  return 'operating';
}

export function getApplicableExpectationMetrics(
  reportInput: any,
  ticker?: string
): ExpectationMetricDefinition[] {
  const unwrapped = unwrapHistoryRecord(reportInput);
  const data: ReportData = unwrapped?.data || (reportInput?.data ? reportInput.data : reportInput) || {};
  const sym = (ticker || unwrapped?.ticker || data.ticker || (data as any)?.symbol || '').toUpperCase().trim();
  const archetype = resolveBusinessArchetype(data, sym);
  const category = resolveBusinessCategory(reportInput, sym);

  return EXPECTATION_METRIC_REGISTRY.filter(m => {
    if (m.applicableArchetypes && m.applicableArchetypes.length > 0) {
      return m.applicableArchetypes.includes(archetype);
    }
    return m.applicableBusinessTypes.includes(category);
  });
}

export function getActiveValuationAssumptions(
  reportInput: any,
  isThai = false
): ActiveValuationBasis {
  const unwrapped = unwrapHistoryRecord(reportInput);
  const data: ReportData = unwrapped?.data || (reportInput?.data ? reportInput.data : reportInput) || {};
  const sym = (unwrapped?.ticker || data.ticker || (data as any)?.symbol || 'STOCK').toUpperCase().trim();
  const detected = (data.intrinsic_value as any)?.selected_model ?? detectValuationModel(data, sym);
  const dcfModel = data.intrinsic_value?.dcf_model;
  const dcfInputs = dcfModel?.inputs;
  const category = resolveBusinessCategory(reportInput, sym);

  // 1. Check Financial Sector Guard / Banking / FinTech
  const isSectorGuardActive = (
    category === 'financial' ||
    detected.model_type === 'fintech_pe' ||
    detected.model_type === 'ddm' ||
    (dcfInputs?.isValid === false && (
      dcfInputs?.missingFields?.some((f: string) => f.includes('operating-company FCFF model fit')) ||
      dcfInputs?.missingFields?.some((f: string) => f.includes('fintech_pe selected')) ||
      (data.intrinsic_value?.summary?.verdict_text || '').includes('Financial Sector Guard')
    ))
  );

  if (isSectorGuardActive) {
    const isFintech = detected.model_type === 'fintech_pe' || (data.company_profile?.description || '').toLowerCase().includes('fintech');
    return {
      methodTitleTh: isFintech
        ? 'วิธีประเมิน: Multiples & Solvency (Financial Sector Guard)'
        : 'วิธีประเมิน: DDM & Residual Income (Financial Sector Guard)',
      methodTitleEn: isFintech
        ? 'Valuation Approach: Multiples & Solvency (Financial Sector Guard)'
        : 'Valuation Approach: DDM & Residual Income (Financial Sector Guard)',
      guardStatusTh: 'แบบจำลอง FCFF DCF: ไม่ใช้กับธุรกิจประเภทนี้ (Financial Sector Guard)',
      guardStatusEn: 'FCFF DCF Model: Not applicable for this business type (Financial Sector Guard active)',
      isGuarded: true,
      modelType: detected.model_type || 'fintech_pe',
      assumptions: []
    };
  }

  // 2. Check REIT
  if (category === 'reit' || detected.model_type === 'reit_affo') {
    return {
      methodTitleTh: 'วิธีประเมิน: FFO / AFFO Multiple & Cash Yield Valuation',
      methodTitleEn: 'Valuation Approach: FFO / AFFO Multiple & Yield Valuation',
      guardStatusTh: 'แบบจำลอง FCFF DCF: ไม่ใช้กับธุรกิจประเภท REIT (REIT Guard — ใช้ AFFO/FFO Multiple แทน)',
      guardStatusEn: 'FCFF DCF Model: Not applicable for REITs (REIT Guard active — AFFO/FFO model required)',
      isGuarded: true,
      modelType: 'reit_affo',
      assumptions: []
    };
  }

  // 3. Check Early Stage / Negative Gross Margin / Negative FCF
  if (category === 'early_stage' || detected.model_type === 'relative_only') {
    return {
      methodTitleTh: 'วิธีประเมิน: Relative Valuation (EV/Revenue Multiples)',
      methodTitleEn: 'Valuation Approach: Relative Valuation (EV/Revenue Multiples)',
      guardStatusTh: 'แบบจำลอง FCFF DCF: ระงับชั่วคราวเนื่องจากกระแสเงินสดติดลบต่อเนื่อง',
      guardStatusEn: 'FCFF DCF Model: Suspended due to consecutive negative FCF',
      isGuarded: true,
      modelType: 'relative_only',
      assumptions: []
    };
  }

  // 4. Operating Company with DCF
  const assumptionsObj = (data.intrinsic_value as any)?.assumptions;
  const dcfAssumptions = dcfModel?.assumptions;
  const wacc = typeof assumptionsObj?.discount_rate === 'number'
    ? assumptionsObj.discount_rate
    : (typeof dcfAssumptions?.wacc_pct === 'number' ? dcfAssumptions.wacc_pct : null);
  const terminalGrowth = typeof assumptionsObj?.terminal_growth_rate === 'number'
    ? assumptionsObj.terminal_growth_rate
    : (typeof dcfAssumptions?.terminal_growth_pct === 'number' ? dcfAssumptions.terminal_growth_pct : null);
  const rawProjYears = typeof dcfAssumptions?.projection_years === 'number'
    ? dcfAssumptions.projection_years
    : (typeof dcfInputs?.projectionYears === 'number'
        ? dcfInputs.projectionYears
        : (typeof assumptionsObj?.projection_years === 'number'
            ? assumptionsObj.projection_years
            : (typeof assumptionsObj?.projectionYears === 'number'
                ? assumptionsObj.projectionYears
                : (typeof (data.intrinsic_value as any)?.projection_years === 'number'
                    ? (data.intrinsic_value as any).projection_years
                    : null))));
  const projYears = (detected?.model_type !== 'relative_only' && typeof rawProjYears === 'number' && rawProjYears > 0)
    ? rawProjYears
    : null;
  const baseScenario = dcfModel?.scenarios?.base;
  const revCagr = typeof baseScenario?.revenue_cagr_pct === 'number' ? baseScenario.revenue_cagr_pct : null;
  const terminalMargin = typeof baseScenario?.terminal_margin_pct === 'number' ? baseScenario.terminal_margin_pct : null;

  const assumptions: ActiveValuationAssumption[] = [];
  if (wacc !== null) {
    const isWaccDerived = Boolean(
      (data.intrinsic_value as any)?.dcf_model?.assumptions?.wacc_details ||
      (data.intrinsic_value as any)?.dcf_model?.inputs?.costOfEquity
    );
    assumptions.push({
      labelTh: 'อัตราคิดลด (WACC)',
      labelEn: 'Discount rate (WACC)',
      valueText: `${wacc.toFixed(1)}%`,
      provenance: isWaccDerived ? 'DETERMINISTIC_DERIVATION' : 'MODEL_ASSUMPTION'
    });
  }
  if (terminalGrowth !== null) {
    assumptions.push({
      labelTh: 'อัตราเติบโตระยะยาว (Terminal Growth)',
      labelEn: 'Terminal growth rate',
      valueText: `${terminalGrowth.toFixed(1)}%`,
      provenance: 'MODEL_ASSUMPTION'
    });
  }
  if (projYears !== null) {
    assumptions.push({
      labelTh: 'ระยะเวลาประมาณการ',
      labelEn: 'Explicit forecast period',
      valueText: `${projYears} ${isThai ? 'ปี' : 'Years'}`,
      provenance: 'MODEL_ASSUMPTION'
    });
  }
  if (revCagr !== null) {
    assumptions.push({
      labelTh: 'รายได้เติบโตเฉลี่ย (Base Revenue CAGR)',
      labelEn: 'Base Revenue CAGR',
      valueText: `${revCagr.toFixed(1)}%`,
      provenance: 'MODEL_ASSUMPTION'
    });
  }
  if (terminalMargin !== null) {
    assumptions.push({
      labelTh: 'อัตรากำไรเป้าหมาย (Terminal Margin)',
      labelEn: 'Target terminal margin',
      valueText: `${terminalMargin.toFixed(1)}%`,
      provenance: 'MODEL_ASSUMPTION'
    });
  }

  const isDcfInvalid = dcfInputs?.isValid === false;
  return {
    methodTitleTh: 'วิธีประเมิน: แบบจำลองคิดลดกระแสเงินสด (FCFF DCF)',
    methodTitleEn: 'Valuation Approach: Discounted Cash Flow (FCFF DCF)',
    guardStatusTh: isDcfInvalid ? 'แบบจำลอง FCFF DCF: ข้อมูลไม่ครบถ้วนสำหรับการประเมิน' : undefined,
    guardStatusEn: isDcfInvalid ? 'FCFF DCF Model: Insufficient data for valuation' : undefined,
    isGuarded: isDcfInvalid,
    modelType: detected.model_type || 'dcf_standard',
    assumptions: isDcfInvalid ? [] : assumptions
  };
}

/**
 * Creates a structured snapshot of valuation assumptions at confirmation time.
 * Captures numeric parameters and provenance to ensure historical immutability.
 */
export function createValuationSnapshot(
  reportInput: any,
  sourceReportId?: string | null,
  isThai = false
): ThesisValuationSnapshot {
  const basis = getActiveValuationAssumptions(reportInput, isThai);
  const unwrapped = unwrapHistoryRecord(reportInput);
  const data: ReportData = unwrapped?.data || (reportInput?.data ? reportInput.data : reportInput) || {};
  const dcfModel = data.intrinsic_value?.dcf_model;
  const dcfInputs = dcfModel?.inputs;
  const assumptionsObj = (data.intrinsic_value as any)?.assumptions;
  const dcfAssumptions = dcfModel?.assumptions;

  const wacc = typeof assumptionsObj?.discount_rate === 'number'
    ? assumptionsObj.discount_rate
    : (typeof dcfAssumptions?.wacc_pct === 'number' ? dcfAssumptions.wacc_pct : null);
  const terminalGrowth = typeof assumptionsObj?.terminal_growth_rate === 'number'
    ? assumptionsObj.terminal_growth_rate
    : (typeof dcfAssumptions?.terminal_growth_pct === 'number' ? dcfAssumptions.terminal_growth_pct : null);
  const rawProjYears = typeof dcfAssumptions?.projection_years === 'number'
    ? dcfAssumptions.projection_years
    : (typeof dcfInputs?.projectionYears === 'number'
        ? dcfInputs.projectionYears
        : (typeof assumptionsObj?.projection_years === 'number'
            ? assumptionsObj.projection_years
            : (typeof assumptionsObj?.projectionYears === 'number'
                ? assumptionsObj.projectionYears
                : (typeof (data.intrinsic_value as any)?.projection_years === 'number'
                    ? (data.intrinsic_value as any).projection_years
                    : null))));
  const projYears = (basis.modelType !== 'relative_only' && typeof rawProjYears === 'number' && rawProjYears > 0)
    ? rawProjYears
    : null;
  const baseScenario = dcfModel?.scenarios?.base;
  const revCagr = typeof baseScenario?.revenue_cagr_pct === 'number' ? baseScenario.revenue_cagr_pct : null;
  const terminalMargin = typeof baseScenario?.terminal_margin_pct === 'number' ? baseScenario.terminal_margin_pct : null;

  return {
    modelType: basis.modelType,
    methodTitleEn: basis.methodTitleEn,
    methodTitleTh: basis.methodTitleTh,
    isGuarded: basis.isGuarded,
    guardStatusEn: basis.guardStatusEn,
    guardStatusTh: basis.guardStatusTh,
    assumptions: {
      waccPct: wacc,
      terminalGrowthPct: terminalGrowth,
      projectionYears: projYears,
      revenueCagrPct: revCagr,
      terminalMarginPct: terminalMargin
    },
    assumptionsList: basis.assumptions,
    sourceReportId: sourceReportId ?? (unwrapped?.reportId || (data as any)?.id || null),
    capturedAt: new Date().toISOString(),
    provenance: 'FROZEN_CONFIRMATION_SNAPSHOT'
  };
}

/**
 * Converts a frozen ThesisValuationSnapshot back to ActiveValuationBasis for rendering.
 */
export function snapshotToValuationBasis(
  snapshot: ThesisValuationSnapshot,
  isThai = false
): ActiveValuationBasis {
  return {
    methodTitleTh: snapshot.methodTitleTh,
    methodTitleEn: snapshot.methodTitleEn,
    guardStatusTh: snapshot.guardStatusTh,
    guardStatusEn: snapshot.guardStatusEn,
    isGuarded: snapshot.isGuarded,
    modelType: snapshot.modelType,
    assumptions: snapshot.assumptionsList || []
  };
}

/**
 * Reconstructs the frozen valuation basis from a confirmed thesis record.
 * Prioritizes:
 * 1. valuationSnapshot
 * 2. frozenValuationBasis
 * 3. Structured parsing of legacy keyAssumptions
 * Never falls back to a live or future report for a confirmed thesis.
 */
export function reconstructValuationBasisFromLegacyThesis(
  thesis: InvestmentThesisRecord,
  isThai = false
): ActiveValuationBasis {
  if (thesis.valuationSnapshot) {
    return snapshotToValuationBasis(thesis.valuationSnapshot, isThai);
  }
  if (thesis.frozenValuationBasis) {
    return thesis.frozenValuationBasis;
  }

  // Parse legacy keyAssumptions safely
  const assumptions: ActiveValuationAssumption[] = [];
  const keyAssumptions = thesis.keyAssumptions || [];

  for (const ka of keyAssumptions) {
    if (ka.includes('Discount rate') || ka.includes('WACC')) {
      const match = ka.match(/:\s*([\d.]+%)/);
      if (match) {
        assumptions.push({
          labelTh: 'อัตราคิดลด (WACC)',
          labelEn: 'Discount rate (WACC)',
          valueText: match[1],
          provenance: 'MODEL_ASSUMPTION'
        });
      }
    } else if (ka.includes('Terminal growth') || ka.includes('Terminal Growth')) {
      const match = ka.match(/:\s*([\d.]+%)/);
      if (match) {
        assumptions.push({
          labelTh: 'อัตราเติบโตระยะยาว (Terminal Growth)',
          labelEn: 'Terminal growth rate',
          valueText: match[1],
          provenance: 'MODEL_ASSUMPTION'
        });
      }
    } else if (ka.includes('forecast period') || ka.includes('Projection Period') || ka.includes('forecast')) {
      const match = ka.match(/:\s*(\d+)/);
      if (match) {
        assumptions.push({
          labelTh: 'ระยะเวลาประมาณการ',
          labelEn: 'Explicit forecast period',
          valueText: `${match[1]} ${isThai ? 'ปี' : 'Years'}`,
          provenance: 'MODEL_ASSUMPTION'
        });
      }
    } else if (ka.includes('Revenue CAGR') || ka.includes('revenue_cagr')) {
      const match = ka.match(/:\s*([\d.]+%)/);
      if (match) {
        assumptions.push({
          labelTh: 'รายได้เติบโตเฉลี่ย (Base Revenue CAGR)',
          labelEn: 'Base Revenue CAGR',
          valueText: match[1],
          provenance: 'MODEL_ASSUMPTION'
        });
      }
    } else if (ka.includes('terminal margin') || ka.includes('Terminal Margin')) {
      const match = ka.match(/:\s*([\d.]+%)/);
      if (match) {
        assumptions.push({
          labelTh: 'อัตรากำไรเป้าหมาย (Terminal Margin)',
          labelEn: 'Target terminal margin',
          valueText: match[1],
          provenance: 'MODEL_ASSUMPTION'
        });
      }
    }
  }

  return {
    methodTitleTh: 'วิธีประเมิน: แบบจำลองคิดลดกระแสเงินสด (FCFF DCF)',
    methodTitleEn: 'Valuation Approach: Discounted Cash Flow (FCFF DCF)',
    isGuarded: assumptions.length === 0,
    modelType: 'dcf_standard',
    assumptions
  };
}

export type ExpectationCondition =
  | 'gte'
  | 'lte'
  | 'eq'
  | 'approx' // within +/- 5%
  | 'event_occurred';

export type ExpectationStatus =
  | 'PENDING'
  | 'MET'
  | 'MISSED'
  | 'EXCEEDED'
  | 'PARTIAL'
  | 'UNAVAILABLE';

export type ExpectationOrigin =
  | 'USER_EXPECTATION'
  | 'MANAGEMENT_GUIDANCE'
  | 'AI_DRAFT'
  | 'DETERMINISTIC_CONDITION';

export interface TrackedExpectation {
  expectationId: string;
  ticker: string;
  metricOrEvent: ExpectationMetric | string;
  metricLabel: string;
  targetValue: number | string;
  condition: ExpectationCondition;
  targetPeriod: string; // e.g. 'Q3 2026', 'FY26', '2026-10-30'
  status: ExpectationStatus;
  origin: ExpectationOrigin;
  evaluationMode?: EvaluationMode;
  unit?: string;
  sourceReportId: string | null;
  actualValue: number | string | null;
  actualPeriodFound?: string | null;
  evaluationDate: string | null;
  evaluationNotes?: string;
  source?: string;
  provenance?: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

export type LifecycleState =
  | 'NEW'
  | 'ACTIVE'
  | 'INCREASING'
  | 'DECREASING'
  | 'RESOLVED'
  | 'MATERIALIZED'
  | 'EXPIRED'
  | 'UNKNOWN';

export interface TrackedItemTransition {
  itemText: string;
  category: 'risk' | 'catalyst';
  previousState: LifecycleState;
  currentState: LifecycleState;
  evidence?: string;
  isCertain: boolean;
}

/**
 * Extracts a draft thesis from an analysis report.
 * Strictly labeled as AI_DRAFT unless previously confirmed.
 */
export function extractDraftThesisFromReport(
  reportInput: any,
  userId?: string
): InvestmentThesisRecord | null {
  const snapshot = extractMemorySnapshot(reportInput);
  if (!snapshot) return null;

  const data: ReportData = reportInput?.data || (reportInput?.ticker ? reportInput : null);
  const now = new Date().toISOString();

  const activeBasis = getActiveValuationAssumptions(reportInput, false);
  const valuationSnapshot = createValuationSnapshot(reportInput, snapshot.reportId, false);
  const keyAssumptions: string[] = [];
  if (activeBasis.isGuarded) {
    keyAssumptions.push(`Valuation approach: ${activeBasis.methodTitleEn}`);
    if (activeBasis.guardStatusEn) {
      keyAssumptions.push(activeBasis.guardStatusEn);
    }
  } else {
    for (const a of activeBasis.assumptions) {
      keyAssumptions.push(`${a.labelEn}: ${a.valueText}`);
    }
  }

  const category = resolveBusinessCategory(reportInput, snapshot.ticker);
  const invalidationConditions: string[] = [];
  // Propose sensible invalidation conditions based on business category and risks
  if (category === 'operating' || category === 'cyclical') {
    if (snapshot.financials.operatingMarginPct !== null) {
      invalidationConditions.push(`Operating margin drops below ${(snapshot.financials.operatingMarginPct * 0.8).toFixed(1)}%`);
    }
  } else if (category === 'financial') {
    if (snapshot.financials.netIncome !== null && snapshot.financials.netIncome > 0) {
      invalidationConditions.push(`Net income turns negative or drops below ${(snapshot.financials.netIncome * 0.7).toFixed(0)}M`);
    }
  }
  if (snapshot.thesis.keyRisks.length > 0) {
    invalidationConditions.push(`Materialization of primary risk: ${snapshot.thesis.keyRisks[0]}`);
  }

  return {
    thesisId: `thesis_${snapshot.ticker}_${Date.now()}`,
    ticker: snapshot.ticker,
    version: 1,
    summary: snapshot.thesis.summary || `Investment thesis for ${snapshot.ticker}`,
    keyDrivers: snapshot.thesis.keyDrivers,
    keyAssumptions,
    keyRisks: snapshot.thesis.keyRisks,
    catalysts: snapshot.thesis.catalysts,
    invalidationConditions,
    status: 'ACTIVE',
    confirmationStatus: 'AI_DRAFT',
    sourceReportId: snapshot.reportId,
    frozenValuationBasis: activeBasis,
    valuationSnapshot,
    createdAt: now,
    updatedAt: now,
    userId: userId || undefined
  };
}

/**
 * Confirms or edits a user thesis, transitioning state to USER_CONFIRMED or USER_EDITED.
 * Strictly links new revisions created from a report view to that current research state (currentReportId).
 * Freezes the current valuation basis into the thesis record so later reports do not silently mutate historical assumptions.
 */
export function confirmUserThesis(
  baseThesis: InvestmentThesisRecord,
  edits?: Partial<InvestmentThesisRecord>,
  userId?: string,
  currentReportId?: string | null,
  currentValuationBasis?: ActiveValuationBasis,
  currentValuationSnapshot?: ThesisValuationSnapshot
): InvestmentThesisRecord {
  const now = new Date().toISOString();
  const isBaseConfirmed = baseThesis.confirmationStatus === 'USER_CONFIRMED' || baseThesis.confirmationStatus === 'USER_EDITED';
  const isConfirmingDraft = baseThesis.confirmationStatus === 'AI_DRAFT';

  const hasEdits = Boolean(
    edits?.summary ||
    edits?.keyDrivers ||
    edits?.keyAssumptions ||
    edits?.keyRisks ||
    edits?.catalysts ||
    edits?.invalidationConditions ||
    edits?.status
  );

  // Valuation basis freezing logic:
  // If baseThesis is already confirmed, its existing valuation assumptions MUST remain frozen
  // unless edits explicitly provides new frozenValuationBasis / valuationSnapshot.
  let frozenValuationBasis: ActiveValuationBasis | undefined = edits?.frozenValuationBasis;
  if (!frozenValuationBasis) {
    if (isBaseConfirmed) {
      frozenValuationBasis = baseThesis.frozenValuationBasis || reconstructValuationBasisFromLegacyThesis(baseThesis);
    } else {
      frozenValuationBasis = currentValuationBasis || baseThesis.frozenValuationBasis;
    }
  }

  let valuationSnapshot: ThesisValuationSnapshot | undefined = edits?.valuationSnapshot;
  if (!valuationSnapshot) {
    if (isBaseConfirmed) {
      valuationSnapshot = baseThesis.valuationSnapshot;
    } else {
      valuationSnapshot = currentValuationSnapshot || baseThesis.valuationSnapshot;
    }
  }

  const nextVersion = baseThesis.version + 1;

  // sourceReportId:
  // If confirming draft: link to currentReportId
  // If base is already confirmed: preserve baseThesis.sourceReportId UNLESS edits explicitly updated valuation basis with a new reportId
  let sourceReportId = edits?.sourceReportId ?? currentReportId ?? baseThesis.sourceReportId ?? null;

  return {
    ...baseThesis,
    ...(edits || {}),
    version: nextVersion,
    confirmationStatus: isConfirmingDraft ? (hasEdits ? 'USER_EDITED' : 'USER_CONFIRMED') : 'USER_EDITED',
    sourceReportId,
    frozenValuationBasis,
    valuationSnapshot,
    updatedAt: now,
    userId: userId || baseThesis.userId
  };
}

export type InvalidationTriggerType = 'DETERMINISTIC_TRIGGER' | 'MANUAL_REVIEW_TRIGGER';

export interface ClassifiedInvalidationCondition {
  conditionText: string;
  type: InvalidationTriggerType;
  metric?: string | null;
  threshold?: number | null;
  isTriggered?: boolean;
  requiresManualReview: boolean;
  notes?: string;
}

/**
 * Classifies an invalidation condition into either a deterministically monitorable numeric condition
 * or a qualitative condition requiring explicit manual user review.
 * Never fabricates automated evaluation for free-text conditions.
 */
export function classifyInvalidationCondition(conditionText: string): ClassifiedInvalidationCondition {
  const clean = conditionText.trim();
  // Operating margin numeric threshold
  const marginMatch = clean.match(/(?:operating\s+margin|margin).*?(?:<|drops\s+below|below|falls\s+below)\s*(\d+(?:\.\d+)?)\s*%/i)
    || clean.match(/(\d+(?:\.\d+)?)\s*%\s*(?:operating\s+margin|margin)/i);
  if (marginMatch) {
    const threshold = parseFloat(marginMatch[1]);
    return {
      conditionText: clean,
      type: 'DETERMINISTIC_TRIGGER',
      metric: 'operating_margin_pct',
      threshold,
      requiresManualReview: false,
      notes: `Deterministic monitor: Operating margin threshold ${threshold}%`
    };
  }

  // Free cash flow numeric threshold
  const fcfMatch = clean.match(/(?:free\s+cash\s+flow|fcf).*?(?:<|drops\s+below|below|falls\s+below)\s*\$?(\d+(?:\.\d+)?)\s*(?:m|b|k)?/i);
  if (fcfMatch) {
    const threshold = parseFloat(fcfMatch[1]);
    return {
      conditionText: clean,
      type: 'DETERMINISTIC_TRIGGER',
      metric: 'free_cash_flow',
      threshold,
      requiresManualReview: false,
      notes: `Deterministic monitor: FCF threshold ${threshold}`
    };
  }

  // Qualitative / free-text conditions require user review
  return {
    conditionText: clean,
    type: 'MANUAL_REVIEW_TRIGGER',
    metric: null,
    threshold: null,
    requiresManualReview: true,
    notes: 'Qualitative condition requires user review; cannot be deterministically evaluated.'
  };
}

/**
 * Validates target period strings according to supported fiscal periods.
 * Accepts formats: 'Q3 2026', '2026-Q3', 'Q3-2026', 'Q4 26', 'FY2026', 'FY26', '2026'.
 * Rejects arbitrary or ambiguous text.
 */
export function isValidTargetPeriod(periodStr: string): boolean {
  if (!periodStr || typeof periodStr !== 'string') return false;
  const clean = periodStr.trim().toUpperCase();
  const isQuarter = /^Q[1-4]\s*(?:FY\s*)?(\d{2,4})$/i.test(clean) ||
                    /^(?:FY\s*)?(\d{2,4})[-/\s]+Q[1-4]$/i.test(clean);
  const isAnnual = /^FY\s*(\d{2,4})$/i.test(clean);
  const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(clean);
  return isQuarter || isAnnual || isIsoDate;
}

/**
 * Normalizes period strings for canonical comparison (e.g. 'Q3 2026', '2026-Q3', 'Q3-2026', 'FY26').
 */
function normalizePeriodForMatch(periodStr: string): string {
  const raw = String(periodStr || '').toUpperCase().trim();
  const qMatch = raw.match(/^Q([1-4])\s*(?:FY\s*)?(\d{2,4})$/i) || raw.match(/^(?:FY\s*)?(\d{2,4})[-/\s]+Q([1-4])$/i);
  if (qMatch) {
    const q = qMatch[1].length === 1 ? qMatch[1] : qMatch[2];
    let yr = parseInt(qMatch[1].length === 1 ? qMatch[2] : qMatch[1], 10);
    if (yr < 100) yr += 2000;
    return `Q${q}_${yr}`;
  }
  const aMatch = raw.match(/^(?:FY\s*)?(\d{2,4})$/i);
  if (aMatch) {
    let yr = parseInt(aMatch[1], 10);
    if (yr < 100) yr += 2000;
    return `FY_${yr}`;
  }
  return raw.replace(/[^A-Z0-9]/g, '');
}

/**
 * Deterministically evaluates tracked expectations against a research memory snapshot and optional history.
 * Invariants:
 * 1. Durable Terminal Outcomes: Once an expectation reaches MET, MISSED, or EXCEEDED, preserve that outcome.
 * 2. Immutable Original Target Intent: targetValue, targetPeriod, condition, origin, createdAt, sourceReportId are preserved untouched.
 * 3. Historical Target Period Resolution: If target period is not the latestPeriod (e.g. target is Q3 2026, newest report is Q4 2026),
 *    resolve against authoritative historical periods from periodHistory or historicalSnapshots. Never evaluate Q3 target using Q4 values!
 * 4. Missing data remains PENDING or UNAVAILABLE truthfully.
 */
export function evaluateExpectations(
  expectations: TrackedExpectation[],
  memorySnapshot: ResearchMemorySnapshot,
  historicalSnapshots: ResearchMemorySnapshot[] = []
): TrackedExpectation[] {
  const now = new Date().toISOString();
  const financials = memorySnapshot.financials;
  const currentPeriod = financials.latestPeriod?.toUpperCase().trim() || '';
  const normCurrentPeriod = normalizePeriodForMatch(currentPeriod);

  return expectations.map(exp => {
    // Invariant 1: Durable terminal evaluation. Once MET, MISSED, or EXCEEDED, preserve durably!
    if (exp.status === 'MET' || exp.status === 'MISSED' || exp.status === 'EXCEEDED') {
      return exp;
    }

    const metricDef = EXPECTATION_METRIC_REGISTRY.find(m => m.id === exp.metricOrEvent);
    const isManual = exp.evaluationMode === 'MANUAL' || metricDef?.evaluationMode === 'MANUAL';

    // Invariant 4: MANUAL_REVIEW expectations must never be auto-resolved to MET/MISSED by AI or engine
    if (isManual) {
      return {
        ...exp,
        evaluationMode: 'MANUAL',
        unit: exp.unit || metricDef?.unit,
        evaluationNotes: exp.evaluationNotes || 'Manual review required: Verify actual results from official 10-Q/10-K SEC filing.'
      };
    }

    const expPeriod = exp.targetPeriod.toUpperCase().trim();
    const normExpPeriod = normalizePeriodForMatch(expPeriod);

    // Invariant 3: Canonical Target-Period Resolver
    let matchedPeriod: string | null = null;
    let actualValue: number | null = null;

    const extractMetricValue = (source: any): number | null => {
      if (!source) return null;
      const m = exp.metricOrEvent.toLowerCase();
      if (m === 'revenue') return typeof source.revenue === 'number' ? source.revenue : null;
      if (m === 'revenue_growth_yoy_pct') return typeof source.revenueYoYPct === 'number' ? source.revenueYoYPct : null;
      if (m === 'operating_margin_pct') return typeof source.operatingMarginPct === 'number' ? source.operatingMarginPct : null;
      if (m === 'free_cash_flow') return typeof source.freeCashFlow === 'number' ? source.freeCashFlow : null;
      if (m === 'net_income') return typeof source.netIncome === 'number' ? source.netIncome : null;
      if (m === 'eps_diluted') return typeof source.epsDiluted === 'number' ? source.epsDiluted : null;
      if (m === 'gross_margin_pct') return typeof source.grossMarginPct === 'number' ? source.grossMarginPct : null;
      if (m === 'cash_and_equivalents') {
        if (typeof source.cashAndEquivalents === 'number') return source.cashAndEquivalents;
        return null;
      }
      if (m === 'net_cash') {
        if (typeof source.netCash === 'number') return source.netCash;
        return null;
      }
      return null;
    };

    // Check 1: Does current snapshot latestPeriod match target?
    if (currentPeriod && (normCurrentPeriod === normExpPeriod || currentPeriod === expPeriod)) {
      matchedPeriod = currentPeriod;
      actualValue = extractMetricValue(financials);
    }

    // Check 2: Check current snapshot periodHistory
    if (actualValue === null && Array.isArray(financials.periodHistory)) {
      const histItem = financials.periodHistory.find(h => {
        const normH = normalizePeriodForMatch(h.period);
        return normH === normExpPeriod || h.period.toUpperCase().trim() === expPeriod;
      });
      if (histItem) {
        matchedPeriod = histItem.period;
        actualValue = extractMetricValue(histItem);
      }
    }

    // Check 3: Check prior historicalSnapshots
    if (actualValue === null && Array.isArray(historicalSnapshots)) {
      for (const hSnap of historicalSnapshots) {
        const hPeriod = hSnap.financials.latestPeriod?.toUpperCase().trim() || '';
        const normH = normalizePeriodForMatch(hPeriod);
        if (normH === normExpPeriod || hPeriod === expPeriod) {
          matchedPeriod = hPeriod;
          actualValue = extractMetricValue(hSnap.financials);
          if (actualValue !== null) break;
        }
        if (actualValue === null && Array.isArray(hSnap.financials.periodHistory)) {
          const histItem = hSnap.financials.periodHistory.find(h => {
            const nH = normalizePeriodForMatch(h.period);
            return nH === normExpPeriod || h.period.toUpperCase().trim() === expPeriod;
          });
          if (histItem) {
            matchedPeriod = histItem.period;
            actualValue = extractMetricValue(histItem);
            if (actualValue !== null) break;
          }
        }
      }
    }

    // Period mismatch validation (e.g. comparing quarterly target Q4 2026 against annual FY2026 data)
    const expYearMatch = expPeriod.match(/\b(20\d\d)\b/);
    const currYearMatch = currentPeriod.match(/\b(20\d\d)\b/);
    const isQuarterlyTarget = /^Q[1-4]/i.test(normExpPeriod) || /\bQ[1-4]\b/i.test(expPeriod);
    const isAnnualCurrent = /^FY/i.test(normCurrentPeriod) || /^(?:FY\s*)?20\d\d$/i.test(currentPeriod);

    let periodMismatchNote: string | undefined;
    if (expYearMatch && currYearMatch && expYearMatch[1] === currYearMatch[1] && isQuarterlyTarget && isAnnualCurrent) {
      periodMismatchNote = `Period mismatch: target requires quarterly data (${exp.targetPeriod}) but only annual (${currentPeriod}) is available. Data not compared.`;
    }

    if (matchedPeriod) {
      const normMatched = normalizePeriodForMatch(matchedPeriod);
      const isAnnualMatched = /^FY/i.test(normMatched);
      if (isQuarterlyTarget && isAnnualMatched) {
        return {
          ...exp,
          status: 'UNAVAILABLE',
          actualPeriodFound: matchedPeriod,
          actualValue: null,
          evaluationDate: now,
          evaluationNotes: `Period mismatch: target period ${exp.targetPeriod} cannot be compared against available ${matchedPeriod} data.`
        };
      }
    }

    // If target period data has not arrived or was never published
    if (!matchedPeriod || actualValue === null || typeof actualValue !== 'number') {
      if (matchedPeriod && actualValue === null) {
        return {
          ...exp,
          status: 'UNAVAILABLE',
          actualPeriodFound: matchedPeriod,
          actualValue: null,
          evaluationDate: now,
          evaluationNotes: `Target period reached (${matchedPeriod}) but metric ${exp.metricOrEvent} was unavailable.`
        };
      }

      return {
        ...exp,
        status: 'PENDING',
        actualValue: null,
        evaluationNotes: periodMismatchNote || exp.evaluationNotes
      };
    }

    const targetNum = Number(exp.targetValue);
    if (isNaN(targetNum)) {
      return {
        ...exp,
        status: 'UNAVAILABLE',
        actualPeriodFound: matchedPeriod,
        actualValue: null,
        evaluationDate: now,
        evaluationNotes: 'Non-numeric target value cannot be evaluated against financial metric.'
      };
    }

    const tolerance = Math.abs(targetNum) * 0.05;
    let status: ExpectationStatus = 'PENDING';
    if (exp.condition === 'gte') {
      if (actualValue >= targetNum + tolerance) {
        status = 'EXCEEDED';
      } else if (actualValue >= targetNum) {
        status = 'MET';
      } else {
        status = 'MISSED';
      }
    } else if (exp.condition === 'lte') {
      if (actualValue <= targetNum - tolerance) {
        status = 'EXCEEDED';
      } else if (actualValue <= targetNum) {
        status = 'MET';
      } else {
        status = 'MISSED';
      }
    } else if (exp.condition === 'approx') {
      status = Math.abs(actualValue - targetNum) <= tolerance ? 'MET' : 'MISSED';
    } else if (exp.condition === 'eq') {
      status = actualValue === targetNum ? 'MET' : 'MISSED';
    }

    const sourceOrigin = financials.provenance === 'sec_verified'
      ? (memorySnapshot.evidence?.secAccession ? `SEC 10-Q/10-K (${memorySnapshot.evidence.secAccession})` : 'SEC_FILING')
      : 'FINANCIAL_STATEMENTS';

    // Invariant 2: Original target fields (targetValue, targetPeriod, condition, origin, createdAt, sourceReportId) are preserved!
    return {
      ...exp,
      status,
      actualValue,
      actualPeriodFound: matchedPeriod,
      evaluationMode: 'AUTO',
      unit: exp.unit || metricDef?.unit,
      source: exp.source || sourceOrigin,
      provenance: exp.provenance || 'DETERMINISTIC_DERIVATION',
      evaluationDate: now,
      updatedAt: now,
      evaluationNotes: `Evaluated against ${matchedPeriod} data: actual ${actualValue} vs target ${targetNum} (${exp.condition})`
    };
  });
}

/**
 * Deterministically compares risks and catalysts between previous and current research.
 * Strictly conservative:
 * - Only exact normalized identity allows certain continuation (isCertain: true).
 * - Partial / ambiguous / semantic rewordings produce uncertain transitions (isCertain: false) with UNKNOWN/evolving status.
 * - Unmatched items from unstructured text are never certain (isCertain: false).
 */
export function matchRiskCatalystTransitions(
  previousRisks: string[],
  currentRisks: string[],
  previousCatalysts: string[],
  currentCatalysts: string[]
): TrackedItemTransition[] {
  const transitions: TrackedItemTransition[] = [];

  const clean = (s: string) => s.trim().toLowerCase();

  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'from', 'up', 'about', 'into', 'over', 'after', 'is', 'are', 'was',
    'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'but', 'if', 'then', 'else', 'when', 'where', 'why', 'how', 'all', 'any',
    'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will',
    'just', 'should', 'now', 'risk', 'risks', 'catalyst', 'catalysts'
  ]);

  const stemWord = (w: string) => {
    if (w.endsWith('ing') && w.length > 5) return w.slice(0, -3);
    if (w.endsWith('ed') && w.length > 4) return w.slice(0, -2);
    if (w.endsWith('er') && w.length > 4) return w.slice(0, -2);
    if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
    return w;
  };

  const getSignificantStems = (text: string): Set<string> => {
    const rawWords = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));
    return new Set(rawWords.map(stemWord));
  };

  const areSemanticallyAmbiguous = (text1: string, text2: string): boolean => {
    const c1 = clean(text1);
    const c2 = clean(text2);
    if (c1.includes(c2) || c2.includes(c1)) return true;

    const stems1 = getSignificantStems(text1);
    const stems2 = getSignificantStems(text2);
    if (stems1.size === 0 || stems2.size === 0) return false;

    let shared = 0;
    for (const s1 of stems1) {
      for (const s2 of stems2) {
        if (s1 === s2 || (s1.length >= 4 && s2.length >= 4 && (s1.startsWith(s2) || s2.startsWith(s1)))) {
          shared++;
          break;
        }
      }
    }
    return shared > 0;
  };

  const matchCategory = (
    prevItems: string[],
    currItems: string[],
    category: 'risk' | 'catalyst'
  ) => {
    const matchedPrevIndices = new Set<number>();
    const matchedCurrIndices = new Set<number>();

    // Pass 1: Exact matches (certain)
    for (let cIdx = 0; cIdx < currItems.length; cIdx++) {
      const currText = currItems[cIdx];
      const cleanCurr = clean(currText);

      for (let pIdx = 0; pIdx < prevItems.length; pIdx++) {
        if (matchedPrevIndices.has(pIdx)) continue;
        const prevText = prevItems[pIdx];
        if (clean(prevText) === cleanCurr) {
          matchedPrevIndices.add(pIdx);
          matchedCurrIndices.add(cIdx);
          transitions.push({
            itemText: currText,
            category,
            previousState: 'ACTIVE',
            currentState: 'ACTIVE',
            isCertain: true
          });
          break;
        }
      }
    }

    // Pass 2: Ambiguous / Semantic / Token overlap matches (uncertain)
    for (let cIdx = 0; cIdx < currItems.length; cIdx++) {
      if (matchedCurrIndices.has(cIdx)) continue;
      const currText = currItems[cIdx];

      for (let pIdx = 0; pIdx < prevItems.length; pIdx++) {
        if (matchedPrevIndices.has(pIdx)) continue;
        const prevText = prevItems[pIdx];

        if (areSemanticallyAmbiguous(currText, prevText)) {
          matchedPrevIndices.add(pIdx);
          matchedCurrIndices.add(cIdx);
          transitions.push({
            itemText: `${currText} (evolving from: ${prevText})`,
            category,
            previousState: 'ACTIVE',
            currentState: 'UNKNOWN',
            isCertain: false,
            evidence: 'Ambiguous rephrasing or semantic evolution across reports; review needed'
          });
          break;
        }
      }
    }

    // Pass 3: Unmatched current items (NEW, but uncertain for free-text)
    for (let cIdx = 0; cIdx < currItems.length; cIdx++) {
      if (matchedCurrIndices.has(cIdx)) continue;
      transitions.push({
        itemText: currItems[cIdx],
        category,
        previousState: 'UNKNOWN',
        currentState: 'NEW',
        isCertain: false,
        evidence: 'Newly introduced in report prose; identity unconfirmed'
      });
    }

    // Pass 4: Unmatched previous items (RESOLVED, but uncertain for free-text)
    for (let pIdx = 0; pIdx < prevItems.length; pIdx++) {
      if (matchedPrevIndices.has(pIdx)) continue;
      transitions.push({
        itemText: prevItems[pIdx],
        category,
        previousState: 'ACTIVE',
        currentState: 'RESOLVED',
        isCertain: false,
        evidence: 'Not mentioned in latest report; resolution unconfirmed'
      });
    }
  };

  matchCategory(previousRisks, currentRisks, 'risk');
  matchCategory(previousCatalysts, currentCatalysts, 'catalyst');

  return transitions;
}

/**
 * Resolves which user-confirmed thesis version was active for a specific research report state.
 * Strictly adheres to historical truth:
 * 1. Direct sourceReportId linkage takes top priority.
 * 2. If not directly linked, matches by valid temporal association (latest confirmed thesis on or before report timestamp).
 * 3. Never retroactively claims a modern thesis existed at an old report date. Legacy/unrecorded reports return null.
 */
export function resolveActiveThesisForReport(
  reportInput: any,
  revisions: InvestmentThesisRecord[] = [],
  currentThesis?: InvestmentThesisRecord | null
): InvestmentThesisRecord | null {
  if (!reportInput) return null;

  const unwrapped = unwrapHistoryRecord(reportInput);
  const data = unwrapped?.data || (reportInput.data ? reportInput.data : reportInput);
  const reportId = unwrapped?.reportId || (reportInput as any).id || (data as any).id;

  // 1. Direct linkage via sourceReportId
  if (reportId) {
    if (Array.isArray(revisions) && revisions.length > 0) {
      const directMatch = revisions.find(r => r.sourceReportId === reportId);
      if (directMatch) return directMatch;
    }

    if (currentThesis && currentThesis.sourceReportId === reportId) {
      return currentThesis;
    }
  }

  // 2. Temporal association if timestamp is valid
  const rawTimestamp = unwrapped?.createdTimestamp
    || (data?.generated_at ? Date.parse(String(data.generated_at)) : 0)
    || (data?.as_of_date ? Date.parse(String(data.as_of_date)) : 0);
  const repTime = Number.isFinite(rawTimestamp) && rawTimestamp > 0 ? rawTimestamp : 0;

  if (repTime > 0 && Array.isArray(revisions) && revisions.length > 0) {
    // Only consider user-confirmed or user-edited revisions
    const eligible = revisions
      .filter(r => {
        if (r.confirmationStatus !== 'USER_CONFIRMED' && r.confirmationStatus !== 'USER_EDITED') {
          return false;
        }
        const revTime = Date.parse(r.updatedAt || r.createdAt);
        return Number.isFinite(revTime) && revTime <= repTime;
      })
      .sort((a, b) => b.version - a.version);

    if (eligible.length > 0) {
      return eligible[0];
    }
  }

  // 3. If no confirmed revision existed at that report time, return null (NOT RECORDED)
  return null;
}
