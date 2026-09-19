import type { ReportData } from '../../types';
import {
  resolveBusinessArchetype,
  type BusinessArchetype,
  type MetricApplicability,
} from '../financialMetricContext';
import type { FinancialUnit } from '../financialValue';
import {
  DataGapState,
  type BusinessRelevance,
  type DataCompletenessSummary,
  type DataGap,
} from './types';

export interface MetricArchetypeRule {
  fieldKey: string;
  displayName: string;
  displayNameTh: string;
  canonicalPath: string;
  expectedUnit: FinancialUnit;
  businessRelevance: BusinessRelevance;
  applicability: MetricApplicability;
  definition?: string;
}

const ARCHETYPE_ALIAS_MAP: Record<string, BusinessArchetype> = {
  BANK_LENDER_FINTECH: 'bank',
  BANK: 'bank',
  LENDER: 'lender',
  FINTECH: 'fintech',
  SOFTWARE_PLATFORM: 'saas_software',
  SAAS: 'saas_software',
  INSURANCE: 'insurer',
  REIT: 'reit',
  ENERGY_RESOURCE: 'energy_commodity',
  ENERGY: 'energy_commodity',
  RETAIL_CONSUMER: 'retail',
  RETAIL: 'retail',
  EARLY_STAGE_GROWTH: 'early_stage',
  EARLY_STAGE: 'early_stage',
  GENERAL_CORPORATE: 'general_operating',
  GENERAL_OPERATING: 'general_operating',
};

/**
 * Sector-specific metric expectation rules by archetype.
 */
export const ARCHETYPE_METRIC_RULES: Record<BusinessArchetype, MetricArchetypeRule[]> = {
  bank: [
    { fieldKey: 'net_interest_margin_pct', displayName: 'Net Interest Margin (NIM)', displayNameTh: 'อัตราส่วนต่างดอกเบี้ยสุทธิ (NIM)', canonicalPath: 'financial_statements.income_statement.net_interest_margin_pct', expectedUnit: 'percent', businessRelevance: 'CRITICAL', applicability: 'PRIMARY' },
    { fieldKey: 'deposits', displayName: 'Total Deposits', displayNameTh: 'เงินฝากรวม', canonicalPath: 'financial_statements.balance_sheet.deposits', expectedUnit: 'USD_M', businessRelevance: 'CRITICAL', applicability: 'PRIMARY' },
    { fieldKey: 'loans_held_for_investment', displayName: 'Loans Held for Investment', displayNameTh: 'สินเชื่อเพื่อการลงทุน', canonicalPath: 'financial_statements.balance_sheet.loans_held_for_investment', expectedUnit: 'USD_M', businessRelevance: 'CRITICAL', applicability: 'PRIMARY' },
    { fieldKey: 'provision_for_credit_losses', displayName: 'Provision for Credit Losses', displayNameTh: 'ผลขาดทุนด้านเครดิตที่คาดว่าจะเกิดขึ้น', canonicalPath: 'financial_statements.income_statement.provision_for_credit_losses', expectedUnit: 'USD_M', businessRelevance: 'HIGH', applicability: 'PRIMARY' },
    { fieldKey: 'tier1_capital_ratio', displayName: 'Tier 1 Capital Ratio', displayNameTh: 'อัตราส่วนเงินกองทุนชั้นที่ 1', canonicalPath: 'financial_statements.balance_sheet.tier1_capital_ratio', expectedUnit: 'percent', businessRelevance: 'HIGH', applicability: 'PRIMARY' },
    { fieldKey: 'inventory', displayName: 'Inventory', displayNameTh: 'สินค้าคงเหลือ', canonicalPath: 'financial_statements.balance_sheet.inventory', expectedUnit: 'USD_M', businessRelevance: 'LOW', applicability: 'NOT_MEANINGFUL_FOR_PRIMARY_INTERPRETATION' },
    { fieldKey: 'gross_margin_pct', displayName: 'Gross Margin', displayNameTh: 'อัตรากำไรขั้นต้น', canonicalPath: 'financial_statements.income_statement.gross_margin_pct', expectedUnit: 'percent', businessRelevance: 'LOW', applicability: 'NOT_MEANINGFUL_FOR_PRIMARY_INTERPRETATION' },
  ],
  lender: [
    { fieldKey: 'net_interest_margin_pct', displayName: 'Net Interest Margin (NIM)', displayNameTh: 'อัตราส่วนต่างดอกเบี้ยสุทธิ (NIM)', canonicalPath: 'financial_statements.income_statement.net_interest_margin_pct', expectedUnit: 'percent', businessRelevance: 'CRITICAL', applicability: 'PRIMARY' },
    { fieldKey: 'deposits', displayName: 'Total Deposits', displayNameTh: 'เงินฝากรวม', canonicalPath: 'financial_statements.balance_sheet.deposits', expectedUnit: 'USD_M', businessRelevance: 'CRITICAL', applicability: 'PRIMARY' },
    { fieldKey: 'loans_held_for_investment', displayName: 'Loans Held for Investment', displayNameTh: 'สินเชื่อเพื่อการลงทุน', canonicalPath: 'financial_statements.balance_sheet.loans_held_for_investment', expectedUnit: 'USD_M', businessRelevance: 'CRITICAL', applicability: 'PRIMARY' },
    { fieldKey: 'provision_for_credit_losses', displayName: 'Provision for Credit Losses', displayNameTh: 'ผลขาดทุนด้านเครดิตที่คาดว่าจะเกิดขึ้น', canonicalPath: 'financial_statements.income_statement.provision_for_credit_losses', expectedUnit: 'USD_M', businessRelevance: 'HIGH', applicability: 'PRIMARY' },
    { fieldKey: 'inventory', displayName: 'Inventory', displayNameTh: 'สินค้าคงเหลือ', canonicalPath: 'financial_statements.balance_sheet.inventory', expectedUnit: 'USD_M', businessRelevance: 'LOW', applicability: 'NOT_MEANINGFUL_FOR_PRIMARY_INTERPRETATION' },
    { fieldKey: 'gross_margin_pct', displayName: 'Gross Margin', displayNameTh: 'อัตรากำไรขั้นต้น', canonicalPath: 'financial_statements.income_statement.gross_margin_pct', expectedUnit: 'percent', businessRelevance: 'LOW', applicability: 'NOT_MEANINGFUL_FOR_PRIMARY_INTERPRETATION' },
  ],
  fintech: [
    { fieldKey: 'net_interest_margin_pct', displayName: 'Net Interest Margin (NIM)', displayNameTh: 'อัตราส่วนต่างดอกเบี้ยสุทธิ (NIM)', canonicalPath: 'financial_statements.income_statement.net_interest_margin_pct', expectedUnit: 'percent', businessRelevance: 'CRITICAL', applicability: 'PRIMARY' },
    { fieldKey: 'deposits', displayName: 'Total Deposits', displayNameTh: 'เงินฝากรวม', canonicalPath: 'financial_statements.balance_sheet.deposits', expectedUnit: 'USD_M', businessRelevance: 'CRITICAL', applicability: 'PRIMARY' },
    { fieldKey: 'loans_held_for_investment', displayName: 'Loans Held for Investment', displayNameTh: 'สินเชื่อเพื่อการลงทุน', canonicalPath: 'financial_statements.balance_sheet.loans_held_for_investment', expectedUnit: 'USD_M', businessRelevance: 'CRITICAL', applicability: 'PRIMARY' },
    { fieldKey: 'provision_for_credit_losses', displayName: 'Provision for Credit Losses', displayNameTh: 'ผลขาดทุนด้านเครดิตที่คาดว่าจะเกิดขึ้น', canonicalPath: 'financial_statements.income_statement.provision_for_credit_losses', expectedUnit: 'USD_M', businessRelevance: 'HIGH', applicability: 'PRIMARY' },
    { fieldKey: 'inventory', displayName: 'Inventory', displayNameTh: 'สินค้าคงเหลือ', canonicalPath: 'financial_statements.balance_sheet.inventory', expectedUnit: 'USD_M', businessRelevance: 'LOW', applicability: 'NOT_MEANINGFUL_FOR_PRIMARY_INTERPRETATION' },
    { fieldKey: 'gross_margin_pct', displayName: 'Gross Margin', displayNameTh: 'อัตรากำไรขั้นต้น', canonicalPath: 'financial_statements.income_statement.gross_margin_pct', expectedUnit: 'percent', businessRelevance: 'LOW', applicability: 'NOT_MEANINGFUL_FOR_PRIMARY_INTERPRETATION' },
  ],
  reit: [
    { fieldKey: 'ffo', displayName: 'Funds From Operations (FFO)', displayNameTh: 'กระแสเงินสดจากการดำเนินงาน (FFO)', canonicalPath: 'financial_statements.income_statement.ffo', expectedUnit: 'USD_M', businessRelevance: 'CRITICAL', applicability: 'PRIMARY' },
    { fieldKey: 'affo', displayName: 'Adjusted FFO (AFFO)', displayNameTh: 'FFO ปรับปรุง (AFFO)', canonicalPath: 'financial_statements.income_statement.affo', expectedUnit: 'USD_M', businessRelevance: 'CRITICAL', applicability: 'PRIMARY' },
    { fieldKey: 'noi', displayName: 'Net Operating Income (NOI)', displayNameTh: 'รายได้จากการดำเนินงานสุทธิ (NOI)', canonicalPath: 'financial_statements.income_statement.noi', expectedUnit: 'USD_M', businessRelevance: 'CRITICAL', applicability: 'PRIMARY' },
    { fieldKey: 'occupancy_rate_pct', displayName: 'Occupancy Rate', displayNameTh: 'อัตราการเช่าพื้นที่', canonicalPath: 'financial_statements.key_indicators.occupancy_rate_pct', expectedUnit: 'percent', businessRelevance: 'HIGH', applicability: 'PRIMARY' },
    { fieldKey: 'cogs', displayName: 'Cost of Goods Sold', displayNameTh: 'ต้นทุนขาย', canonicalPath: 'financial_statements.income_statement.cost_of_goods_sold', expectedUnit: 'USD_M', businessRelevance: 'LOW', applicability: 'NOT_MEANINGFUL_FOR_PRIMARY_INTERPRETATION' },
  ],
  insurer: [
    { fieldKey: 'combined_ratio_pct', displayName: 'Combined Ratio', displayNameTh: 'อัตราส่วนรวม (Combined Ratio)', canonicalPath: 'financial_statements.key_indicators.combined_ratio_pct', expectedUnit: 'percent', businessRelevance: 'CRITICAL', applicability: 'PRIMARY' },
    { fieldKey: 'loss_ratio_pct', displayName: 'Loss Ratio', displayNameTh: 'อัตราส่วนค่าสินไหมทดแทน', canonicalPath: 'financial_statements.key_indicators.loss_ratio_pct', expectedUnit: 'percent', businessRelevance: 'HIGH', applicability: 'PRIMARY' },
    { fieldKey: 'net_premiums_earned', displayName: 'Net Premiums Earned', displayNameTh: 'เบี้ยประกันภัยรับสุทธิ', canonicalPath: 'financial_statements.income_statement.net_premiums_earned', expectedUnit: 'USD_M', businessRelevance: 'CRITICAL', applicability: 'PRIMARY' },
    { fieldKey: 'loss_reserve', displayName: 'Loss Reserve', displayNameTh: 'สำรองค่าสินไหมทดแทน', canonicalPath: 'financial_statements.balance_sheet.loss_reserve', expectedUnit: 'USD_M', businessRelevance: 'HIGH', applicability: 'PRIMARY' },
    { fieldKey: 'inventory', displayName: 'Inventory', displayNameTh: 'สินค้าคงเหลือ', canonicalPath: 'financial_statements.balance_sheet.inventory', expectedUnit: 'USD_M', businessRelevance: 'LOW', applicability: 'NOT_MEANINGFUL_FOR_PRIMARY_INTERPRETATION' },
  ],
  saas_software: [
    { fieldKey: 'rpo', displayName: 'Remaining Performance Obligations (RPO)', displayNameTh: 'ภาระผูกพันตามสัญญาที่ยังไม่รับรู้รายได้ (RPO)', canonicalPath: 'financial_statements.income_statement.rpo', expectedUnit: 'USD_M', businessRelevance: 'CRITICAL', applicability: 'PRIMARY' },
    { fieldKey: 'arr', displayName: 'Annual Recurring Revenue (ARR)', displayNameTh: 'รายได้ประจำปี (ARR)', canonicalPath: 'financial_statements.income_statement.arr', expectedUnit: 'USD_M', businessRelevance: 'HIGH', applicability: 'PRIMARY' },
    { fieldKey: 'gross_margin_pct', displayName: 'Gross Margin', displayNameTh: 'อัตรากำไรขั้นต้น', canonicalPath: 'financial_statements.income_statement.gross_margin_pct', expectedUnit: 'percent', businessRelevance: 'CRITICAL', applicability: 'PRIMARY' },
    { fieldKey: 'inventory', displayName: 'Inventory', displayNameTh: 'สินค้าคงเหลือ', canonicalPath: 'financial_statements.balance_sheet.inventory', expectedUnit: 'USD_M', businessRelevance: 'LOW', applicability: 'NOT_MEANINGFUL_FOR_PRIMARY_INTERPRETATION' },
  ],
  energy_commodity: [
    { fieldKey: 'production_volume', displayName: 'Production Volume', displayNameTh: 'ปริมาณการผลิต', canonicalPath: 'financial_statements.key_indicators.production_volume', expectedUnit: 'x', businessRelevance: 'CRITICAL', applicability: 'PRIMARY' },
    { fieldKey: 'realized_price', displayName: 'Realized Price', displayNameTh: 'ราคาขายเฉลี่ยจริง', canonicalPath: 'financial_statements.key_indicators.realized_price', expectedUnit: 'x', businessRelevance: 'HIGH', applicability: 'PRIMARY' },
    { fieldKey: 'gross_margin_pct', displayName: 'Gross Margin', displayNameTh: 'อัตรากำไรขั้นต้น', canonicalPath: 'financial_statements.income_statement.gross_margin_pct', expectedUnit: 'percent', businessRelevance: 'MEDIUM', applicability: 'PRIMARY' },
  ],
  retail: [
    { fieldKey: 'same_store_sales_growth_pct', displayName: 'Same-Store Sales Growth', displayNameTh: 'การเติบโตของยอดขายสาขาเดิม', canonicalPath: 'financial_statements.key_indicators.same_store_sales_growth_pct', expectedUnit: 'percent', businessRelevance: 'CRITICAL', applicability: 'PRIMARY' },
    { fieldKey: 'inventory', displayName: 'Inventory', displayNameTh: 'สินค้าคงเหลือ', canonicalPath: 'financial_statements.balance_sheet.inventory', expectedUnit: 'USD_M', businessRelevance: 'CRITICAL', applicability: 'PRIMARY' },
    { fieldKey: 'gross_margin_pct', displayName: 'Gross Margin', displayNameTh: 'อัตรากำไรขั้นต้น', canonicalPath: 'financial_statements.income_statement.gross_margin_pct', expectedUnit: 'percent', businessRelevance: 'CRITICAL', applicability: 'PRIMARY' },
  ],
  early_stage: [
    { fieldKey: 'cash_runway_months', displayName: 'Cash Runway (Months)', displayNameTh: 'ระยะเวลากระแสเงินสดคงเหลือ (เดือน)', canonicalPath: 'financial_statements.key_indicators.cash_runway_months', expectedUnit: 'count', businessRelevance: 'CRITICAL', applicability: 'PRIMARY' },
    { fieldKey: 'cash_and_equivalents', displayName: 'Cash & Equivalents', displayNameTh: 'เงินสดและรายการเทียบเท่าเงินสด', canonicalPath: 'financial_statements.balance_sheet.cash_and_equivalents', expectedUnit: 'USD_M', businessRelevance: 'CRITICAL', applicability: 'PRIMARY' },
    { fieldKey: 'pe_ratio', displayName: 'P/E Ratio', displayNameTh: 'อัตราส่วน P/E', canonicalPath: 'financial_statements.key_indicators.pe_ratio', expectedUnit: 'x', businessRelevance: 'LOW', applicability: 'NOT_MEANINGFUL_FOR_PRIMARY_INTERPRETATION' },
  ],
  general_operating: [
    { fieldKey: 'gross_margin_pct', displayName: 'Gross Margin', displayNameTh: 'อัตรากำไรขั้นต้น', canonicalPath: 'financial_statements.income_statement.gross_margin_pct', expectedUnit: 'percent', businessRelevance: 'CRITICAL', applicability: 'PRIMARY' },
    { fieldKey: 'operating_margin_pct', displayName: 'Operating Margin', displayNameTh: 'อัตรากำไรจากการดำเนินงาน', canonicalPath: 'financial_statements.income_statement.operating_margin_pct', expectedUnit: 'percent', businessRelevance: 'CRITICAL', applicability: 'PRIMARY' },
    { fieldKey: 'free_cash_flow', displayName: 'Free Cash Flow', displayNameTh: 'กระแสเงินสดอิสระ', canonicalPath: 'financial_statements.cash_flow.free_cash_flow', expectedUnit: 'USD_M', businessRelevance: 'CRITICAL', applicability: 'PRIMARY' },
    { fieldKey: 'rpo', displayName: 'Remaining Performance Obligations', displayNameTh: 'ภาระผูกพันตามสัญญาที่ยังไม่รับรู้รายได้', canonicalPath: 'financial_statements.income_statement.rpo', expectedUnit: 'USD_M', businessRelevance: 'MEDIUM', applicability: 'SECONDARY' },
  ],
  asset_manager: [],
  broker_exchange: [],
  semiconductor: [],
  hardware_device: [],
  industrial_manufacturing: [],
  digital_marketplace: [],
  utility: [],
  telecom: [],
};

// Fill empty archetypes with general operating fallback
for (const key of Object.keys(ARCHETYPE_METRIC_RULES) as BusinessArchetype[]) {
  if (ARCHETYPE_METRIC_RULES[key].length === 0) {
    ARCHETYPE_METRIC_RULES[key] = ARCHETYPE_METRIC_RULES.general_operating;
  }
}

/**
 * Builds a structured inventory of data gaps from ReportData.
 */
export function buildDataGapInventory(
  report: Partial<ReportData>,
  forcedArchetypeOrPeriod?: BusinessArchetype | string,
  targetPeriod?: string
): { gaps: DataGap[]; archetype: BusinessArchetype; summary: DataCompletenessSummary } {
  let archetype: BusinessArchetype;
  let resolvedTargetPeriod = targetPeriod;

  const reportTicker = (report as any).symbol || report.ticker;

  if (forcedArchetypeOrPeriod) {
    const upper = forcedArchetypeOrPeriod.toUpperCase();
    if (ARCHETYPE_ALIAS_MAP[upper]) {
      archetype = ARCHETYPE_ALIAS_MAP[upper];
    } else if (forcedArchetypeOrPeriod in ARCHETYPE_METRIC_RULES) {
      archetype = forcedArchetypeOrPeriod as BusinessArchetype;
    } else {
      if (!resolvedTargetPeriod) {
        resolvedTargetPeriod = forcedArchetypeOrPeriod;
      }
      archetype = resolveBusinessArchetype(report, reportTicker);
    }
  } else {
    archetype = resolveBusinessArchetype(report, reportTicker);
  }

  const periods = report.financial_statements?.periods ||
    (report.financial_statements?.income_statement as any)?.periods ||
    (report.financial_statements?.balance_sheet as any)?.periods ||
    [];
  const latestPeriod = resolvedTargetPeriod || periods[periods.length - 1] || 'Latest';
  const rules = ARCHETYPE_METRIC_RULES[archetype] || ARCHETYPE_METRIC_RULES.general_operating;

  const gaps: DataGap[] = [];

  for (const rule of rules) {
    let currentStatus: DataGapState = DataGapState.NOT_FOUND_YET;

    // 1. Check if NOT_APPLICABLE for this archetype
    if (rule.applicability === 'NOT_MEANINGFUL_FOR_PRIMARY_INTERPRETATION') {
      currentStatus = DataGapState.NOT_APPLICABLE;
    } else {
      // 2. Check canonical value in report
      const parts = rule.canonicalPath.split('.');
      let current: any = report;
      for (const part of parts) {
        current = current?.[part];
      }

      if (Array.isArray(current)) {
        const lastVal = current[current.length - 1];
        if (typeof lastVal === 'number' && Number.isFinite(lastVal)) {
          currentStatus = DataGapState.VERIFIED_AVAILABLE;
        } else if (rule.applicability === 'CONTEXT_ONLY' || rule.applicability === 'SECONDARY') {
          currentStatus = DataGapState.NOT_REPORTED;
        } else {
          currentStatus = DataGapState.NOT_FOUND_YET;
        }
      } else if (typeof current === 'number' && Number.isFinite(current)) {
        currentStatus = DataGapState.VERIFIED_AVAILABLE;
      } else if (rule.applicability === 'CONTEXT_ONLY' || rule.applicability === 'SECONDARY') {
        currentStatus = DataGapState.NOT_REPORTED;
      } else {
        currentStatus = DataGapState.NOT_FOUND_YET;
      }
    }

    gaps.push({
      fieldKey: rule.fieldKey,
      displayName: rule.displayName,
      displayNameTh: rule.displayNameTh,
      businessRelevance: rule.businessRelevance,
      expectedPeriod: latestPeriod,
      expectedUnit: rule.expectedUnit,
      currentStatus,
      canonicalPath: rule.canonicalPath,
      sourceAttempts: [],
      applicability: rule.applicability,
      archetype,
      definition: rule.definition,
    });
  }

  const verifiedAvailable = gaps.filter((g) => g.currentStatus === DataGapState.VERIFIED_AVAILABLE).length;
  const verifiedDerived = gaps.filter((g) => g.currentStatus === DataGapState.VERIFIED_DERIVED).length;
  const notReported = gaps.filter((g) => g.currentStatus === DataGapState.NOT_REPORTED).length;
  const notApplicable = gaps.filter((g) => g.currentStatus === DataGapState.NOT_APPLICABLE).length;
  const extractionGaps = gaps.filter((g) => g.currentStatus === DataGapState.EXTRACTION_GAP).length;
  const sourceConflicts = gaps.filter((g) => g.currentStatus === DataGapState.SOURCE_CONFLICT).length;
  const unresolved = gaps.filter((g) => g.currentStatus === DataGapState.NOT_FOUND_YET).length;

  const totalImportant = gaps.filter((g) => g.businessRelevance === 'CRITICAL' || g.businessRelevance === 'HIGH').length;
  const fulfilledImportant = gaps.filter((g) =>
    (g.businessRelevance === 'CRITICAL' || g.businessRelevance === 'HIGH') &&
    (g.currentStatus === DataGapState.VERIFIED_AVAILABLE || g.currentStatus === DataGapState.VERIFIED_DERIVED || g.currentStatus === DataGapState.NOT_APPLICABLE)
  ).length;

  const completenessScorePct = totalImportant > 0
    ? Math.round((fulfilledImportant / totalImportant) * 100)
    : 100;

  const summary: DataCompletenessSummary = {
    totalImportantFields: totalImportant,
    verifiedAvailable,
    verifiedDerived,
    notReported,
    notApplicable,
    extractionGaps,
    sourceConflicts,
    unresolved,
    completenessScorePct,
    gaps,
  };

  return { gaps, archetype, summary };
}
