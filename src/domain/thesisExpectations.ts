import { ReportData } from '../types';
import { ResearchMemorySnapshot, extractMemorySnapshot } from './investmentMemory';
import { unwrapHistoryRecord } from '../utils/researchTimeline';
import { detectValuationModel } from '../utils/valuation/modelSelector';

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
  createdAt: string;
  updatedAt: string;
  userId?: string;
  notes?: string;
}

export type BusinessCategory = 'operating' | 'financial' | 'reit' | 'cyclical' | 'early_stage';
export type EvaluationMode = 'AUTO' | 'MANUAL';

export interface ActiveValuationAssumption {
  labelTh: string;
  labelEn: string;
  valueText: string;
  provenance?: 'DETERMINISTIC_DERIVATION' | 'AI_DRAFT' | 'VERIFIED_FACT' | 'USER_CONFIRMED';
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

export type ExpectationMetric =
  | 'revenue'
  | 'revenue_growth_yoy_pct'
  | 'operating_margin_pct'
  | 'free_cash_flow'
  | 'net_income'
  | 'eps_diluted'
  | 'gross_margin_pct'
  | 'cash_and_equivalents'
  | 'deposits'
  | 'net_interest_margin'
  | 'tier_1_capital_ratio'
  | 'net_charge_off_rate'
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
    evaluationMode: 'AUTO',
    supportedPeriods: ['QUARTER', 'ANNUAL'],
    descriptionTh: 'อัตรากำไรจากการดำเนินงาน (Operating Income / Revenue)',
    descriptionEn: 'Operating margin percentage from verified statement.'
  },
  {
    id: 'free_cash_flow',
    labelEn: 'Free Cash Flow',
    labelTh: 'กระแสเงินสดอิสระ',
    unit: '$M',
    category: 'FINANCIAL',
    applicableBusinessTypes: ['operating', 'cyclical'],
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
    evaluationMode: 'AUTO',
    supportedPeriods: ['QUARTER', 'ANNUAL'],
    descriptionTh: 'กำไรต่อหุ้นปรับลดตามมาตรฐาน GAAP',
    descriptionEn: 'Diluted earnings per share from official statement.'
  },
  {
    id: 'gross_margin_pct',
    labelEn: 'Gross Margin',
    labelTh: 'อัตรากำไรขั้นต้น',
    unit: '%',
    category: 'FINANCIAL',
    applicableBusinessTypes: ['operating', 'early_stage', 'cyclical'],
    evaluationMode: 'AUTO',
    supportedPeriods: ['QUARTER', 'ANNUAL'],
    descriptionTh: 'อัตรากำไรขั้นต้น (Gross Profit / Revenue)',
    descriptionEn: 'Gross margin percentage from verified statement.'
  },
  {
    id: 'cash_and_equivalents',
    labelEn: 'Cash & Equivalents',
    labelTh: 'เงินสดและรายการเทียบเท่า',
    unit: '$M',
    category: 'FINANCIAL',
    applicableBusinessTypes: ['operating', 'early_stage'],
    evaluationMode: 'AUTO',
    supportedPeriods: ['QUARTER', 'ANNUAL'],
    descriptionTh: 'เงินสดและรายการเทียบเท่าเงินสดในงบดุล',
    descriptionEn: 'Cash and cash equivalents on balance sheet.'
  },

  // 2. Financial Institutions / FinTech Metrics (MANUAL REVIEW)
  {
    id: 'deposits',
    labelEn: 'Total Deposits',
    labelTh: 'เงินฝากรวม (Total Deposits)',
    unit: '$M',
    category: 'CREDIT',
    applicableBusinessTypes: ['financial'],
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
    evaluationMode: 'MANUAL',
    supportedPeriods: ['QUARTER', 'ANNUAL'],
    availabilityReasonTh: 'ต้องตรวจสอบจากรายงาน 10-Q/10-K เนื่องจากเป็นตัวชี้วัดเฉพาะกลุ่มสถาบันการเงิน',
    availabilityReasonEn: 'Requires manual review from official 10-Q/10-K filing as regulatory capital ratio.'
  },
  {
    id: 'net_charge_off_rate',
    labelEn: 'Net Charge-Off Rate (NCO)',
    labelTh: 'อัตราการตัดหนี้สูญสุทธิ (NCO)',
    unit: '%',
    category: 'CREDIT',
    applicableBusinessTypes: ['financial'],
    evaluationMode: 'MANUAL',
    supportedPeriods: ['QUARTER', 'ANNUAL'],
    availabilityReasonTh: 'ต้องตรวจสอบจากรายงาน 10-Q/10-K เนื่องจากเป็นตัวชี้วัดคุณภาพสินเชื่อ',
    availabilityReasonEn: 'Requires manual review from official 10-Q/10-K filing as credit quality metric.'
  },

  // 3. REIT Metrics (MANUAL REVIEW)
  {
    id: 'affo',
    labelEn: 'Adjusted Funds From Operations (AFFO)',
    labelTh: 'กระแสเงินสดปรับปรุงอสังหาฯ (AFFO)',
    unit: '$M',
    category: 'FINANCIAL',
    applicableBusinessTypes: ['reit'],
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
  const profile = data.company_profile;
  const sector = (profile?.sector || profile?.overview?.country || '').toLowerCase();
  const industry = (profile?.industry || profile?.overview?.description || '').toLowerCase();
  const template = data.financial_statements?.statement_template;
  const detected = detectValuationModel(data, sym);

  if (
    detected.model_type === 'fintech_pe' ||
    detected.model_type === 'ddm' ||
    template === 'banking' ||
    sector.includes('financial') ||
    sector.includes('bank') ||
    sector.includes('fintech') ||
    sector.includes('insurance') ||
    industry.includes('credit services') ||
    ['SOFI', 'NU', 'HOOD', 'COIN', 'AFRM', 'UPST', 'PYPL', 'SQ', 'JPM', 'BAC', 'WFC', 'C', 'GS', 'MS'].includes(sym)
  ) {
    return 'financial';
  }

  if (
    detected.model_type === 'reit_affo' ||
    template === 'reit' ||
    sector.includes('real estate') ||
    industry.includes('reit') ||
    ['PLD', 'AMT', 'EQIX', 'SPG', 'O', 'PSA', 'CCI'].includes(sym)
  ) {
    return 'reit';
  }

  if (
    detected.model_type === 'relative_only' ||
    ['RKLB', 'ASTS', 'LUNR', 'RDW', 'SPCE', 'PL', 'RIVN', 'LCID', 'PLUG', 'QS', 'JOBY', 'ACHR', 'EOSE'].includes(sym)
  ) {
    return 'early_stage';
  }

  return 'operating';
}

export function getApplicableExpectationMetrics(
  reportInput: any,
  ticker?: string
): ExpectationMetricDefinition[] {
  const category = resolveBusinessCategory(reportInput, ticker);
  return EXPECTATION_METRIC_REGISTRY.filter(m => m.applicableBusinessTypes.includes(category));
}

export function getActiveValuationAssumptions(
  reportInput: any,
  isThai = false
): ActiveValuationBasis {
  const unwrapped = unwrapHistoryRecord(reportInput);
  const data: ReportData = unwrapped?.data || (reportInput?.data ? reportInput.data : reportInput) || {};
  const sym = (unwrapped?.ticker || data.ticker || (data as any)?.symbol || 'STOCK').toUpperCase().trim();
  const detected = detectValuationModel(data, sym);
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
    const isFintech = detected.model_type === 'fintech_pe' || (data.company_profile?.description || '').toLowerCase().includes('fintech') || sym === 'SOFI';
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
  const projYears = typeof dcfAssumptions?.projection_years === 'number'
    ? dcfAssumptions.projection_years
    : (typeof dcfInputs?.projectionYears === 'number' ? dcfInputs.projectionYears : null);
  const baseScenario = dcfModel?.scenarios?.base;
  const revCagr = typeof baseScenario?.revenue_cagr_pct === 'number' ? baseScenario.revenue_cagr_pct : null;
  const terminalMargin = typeof baseScenario?.terminal_margin_pct === 'number' ? baseScenario.terminal_margin_pct : null;

  const assumptions: ActiveValuationAssumption[] = [];
  if (wacc !== null) {
    assumptions.push({
      labelTh: 'อัตราคิดลด (WACC)',
      labelEn: 'Discount rate (WACC)',
      valueText: `${wacc.toFixed(1)}%`,
      provenance: 'DETERMINISTIC_DERIVATION'
    });
  }
  if (terminalGrowth !== null) {
    assumptions.push({
      labelTh: 'อัตราเติบโตระยะยาว (Terminal Growth)',
      labelEn: 'Terminal growth rate',
      valueText: `${terminalGrowth.toFixed(1)}%`,
      provenance: 'DETERMINISTIC_DERIVATION'
    });
  }
  if (projYears !== null) {
    assumptions.push({
      labelTh: 'ระยะเวลาประมาณการ',
      labelEn: 'Explicit forecast period',
      valueText: `${projYears} ${isThai ? 'ปี' : 'Years'}`,
      provenance: 'DETERMINISTIC_DERIVATION'
    });
  }
  if (revCagr !== null) {
    assumptions.push({
      labelTh: 'รายได้เติบโตเฉลี่ย (Base Revenue CAGR)',
      labelEn: 'Base Revenue CAGR',
      valueText: `${revCagr.toFixed(1)}%`,
      provenance: 'AI_DRAFT'
    });
  }
  if (terminalMargin !== null) {
    assumptions.push({
      labelTh: 'อัตรากำไรเป้าหมาย (Terminal Margin)',
      labelEn: 'Target terminal margin',
      valueText: `${terminalMargin.toFixed(1)}%`,
      provenance: 'AI_DRAFT'
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
    createdAt: now,
    updatedAt: now,
    userId: userId || undefined
  };
}

/**
 * Confirms or edits a user thesis, transitioning state to USER_CONFIRMED or USER_EDITED.
 * Strictly links new revisions created from a report view to that current research state (currentReportId).
 */
export function confirmUserThesis(
  baseThesis: InvestmentThesisRecord,
  edits?: Partial<InvestmentThesisRecord>,
  userId?: string,
  currentReportId?: string | null
): InvestmentThesisRecord {
  const now = new Date().toISOString();
  const hasEdits = Boolean(
    edits?.summary ||
    edits?.keyDrivers ||
    edits?.keyAssumptions ||
    edits?.keyRisks ||
    edits?.catalysts ||
    edits?.invalidationConditions ||
    edits?.status
  );

  return {
    ...baseThesis,
    ...(edits || {}),
    version: baseThesis.version + 1,
    confirmationStatus: hasEdits ? 'USER_EDITED' : 'USER_CONFIRMED',
    sourceReportId: currentReportId ?? edits?.sourceReportId ?? baseThesis.sourceReportId,
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
      if (m === 'gross_margin_pct') return typeof source.grossMarginPct === 'number' ? source.grossMarginPct : null;
      if (m === 'cash_and_equivalents') {
        if (typeof source.netCash === 'number') return source.netCash;
        if (typeof source.cashAndEquivalents === 'number') return source.cashAndEquivalents;
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

    let status: ExpectationStatus = 'PENDING';
    if (exp.condition === 'gte') {
      if (actualValue >= targetNum * 1.05) {
        status = 'EXCEEDED';
      } else if (actualValue >= targetNum) {
        status = 'MET';
      } else {
        status = 'MISSED';
      }
    } else if (exp.condition === 'lte') {
      status = actualValue <= targetNum ? 'MET' : 'MISSED';
    } else if (exp.condition === 'approx') {
      const tolerance = Math.abs(targetNum * 0.05);
      status = Math.abs(actualValue - targetNum) <= tolerance ? 'MET' : 'MISSED';
    } else if (exp.condition === 'eq') {
      status = actualValue === targetNum ? 'MET' : 'MISSED';
    }

    // Invariant 2: Original target fields (targetValue, targetPeriod, condition, origin, createdAt, sourceReportId) are preserved!
    return {
      ...exp,
      status,
      actualValue,
      actualPeriodFound: matchedPeriod,
      evaluationMode: 'AUTO',
      unit: exp.unit || metricDef?.unit,
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
