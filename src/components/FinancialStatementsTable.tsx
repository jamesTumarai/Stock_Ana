import { selectFinancialMetric, metricPeriodChanges, formatMetricChange } from '../domain/selectedFinancialMetric';
import { STATEMENT_SEMANTIC_LABELS, commonParentIncomeAlias } from '../domain/statementSemanticLabels';
import { metricDeltaTone } from '../domain/metricAssessmentPolicy';
import { formatWorkingCapitalCashEffect } from '../domain/workingCapitalSemantics';
import {verifiedMetricSeries} from '../domain/financialSynthesisGuard';
import { analystCacheKey, deterministicMetricInsight, MetricRequestSequence, type AnalystFallbackReason } from '../domain/financialAnalystContract';
import { calculateVerifiedKeyIndicators } from '../domain/verifiedKeyIndicators';
import { aggregateQuarterlyToAnnual } from '../utils/statementAggregation';
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Table, AlertTriangle, TrendingUp, TrendingDown, Minus,
  ChevronDown, ChevronRight, Layers, DollarSign, ArrowRight,
  BarChart3, Activity, PieChart, Shield, Check, SlidersHorizontal, Sparkles, Lightbulb, Info, Calculator
} from 'lucide-react';
import { CalculationModal } from './CalculationModal';
import { getMetricCalculationDetail, MetricCalculationDetail } from '../utils/metricCalculations';
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, ReferenceLine
} from 'recharts';
import { FinancialStatementsData, KeyIndicatorsData, KeyIndicatorMetric, KeyIndicatorsCategory } from '../types';
import { getFinancialAiInsight, FinancialAiInsight } from '../utils/financialAiInsights';
import {
  getMetricInterpretationContext,
  getBusinessAwareLocalFallback,
  MetricInterpretationContext
} from '../domain/financialMetricContext';
import {
  resolveGrossMarginLineage,
  findKeyIndicatorInSource,
  alignMetricValuesByPeriod
} from '../domain/metricLineage';
import { getDataGapExplanation } from '../domain/dataCompleteness/userFacingExplanation';
import { authenticatedFetch } from '../services/authenticatedFetch';
import { fetchMetricAi, metricAiFailureLabel } from '../services/metricAiClient';

interface Props {
  data?: FinancialStatementsData;
  isThai: boolean;
  currencyRate?: number;
  currencyMode?: 'USD' | 'THB';
  ticker?: string;
  companyName?: string;
}

export function FinancialStatementsTable(props: Props) {
  if (!props.data?.verified_dataset || !props.data.periods.length) return <div className="bg-white rounded-2xl p-6 border border-stone-200 text-stone-500 text-center">
    {props.isThai ? 'ยังไม่มีงบการเงินที่ตรวจสอบแหล่งที่มาและงวดได้ จึงไม่แสดงตัวเลขทดแทน' : 'Verified financial statements unavailable; no substitute numbers displayed.'}
  </div>;
  return <VerifiedFinancialStatementsTable {...props} />;
}

function VerifiedFinancialStatementsTable({
  data,
  isThai,
  currencyRate,
  currencyMode = 'USD',
  ticker = '',
  companyName = ''
}: Props) {
  const [statementTab, setStatementTab] = useState<'indicators' | 'income' | 'balance' | 'cashflow'>('income');
  const [selectedRowKey, setSelectedRowKey] = useState<string>('revenue');
  const [isChartCollapsed, setIsChartCollapsed] = useState<boolean>(false);
  const [liveAiInsights, setLiveAiInsights] = useState<Record<string, FinancialAiInsight>>({});
  const [isAiAnalyzing, setIsAiAnalyzing] = useState<boolean>(false);
  const [analystFailures, setAnalystFailures] = useState<Record<string, AnalystFallbackReason>>({});
  const requestSequence = useRef(new MetricRequestSequence());
  const activeMetricRequest = useRef<{requestId: string; cacheKey: string} | null>(null);
  const [activeCalcDetail, setActiveCalcDetail] = useState<MetricCalculationDetail | null>(null);
  const [activeCalcPeriod, setActiveCalcPeriod] = useState<string>('');

  // Dropdown States
  const [periodDropdownOpen, setPeriodDropdownOpen] = useState<boolean>(false);
  const [periodType, setPeriodType] = useState<'quarterly' | 'annual' | 'cumulative'>(data?.fiscal_period_type === 'annual' ? 'annual' : 'quarterly');
  const [quarterFilter, setQuarterFilter] = useState<'all' | 'Q1' | 'Q2' | 'Q3' | 'Q4'>('all');

  const [compareDropdownOpen, setCompareDropdownOpen] = useState<boolean>(false);
  const [compareMode, setCompareMode] = useState<'yoy' | 'qoq' | 'hide'>('yoy');

  const periodMenuRef = useRef<HTMLDivElement>(null);
  const compareMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (periodMenuRef.current && !periodMenuRef.current.contains(e.target as Node)) {
        setPeriodDropdownOpen(false);
      }
      if (compareMenuRef.current && !compareMenuRef.current.contains(e.target as Node)) {
        setCompareDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const annualData = React.useMemo(() => {
    return data?.fiscal_period_type === 'annual' ? data : data ? aggregateQuarterlyToAnnual(data) : null;
  }, [data]);

  if (!data || !data.periods || data.periods.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-stone-200 text-stone-500 text-center italic">
        {isThai ? 'ไม่มีข้อมูลงบการเงินย้อนหลัง' : 'No historical financial statement data available.'}
      </div>
    );
  }

  const isReportedAnnualOnly = data.fiscal_period_type === 'annual' && data.period_snapshots?.every(p => p.periodType === 'annual');
  const isAnnualActive = periodType === 'annual' && Boolean(annualData);
  const effectiveData = isAnnualActive ? (annualData as FinancialStatementsData) : data;
  const rawPeriods = effectiveData.periods;
  const statementTemplate = effectiveData.statement_template || 'standard';
  const validation = effectiveData.validation_summary;
  const isForeignCurrency = Boolean(effectiveData.currency && effectiveData.currency !== 'USD');
  const currSym = isForeignCurrency ? `${effectiveData.currency} ` : currencyMode === 'THB' ? '฿' : '$';
  const hasFxRate = typeof currencyRate === 'number' && Number.isFinite(currencyRate) && currencyRate > 0;
  const multiplier = !isForeignCurrency && currencyMode === 'THB' && hasFxRate ? currencyRate : 1;

  // Filter periods based on user selection
  const periodIndices = rawPeriods.map((_, i) => i).filter((i) => {
    if (isAnnualActive) return true;
    const p = rawPeriods[i];
    if (quarterFilter === 'all') return i >= rawPeriods.length - 4;
    return p.includes(quarterFilter);
  });

  const periods = periodIndices.map(i => rawPeriods[i]);

  const normalizeToMillions = (val: number | null | undefined) => val;

  const formatNum = (rawVal: number | null | undefined, isCurrency = true, decimals = 2): string => {
    if (rawVal === null || rawVal === undefined) return '-';
    if (!isCurrency) return rawVal.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    if (!isForeignCurrency && currencyMode === 'THB' && !hasFxRate) return isThai ? 'FX ไม่พร้อม' : 'FX N/A';

    const val = (normalizeToMillions(rawVal) ?? 0);
    const converted = val * multiplier;

    if (Math.abs(converted) >= 1000) {
      return `${(converted / 1000).toFixed(2)}B`;
    }
    return `${converted.toFixed(2)}M`;
  };

  const calculateComparison = (
    values: (number | null | undefined)[],
    metricKey?: string
  ): (number | null)[] => {
    if (values.length === rawPeriods.length) return metricPeriodChanges(metricKey || selectedRowKey, values, rawPeriods, compareMode);
    const aliases: Record<string,string> = {eps:'eps_diluted',opex:'operating_expenses',cash:'cash_and_equivalents',current_assets:'total_current_assets',current_liabilities:'total_current_liabilities',ocf:'operating_cash_flow',icf:'investing_cash_flow',fcf_financing:'financing_cash_flow',net_income_cont:'net_income'};
    const key = aliases[metricKey || ''] || metricKey || '';
    const detailSeries = effectiveData.indicator_details?.[key]?.map(d => d.value);
    const series = detailSeries || [effectiveData.income_statement, effectiveData.balance_sheet, effectiveData.cash_flow]
      .map(section => (section as unknown as Record<string, (number | null)[]>)[key]).find(Array.isArray);
    return series?.length === rawPeriods.length
      ? periodIndices.map(i => metricPeriodChanges(metricKey || selectedRowKey, series, rawPeriods, compareMode)[i])
      : metricPeriodChanges(metricKey || selectedRowKey, values, periods, compareMode);
  };

  const openCalculationDetail = (key: string, pIdx?: number) => {
    const periodIndex = typeof pIdx === 'number' && pIdx >= 0 ? periodIndices[pIdx] ?? 0 : periodIndices[periodIndices.length - 1] ?? 0;
    const detail = getMetricCalculationDetail(key, periodIndex, effectiveData);
    if (detail) {
      setActiveCalcDetail(detail);
      const label = typeof pIdx === 'number' && pIdx >= 0 ? periods[pIdx] : periods[periods.length - 1];
      setActiveCalcPeriod(label || '');
    }
  };

  const income = effectiveData.income_statement;
  const balance = effectiveData.balance_sheet;
  const cashflow = effectiveData.cash_flow;

  const indicatorDetails = calculateVerifiedKeyIndicators(effectiveData);
  const indicatorValues = (key: string) => indicatorDetails[key]?.map(detail => detail.value) || [];
  const grossMarginVals = indicatorDetails['gross_margin'].map(d => d.value);
  const opMarginVals = indicatorDetails['operating_margin'].map(d => d.value);
  const ebitMarginVals = indicatorDetails['ebit_margin'].map(d => d.value);
  const netMarginVals = indicatorDetails['net_margin'].map(d => d.value);
  const ebitdaMarginVals = indicatorDetails['ebitda_margin'].map(d => d.value);
  const taxRateVals = indicatorDetails['tax_rate'].map(d => d.value);
  const currentRatioVals = indicatorDetails['current_ratio'].map(d => d.value);
  const quickRatioVals = indicatorDetails['quick_ratio'].map(d => d.value);
  const debtToEquityVals = indicatorDetails['debt_to_equity'].map(d => d.value);
  const equityRatioVals = indicatorDetails['equity_ratio'].map(d => d.value);
  const debtToAssetVals = indicatorDetails['debt_to_asset'].map(d => d.value);
  const roeVals = indicatorDetails['roe'].map(d => d.value);
  const roaVals = indicatorDetails['roa'].map(d => d.value);
  const roicVals = indicatorDetails['roic'].map(d => d.value);
  const fcfMarginVals = indicatorDetails['fcf_to_sales'].map(d => d.value);
  const fcfToNetIncomeVals = indicatorDetails['fcf_to_net_income'].map(d => d.value);
  const assetTurnoverVals = indicatorDetails['asset_turnover'].map(d => d.value);
  const invTurnoverVals = indicatorDetails['inventory_turnover'].map(d => d.value);
  const dsoVals = indicatorDetails['dso'].map(d => d.value);
  const dioVals = indicatorDetails['dio'].map(d => d.value);
  const dpoVals = indicatorDetails['dpo'].map(d => d.value);
  const cccVals = indicatorDetails['ccc'].map(d => d.value);

  const keyIndicators: KeyIndicatorsData = {
    periods: rawPeriods,
    categories: [
      {
        category_key: 'profitability',
        category_title: isThai ? '1. ความสามารถในการทำกำไร (Profitability)' : 'Profitability',
        metrics: [
          { key: 'gross_margin', name: 'Gross Margin', name_th: 'อัตรากำไรขั้นต้น', category: 'profitability', unit: '%', values: grossMarginVals },
          { key: 'operating_margin', name: 'Operating Margin', name_th: 'อัตรากำไรจากการดำเนินงาน', category: 'profitability', unit: '%', values: opMarginVals },
          { key: 'ebit_margin', name: 'EBIT Margin — unavailable without verified EBIT', name_th: 'อัตรากำไรก่อนดอกเบี้ยและภาษี', category: 'profitability', unit: '%', values: ebitMarginVals },
          { key: 'net_margin', name: 'Net Margin', name_th: 'อัตรากำไรสุทธิ', category: 'profitability', unit: '%', values: netMarginVals },
          { key: 'ebitda_margin', name: 'Derived EBITDA Margin', name_th: 'อัตรากำไรก่อนดอกเบี้ย ภาษี ค่าเสื่อม & ตัดจำหน่าย', category: 'profitability', unit: '%', values: ebitdaMarginVals },
          { key: 'tax_rate', name: 'Effective Tax Rate', name_th: 'อัตราภาษีเงินได้ที่แท้จริง', category: 'profitability', unit: '%', values: taxRateVals }
        ]
      },
      {
        category_key: 'solvency',
        category_title: isThai ? '2. สภาพคล่องและภาระหนี้สิน (Solvency & Leverage)' : 'Solvency & Leverage',
        metrics: [
          { key: 'current_ratio', name: 'Current Ratio', name_th: 'อัตราส่วนสภาพคล่องหมุนเวียน (Current Assets / Current Liabilities)', category: 'solvency', unit: 'x', values: currentRatioVals },
          { key: 'quick_ratio', name: 'Quick Ratio', name_th: 'อัตราส่วนสภาพคล่องหมุนเวียนเร็ว (Quick Assets / Current Liabilities)', category: 'solvency', unit: 'x', values: quickRatioVals },
          { key: 'debt_to_equity', name: 'Debt to Equity Ratio', name_th: 'อัตราส่วนหนี้สินต่อส่วนของผู้ถือหุ้น (D/E)', category: 'solvency', unit: 'x', values: debtToEquityVals },
          { key: 'equity_ratio', name: 'Equity Ratio', name_th: 'อัตราส่วนส่วนของผู้ถือหุ้นต่อสินทรัพย์รวม', category: 'solvency', unit: '%', values: equityRatioVals },
          { key: 'debt_to_asset', name: 'Canonical Debt to Assets', name_th: 'อัตราส่วนหนี้สินรวมต่อสินทรัพย์รวม', category: 'solvency', unit: '%', values: debtToAssetVals }
        ]
      },
      {
        category_key: 'operating_capacity',
        category_title: isThai ? '3. ประสิทธิภาพการดำเนินงาน (Operating Capacity & Returns)' : 'Operating Capacity & Returns',
        metrics: [
          { key: 'roe', name: 'ROE (TTM / Average Equity)', name_th: 'ผลตอบแทนต่อส่วนของผู้ถือหุ้น (TTM)', category: 'operating_capacity', unit: '%', values: roeVals },
          { key: 'roa', name: 'ROA (TTM / Average Assets)', name_th: 'ผลตอบแทนต่อสินทรัพย์รวม (TTM)', category: 'operating_capacity', unit: '%', values: roaVals },
          { key: 'roic', name: 'ROIC (TTM)', name_th: 'ผลตอบแทนจากเงินลงทุนรวม (TTM)', category: 'operating_capacity', unit: '%', values: roicVals },
          { key: 'fcf_to_sales', name: 'FCF to Sales Margin', name_th: 'อัตราส่วนกระแสเงินสดอิสระต่อรายได้', category: 'operating_capacity', unit: '%', values: fcfMarginVals },
          { key: 'fcf_to_net_income', name: 'FCF to Net Income Ratio', name_th: 'สัดส่วนกระแสเงินสดอิสระต่อกำไรสุทธิ (Cash Conversion)', category: 'operating_capacity', unit: '%', values: fcfToNetIncomeVals },
          { key: 'asset_turnover', name: 'Asset Turnover', name_th: 'อัตราหมุนเวียนสินทรัพย์รวม (Asset Turnover)', category: 'operating_capacity', unit: 'x', values: assetTurnoverVals },
          { key: 'inventory_turnover', name: 'Inventory Turnover', name_th: 'อัตราหมุนเวียนสินค้าคงเหลือ', category: 'operating_capacity', unit: 'x', values: invTurnoverVals },
          { key: 'dso', name: 'Days Sales Outstanding (DSO)', name_th: 'ระยะเวลาเก็บหนี้เฉลี่ย (วัน)', category: 'operating_capacity', unit: 'D', values: dsoVals },
          { key: 'dio', name: 'Days Inventory Outstanding (DIO)', name_th: 'ระยะเวลาขายสินค้าเฉลี่ย (วัน)', category: 'operating_capacity', unit: 'D', values: dioVals },
          { key: 'dpo', name: 'DPO (COGS proxy — approximate)', name_th: 'ระยะเวลาชำระหนี้เฉลี่ย (วัน)', category: 'operating_capacity', unit: 'D', values: dpoVals },
          { key: 'ccc', name: 'Cash Conversion Cycle (CCC)', name_th: 'วงจรเงินสดหมุนเวียน (วัน)', category: 'operating_capacity', unit: 'D', values: cccVals }
        ]
      },
      ...(statementTemplate === 'banking' ? [{
        category_key: 'banking_metrics',
        category_title: isThai ? '4. ดัชนีชี้วัดเฉพาะธุรกิจธนาคาร & FinTech (Banking & FinTech Key Metrics)' : '4. Banking & FinTech Metrics',
        metrics: [
          { key: 'nim', name: 'Net Interest Margin (NIM)', name_th: 'อัตราส่วนต่างดอกเบี้ยสุทธิ (NIM %)', category: 'banking_metrics', unit: '%', values: indicatorValues('nim') },
          { key: 'deposit_growth', name: 'Total Deposits', name_th: 'ฐานเงินฝากรวมของลูกค้า ($M)', category: 'banking_metrics', unit: '$', values: indicatorValues('deposit_growth') },
          { key: 'loan_deposit_ratio', name: 'Loan-to-Deposit Ratio (LDR)', name_th: 'อัตราส่วนสินเชื่อต่อเงินฝาก (LDR %)', category: 'banking_metrics', unit: '%', values: indicatorValues('loan_deposit_ratio') },
          { key: 'efficiency_ratio', name: 'Efficiency Ratio (Cost/Income)', name_th: 'อัตราส่วนต้นทุนต่อรายได้ (Efficiency Ratio %)', category: 'banking_metrics', unit: '%', values: indicatorValues('efficiency_ratio') }
        ]
      }] : [])
    ]
  };

  // Balance Sheet Data items (Derived safely from company's real balance sheet)
  const bsItems = {
    total_assets: balance?.total_assets || [],
    current_assets: balance?.total_current_assets || [],
    cash_and_investments: (balance?.cash_and_equivalents || []).map((c, i) => {
      const sti = balance?.short_term_investments?.[i];
      return c !== null && c !== undefined && sti !== null && sti !== undefined ? c + sti : null;
    }),
    cash: balance?.cash_and_equivalents || [],
    short_term_investments: balance?.short_term_investments || [],
    receivables: balance?.receivables || balance?.accounts_receivable || [],
    accounts_receivable: balance?.accounts_receivable || balance?.receivables || [],
    inventory: balance?.inventory || [],
    non_current_assets: (balance?.total_assets || []).map((ta, i) => {
      const ca = balance?.total_current_assets?.[i];
      if (ta !== null && ta !== undefined && ca !== null && ca !== undefined) return ta - ca;
      return null;
    }),
    net_ppe: balance?.net_ppe || [],
    available_for_sale_securities: balance?.available_for_sale_securities || [],
    investment_securities: balance?.investment_securities || balance?.available_for_sale_securities || [],
    loans_held_for_investment: balance?.loans_held_for_investment || [],
    loans_held_for_sale: balance?.loans_held_for_sale || [],
    goodwill: balance?.goodwill || [],
    deposits: balance?.deposits || [],
    total_liabilities: balance?.total_liabilities || [],
    current_liabilities: balance?.total_current_liabilities || [],
    payables: balance?.accounts_payable || balance?.payables || [],
    accounts_payable: balance?.accounts_payable || balance?.payables || [],
    tax_payable: balance?.tax_payable || [],
    short_term_debt: balance?.short_term_debt || [],
    current_deferred_liabilities: balance?.current_deferred_liabilities || [],
    non_current_liabilities: (balance?.total_liabilities || []).map((tl, i) => {
      const cl = balance?.total_current_liabilities?.[i];
      if (tl !== null && tl !== undefined && cl !== null && cl !== undefined) return tl - cl;
      return null;
    }),
    long_term_debt: balance?.long_term_debt || [],
    current_debt_and_finance_leases: balance?.current_debt_and_finance_leases || [],
    noncurrent_debt_and_finance_leases: balance?.noncurrent_debt_and_finance_leases || [],
    finance_lease_liabilities_current: balance?.finance_lease_liabilities_current || [],
    finance_lease_liabilities_non_current: balance?.finance_lease_liabilities_non_current || [],
    long_term_debt_and_finance_leases: balance?.long_term_debt_and_finance_leases || [],
    total_equity: balance?.total_equity || [],
    stockholders_equity: balance?.stockholders_equity || [],
    noncontrolling_interest: balance?.noncontrolling_interest || [],
    redeemable_noncontrolling_interest: balance?.redeemable_noncontrolling_interest || [],
    capital_stock: balance?.capital_stock || [],
    common_stock: balance?.common_stock || [],
    retained_earnings: balance?.retained_earnings || [],
    aoci: balance?.aoci || []
  };

  // Cash Flow Data items (Derived safely from company's real cash flow)
  const cashBasis = effectiveData.verified_dataset?.cashFlowCashBalances?.at(-1)?.basis;
  const cashBasisName = cashBasis === 'CASH_AND_RESTRICTED_CASH_INCLUDING_DISPOSAL_GROUP' ? 'Cash, Cash Equivalents & Restricted Cash Including Disposal Groups' : cashBasis === 'CASH_AND_RESTRICTED_CASH' ? 'Cash, Cash Equivalents & Restricted Cash' : 'Cash on Reported Cash-Flow Basis';
  const cfItems = {
    equity_issuance_proceeds: cashflow?.equity_issuance_proceeds||[],
    dividends_to_noncontrolling_interests: cashflow?.dividends_to_noncontrolling_interests||[],
    ocf: cashflow?.operating_cash_flow || [],
    net_income_cont: income?.net_income || [],
    depreciation: cashflow?.depreciation || [],
    depreciation_amortization_and_impairment: cashflow?.depreciation_amortization_and_impairment || [],
    depreciation_amortization_and_accretion: cashflow?.depreciation_amortization_and_accretion || [],
    debt_issuance: cashflow?.debt_issuance || [],
    debt_repayments: cashflow?.debt_repayments || [],
    finance_lease_payments: cashflow?.finance_lease_payments || [],
    distributions_to_noncontrolling_interests: cashflow?.distributions_to_noncontrolling_interests || [],
    distributions_to_noncontrolling_and_redeemable_interests: cashflow?.distributions_to_noncontrolling_and_redeemable_interests || [],
    stock_based_compensation: cashflow?.stock_based_compensation || [],
    non_cash_items: cashflow?.non_cash_items || [],
    change_working_capital: cashflow?.change_working_capital || [],
    change_receivables: verifiedMetricSeries(effectiveData,'change_receivables',rawPeriods),
    change_inventory: verifiedMetricSeries(effectiveData,'change_inventory',rawPeriods),
    change_payables: verifiedMetricSeries(effectiveData,'change_payables',rawPeriods),
    change_other_ca: cashflow?.change_other_ca || [],
    change_other_cl: cashflow?.change_other_cl || [],
    icf: cashflow?.investing_cash_flow || [],
    capex: (cashflow?.capex || []).map(c => c !== null && c !== undefined ? -Math.abs(c) : null),
    investment_purchase: cashflow?.investment_purchase || [],
    other_investing: cashflow?.other_investing || [],
    fcf_financing: cashflow?.financing_cash_flow || [],
    debt_issuance_payments: cashflow?.debt_issuance_payments || [],
    issuance_of_common_stock: cashflow?.issuance_of_common_stock || [],
    repurchase_of_common_stock: cashflow?.repurchase_of_common_stock || [],
    option_exercise_proceeds: cashflow?.option_exercise_proceeds || [],
    equity_compensation_and_option_proceeds: cashflow?.equity_compensation_and_option_proceeds || [],
    dividends_paid: cashflow?.dividends_paid || [],
    other_financing: cashflow?.other_financing || [],
    change_in_deposits: cashflow?.change_in_deposits || [],
    change_in_loans_held_for_sale: cashflow?.change_in_loans_held_for_sale || [],
    provision_addback: cashflow?.provision_addback || [],
    ending_cash: cashflow?.ending_cash || [],
    net_change_cash: cashflow?.net_change_cash || [],
    beginning_cash: cashflow?.beginning_cash || [],
    free_cash_flow: cashflow?.free_cash_flow || (cashflow?.operating_cash_flow || []).map((ocf, i) => {
      const c = cashflow?.capex?.[i];
      if (ocf !== null && ocf !== undefined && c !== null && c !== undefined) return ocf - Math.abs(c);
      return null;
    })
  };

  // Build active line items map for synchronous top chart
  const getActiveChartConfig = () => {
    if (statementTab === 'indicators') {
      const allMetrics = keyIndicators.categories.flatMap(c => c.metrics);
      const m = allMetrics.find(x => x.key === selectedRowKey) || allMetrics[0];
      const filteredVals = periodIndices.map(i => m.values[i] !== undefined ? m.values[i] : null);
      const indThMap: Record<string, string> = {
        gross_margin: 'อัตรากำไรขั้นต้น (Gross Margin %)',
        operating_margin: 'อัตรากำไรจากการดำเนินงาน (Operating Margin %)',
        net_margin: 'อัตรากำไรสุทธิ (Net Margin %)',
        ebitda_margin: 'อัตราส่วน EBITDA Margin (%)',
        tax_rate: 'อัตราภาษีที่แท้จริง (Effective Tax Rate %)',
        current_ratio: 'อัตราส่วนทุนหมุนเวียน (Current Ratio)',
        quick_ratio: 'อัตราส่วนสภาพคล่องเร็ว (Quick Ratio)',
        debt_to_equity: 'อัตราส่วนหนี้สินต่อทุน (D/E Ratio)',
        equity_ratio: 'สัดส่วนส่วนของผู้ถือหุ้น (Equity Ratio %)',
        roe: 'ผลตอบแทนต่อส่วนของผู้ถือหุ้น (ROE %)',
        roa: 'ผลตอบแทนต่อสินทรัพย์รวม (ROA %)',
        asset_turnover: 'อัตราหมุนเวียนสินทรัพย์ (Asset Turnover)',
        inventory_turnover: 'อัตราหมุนเวียนสินค้าคงเหลือ (Inventory Turnover)',
        dso: 'ระยะเวลาเก็บหนี้เฉลี่ย (DSO - Days)',
        dio: 'ระยะเวลาขายสินค้าเฉลี่ย (DIO - Days)',
        dpo: 'ระยะเวลาชำระหนี้เฉลี่ย (DPO - Days)',
        ccc: 'วงจรเงินสด (Cash Conversion Cycle - CCC)'
      };
      return {
        title: m.name,
        title_th: indThMap[m.key] || m.name,
        categoryLabel: isThai ? 'ดัชนีชี้วัดสำคัญ (Key Indicators)' : 'Key Indicators',
        unit: m.unit,
        isCurrency: false,
        periods: periods,
        values: filteredVals,
        yoy_pcts: calculateComparison(filteredVals, m.key)
      };
    }

    if (statementTab === 'income' && income) {
      const rowMap: Record<string, { en: string; th: string; raw: (number | null | undefined)[]; isCurrency?: boolean; unit?: string }> = {
        revenue: { en: statementTemplate === 'banking' ? 'Total Net Revenue (Interest + Non-Interest)' : 'Total Revenue as Reported', th: statementTemplate === 'banking' ? 'รายได้รวมสุทธิ (ดอกเบี้ยสุทธิ + ค่าธรรมเนียม)' : 'รายได้รวมตามรายงาน', raw: income.revenue || [], isCurrency: true },
        net_interest_income: { en: 'Net Interest Income (NII)', th: 'รายได้ดอกเบี้ยสุทธิ (NII)', raw: income.net_interest_income || [], isCurrency: true },
        non_interest_income: { en: 'Non-Interest Income (Fee & Services)', th: 'รายได้ที่มิใช่ดอกเบี้ย (ค่าธรรมเนียม)', raw: income.non_interest_income || [], isCurrency: true },
        provision_for_credit_losses: { en: 'Provision for Credit Losses', th: 'ผลขาดทุนด้านเครดิตที่คาดว่าจะเกิดขึ้น', raw: (income.provision_for_credit_losses || []).map(p => p !== null && p !== undefined ? -Math.abs(p) : null), isCurrency: true },
        operating_income: { en: 'Operating Income', th: 'กำไรจากการดำเนินงาน', raw: income.operating_income || [], isCurrency: true },
        interest_income: {en:'Interest Income (Reported Scope)',th:'รายได้ดอกเบี้ยตามขอบเขตที่รายงาน',raw:income.interest_income||[],isCurrency:true},
        interest_expense: {en:'Interest Expense',th:'ค่าใช้จ่ายดอกเบี้ย',raw:income.interest_expense||[],isCurrency:true},
        gross_profit: { en: 'Gross Profit', th: 'กำไรขั้นต้น', raw: income.gross_profit || [], isCurrency: true },
        net_income: { en: 'Total Net Income', th: 'กำไรสุทธิรวม', raw: income.net_income || [], isCurrency: true },
        net_income_parent: { en: 'Net Income Attributable to Parent', th: 'กำไรสุทธิที่เป็นของบริษัทใหญ่', raw: income.net_income_parent || [], isCurrency: true },
        net_income_common: { en: 'Net Income Available to Common Stockholders', th: 'กำไรสุทธิของผู้ถือหุ้นสามัญ', raw: income.net_income_common || [], isCurrency: true },
        eps: { en: 'Diluted EPS', th: 'กำไรต่อหุ้นปรับลด', raw: income.eps_diluted || [], isCurrency: false, unit: ` ${effectiveData.currency||'USD'}/share` },
        cogs: { en: 'Cost of Revenue', th: 'ต้นทุนขายและบริการ', raw: income.cogs || [], isCurrency: true },
        opex: { en: statementTemplate === 'banking' ? 'Non-Interest Expense (Operating Expense)' : 'Operating Expense (OPEX)', th: statementTemplate === 'banking' ? 'ค่าใช้จ่ายในการดำเนินงาน (เทคโนโลยี/บริหาร)' : 'ค่าใช้จ่ายในการดำเนินงาน (OPEX)', raw: income.operating_expenses || [], isCurrency: true },
        other_income: { en: 'Other Income (Expense), Net', th: 'รายได้ (ค่าใช้จ่าย) อื่นสุทธิ', raw: income.other_income || [], isCurrency: true }
      };

      const selected = rowMap[selectedRowKey] || {en:selectedRowKey.replace(/_/g,' '),th:selectedRowKey.replace(/_/g,' '),raw:[],isCurrency:true};
      const filteredRaw = periodIndices.map(i => selected.raw[i] !== undefined ? selected.raw[i] : null);
      return {
        title: selected.en,
        title_th: selected.th,
        categoryLabel: isThai ? 'งบกำไรขาดทุน (Income Statement)' : 'Income Statement',
        unit: selected.unit || (selected.isCurrency ? '$' : ''),
        isCurrency: selected.isCurrency,
        periods: periods,
        values: filteredRaw.map(v => normalizeToMillions(v) ?? null),
        yoy_pcts: calculateComparison(filteredRaw, selectedRowKey)
      };
    }

    if (statementTab === 'balance') {
      const bsTitles: Record<string, { en: string; th: string }> = {
        total_assets: { en: 'Total Assets', th: 'สินทรัพย์รวม' },
        current_assets: { en: 'Total Current Assets', th: 'สินทรัพย์หมุนเวียนรวม' },
        cash_and_investments: { en: 'Cash & Short-Term Investments', th: 'เงินสดและเงินลงทุนระยะสั้น' },
        cash: { en: 'Cash and Cash Equivalents', th: 'เงินสดและรายการเทียบเท่าเงินสด' },
        short_term_investments: { en: 'Short Term Investments', th: 'เงินลงทุนระยะสั้น' },
        investment_securities: { en: 'Investment Securities', th: 'เงินลงทุนในหลักทรัพย์' },
        loans_held_for_investment: { en: 'Loans Held for Investment (Net)', th: 'เงินให้สินเชื่อเพื่อการลงทุน (สุทธิ)' },
        loans_held_for_sale: { en: 'Loans Held for Sale', th: 'เงินให้สินเชื่อเพื่อการค้า/ขาย' },
        receivables: { en: 'Receivables', th: 'ลูกหนี้การค้าและลูกหนี้อื่น' },
        accounts_receivable: { en: 'Accounts Receivable', th: 'ลูกหนี้การค้า' },
        inventory: { en: 'Inventory', th: 'สินค้าคงเหลือ' },
        non_current_assets: { en: 'Total Non-Current Assets', th: 'สินทรัพย์ไม่หมุนเวียนรวม' },
        net_ppe: { en: 'Net PPE', th: 'ที่ดิน อาคาร และอุปกรณ์สุทธิ' },
        available_for_sale_securities: { en: 'Available for Sale Securities', th: 'หลักทรัพย์เผื่อขาย / เงินลงทุนระยะยาว' },
        goodwill: { en: 'Goodwill', th: 'ค่าความนิยม' },
        total_liabilities: { en: 'Total Liabilities', th: 'หนี้สินรวม' },
        deposits: { en: '⚠️ Total Deposits (Interest & Non-Interest Bearing)', th: 'เงินฝากรวมของลูกค้า (ภาระผูกพันหลักของธนาคาร)' },
        current_liabilities: { en: 'Total Current Liabilities', th: 'หนี้สินหมุนเวียนรวม' },
        payables: { en: 'Payables', th: 'เจ้าหนี้การค้าและค่าใช้จ่ายค้างจ่าย' },
        accounts_payable: { en: 'Accounts Payable', th: 'เจ้าหนี้การค้า' },
        tax_payable: { en: 'Total Tax Payable', th: 'ภาษีเงินได้ค้างจ่าย' },
        current_debt_and_finance_leases: {en:'Current Debt & Finance Leases',th:'หนี้สินระยะสั้นรวมสัญญาเช่าการเงิน'},
        noncurrent_debt_and_finance_leases: {en:'Noncurrent Debt & Finance Leases',th:'หนี้สินระยะยาวรวมสัญญาเช่าการเงิน'},
        finance_lease_liabilities_current: {en:'Current Finance Lease Liability',th:'หนี้สินสัญญาเช่าการเงินระยะสั้น'},
        finance_lease_liabilities_non_current: {en:'Noncurrent Finance Lease Liability',th:'หนี้สินสัญญาเช่าการเงินระยะยาว'},
        short_term_debt: { en: 'Current Debt', th: 'หนี้สินทางการเงินระยะสั้น' },
        current_deferred_liabilities: { en: 'Current Deferred Liabilities', th: 'หนี้สินรอการรับรู้ระยะสั้น / รายได้รับล่วงหน้า' },
        non_current_liabilities: { en: 'Total Non-Current Liabilities', th: 'หนี้สินไม่หมุนเวียนรวม' },
        long_term_debt: { en: 'Long-Term Debt', th: 'หนี้สินทางการเงินระยะยาว' },
        long_term_debt_and_finance_leases: { en: 'Long-Term Debt and Finance Leases', th: 'หนี้สินระยะยาวรวมสัญญาเช่าการเงิน' },
        total_equity: { en: 'Equity Including Noncontrolling Interests', th: 'ส่วนของผู้ถือหุ้นรวมส่วนได้เสียที่ไม่มีอำนาจควบคุม' },
        capital_stock: { en: 'Capital Stock', th: 'ทุนเรือนหุ้น' },
        common_stock: { en: 'Common Stock', th: 'หุ้นสามัญ' },
        retained_earnings: { en: 'Retained Earnings', th: 'กำไรสะสม' },
        aoci: { en: 'Accumulated Other Comprehensive Income (AOCI)', th: 'กำไร/ขาดทุนเบ็ดเสร็จอื่นสะสม (AOCI)' }
      };

      const raw = bsItems[selectedRowKey as keyof typeof bsItems] || [];
      const filteredRaw = periodIndices.map(i => raw[i] !== undefined ? raw[i] : null);
      const titleObj = bsTitles[selectedRowKey] || {en:selectedRowKey.replace(/_/g,' '),th:selectedRowKey.replace(/_/g,' ')};
      return {
        title: titleObj.en,
        title_th: titleObj.th,
        categoryLabel: isThai ? 'งบดุล (Balance Sheet)' : 'Balance Sheet',
        unit: '$',
        isCurrency: true,
        periods: periods,
        values: filteredRaw.map(v => normalizeToMillions(v) ?? null),
        yoy_pcts: calculateComparison(filteredRaw, selectedRowKey)
      };
    }

    if (statementTab === 'cashflow') {
      const cfTitles: Record<string, { en: string; th: string }> = {
        ocf: { en: 'Operating Cash Flow', th: 'กระแสเงินสดจากการดำเนินงาน (OCF)' },
        net_income_cont: { en: 'Total Net Income', th: 'กำไรสุทธิรวม' },
        provision_addback: { en: 'Provision for Credit Losses (Add-back)', th: 'บวกกลับสำรองหนี้สูญและผลขาดทุนด้านเครดิต' },
        depreciation_amortization_and_impairment: {en:'Depreciation, Amortization & Impairment',th:'ค่าเสื่อมราคา ค่าตัดจำหน่าย และด้อยค่า'},
        depreciation_amortization_and_accretion: {en:'Depreciation, Amortization & Accretion',th:'ค่าเสื่อมราคา ค่าตัดจำหน่าย และ accretion'},
        equity_issuance_proceeds:{en:'Equity Issuance Proceeds (Broad Reported Basis)',th:'เงินสดออกหุ้นตามนิยามกว้างของแหล่งข้อมูล'},
        dividends_to_noncontrolling_interests:{en:'Dividends to Noncontrolling Interests',th:'เงินปันผลจ่าย NCI'},
        debt_issuance: {en:'Debt Issuance Proceeds',th:'เงินสดจากการออกหนี้'},
        debt_repayments: {en:'Debt Repayments',th:'เงินสดจ่ายคืนหนี้'},
        finance_lease_payments: {en:'Finance Lease Principal Payments',th:'เงินสดจ่ายคืนหนี้สัญญาเช่าการเงิน'},
        distributions_to_noncontrolling_and_redeemable_interests: {en:'Distributions to NCI & Redeemable Interests',th:'เงินสดจ่าย NCI รวมส่วนที่ไถ่ถอนได้'},
        distributions_to_noncontrolling_interests: {en:'Distributions to Noncontrolling Interests',th:'เงินสดจ่ายส่วนได้เสียที่ไม่มีอำนาจควบคุม'},
        depreciation: { en: 'Depreciation & Depletion & Amortization', th: 'ค่าเสื่อมราคาและค่าตัดจำหน่าย' },
        stock_based_compensation: { en: 'Stock-Based Compensation (SBC)', th: 'ค่าตอบแทนในรูปหุ้น (Stock-Based Compensation)' },
        non_cash_items: { en: 'Other Non-Cash Items', th: 'รายการที่ไม่ใช่เงินสดอื่นๆ' },
        change_working_capital: { en: 'Change in Working Capital', th: 'การเปลี่ยนแปลงในเงินทุนหมุนเวียน' },
        change_in_loans_held_for_sale: { en: '⚠️ Change in Loans Held for Sale (Originations vs Sales)', th: 'การเปลี่ยนแปลงในเงินให้สินเชื่อเพื่อการค้า/ขาย (ตัวแปรหลักฉุด/ดัน OCF)' },
        change_receivables: { en: 'Change in Receivables', th: 'การเปลี่ยนแปลงในลูกหนี้การค้า' },
        change_inventory: { en: 'Change in Inventory', th: 'การเปลี่ยนแปลงในสินค้าคงเหลือ' },
        change_payables: { en: 'Change in Payables and Accrued Expense', th: 'การเปลี่ยนแปลงในเจ้าหนี้การค้าและค่าใช้จ่ายค้างจ่าย' },
        change_other_ca: { en: 'Change in Other Current Assets', th: 'การเปลี่ยนแปลงในสินทรัพย์หมุนเวียนอื่น' },
        change_other_cl: { en: 'Change in Other Current Liabilities', th: 'การเปลี่ยนแปลงในหนี้สินหมุนเวียนอื่น' },
        icf: { en: 'Net Cash from Investing Activities', th: 'กระแสเงินสดสุทธิจากกิจกรรมลงทุน (ICF)' },
        capex: { en: 'Capital Expenditures (CapEx)', th: 'รายจ่ายฝ่ายทุน (CapEx)' },
        investment_purchase: { en: 'Net Investment Purchase and Sale', th: 'เงินสดสุทธิซื้อ/ขายเงินลงทุน' },
        other_investing: { en: 'Net Other Investing Changes', th: 'การเปลี่ยนแปลงอื่นๆ ในกิจกรรมลงทุน' },
        fcf_financing: { en: 'Financing Cash Flow', th: 'กระแสเงินสดจากกิจกรรมจัดหาเงิน' },
        change_in_deposits: { en: '⚠️ Change in Customer Deposits', th: 'การเปลี่ยนแปลงสุทธิในเงินฝากลูกค้า (เงินฝากไหลเข้า/ออก)' },
        debt_issuance_payments: { en: 'Net Issuance Payments Of Debt', th: 'เงินสดสุทธิจากการกู้ยืม/ชำระคืนหนี้' },
        issuance_of_common_stock: { en: 'Common Stock Issuance Proceeds', th: 'เงินสดจากการออกหุ้นสามัญ' },
        repurchase_of_common_stock: { en: 'Common Stock Repurchases', th: 'เงินสดจ่ายซื้อหุ้นสามัญคืน' },
        equity_compensation_and_option_proceeds: {en:'Stock Option Exercises & Other Stock Issuance Proceeds',th:'เงินรับจากการใช้สิทธิหุ้นและการออกหุ้นอื่น'},
        option_exercise_proceeds: { en: 'Stock Option Exercise Proceeds', th: 'เงินสดจากการใช้สิทธิซื้อหุ้น' },
        dividends_paid: { en: 'Cash Dividends Paid', th: 'เงินปันผลจ่าย' },
        other_financing: { en: 'Net Other Financing Charges', th: 'ค่าใช้จ่ายและรายการอื่นจากกิจกรรมจัดหาเงิน' },
        ending_cash: { en: 'Ending ' + cashBasisName, th: 'เงินสดคงเหลือปลายงวด' },
        net_change_cash: { en: 'Net Change in Cash', th: 'การเปลี่ยนแปลงสุทธิในเงินสด' },
        beginning_cash: { en: 'Beginning ' + cashBasisName, th: 'เงินสดคงเหลือต้นงวด' },
        free_cash_flow: { en: 'Free Cash Flow', th: 'กระแสเงินสดอิสระ (FCF = OCF - CapEx)' }
      };

      const raw = cfItems[selectedRowKey as keyof typeof cfItems] || [];
      const filteredRaw = periodIndices.map(i => raw[i] !== undefined ? raw[i] : null);
      const titleObj = cfTitles[selectedRowKey] || {en:selectedRowKey.replace(/_/g,' '),th:selectedRowKey.replace(/_/g,' ')};
      return {
        title: titleObj.en,
        title_th: titleObj.th,
        categoryLabel: isThai ? 'งบกระแสเงินสด (Cash Flow Statement)' : 'Cash Flow Statement',
        unit: '$',
        isCurrency: true,
        periods: periods,
        values: filteredRaw.map(v => normalizeToMillions(v) ?? null),
        yoy_pcts: calculateComparison(filteredRaw, selectedRowKey)
      };
    }

    return {
      title: 'Total Revenue as Reported',
      title_th: 'รายได้รวมตามรายงาน',
      categoryLabel: isThai ? 'งบกำไรขาดทุน (Income Statement)' : 'Income Statement',
      unit: '$',
      isCurrency: true,
      periods: periods,
      values: (income?.revenue || []).map(v => normalizeToMillions(v) ?? null),
      yoy_pcts: calculateComparison(income?.revenue || [], 'revenue')
    };
  };

  const chartConfig = getActiveChartConfig();
  const chartLabel = STATEMENT_SEMANTIC_LABELS[selectedRowKey];
  if (chartLabel) { chartConfig.title = chartLabel.en; chartConfig.title_th = chartLabel.th; }
  const hideParentIncomeAlias = commonParentIncomeAlias(effectiveData, periods);
  const selectedMetric = React.useMemo(() => selectFinancialMetric(effectiveData, selectedRowKey, periods, compareMode), [effectiveData, selectedRowKey, periods.join('|'), compareMode]);
  chartConfig.values = selectedMetric.values;
  chartConfig.yoy_pcts = selectedMetric.changes;
  const selectedCacheKey = analystCacheKey(ticker, selectedMetric, isThai);
  const hasValidPoints = chartConfig.values.some(v => v !== null && v !== undefined && !Number.isNaN(v));

  const getMetricGapExplanation = (metricKey: string): string => {
    if (statementTemplate === 'banking' && (metricKey === 'gross_margin' || metricKey === 'cogs')) {
      return getDataGapExplanation('NOT_REPORTED', isThai).text;
    }
    if (statementTemplate === 'banking' && metricKey === 'inventory_turnover') {
      return getDataGapExplanation('NOT_APPLICABLE', isThai).text;
    }
    const gap = (data as any)?.data_completeness?.gaps?.find((g: any) => g.fieldKey === metricKey);
    if (gap?.currentStatus) {
      return getDataGapExplanation(gap.currentStatus, isThai).text;
    }
    return getDataGapExplanation('NOT_FOUND_YET', isThai).text;
  };
  const chartData = chartConfig.periods.map((p, idx) => ({
    period: p,
    value: chartConfig.values[idx] !== undefined ? chartConfig.values[idx] : null,
    yoy_pct: chartConfig.yoy_pcts && chartConfig.yoy_pcts[idx] !== undefined ? chartConfig.yoy_pcts[idx] : null
  }));

  // The selected metric owns context, cache identity and asynchronous results.
  useEffect(() => {
    const token = requestSequence.current.next();
    const controller = new AbortController();
    setIsAiAnalyzing(false);
    if (!ticker.trim() || !selectedMetric.dataQuality.eligibleForAi || liveAiInsights[selectedCacheKey])
      return () => { controller.abort(); requestSequence.current.invalidate(); };
    const requestId = crypto.randomUUID();
    activeMetricRequest.current = { requestId, cacheKey: selectedCacheKey };
    const context = getMetricInterpretationContext({metricKey: selectedMetric.metricKey, metricName: chartConfig.title,
      metricNameTh: chartConfig.title_th, reportData: effectiveData, ticker, periods: selectedMetric.periods,
      historyValues: selectedMetric.values, yoyPcts: selectedMetric.changes, unit: selectedMetric.definition?.unit,
      isCurrency: chartConfig.isCurrency, isThai, isSourceReconciled: selectedMetric.dataQuality.currentVerified});
    const fetchInsight = async () => {
      try {
        const result = await fetchMetricAi(selectedMetric, context, { requestId, ticker, companyName, isThai, compareMode,
          signal: controller.signal, fetcher: authenticatedFetch,
          isCurrent: () => requestSequence.current.accepts(token) && activeMetricRequest.current?.requestId === requestId,
          onRequest: () => setIsAiAnalyzing(true),
          diagnostic: process.env.NODE_ENV !== 'production' ? metadata => console.info('[metric-ai-client]', metadata) : undefined });
        if (!requestSequence.current.accepts(token) || controller.signal.aborted) return;
        if (result.insight) setLiveAiInsights(prev => ({...prev, [selectedCacheKey]: result.insight!}));
        else if (result.reason) setAnalystFailures(prev => ({...prev, [selectedCacheKey]: result.reason!}));
      } finally {
        if (requestSequence.current.accepts(token)) setIsAiAnalyzing(false);
      }
    };
    void fetchInsight();
    return () => { controller.abort(); requestSequence.current.invalidate(); if (activeMetricRequest.current?.requestId === requestId) activeMetricRequest.current = null; };
  }, [ticker, companyName, effectiveData, selectedCacheKey, compareMode]);

  const cellProvenance = (key: string, i: number) => {
    const snapshot = effectiveData.period_snapshots?.[i];
    const aliases: Record<string,string>={cash:'cash_and_equivalents',current_assets:'total_current_assets',current_liabilities:'total_current_liabilities',ocf:'operating_cash_flow',icf:'investing_cash_flow',fcf_financing:'financing_cash_flow',net_income_cont:'net_income',opex:'operating_expenses',eps:'eps_diluted'};
    const observation = Object.values(snapshot?.observations || {}).find(o => o.metric === (aliases[key]||key));
    if(['change_receivables','change_inventory','change_payables'].includes(key)&&observation?.valueSemantic!=='CASH_FLOW_EFFECT')
      return 'Unavailable — cash-flow sign semantics are not verified in this saved observation; refresh the authoritative source. No balance movement is substituted.';
    const indicator = indicatorDetails[key]?.[i];
    const canonicalKey=selectedMetric.definition?.key===key?selectedMetric.definition.canonicalKey:aliases[key]||key;
    const audit=effectiveData.verified_dataset?.completionAudit?.find(a=>a.metric.split('.')[1]===canonicalKey&&a.period===snapshot?.label);
    const cashBalance=['beginning_cash','ending_cash'].includes(key)&&effectiveData.verified_dataset?.cashFlowCashBalances?.find(b=>b.period===snapshot?.label);
    if(cashBalance) {
      const source=key==='beginning_cash'?cashBalance.beginningSource:cashBalance.endingSource;
      return [snapshot?.label,'instant',source.periodEnd,cashBalance.startDate,cashBalance.endDate,
        cashBalance.basis==='CASH_AND_RESTRICTED_CASH_INCLUDING_DISPOSAL_GROUP'
          ? 'us-gaap:CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsIncludingDisposalGroupAndDiscontinuedOperations'
          : 'us-gaap:CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents',
        cashBalance.basis,source.documentType,source.filingDate,source.documentUrl,'USD → million USD; cash-flow reconciliation scope'].filter(Boolean).join(' · ');
    }
    return indicator ? [indicator.status, indicator.basis, indicator.formula, ...indicator.sourceUrls].join(' · ')
      : observation ? [snapshot?.label, observation.periodStart, observation.periodEnd, observation.concept,
        observation.source?.documentType, observation.source?.filingDate, observation.periodType,
        observation.sourceUnit || observation.unit, observation.unit, observation.verification, observation.valueSemantic,
        key === 'net_income_common' && hideParentIncomeAlias ? 'Source alias: Net Income Attributable to Parent' : undefined,
        key === 'aoci' ? 'Certain gains/losses accumulated in equity outside net income; not retained earnings.' : undefined,
        observation.source?.documentUrl, observation.derivation].filter(Boolean).join(' · ')
      : audit?`${audit.reasonCode} · ${audit.sourcePathsAttempted.join(' · ')}`:'Unavailable — no compatible verified observation';
  };

  const renderGenericRow = (
    key: string,
    title: string,
    rawValues: (number | null | undefined)[],
    isGroup = false,
    indent = 0,
    title_th?: string
  ) => {
    const semanticLabel = STATEMENT_SEMANTIC_LABELS[key];
    if (semanticLabel) { title = semanticLabel.en; title_th = semanticLabel.th; }
    const isSelected = selectedRowKey === key;
    const values = periodIndices.map(i => rawValues[i] !== undefined ? rawValues[i] : null);
    const comparisonList = calculateComparison(values, key);
    const hasCalc = Boolean(getMetricCalculationDetail(key, 0, effectiveData));
    return (
      <tr
        key={key}
        onClick={() => setSelectedRowKey(key)}
        className={`transition-colors cursor-pointer ${isSelected
            ? 'bg-stone-100/90 font-bold text-stone-950 border-l-4 border-l-[#0b5a4b]'
            : isGroup
              ? 'bg-stone-50/60 font-bold text-stone-900 hover:bg-stone-100/70'
              : 'hover:bg-stone-50/60 text-stone-800'
          }`}
      >
        <td
          className={`py-2.5 px-4 sticky left-0 bg-inherit z-10 shadow-xs ${indent === 1 ? 'pl-8' : indent === 2 ? 'pl-12' : ''
            }`}
        >
          <div className="flex items-start gap-2">
            <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isSelected ? 'bg-[#0b5a4b]' : indent > 0 ? 'bg-transparent' : 'bg-stone-300'}`} />
            <div>
              <div className={`leading-snug flex items-center gap-1.5 flex-wrap ${isGroup ? 'font-bold text-stone-900' : indent === 1 ? 'font-semibold text-stone-800' : 'text-stone-700'}`}>
                <span>{indent > 0 ? `— ${title}` : title}</span>
                {hasCalc && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openCalculationDetail(key, periods.length - 1);
                    }}
                    className="p-1 rounded-md text-stone-400 hover:text-[#0b5a4b] hover:bg-emerald-50 transition-colors cursor-pointer"
                    title={isThai ? 'ดูสูตรและวิธีคำนวณ' : 'View calculation formula and inputs'}
                    aria-label={`View formula for ${title}`}
                  >
                    <Calculator className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {title_th && (
                <div className={`text-[11px] font-normal text-stone-500 font-sans mt-0.5 ${indent > 0 ? 'pl-3' : ''}`}>
                  {title_th}
                </div>
              )}
            </div>
          </div>
        </td>
        {periods.map((_, idx) => {
          const val = values[idx];
          const comp = comparisonList[idx];
          return (
            <td key={idx} className="py-2.5 px-3 text-right" title={cellProvenance(key, periodIndices[idx])}>
              <div className="font-mono text-stone-900 font-bold">
                {val !== null && val !== undefined ? /^change_(receivables|inventory|payables)$/.test(key) ? formatWorkingCapitalCashEffect(val) : formatNum(val) : '-'}
              </div>
              {compareMode !== 'hide' && comp !== null && (
                <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${metricDeltaTone(key, comp)}`}>
                  <span>{formatMetricChange(key, comp)}</span>
                  <span className="text-[8px] text-stone-400 font-sans uppercase font-medium">({compareMode})</span>
                </div>
              )}
            </td>
          );
        })}
      </tr>
    );
  };

  const deadlines = rawPeriods.map((_, i) => effectiveData.period_snapshots?.[i]?.endDate || 'Unavailable');

  return (
    <div className="flex flex-col gap-6 w-full print:block print:overflow-visible">
      {/* Top Main Container */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden flex flex-col print:block print:overflow-visible">
        {/* Header Tabs: Key Indicators | Income Statement | Balance Sheet | Cash Flow */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 sm:p-5 border-b border-stone-200 bg-stone-50/70">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 p-1 bg-stone-200/60 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setStatementTab('indicators');
                setSelectedRowKey('gross_margin');
              }}
              className={`py-2 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all text-center cursor-pointer ${statementTab === 'indicators'
                  ? 'bg-[#0b5a4b] text-white shadow-sm'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
                }`}
            >
              {isThai ? 'ดัชนีชี้วัดสำคัญ' : 'Key Indicators'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStatementTab('income');
                setSelectedRowKey('revenue');
              }}
              className={`py-2 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all text-center cursor-pointer ${statementTab === 'income'
                  ? 'bg-[#0b5a4b] text-white shadow-sm'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
                }`}
            >
              {isThai ? 'งบกำไรขาดทุน' : 'Income Statement'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStatementTab('balance');
                setSelectedRowKey('total_assets');
              }}
              className={`py-2 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all text-center cursor-pointer ${statementTab === 'balance'
                  ? 'bg-[#0b5a4b] text-white shadow-sm'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
                }`}
            >
              {isThai ? 'งบดุล' : 'Balance Sheet'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStatementTab('cashflow');
                setSelectedRowKey('ocf');
              }}
              className={`py-2 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all text-center cursor-pointer ${statementTab === 'cashflow'
                  ? 'bg-[#0b5a4b] text-white shadow-sm'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
                }`}
            >
              {isThai ? 'งบกระแสเงินสด' : 'Cash Flow'}
            </button>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto flex-wrap">
            {rawPeriods.length > 0 && (
              <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{isThai ? `งบการเงินล่าสุด: ${rawPeriods[rawPeriods.length - 1]}` : `Latest Period: ${rawPeriods[rawPeriods.length - 1]}`}</span>
              </span>
            )}
            <span className="text-xs text-stone-500 font-mono">
              {isThai ? 'สกุลเงิน:' : 'Currency:'} <strong className="text-stone-800">{isForeignCurrency ? effectiveData.currency : currencyMode}</strong>
            </span>
          </div>
        </div>

        {/* Sector Template & Statement Audit Strip */}
        <div className="px-4 sm:px-6 py-3 bg-stone-50/90 border-b border-stone-200 flex items-center justify-between gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            {data.source?.document_url ? (
              <a
                href={data.source.document_url}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 rounded-xl bg-sky-50 text-sky-800 border border-sky-200 font-medium hover:bg-sky-100"
              >
                {isThai
                  ? `แหล่งงบ: ${data.source.document_type || 'เอกสารต้นทาง'}${data.source.period_end ? ` · สิ้นงวด ${data.source.period_end}` : ''}`
                  : `Statement source: ${data.source.document_type || 'primary filing'}${data.source.period_end ? ` · period ended ${data.source.period_end}` : ''}`}
              </a>
            ) : (
              <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                {isThai ? 'ยังไม่มีลิงก์เอกสารต้นทาง: ตัวเลขนี้ยังไม่ยืนยันกับ filing' : 'No primary filing link: figures are not filing-verified'}
              </span>
            )}
            {/* Sector Template Badge */}
            {data.source?.filing_date && <span className="text-stone-600">{isThai ? 'วันที่ยื่นงบ:' : 'Filed:'} {data.source.filing_date}</span>}
            <span className="px-2.5 py-1 rounded-xl bg-stone-900 text-white font-medium flex items-center gap-1.5 shadow-2xs">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {statementTemplate === 'banking' && (isThai ? '🏦 สถาบันการเงิน / Fintech (NII · Deposits · Credit Reserves)' : '🏦 Banking / Fintech Template (NII · Deposits · Loan Reserves)')}
                {statementTemplate === 'insurance' && (isThai ? '🛡️ ประกันภัย (Premiums · Claims · Loss Reserves)' : '🛡️ Insurance Template (Premiums · Loss Reserves)')}
                {statementTemplate === 'reit' && (isThai ? '🏢 ทรัสต์เพื่อการลงทุนในอสังหาฯ (NOI · FFO · AFFO)' : '🏢 REITs Template (Rental · NOI · FFO/AFFO)')}
                {statementTemplate === 'cyclical' && (isThai ? '⚡ พลังงาน / สินค้าโภคภัณฑ์ / สายการบิน (Cyclical & FCF)' : '⚡ Cyclical / Energy / Airlines Template')}
                {statementTemplate === 'biotech' && (isThai ? '🧬 ไบโอเทค / เติบโตช่วงเริ่มต้น (Cash Runway · R&D)' : '🧬 Biotech & Pre-Revenue Growth Template')}
                {statementTemplate === 'standard' && (isThai ? '🏭 บริษัทผลิตและบริการมาตรฐาน (COGS · Gross Margin)' : '🏭 Standard Corporate Template (COGS · Gross Margin)')}
              </span>
            </span>

            {/* Balance Sheet Identity Badge */}
            {validation && (
              <span className={`px-2.5 py-1 rounded-xl border font-mono font-semibold flex items-center gap-1.5 shadow-2xs ${
                validation.is_balanced
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
                {validation.is_balanced ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Balance equation: PASS — disclosed totals reconcile (not full line coverage)</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>{validation.failed_guards?.some(guard => guard.startsWith('BALANCE_SHEET_IMBALANCE'))
                      ? 'Balance equation: FAIL — disclosed totals disagree'
                      : 'Balance equation: incomplete — required scope not disclosed'}</span>
                  </>
                )}
              </span>
            )}

            {/* Sector Specific Guards */}
            {validation && (
              <span
                className={`px-2.5 py-1 rounded-xl border font-mono text-[11px] font-semibold flex items-center gap-1.5 shadow-2xs ${
                  validation.impossible_guards_passed
                    ? 'bg-emerald-50/80 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
                title={validation.failed_guards?.join('; ') || `Accounting guards: ${validation.reconciliation_status || 'unavailable'}`}
              >
                {validation.impossible_guards_passed ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>{statementTemplate === 'banking' ? 'Assets ≥ Deposits (Guard OK)' : 'Accounting Guards Passed'}</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                    <span>{validation.failed_guards?.[0]?.split(':')[0] || (isThai ? 'ตรวจได้บางส่วน — ข้อมูลไม่ครบ' : 'Partial reconciliation — incomplete inputs')}</span>
                  </>
                )}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-stone-500 text-[11px] font-mono">
            <Shield className="w-3.5 h-3.5 text-[#0b5a4b]" />
            <span>{validation?.source_reconciliation_status === 'verified' ? (isThai ? 'ตรวจแหล่งที่มารายช่องแล้ว' : 'Cell sources verified') : (isThai ? 'Coverage: PARTIAL — บางรายการไม่มีข้อมูลที่ตรวจสอบได้ ไม่ใช่ผลตรวจสมการงบดุล' : 'Source coverage or reconciliation partial')}</span>
          </div>
        </div>

        {/* Ratio Reliability Warning Box ("Ratio ปกติ ≠ ข้อมูลถูก") */}
        {validation?.ratio_reliability_warning && (
          <div className="mx-4 sm:mx-6 mt-4 p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/90 flex items-start gap-3 shadow-2xs">
            <div className="p-1.5 rounded-xl bg-amber-100 text-amber-800 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="flex-1 text-xs">
              <div className="font-bold text-amber-950 flex items-center gap-2 flex-wrap">
                <span>{isThai ? 'การแจ้งเตือนความน่าเชื่อถือของอัตราส่วนทางการเงิน' : 'Financial Ratio Reliability Warning'}</span>
                <span className="px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-900 text-[10px] font-mono font-bold uppercase tracking-wider">
                  {isThai ? 'Ratio ปกติ ≠ ข้อมูลถูกต้อง' : 'Normal Ratio ≠ Correct Data'}
                </span>
              </div>
              <p className="text-amber-900/90 mt-1 leading-relaxed">
                {isThai
                  ? validation.reconciliation_status === 'failed' ? 'ตัวเลขบางงวดกระทบยอดไม่ผ่าน จึงระงับอัตราส่วนที่พึ่งพาข้อมูลนั้น กรุณาตรวจรายการที่แจ้งไว้ก่อนตีความ' : 'ช่องที่ยอมรับมีแหล่งอ้างอิง แต่ยังขาดบางองค์ประกอบสำหรับกระทบยอดทั้งหมด อัตราส่วนคำนวณเฉพาะเมื่อข้อมูลที่ต้องใช้เข้ากันได้ ข้อมูลไม่ครบไม่ได้แปลว่าตัวเลขผิด'
                  : validation.reconciliation_status === 'failed' ? 'Accounting inputs failed reconciliation. Affected ratios are suppressed; review the disclosed failures before interpreting this history.' : 'Accepted cells are source-backed, but some reconciliation components are unavailable. Ratios require their own compatible inputs; missing data is not evidence of an accounting error.'}
              </p>
            </div>
          </div>
        )}

        {/* Synchronized Top Dual-Axis Bar & Line Chart (Unified Light Report Aesthetic) */}
        {!isChartCollapsed && (
          <div className="p-4 sm:p-6 border-b border-stone-200 bg-gradient-to-b from-stone-50/90 via-white to-stone-50/40 text-stone-900 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-bold text-base sm:text-lg font-['Prompt','Mitr','Nunito',sans-serif] text-stone-900 tracking-tight">
                  {isThai ? (chartConfig.title_th || chartConfig.title) : chartConfig.title}
                </span>
                {isThai && chartConfig.title_th && chartConfig.title_th !== chartConfig.title && (
                  <span className="text-xs text-stone-500 font-mono font-normal">
                    ({chartConfig.title})
                  </span>
                )}
                <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-[#0b5a4b] font-mono text-xs font-bold border border-emerald-200/80 shadow-2xs">
                  {hasValidPoints && chartConfig.values[chartConfig.values.length - 1] !== null && chartConfig.values[chartConfig.values.length - 1] !== undefined
                    ? (chartConfig.isCurrency ? `${formatNum(chartConfig.values[chartConfig.values.length - 1])}` : `${chartConfig.values[chartConfig.values.length - 1]}${chartConfig.unit}`)
                    : '—'}
                </span>
              </div>

              {/* Interactive Dropdowns (Period & Compare Mode) */}
              <div className="flex items-center gap-2 relative">
                {/* 1. Period Dropdown */}
                <div className="relative" ref={periodMenuRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setPeriodDropdownOpen(!periodDropdownOpen);
                      setCompareDropdownOpen(false);
                    }}
                    className="text-xs font-mono text-stone-700 bg-white hover:bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all font-medium"
                  >
                    <span>{periodType === 'annual' ? (isReportedAnnualOnly ? 'Reported Annual' : isAnnualActive ? 'Annual / LTM' : 'Annual') : `Quarterly · ${quarterFilter === 'all' ? 'All' : quarterFilter}`}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
                  </button>

                  {periodDropdownOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-stone-200 rounded-2xl shadow-xl z-50 p-1.5 flex flex-col text-xs font-sans text-stone-800">
                      <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-2 py-1">Period Selection</div>
                      <button
                        type="button"
                        disabled={isReportedAnnualOnly}
                        onClick={() => { setPeriodType('quarterly'); setQuarterFilter('all'); setPeriodDropdownOpen(false); }}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-stone-100 text-stone-700 cursor-pointer text-left"
                      >
                        <span>Quarterly · All</span>
                        {periodType === 'quarterly' && quarterFilter === 'all' && <Check className="w-3.5 h-3.5 text-[#0b5a4b]" />}
                      </button>
                      {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => (
                        <button
                          key={q}
                          type="button"
                          disabled={isReportedAnnualOnly}
                          onClick={() => { setPeriodType('quarterly'); setQuarterFilter(q); setPeriodDropdownOpen(false); }}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-stone-100 text-stone-700 cursor-pointer text-left"
                        >
                          <span>Quarterly · {q}</span>
                          {periodType === 'quarterly' && quarterFilter === q && <Check className="w-3.5 h-3.5 text-[#0b5a4b]" />}
                        </button>
                      ))}
                      <div className="border-t border-stone-100 my-1" />
                      <button
                        type="button"
                        onClick={() => { setPeriodType('annual'); setQuarterFilter('all'); setPeriodDropdownOpen(false); }}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-stone-100 text-stone-700 cursor-pointer text-left"
                      >
                        <span>Annual (All)</span>
                        {periodType === 'annual' && <Check className="w-3.5 h-3.5 text-[#0b5a4b]" />}
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. Compare Metric Dropdown */}
                <div className="relative" ref={compareMenuRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setCompareDropdownOpen(!compareDropdownOpen);
                      setPeriodDropdownOpen(false);
                    }}
                    className="text-xs font-mono text-stone-700 bg-white hover:bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all font-medium"
                  >
                    <span>{compareMode === 'yoy' ? 'YoY Change' : compareMode === 'qoq' ? 'QoQ Change' : 'Hide Comparison'}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
                  </button>

                  {compareDropdownOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-44 bg-white border border-stone-200 rounded-2xl shadow-xl z-50 p-1.5 flex flex-col text-xs font-sans text-stone-800">
                      <button
                        type="button"
                        onClick={() => { setCompareMode('yoy'); setCompareDropdownOpen(false); }}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-stone-100 text-stone-700 cursor-pointer text-left"
                      >
                        <span>YoY Change</span>
                        {compareMode === 'yoy' && <Check className="w-3.5 h-3.5 text-orange-600" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setCompareMode('qoq'); setCompareDropdownOpen(false); }}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-stone-100 text-stone-700 cursor-pointer text-left"
                      >
                        <span>QoQ Change</span>
                        {compareMode === 'qoq' && <Check className="w-3.5 h-3.5 text-orange-600" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setCompareMode('hide'); setCompareDropdownOpen(false); }}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-stone-100 text-stone-700 cursor-pointer text-left"
                      >
                        <span>Hide Comparison</span>
                        {compareMode === 'hide' && <Check className="w-3.5 h-3.5 text-stone-500" />}
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsChartCollapsed(true)}
                  className="text-xs text-stone-500 hover:text-stone-800 cursor-pointer font-sans px-2.5 py-1.5 rounded-xl hover:bg-stone-100 transition-colors"
                >
                  Collapse ⌃
                </button>
              </div>
            </div>

            {/* Recharts Composed Bar + Line Chart (Harmonious Theme & Accurate Linear Connectors) */}
            <div className="h-60 w-full mt-1">
              {hasValidPoints ? (
                <ResponsiveContainer width="100%" height={240} minHeight={240}>
                  <ComposedChart data={chartData} margin={{ top: 15, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0efed" />
                    <XAxis
                      dataKey="period"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#78716c' }}
                      dy={5}
                    />
                    <YAxis
                      yAxisId="left"
                      domain={[(dataMin: number) => (dataMin < 0 ? Math.floor(dataMin * 1.15) : 0), (dataMax: number) => Math.ceil(dataMax * 1.15)]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#2563eb' }}
                      tickFormatter={(val: number) => {
                        if (!chartConfig.isCurrency) return `${val}${chartConfig.unit || ''}`;
                        const converted = val * multiplier;
                        if (Math.abs(converted) >= 1000) return `${(converted / 1000).toFixed(1)}B`;
                        return `${converted.toFixed(0)}M`;
                      }}
                    />
                    {compareMode !== 'hide' && (
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        domain={['auto', 'auto']}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#ea580c' }}
                        tickFormatter={(val: number) => formatMetricChange(selectedRowKey, val)}
                      />
                    )}
                    <RechartsTooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-[#1c1917] text-white p-3 rounded-xl border border-white/15 shadow-2xl text-xs font-sans space-y-1.5 min-w-[200px]">
                              <div className="text-stone-300 font-mono text-[11px] border-b border-stone-800 pb-1 font-bold">
                                {label}
                              </div>
                              {payload.map((entry: any, i: number) => {
                                const isVal = entry.dataKey === 'value';
                                const nameLabel = isVal ? chartConfig.title : (compareMode === 'qoq' ? 'QoQ Change' : 'YoY Change');
                                const valStr = isVal
                                  ? (chartConfig.isCurrency ? `${formatNum(entry.value)}` : `${Number(entry.value).toFixed(2)}${chartConfig.unit}`)
                                  : formatMetricChange(selectedRowKey, Number(entry.value));
                                const colorDot = isVal ? '#38bdf8' : '#fb923c';
                                return (
                                  <div key={i} className="flex items-center justify-between gap-3 text-xs">
                                    <div className="flex items-center gap-1.5 text-stone-300">
                                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colorDot }} />
                                      <span>{nameLabel}:</span>
                                    </div>
                                    <span className="font-mono font-bold text-white">{valStr}</span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={28}
                      formatter={(val) => (
                        <span className="text-xs text-stone-700 font-medium">
                          {val === 'value' ? `■ ${chartConfig.title}` : `— ${compareMode === 'qoq' ? 'QoQ Change' : 'YoY Change'}`}
                        </span>
                      )}
                    />
                    {compareMode !== 'hide' && (
                      <ReferenceLine yAxisId="right" y={0} stroke="#cbd5e1" strokeDasharray="3 3" />
                    )}
                    <Bar
                      yAxisId="left"
                      dataKey="value"
                      fill="#0b5a4b"
                      radius={[6, 6, 0, 0]}
                      name="value"
                      maxBarSize={36}
                      isAnimationActive={false}
                    />
                    {compareMode !== 'hide' && (
                      <Line
                        yAxisId="right"
                        type="linear"
                        dataKey="yoy_pct"
                        stroke="#d97706"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#d97706', stroke: '#ffffff', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: '#d97706', stroke: '#ffffff', strokeWidth: 2 }}
                        connectNulls={false}
                        name="yoy_pct"
                        isAnimationActive={false}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center gap-2 p-6 text-center bg-stone-50/60 rounded-2xl border border-dashed border-stone-200">
                  <Info className="w-5 h-5 text-stone-400" />
                  <p className="text-xs font-semibold text-stone-700">
                    {getMetricGapExplanation(selectedRowKey)}
                  </p>
                  {periods.length > 0 && (
                    <span className="text-[11px] font-mono text-stone-400">
                      {isThai ? `สำหรับ ${periods[0]} – ${periods[periods.length - 1]}` : `For ${periods[0]} – ${periods[periods.length - 1]}`}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {isChartCollapsed && (
          <div className="p-2.5 bg-stone-50 border-b border-stone-200 text-center">
            <button
              type="button"
              onClick={() => setIsChartCollapsed(false)}
              className="text-xs text-stone-600 hover:text-stone-900 font-semibold cursor-pointer"
            >
              Expand Chart ⌄
            </button>
          </div>
        )}

        {/* Institutional Annual / LTM Status Banner */}
        {isAnnualActive && (
          <div className="px-4 py-2.5 bg-emerald-50/70 border-b border-emerald-100/80 flex items-center justify-between text-xs text-[#0b5a4b] font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#0b5a4b] animate-pulse" />
              <span className="font-semibold">
                {isReportedAnnualOnly ? (isThai ? `งบรายปี IFRS ตามที่รายงาน สกุลเงิน ${effectiveData.currency} ไม่มีการสร้างไตรมาสหรือแปลงเป็น USD` : `Reported annual IFRS · ${effectiveData.currency}; no synthetic quarters or USD conversion`) : (isThai ? 'มุมมองสรุปรายปี / LTM (คำนวณสะสม 4 ไตรมาสอย่างเคร่งครัดตามหลักการบัญชี)' : 'Annual / LTM Mode (Deterministic 4-Quarter Sum for Flows & Ending Balance for Instant Assets/Liabilities)')}
              </span>
            </div>
            <span className="text-[10px] text-stone-500 uppercase tracking-wider font-sans">
              {isThai ? 'ข้อมูล SEC ที่ยอมรับได้' : effectiveData.verified_dataset?.generatedBy?.includes('ifrs') ? 'SEC IFRS Observations' : 'SEC GAAP Observations'}
            </span>
          </div>
        )}

        {/* Tab 1: Key Indicators Table */}
        {statementTab === 'indicators' && (
          <div className="relative">
            <div className="sm:hidden text-[10px] text-stone-400 font-sans px-4 py-1 flex items-center justify-end gap-1 bg-stone-50/50 border-b border-stone-100">
              <span>{isThai ? 'เลื่อนตารางในแนวนอนเพื่อดูงบย้อนหลัง →' : 'Swipe table horizontally to view periods →'}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                    <th className="py-3 px-4 min-w-[145px] sm:min-w-[220px] sticky left-0 bg-stone-50 z-10 shadow-xs">
                    {isThai ? 'ดัชนีชี้วัดทางการเงิน (Metric)' : 'Financial Metric'}
                  </th>
                  {periods.map((p, idx) => (
                    <th key={idx} className="py-3 px-3 text-right font-mono min-w-[90px]">
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs sm:text-sm font-sans">
                {keyIndicators.categories.map((cat, cIdx) => (
                  <React.Fragment key={cIdx}>
                    <tr className="bg-stone-100/70 border-y border-stone-200 font-bold text-xs text-stone-700">
                      <td colSpan={periods.length + 1} className="py-2 px-4 uppercase tracking-wider">
                        {cat.category_title}
                      </td>
                    </tr>
                    {cat.metrics.map((metric) => {
                      const isSelected = selectedRowKey === metric.key;
                      const metricVals = periodIndices.map(i => metric.values[i] !== undefined ? metric.values[i] : null);
                      const comparisonList = calculateComparison(metricVals, metric.key);
                      return (
                        <tr
                          key={metric.key}
                          onClick={() => setSelectedRowKey(metric.key)}
                          className={`transition-colors cursor-pointer ${isSelected
                              ? 'bg-stone-100/90 font-semibold text-stone-950 border-l-4 border-l-[#0b5a4b]'
                              : 'hover:bg-stone-50/70 text-stone-800'
                            }`}
                        >
                          <td className="py-2.5 px-4 font-medium sticky left-0 bg-inherit z-10 shadow-xs">
                            <div className="flex items-start gap-2">
                              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isSelected ? 'bg-[#0b5a4b]' : 'bg-stone-300'}`} />
                              <div>
                                <div className="font-bold text-stone-900 leading-snug flex items-center gap-1.5 flex-wrap">
                                  <span>{metric.name}</span>
                                  {indicatorDetails[metric.key]?.at(-1)?.status === 'approximate' && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800" title={indicatorDetails[metric.key].at(-1)?.basis}>{isThai ? 'ค่าประมาณ' : 'Approximate'}</span>
                                  )}
                                  {Boolean(getMetricCalculationDetail(metric.key, 0, effectiveData)) && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openCalculationDetail(metric.key, periods.length - 1);
                                      }}
                                      className="p-1 rounded-md text-stone-400 hover:text-[#0b5a4b] hover:bg-emerald-50 transition-colors cursor-pointer"
                                      title={isThai ? 'ดูสูตรและวิธีคำนวณ' : 'View calculation formula and inputs'}
                                      aria-label={`View formula for ${metric.name}`}
                                    >
                                      <Calculator className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {validation?.flagged_metrics?.[metric.key] && (
                                    <span
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100/90 text-amber-800 text-[10px] font-mono font-semibold"
                                      title={validation.flagged_metrics[metric.key]}
                                    >
                                      <AlertTriangle className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                                      <span>{isThai ? 'ตัวเลขดิบไม่ผ่านเกณฑ์' : 'Raw Data Unverified'}</span>
                                    </span>
                                  )}
                                </div>
                                {metric.name_th && (
                                  <div className="text-[11px] font-normal text-stone-500 font-sans mt-0.5">{metric.name_th}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          {periods.map((_, pIdx) => {
                            const val = metricVals[pIdx];
                            const comp = comparisonList[pIdx];
                            return (
                              <td key={pIdx} className="py-2.5 px-3 text-right">
                                <div
                                  className="font-mono text-stone-900 font-bold"
                                  title={val === null || val === undefined ? getMetricGapExplanation(metric.key) : cellProvenance(metric.key, periodIndices[pIdx])}
                                >
                                  {val !== null && val !== undefined ? `${val}${metric.unit}` : '—'}
                                </div>
                                {compareMode !== 'hide' && comp !== null && (
                                  <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${comp > 0 ? 'text-emerald-600' : comp < 0 ? 'text-rose-600' : 'text-stone-400'
                                    }`}>
                                    <span>{formatMetricChange(metric.key, comp)}</span>
                                    <span className="text-[8px] text-stone-400 font-sans uppercase font-medium">({compareMode})</span>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Income Statement Table (GAAP Detailed) */}
      {statementTab === 'income' && income && (
        <div className="relative">
          <div className="sm:hidden text-[10px] text-stone-400 font-sans px-4 py-1 flex items-center justify-end gap-1 bg-stone-50/50 border-b border-stone-100">
            <span>{isThai ? 'เลื่อนตารางในแนวนอนเพื่อดูงบย้อนหลัง →' : 'Swipe table horizontally to view periods →'}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  <th className="py-3 px-4 sticky left-0 bg-stone-50 z-10 shadow-xs min-w-[155px] sm:min-w-[240px]">
                    {isThai ? 'รายการงบกำไรขาดทุน (Income Statement Item)' : 'Income Statement Item'}
                  </th>
                  {periods.map((p, idx) => (
                    <th key={idx} className="py-3 px-3 text-right font-mono min-w-[90px]">{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs sm:text-sm font-sans">
                {statementTemplate === 'banking' ? (
                  <>
                    {/* 1. Total Net Revenue */}
                    <tr
                      onClick={() => setSelectedRowKey('revenue')}
                      className={`transition-colors cursor-pointer ${selectedRowKey === 'revenue' ? 'bg-stone-100/90 font-bold text-stone-950 border-l-4 border-l-[#0b5a4b]' : 'hover:bg-stone-50/60 font-bold'}`}
                    >
                      <td className="py-2.5 px-4 sticky left-0 bg-inherit z-10 shadow-xs">
                        <div className="flex items-start gap-2">
                          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${selectedRowKey === 'revenue' ? 'bg-[#0b5a4b]' : 'bg-stone-300'}`} />
                          <div>
                            <div className="font-bold text-stone-900 leading-snug">Total Net Revenue</div>
                            <div className="text-[11px] font-normal text-stone-500 font-sans mt-0.5">รายได้รวมสุทธิ (ดอกเบี้ยสุทธิ + ค่าธรรมเนียมและบริการ)</div>
                          </div>
                        </div>
                      </td>
                      {periods.map((_, idx) => {
                        const vals = periodIndices.map(i => income.revenue[i]);
                        const comp = calculateComparison(vals, 'revenue')[idx];
                        return (
                          <td key={idx} className="py-2.5 px-3 text-right" title={cellProvenance('revenue', periodIndices[idx])}>
                            <div className="font-mono text-stone-900 font-bold">{formatNum(vals[idx])}</div>
                            {compareMode !== 'hide' && comp !== null && (
                              <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${metricDeltaTone('revenue', comp)}`}>
                                <span>{comp >= 0 ? '+' : ''}{comp.toFixed(2)}%</span>
                                <span className="text-[8px] text-stone-400 font-sans uppercase font-medium">({compareMode})</span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>

                    {/* 2. Net Interest Income (NII) */}
                    <tr
                      onClick={() => setSelectedRowKey('net_interest_income')}
                      className={`transition-colors cursor-pointer ${selectedRowKey === 'net_interest_income' ? 'bg-stone-100/90 font-semibold text-stone-950 border-l-4 border-l-[#0b5a4b]' : 'hover:bg-stone-50/60 text-stone-700'}`}
                    >
                      <td className="py-2.5 px-4 pl-8 sticky left-0 bg-inherit z-10 shadow-xs">
                        <div>
                          <div className="font-semibold text-stone-800 leading-snug">— Net Interest Income (NII)</div>
                          <div className="text-[11px] font-normal text-stone-500 font-sans mt-0.5">รายได้ดอกเบี้ยสุทธิ (ดอกเบี้ยรับหักดอกเบี้ยจ่ายเงินฝาก)</div>
                        </div>
                      </td>
                      {periods.map((_, idx) => {
                        const rawNii = income.net_interest_income || [];
                        const vals = periodIndices.map(i => rawNii[i] !== undefined ? rawNii[i] : null);
                        const comp = calculateComparison(vals, 'net_interest_income')[idx];
                        return (
                          <td key={idx} className="py-2.5 px-3 text-right" title={cellProvenance('net_interest_income', periodIndices[idx])}>
                            <div className="font-mono text-stone-800 font-medium">{formatNum(vals[idx])}</div>
                            {compareMode !== 'hide' && comp !== null && (
                              <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${metricDeltaTone('net_interest_income', comp)}`}>
                                <span>{comp >= 0 ? '+' : ''}{comp.toFixed(2)}%</span>
                                <span className="text-[8px] text-stone-400 font-sans uppercase font-medium">({compareMode})</span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>

                    {/* 3. Non-Interest / Fee Income */}
                    <tr
                      onClick={() => setSelectedRowKey('non_interest_income')}
                      className={`transition-colors cursor-pointer ${selectedRowKey === 'non_interest_income' ? 'bg-stone-100/90 font-semibold text-stone-950 border-l-4 border-l-[#0b5a4b]' : 'hover:bg-stone-50/60 text-stone-700'}`}
                    >
                      <td className="py-2.5 px-4 pl-8 sticky left-0 bg-inherit z-10 shadow-xs">
                        <div>
                          <div className="font-semibold text-stone-800 leading-snug">— Non-Interest / Fee Income</div>
                          <div className="text-[11px] font-normal text-stone-500 font-sans mt-0.5">รายได้ที่มิใช่ดอกเบี้ย (ค่าธรรมเนียม บริการเทคโนโลยี และการลงทุน)</div>
                        </div>
                      </td>
                      {periods.map((_, idx) => {
                        const rawNonInt = income.non_interest_income || [];
                        const vals = periodIndices.map(i => rawNonInt[i] !== undefined ? rawNonInt[i] : null);
                        const comp = calculateComparison(vals, 'non_interest_income')[idx];
                        return (
                          <td key={idx} className="py-2.5 px-3 text-right" title={cellProvenance('non_interest_income', periodIndices[idx])}>
                            <div className="font-mono text-stone-800 font-medium">{formatNum(vals[idx])}</div>
                            {compareMode !== 'hide' && comp !== null && (
                              <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${metricDeltaTone('non_interest_income', comp)}`}>
                                <span>{comp >= 0 ? '+' : ''}{comp.toFixed(2)}%</span>
                                <span className="text-[8px] text-stone-400 font-sans uppercase font-medium">({compareMode})</span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>

                    {/* 4. Provision for Credit Losses */}
                    <tr
                      onClick={() => setSelectedRowKey('provision_for_credit_losses')}
                      className={`transition-colors cursor-pointer ${selectedRowKey === 'provision_for_credit_losses' ? 'bg-stone-100/90 font-semibold text-stone-950 border-l-4 border-l-[#0b5a4b]' : 'hover:bg-stone-50/60 text-rose-700'}`}
                    >
                      <td className="py-2.5 px-4 pl-8 sticky left-0 bg-inherit z-10 shadow-xs">
                        <div>
                          <div className="font-semibold text-rose-900 leading-snug">— Provision for Credit Losses</div>
                          <div className="text-[11px] font-normal text-rose-600/80 font-sans mt-0.5">ผลขาดทุนด้านเครดิตที่คาดว่าจะเกิดขึ้น / เงินสำรองหนี้สูญ</div>
                        </div>
                      </td>
                      {periods.map((_, idx) => {
                        const rawProv = income.provision_for_credit_losses || [];
                        const vals = periodIndices.map(i => rawProv[i] !== undefined ? rawProv[i] : null);
                        const comp = calculateComparison(vals, 'provision_for_credit_losses')[idx];
                        return (
                          <td key={idx} className="py-2.5 px-3 text-right" title={cellProvenance('provision_for_credit_losses', periodIndices[idx])}>
                            <div className="font-mono text-rose-700 font-medium">
                              {vals[idx] !== null && vals[idx] !== undefined ? `(${formatNum(Math.abs(vals[idx]!))})` : '-'}
                            </div>
                            {compareMode !== 'hide' && comp !== null && (
                              <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${metricDeltaTone('provision_for_credit_losses', comp)}`}>
                                <span>{comp >= 0 ? '+' : ''}{comp.toFixed(2)}%</span>
                                <span className="text-[8px] text-stone-400 font-sans uppercase font-medium">({compareMode})</span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>

                    {/* 5. Non-Interest Expense (Operating Expense) */}
                    <tr
                      onClick={() => setSelectedRowKey('opex')}
                      className={`transition-colors cursor-pointer ${selectedRowKey === 'opex' ? 'bg-stone-100/90 font-semibold text-stone-950 border-l-4 border-l-[#0b5a4b]' : 'hover:bg-stone-50/60 text-stone-800'}`}
                    >
                      <td className="py-2.5 px-4 sticky left-0 bg-inherit z-10 shadow-xs">
                        <div className="flex items-start gap-2">
                          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${selectedRowKey === 'opex' ? 'bg-[#0b5a4b]' : 'bg-stone-300'}`} />
                          <div>
                            <div className="font-bold text-stone-900 leading-snug">Non-Interest Expense (Operating Expense)</div>
                            <div className="text-[11px] font-normal text-stone-500 font-sans mt-0.5">ค่าใช้จ่ายดำเนินงานที่ไม่ใช่ดอกเบี้ย (เทคโนโลยี, พัฒนาผลิตภัณฑ์, การตลาด และ SG&A)</div>
                          </div>
                        </div>
                      </td>
                      {periods.map((_, idx) => {
                        const vals = periodIndices.map(i => income.operating_expenses ? income.operating_expenses[i] : null);
                        const comp = calculateComparison(vals, 'opex')[idx];
                        return (
                          <td key={idx} className="py-2.5 px-3 text-right" title={cellProvenance('opex', periodIndices[idx])}>
                            <div className="font-mono text-stone-800">{formatNum(vals[idx])}</div>
                            {compareMode !== 'hide' && comp !== null && (
                              <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${metricDeltaTone('opex', comp)}`}>
                                <span>{comp >= 0 ? '+' : ''}{comp.toFixed(2)}%</span>
                                <span className="text-[8px] text-stone-400 font-sans uppercase font-medium">({compareMode})</span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>

                    {/* 6. Operating Profit / Pre-Tax Income */}
                    <tr
                      onClick={() => setSelectedRowKey('operating_income')}
                      className={`transition-colors cursor-pointer ${selectedRowKey === 'operating_income' ? 'bg-stone-100/90 font-bold text-stone-950 border-l-4 border-l-[#0b5a4b]' : 'hover:bg-stone-50/60 font-bold'}`}
                    >
                      <td className="py-2.5 px-4 sticky left-0 bg-inherit z-10 shadow-xs">
                        <div className="flex items-start gap-2">
                          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${selectedRowKey === 'operating_income' ? 'bg-[#0b5a4b]' : 'bg-stone-300'}`} />
                          <div>
                            <div className="font-bold text-stone-900 leading-snug">Pre-Tax Operating Income</div>
                            <div className="text-[11px] font-normal text-stone-500 font-sans mt-0.5">กำไรก่อนภาษี / กำไรจากการดำเนินงาน</div>
                          </div>
                        </div>
                      </td>
                      {periods.map((_, idx) => {
                        const vals = periodIndices.map(i => income.operating_income ? income.operating_income[i] : null);
                        const comp = calculateComparison(vals, 'operating_income')[idx];
                        return (
                          <td key={idx} className="py-2.5 px-3 text-right" title={cellProvenance('operating_income', periodIndices[idx])}>
                            <div className="font-mono text-stone-900 font-bold">{formatNum(vals[idx])}</div>
                            {compareMode !== 'hide' && comp !== null && (
                              <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${metricDeltaTone('operating_income', comp)}`}>
                                <span>{comp >= 0 ? '+' : ''}{comp.toFixed(2)}%</span>
                                <span className="text-[8px] text-stone-400 font-sans uppercase font-medium">({compareMode})</span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </>
                ) : (
                  <>
                    {/* 1. Total Revenue */}
                    <tr
                      onClick={() => setSelectedRowKey('revenue')}
                      className={`transition-colors cursor-pointer ${selectedRowKey === 'revenue' ? 'bg-stone-100/90 font-bold text-stone-950 border-l-4 border-l-[#0b5a4b]' : 'hover:bg-stone-50/60 font-bold'}`}
                    >
                      <td className="py-2.5 px-4 sticky left-0 bg-inherit z-10 shadow-xs">
                        <div className="flex items-start gap-2">
                          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${selectedRowKey === 'revenue' ? 'bg-[#0b5a4b]' : 'bg-stone-300'}`} />
                          <div>
                            <div className="font-bold text-stone-900 leading-snug">Total Revenue as Reported</div>
                            <div className="text-[11px] font-normal text-stone-500 font-sans mt-0.5">รายได้รวมตามรายงานงบการเงิน</div>
                          </div>
                        </div>
                      </td>
                      {periods.map((_, idx) => {
                        const vals = periodIndices.map(i => income.revenue[i]);
                        const comp = calculateComparison(vals, 'revenue')[idx];
                        return (
                          <td key={idx} className="py-2.5 px-3 text-right" title={cellProvenance('revenue', periodIndices[idx])}>
                            <div className="font-mono text-stone-900 font-bold">{formatNum(vals[idx])}</div>
                            {compareMode !== 'hide' && comp !== null && (
                              <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${metricDeltaTone('revenue', comp)}`}>
                                <span>{comp >= 0 ? '+' : ''}{comp.toFixed(2)}%</span>
                                <span className="text-[8px] text-stone-400 font-sans uppercase font-medium">({compareMode})</span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>

                    {/* 2. Cost of Revenue */}
                    <tr
                      onClick={() => setSelectedRowKey('cogs')}
                      className={`transition-colors cursor-pointer ${selectedRowKey === 'cogs' ? 'bg-stone-100/90 font-semibold text-stone-950 border-l-4 border-l-[#0b5a4b]' : 'hover:bg-stone-50/60 text-stone-700'}`}
                    >
                      <td className="py-2.5 px-4 pl-8 sticky left-0 bg-inherit z-10 shadow-xs">
                        <div>
                          <div className="font-semibold text-stone-800 leading-snug">— Cost of Revenue</div>
                          <div className="text-[11px] font-normal text-stone-500 font-sans mt-0.5">ต้นทุนขายและบริการ (COGS)</div>
                        </div>
                      </td>
                      {periods.map((_, idx) => {
                        const rawCogs = income.cogs || [];
                        const vals = periodIndices.map(i => rawCogs[i]);
                        const comp = calculateComparison(vals, 'cogs')[idx];
                        return (
                          <td key={idx} className="py-2.5 px-3 text-right" title={cellProvenance('cogs', periodIndices[idx])}>
                            <div className="font-mono text-stone-800">{formatNum(vals[idx])}</div>
                            {compareMode !== 'hide' && comp !== null && (
                              <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${metricDeltaTone('cogs', comp)}`}>
                                <span>{comp >= 0 ? '+' : ''}{comp.toFixed(2)}%</span>
                                <span className="text-[8px] text-stone-400 font-sans uppercase font-medium">({compareMode})</span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>

                    {/* 3. Gross Profit */}
                    <tr
                      onClick={() => setSelectedRowKey('gross_profit')}
                      className={`transition-colors cursor-pointer ${selectedRowKey === 'gross_profit' ? 'bg-stone-100/90 font-bold text-stone-950 border-l-4 border-l-[#0b5a4b]' : 'hover:bg-stone-50/60 font-semibold'}`}
                    >
                      <td className="py-2.5 px-4 sticky left-0 bg-inherit z-10 shadow-xs">
                        <div className="flex items-start gap-2">
                          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${selectedRowKey === 'gross_profit' ? 'bg-[#0b5a4b]' : 'bg-stone-300'}`} />
                          <div>
                            <div className="font-bold text-stone-900 leading-snug">Gross Profit</div>
                            <div className="text-[11px] font-normal text-stone-500 font-sans mt-0.5">กำไรขั้นต้น</div>
                          </div>
                        </div>
                      </td>
                      {periods.map((_, idx) => {
                        const rawGp = income.gross_profit || [];
                        const vals = periodIndices.map(i => rawGp[i]);
                        const comp = calculateComparison(vals, 'gross_profit')[idx];
                        return (
                          <td key={idx} className="py-2.5 px-3 text-right" title={cellProvenance('gross_profit', periodIndices[idx])}>
                            <div className="font-mono text-stone-900 font-bold">{formatNum(vals[idx])}</div>
                            {compareMode !== 'hide' && comp !== null && (
                              <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${metricDeltaTone('gross_profit', comp)}`}>
                                <span>{comp >= 0 ? '+' : ''}{comp.toFixed(2)}%</span>
                                <span className="text-[8px] text-stone-400 font-sans uppercase font-medium">({compareMode})</span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>

                    {/* 4. Operating Expense */}
                    <tr
                      onClick={() => setSelectedRowKey('opex')}
                      className={`transition-colors cursor-pointer ${selectedRowKey === 'opex' ? 'bg-stone-100/90 font-semibold text-stone-950 border-l-4 border-l-[#0b5a4b]' : 'hover:bg-stone-50/60 text-stone-800'}`}
                    >
                      <td className="py-2.5 px-4 sticky left-0 bg-inherit z-10 shadow-xs">
                        <div className="flex items-start gap-2">
                          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${selectedRowKey === 'opex' ? 'bg-[#0b5a4b]' : 'bg-stone-300'}`} />
                          <div>
                            <div className="font-bold text-stone-900 leading-snug">Operating Expense</div>
                            <div className="text-[11px] font-normal text-stone-500 font-sans mt-0.5">ค่าใช้จ่ายในการดำเนินงานตามรายงาน</div>
                          </div>
                        </div>
                      </td>
                      {periods.map((_, idx) => {
                        const rawOpex = income.operating_expenses || [];
                        const vals = periodIndices.map(i => rawOpex[i]);
                        const comp = calculateComparison(vals, 'opex')[idx];
                        return (
                          <td key={idx} className="py-2.5 px-3 text-right" title={cellProvenance('opex', periodIndices[idx])}>
                            <div className="font-mono text-stone-800">{formatNum(vals[idx])}</div>
                            {compareMode !== 'hide' && comp !== null && (
                              <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${metricDeltaTone('opex', comp)}`}>
                                <span>{comp >= 0 ? '+' : ''}{comp.toFixed(2)}%</span>
                                <span className="text-[8px] text-stone-400 font-sans uppercase font-medium">({compareMode})</span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>

                    {/* 5. Operating Profit */}
                    <tr
                      onClick={() => setSelectedRowKey('operating_income')}
                      className={`transition-colors cursor-pointer ${selectedRowKey === 'operating_income' ? 'bg-stone-100/90 font-bold text-stone-950 border-l-4 border-l-[#0b5a4b]' : 'hover:bg-stone-50/60 font-bold'}`}
                    >
                      <td className="py-2.5 px-4 sticky left-0 bg-inherit z-10 shadow-xs">
                        <div className="flex items-start gap-2">
                          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${selectedRowKey === 'operating_income' ? 'bg-[#0b5a4b]' : 'bg-stone-300'}`} />
                          <div>
                            <div className="font-bold text-stone-900 leading-snug">Operating Income</div>
                            <div className="text-[11px] font-normal text-stone-500 font-sans mt-0.5">กำไรจากการดำเนินงาน</div>
                          </div>
                        </div>
                      </td>
                      {periods.map((_, idx) => {
                        const rawOp = income.operating_income || [];
                        const vals = periodIndices.map(i => rawOp[i]);
                        const comp = calculateComparison(vals, 'operating_income')[idx];
                        return (
                          <td key={idx} className="py-2.5 px-3 text-right" title={cellProvenance('operating_income', periodIndices[idx])}>
                            <div className="font-mono text-stone-900 font-bold">{formatNum(vals[idx])}</div>
                            {compareMode !== 'hide' && comp !== null && (
                              <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${metricDeltaTone('operating_income', comp)}`}>
                                <span>{comp >= 0 ? '+' : ''}{comp.toFixed(2)}%</span>
                                <span className="text-[8px] text-stone-400 font-sans uppercase font-medium">({compareMode})</span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </>
                )}

                {/* Preserve disclosed interest separately; never synthesize a
                    non-operating total from the narrower other-income row. */}
                {income.interest_income?.some(value=>value!=null)&&renderGenericRow('interest_income','Interest Income (Reported Scope)',income.interest_income,false,1,'รายได้ดอกเบี้ยตามขอบเขตที่รายงาน')}
                {income.interest_expense?.some(value=>value!=null)&&renderGenericRow('interest_expense','Interest Expense',income.interest_expense,false,1,'ค่าใช้จ่ายดอกเบี้ย')}
                {/* 6. Other Income (Expense), Net */}
                <tr
                  onClick={() => setSelectedRowKey('other_income')}
                  className={`transition-colors cursor-pointer ${selectedRowKey === 'other_income' ? 'bg-stone-100/90 font-semibold text-stone-950 border-l-4 border-l-[#0b5a4b]' : 'hover:bg-stone-50/60 text-stone-600'}`}
                >
                  <td className="py-2.5 px-4 pl-8 sticky left-0 bg-inherit z-10 shadow-xs">
                    <div>
                      <div className="font-semibold text-stone-700 leading-snug">— Other Income (Expense), Net</div>
                      <div className="text-[11px] font-normal text-stone-500 font-sans mt-0.5">รายได้ (ค่าใช้จ่าย) อื่นสุทธิ</div>
                    </div>
                  </td>
                  {periods.map((_, idx) => {
                    const otherVals = income.other_income || [];
                    const vals = periodIndices.map(i => otherVals[i] !== undefined ? otherVals[i] : null);
                    const val = vals[idx];
                    const comp = calculateComparison(vals, 'other_income')[idx];
                    return (
                      <td key={idx} className="py-2.5 px-3 text-right" title={cellProvenance('other_income', periodIndices[idx])}>
                        <div className="font-mono text-stone-700 font-medium">{val !== null && val !== undefined ? formatNum(val) : '-'}</div>
                        {compareMode !== 'hide' && comp !== null && (
                          <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${metricDeltaTone('other_income', comp)}`}>
                            <span>{comp >= 0 ? '+' : ''}{comp.toFixed(2)}%</span>
                            <span className="text-[8px] text-stone-400 font-sans uppercase font-medium">({compareMode})</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* 7. Net Income */}
                {income.net_income?.some(value => typeof value === 'number') && <tr
                  onClick={() => setSelectedRowKey('net_income')}
                  className={`transition-colors cursor-pointer ${selectedRowKey === 'net_income' ? 'bg-stone-100/90 font-bold text-stone-950 border-l-4 border-l-[#0b5a4b]' : 'hover:bg-stone-50/60 font-bold text-stone-900'}`}
                >
                  <td className="py-2.5 px-4 sticky left-0 bg-inherit z-10 shadow-xs">
                    <div className="flex items-start gap-2">
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${selectedRowKey === 'net_income' ? 'bg-[#0b5a4b]' : 'bg-stone-400'}`} />
                      <div>
                        <div className="font-bold text-stone-900 leading-snug">Total Net Income</div>
                        <div className="text-[11px] font-normal text-stone-500 font-sans mt-0.5">กำไรสุทธิรวม</div>
                      </div>
                    </div>
                  </td>
                  {periods.map((_, idx) => {
                    const vals = periodIndices.map(i => income.net_income[i]);
                    const comp = calculateComparison(vals, 'net_income')[idx];
                    return (
                      <td key={idx} className="py-2.5 px-3 text-right" title={cellProvenance('net_income', periodIndices[idx])}>
                        <div className="font-mono font-bold text-stone-900">{formatNum(vals[idx])}</div>
                        {compareMode !== 'hide' && comp !== null && (
                          <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${metricDeltaTone('net_income', comp)}`}>
                            <span>{comp >= 0 ? '+' : ''}{comp.toFixed(2)}%</span>
                            <span className="text-[8px] text-stone-400 font-sans uppercase font-medium">({compareMode})</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>}

                {renderGenericRow('net_income_common', 'Net Income to Common Stockholders', income.net_income_common || [], true, 0, 'กำไรสุทธิของผู้ถือหุ้นสามัญ')}
                {!hideParentIncomeAlias && renderGenericRow('net_income_parent', 'Net Income Attributable to Parent', income.net_income_parent || [], false, 1, 'กำไรสุทธิที่เป็นของบริษัทใหญ่ ไม่แทนกำไรสุทธิรวม/กำไรหุ้นสามัญโดยอัตโนมัติ')}
                {income.research_and_development?.some(value => typeof value === 'number') && renderGenericRow('research_and_development', 'Research & Development', income.research_and_development, false, 1, 'วิจัยและพัฒนา')}
                {!income.research_and_development?.some(value => typeof value === 'number') && renderGenericRow('research_and_development_excluding_acquired', 'R&D (Excluding Acquired In-Process Costs)', income.research_and_development_excluding_acquired || [], false, 1, 'วิจัยและพัฒนา ไม่รวมต้นทุนโครงการที่ซื้อมา')}
                {renderGenericRow('selling_general_administrative', 'Selling, General & Administrative', income.selling_general_administrative || [], false, 1, 'ค่าใช้จ่ายขายและบริหาร')}
                {/* 8. Diluted EPS */}
                <tr
                  onClick={() => setSelectedRowKey('eps')}
                  className={`transition-colors cursor-pointer ${selectedRowKey === 'eps' ? 'bg-stone-100/90 font-bold text-stone-950 border-l-4 border-l-[#0b5a4b]' : 'hover:bg-stone-50/60 font-mono text-stone-800'}`}
                >
                  <td className="py-2.5 px-4 font-sans sticky left-0 bg-inherit z-10 shadow-xs">
                    <div className="flex items-start gap-2">
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${selectedRowKey === 'eps' ? 'bg-[#0b5a4b]' : 'bg-stone-300'}`} />
                      <div>
                        <div className="font-bold text-stone-900 leading-snug">Diluted EPS</div>
                        <div className="text-[11px] font-normal text-stone-500 font-sans mt-0.5">กำไรต่อหุ้นปรับลด ({effectiveData.currency||'USD'}/หุ้น)</div>
                      </div>
                    </div>
                  </td>
                  {periods.map((_, idx) => {
                    const rawEps = income.eps_diluted || [];
                    const vals = periodIndices.map(i => rawEps[i] !== undefined ? rawEps[i] : null);
                    const epsVal = vals[idx];
                    const yoy = calculateComparison(vals, 'eps')[idx];
                    return (
                      <td key={idx} className="py-2.5 px-3 text-right">
                        <div className="font-mono font-bold text-stone-900">{epsVal !== null && epsVal !== undefined ? `${isForeignCurrency?effectiveData.currency+' ':'$'}${epsVal.toFixed(2)}` : '-'}</div>
                        {compareMode !== 'hide' && yoy !== null && (
                          <div className={`font-mono text-[10px] ${yoy >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {formatMetricChange('eps', yoy)}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Balance Sheet Table (Hierarchical GAAP) */}
      {statementTab === 'balance' && (
        <div className="relative">
          <div className="sm:hidden text-[10px] text-stone-400 font-sans px-4 py-1 flex items-center justify-end gap-1 bg-stone-50/50 border-b border-stone-100">
            <span>{isThai ? 'เลื่อนตารางในแนวนอนเพื่อดูงบย้อนหลัง →' : 'Swipe table horizontally to view periods →'}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  <th className="py-3 px-4 sticky left-0 bg-stone-50 z-10 shadow-xs min-w-[155px] sm:min-w-[240px]">
                    {isThai ? 'รายการงบดุล (Balance Sheet Item)' : 'Balance Sheet Item'}
                  </th>
                  {periods.map((p, idx) => (
                    <th key={idx} className="py-3 px-3 text-right font-mono min-w-[90px]">{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs sm:text-sm font-sans">
                {statementTemplate === 'banking' ? (
                  <>
                    {/* 1. Total Assets */}
                    {renderGenericRow('total_assets', 'Total Assets', bsItems.total_assets, true, 0, 'สินทรัพย์รวม')}

                    {/* 2. Bank Assets Breakdown */}
                    {renderGenericRow('cash', 'Cash and Cash Equivalents', bsItems.cash, false, 1, 'เงินสดและรายการเทียบเท่าเงินสด')}
                    {renderGenericRow('investment_securities', 'Investment Securities (AFS & HTM)', bsItems.investment_securities, false, 1, 'เงินลงทุนในตราสารหนี้และหลักทรัพย์')}
                    {renderGenericRow('loans_held_for_investment', 'Loans Held for Investment (Net of Allowance)', bsItems.loans_held_for_investment, false, 1, 'เงินให้สินเชื่อเพื่อการลงทุน (สุทธิจากค่าเผื่อหนี้สงสัยจะสูญ)')}
                    {renderGenericRow('loans_held_for_sale', 'Loans Held for Sale', bsItems.loans_held_for_sale, false, 1, 'เงินให้สินเชื่อเพื่อการค้า/ขาย')}
                    {renderGenericRow('net_ppe', 'Premises and Equipment (Net PPE)', bsItems.net_ppe, false, 1, 'ที่ดิน อาคาร และอุปกรณ์')}
                    {renderGenericRow('goodwill', 'Goodwill', bsItems.goodwill, false, 1, 'ค่าความนิยม')}

                    {/* 3. Total Liabilities */}
                    {renderGenericRow('total_liabilities', 'Total Liabilities', bsItems.total_liabilities, true, 0, 'หนี้สินรวม')}

                    {/* 4. Deposits - CRUCIAL BANK LIABILITY ROW */}
                    {renderGenericRow('deposits', '⚠️ Total Customer Deposits (Interest & Non-Interest)', bsItems.deposits, true, 1, 'เงินฝากรวมของลูกค้า (หนี้สินและแหล่งเงินทุนหลักของธนาคาร)')}

                    {/* 5. Other Bank Liabilities */}
                    {renderGenericRow('short_term_debt', 'Short-Term Borrowings & Repos', bsItems.short_term_debt, false, 1, 'เงินกู้ยืมระยะสั้นและธุรกรรมซื้อคืน')}
                    {renderGenericRow('long_term_debt', 'Long-Term Notes & Debt Obligations', bsItems.long_term_debt, false, 1, 'หนี้สินระยะยาวและหุ้นกู้')}

                    {/* 6. Total Stockholders' Equity */}
                    {renderGenericRow('total_equity', 'Total Equity including NCI', bsItems.total_equity, true, 0, 'ส่วนของผู้ถือหุ้นรวมส่วนได้เสียที่ไม่มีอำนาจควบคุม')}
                    {renderGenericRow('stockholders_equity', 'Parent Stockholders\' Equity', bsItems.stockholders_equity, false, 1, 'ส่วนของผู้ถือหุ้นบริษัทใหญ่')}
                    {renderGenericRow('noncontrolling_interest', 'Noncontrolling Interest', bsItems.noncontrolling_interest, false, 1, 'ส่วนได้เสียที่ไม่มีอำนาจควบคุม')}
                    {renderGenericRow('redeemable_noncontrolling_interest', 'Redeemable Noncontrolling Interest (Mezzanine)', bsItems.redeemable_noncontrolling_interest, false, 1, 'ส่วนได้เสียที่ไถ่ถอนได้ แสดงนอกส่วนของผู้ถือหุ้น')}
                    {renderGenericRow('common_stock', 'Common Stock', bsItems.common_stock, false, 1, 'หุ้นสามัญ')}
                    {renderGenericRow('additional_paid_in_capital', 'Additional Paid-in Capital', balance?.additional_paid_in_capital || [], false, 1, 'ส่วนเกินมูลค่าหุ้น')}
                    {renderGenericRow('retained_earnings', 'Retained Earnings (Accumulated Deficit)', bsItems.retained_earnings, false, 1, 'กำไร(ขาดทุน)สะสม')}
                    {renderGenericRow('aoci', 'Accumulated Other Comprehensive Income (AOCI)', bsItems.aoci, false, 1, 'กำไร/ขาดทุนเบ็ดเสร็จอื่นสะสม (AOCI)')}
                  </>
                ) : (
                  <>
                    {/* 1. Total Assets */}
                    {renderGenericRow('total_assets', 'Total Assets', bsItems.total_assets, true, 0, 'สินทรัพย์รวม')}

                    {/* 2. Current Assets Group */}
                    {renderGenericRow('current_assets', 'Total Current Assets', bsItems.current_assets, true, 0, 'สินทรัพย์หมุนเวียนรวม')}
                    {renderGenericRow('cash_and_investments', 'Cash & Short-Term Investments', bsItems.cash_and_investments, false, 1, 'เงินสดและเงินลงทุนระยะสั้น')}
                    {renderGenericRow('cash', 'Cash and Cash Equivalents', bsItems.cash, false, 2, 'เงินสดและรายการเทียบเท่าเงินสด')}
                    {renderGenericRow('short_term_investments', 'Short Term Investments', bsItems.short_term_investments, false, 2, 'เงินลงทุนระยะสั้น')}
                    {renderGenericRow('receivables', 'Receivables', bsItems.receivables, false, 1, 'ลูกหนี้การค้าและลูกหนี้อื่น')}
                    {renderGenericRow('accounts_receivable', 'Accounts Receivable', bsItems.accounts_receivable, false, 2, 'ลูกหนี้การค้า')}
                    {renderGenericRow('inventory', 'Inventory', bsItems.inventory, false, 1, 'สินค้าคงเหลือ')}

                    {/* 3. Non-Current Assets Group */}
                    {renderGenericRow('non_current_assets', 'Total Non-Current Assets', bsItems.non_current_assets, true, 0, 'สินทรัพย์ไม่หมุนเวียนรวม')}
                    {renderGenericRow('net_ppe', 'Net PPE', bsItems.net_ppe, false, 1, 'ที่ดิน อาคาร และอุปกรณ์สุทธิ')}
                    {renderGenericRow('available_for_sale_securities', 'Available for Sale Securities', bsItems.available_for_sale_securities, false, 1, 'หลักทรัพย์เผื่อขาย / เงินลงทุนระยะยาว')}
                    {renderGenericRow('goodwill', 'Goodwill', bsItems.goodwill, false, 1, 'ค่าความนิยม')}

                    {/* 4. Total Liabilities */}
                    {renderGenericRow('total_liabilities', 'Total Liabilities', bsItems.total_liabilities, true, 0, 'หนี้สินรวม')}

                    {/* 5. Current Liabilities Group */}
                    {renderGenericRow('current_liabilities', 'Total Current Liabilities', bsItems.current_liabilities, true, 0, 'หนี้สินหมุนเวียนรวม')}
                    {renderGenericRow('payables', 'Payables', bsItems.payables, false, 1, 'เจ้าหนี้การค้าและค่าใช้จ่ายค้างจ่าย')}
                    {renderGenericRow('accounts_payable', 'Accounts Payable', bsItems.accounts_payable, false, 2, 'เจ้าหนี้การค้า')}
                    {renderGenericRow('tax_payable', 'Total Tax Payable', bsItems.tax_payable, false, 2, 'ภาษีเงินได้ค้างจ่าย')}
                    {renderGenericRow('short_term_debt', 'Current Debt', bsItems.short_term_debt, false, 1, 'หนี้สินทางการเงินระยะสั้น ไม่รวมสัญญาเช่า')}
                    {bsItems.current_debt_and_finance_leases.length > 0 && renderGenericRow('current_debt_and_finance_leases','Current Debt & Finance Leases',bsItems.current_debt_and_finance_leases,false,1,'หนี้สินระยะสั้นรวมสัญญาเช่าการเงิน')}
                    {bsItems.finance_lease_liabilities_current.length > 0 && renderGenericRow('finance_lease_liabilities_current','Current Finance Lease Liability',bsItems.finance_lease_liabilities_current,false,1,'หนี้สินสัญญาเช่าการเงินระยะสั้น')}
                    {renderGenericRow('current_deferred_liabilities', 'Current Deferred Liabilities', bsItems.current_deferred_liabilities, false, 1, 'หนี้สินรอการรับรู้ระยะสั้น / รายได้รับล่วงหน้า')}

                    {/* 6. Non-Current Liabilities Group */}
                    {renderGenericRow('non_current_liabilities', 'Total Non-Current Liabilities', bsItems.non_current_liabilities, true, 0, 'หนี้สินไม่หมุนเวียนรวม')}
                    {renderGenericRow('long_term_debt', 'Long-Term Debt', bsItems.long_term_debt, false, 1, 'หนี้สินทางการเงินระยะยาว')}
                    {bsItems.long_term_debt_and_finance_leases.length > 0 && renderGenericRow('long_term_debt_and_finance_leases', 'Long-Term Debt and Finance Leases', bsItems.long_term_debt_and_finance_leases, false, 1, 'หนี้สินระยะยาวรวมสัญญาเช่าการเงิน')}
                    {bsItems.noncurrent_debt_and_finance_leases.length > 0 && renderGenericRow('noncurrent_debt_and_finance_leases','Noncurrent Debt & Finance Leases',bsItems.noncurrent_debt_and_finance_leases,false,1,'หนี้สินระยะยาวรวมสัญญาเช่าการเงิน')}
                    {bsItems.finance_lease_liabilities_non_current.length > 0 && renderGenericRow('finance_lease_liabilities_non_current','Noncurrent Finance Lease Liability',bsItems.finance_lease_liabilities_non_current,false,1,'หนี้สินสัญญาเช่าการเงินระยะยาว')}

                    {/* 7. Total Equity & Stockholders' Equity Group */}
                    {renderGenericRow('total_equity', 'Total Equity including NCI', bsItems.total_equity, true, 0, 'ส่วนของผู้ถือหุ้นรวมส่วนได้เสียที่ไม่มีอำนาจควบคุม')}
                    {renderGenericRow('stockholders_equity', 'Parent Stockholders\' Equity', bsItems.stockholders_equity, false, 1, 'ส่วนของผู้ถือหุ้นบริษัทใหญ่')}
                    {renderGenericRow('noncontrolling_interest', 'Noncontrolling Interest', bsItems.noncontrolling_interest, false, 1, 'ส่วนได้เสียที่ไม่มีอำนาจควบคุม')}
                    {renderGenericRow('redeemable_noncontrolling_interest', 'Redeemable Noncontrolling Interest (Mezzanine)', bsItems.redeemable_noncontrolling_interest, false, 1, 'ส่วนได้เสียที่ไถ่ถอนได้ แสดงนอกส่วนของผู้ถือหุ้น')}
                    {renderGenericRow('capital_stock', 'Capital Stock', bsItems.capital_stock, false, 1, 'ทุนเรือนหุ้น')}
                    {renderGenericRow('common_stock', 'Common Stock', bsItems.common_stock, false, 2, 'หุ้นสามัญ')}
                    {renderGenericRow('additional_paid_in_capital', 'Additional Paid-in Capital', balance?.additional_paid_in_capital || [], false, 1, 'ส่วนเกินมูลค่าหุ้น')}
                    {renderGenericRow('retained_earnings', 'Retained Earnings', bsItems.retained_earnings, false, 1, 'กำไรสะสม')}
                    {renderGenericRow('aoci', 'Accumulated Other Comprehensive Income (AOCI)', bsItems.aoci, false, 1, 'กำไร/ขาดทุนเบ็ดเสร็จอื่นสะสม (AOCI)')}
                  </>
                )}

                {/* Metadata Footer */}
                <tr className="bg-stone-50/80 text-[11px] text-stone-500 font-mono">
                  <td className="py-2.5 px-4 sticky left-0 bg-stone-50 z-10 shadow-xs font-bold text-stone-600">Period End</td>
                  {periodIndices.map(i => deadlines[i]).map((d, idx) => (
                    <td key={idx} className="py-2.5 px-3 text-right">{d}</td>
                  ))}
                </tr>
                <tr className="bg-stone-50/80 text-[11px] text-stone-500 font-mono">
                  <td className="py-2 px-4 sticky left-0 bg-stone-50 z-10 shadow-xs font-bold text-stone-600">Accounting Standard</td>
                  {periods.map((_, idx) => (
                    <td key={idx} className="py-2 px-3 text-right">{effectiveData.verified_dataset?.generatedBy?.includes('ifrs') ? 'IFRS' : 'US_GAAP'}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Cash Flow Table (Hierarchical GAAP) */}
      {statementTab === 'cashflow' && (
        <div className="relative">
          <div className="sm:hidden text-[10px] text-stone-400 font-sans px-4 py-1 flex items-center justify-end gap-1 bg-stone-50/50 border-b border-stone-100">
            <span>{isThai ? 'เลื่อนตารางในแนวนอนเพื่อดูงบย้อนหลัง →' : 'Swipe table horizontally to view periods →'}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  <th className="py-3 px-4 sticky left-0 bg-stone-50 z-10 shadow-xs min-w-[155px] sm:min-w-[240px]">
                    {isThai ? 'รายการกระแสเงินสด (Cash Flow Item)' : 'Cash Flow Item'}
                  </th>
                  {periods.map((p, idx) => (
                    <th key={idx} className="py-3 px-3 text-right font-mono min-w-[90px]">{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs sm:text-sm font-sans">
                {statementTemplate === 'banking' ? (
                  <>
                    {/* 1. Operating Cash Flow Group */}
                    {renderGenericRow('ocf', 'Operating Cash Flow', cfItems.ocf, true, 0, 'กระแสเงินสดจากการดำเนินงาน (OCF)')}
                    {renderGenericRow('net_income_cont', 'Total Net Income', cfItems.net_income_cont, false, 1, 'กำไรสุทธิจากการดำเนินงาน')}
                    {renderGenericRow('provision_addback', 'Provision for Credit Losses (Non-Cash Add-back)', cfItems.provision_addback, false, 1, 'บวกกลับสำรองหนี้สูญ (รายการที่ไม่ใช่เงินสด)')}
                    {renderGenericRow('depreciation', 'Depreciation & Amortization', cfItems.depreciation, false, 1, 'ค่าเสื่อมราคาและค่าตัดจำหน่าย')}
                    {cfItems.depreciation_amortization_and_accretion.length > 0 && renderGenericRow('depreciation_amortization_and_accretion','Depreciation, Amortization & Accretion',cfItems.depreciation_amortization_and_accretion,false,1,'รวม accretion แยกจาก D&A ที่ใช้คำนวณ EBITDA')}
                    {cfItems.depreciation_amortization_and_impairment.length > 0 && renderGenericRow('depreciation_amortization_and_impairment','Depreciation, Amortization & Impairment',cfItems.depreciation_amortization_and_impairment,false,1,'รวมด้อยค่า แยกจาก D&A ที่ใช้คำนวณ EBITDA')}
                    {renderGenericRow('stock_based_compensation', 'Stock-Based Compensation (Non-Cash Add-back)', cfItems.stock_based_compensation, false, 1, 'ค่าตอบแทนในรูปหุ้น (บวกกลับรายการที่ไม่ใช่เงินสด)')}
                    {renderGenericRow('non_cash_items', 'Other Operating Adjustments', cfItems.non_cash_items, false, 1, 'การปรับปรุงรายการดำเนินงานอื่นๆ')}
                    {renderGenericRow('change_in_loans_held_for_sale', '⚠️ Change in Loans Held for Sale (Originations vs Sales)', cfItems.change_in_loans_held_for_sale, true, 1, 'การเปลี่ยนแปลงในเงินให้สินเชื่อเพื่อการค้า/ขาย (ตัวแปรหลักฉุด/ดัน OCF สถาบันการเงิน)')}

                    {/* 2. Investing Cash Flow Group */}
                    {renderGenericRow('icf', 'Net Cash Flow from Investing Activities', cfItems.icf, true, 0, 'กระแสเงินสดจากกิจกรรมลงทุน (ICF)')}
                    {renderGenericRow('capex', 'Net PPE & Technology CapEx', cfItems.capex, false, 1, 'รายจ่ายฝ่ายทุน ซื้อสินทรัพย์และระบบเทคโนโลยี (CapEx)')}
                    {renderGenericRow('investment_purchase', 'Net Purchases/Sales of Investment Securities', cfItems.investment_purchase, false, 1, 'เงินสดสุทธิจากการซื้อ/ขายเงินลงทุนในหลักทรัพย์')}
                    {renderGenericRow('other_investing', 'Other Investing Activities', cfItems.other_investing, false, 1, 'กิจกรรมลงทุนอื่น')}

                    {/* 3. Financing Cash Flow Group */}
                    {renderGenericRow('fcf_financing', 'Financing Cash Flow', cfItems.fcf_financing, true, 0, 'กระแสเงินสดจากกิจกรรมจัดหาเงิน')}
                    {cfItems.debt_issuance.length > 0 && renderGenericRow('debt_issuance','Debt Issuance Proceeds',cfItems.debt_issuance,false,1,'เงินสดจากการออกหนี้')}
                    {cfItems.debt_repayments.length > 0 && renderGenericRow('debt_repayments','Debt Repayments',cfItems.debt_repayments,false,1,'เงินสดจ่ายคืนหนี้')}
                    {cfItems.finance_lease_payments.length > 0 && renderGenericRow('finance_lease_payments','Finance Lease Principal Payments',cfItems.finance_lease_payments,false,1,'เงินสดจ่ายคืนหนี้สัญญาเช่าการเงิน')}
                    {cfItems.distributions_to_noncontrolling_interests.length > 0 && renderGenericRow('distributions_to_noncontrolling_interests','Distributions to Noncontrolling Interests',cfItems.distributions_to_noncontrolling_interests,false,1,'เงินสดจ่ายส่วนได้เสียที่ไม่มีอำนาจควบคุม')}
                    {cfItems.distributions_to_noncontrolling_and_redeemable_interests.length > 0 && renderGenericRow('distributions_to_noncontrolling_and_redeemable_interests','Distributions to NCI & Redeemable Interests',cfItems.distributions_to_noncontrolling_and_redeemable_interests,false,1,'รายงานรวม NCI และส่วนที่ไถ่ถอนได้ แยกจาก NCI ปกติ')}
                    {renderGenericRow('change_in_deposits', '⚠️ Net Change in Customer Deposits (Inflow/Outflow)', cfItems.change_in_deposits, true, 1, 'การเปลี่ยนแปลงสุทธิในเงินฝากลูกค้า (กระแสเงินสดหลักของธนาคาร)')}
                    {renderGenericRow('debt_issuance_payments', 'Net Issuance/Repayments Of Borrowings', cfItems.debt_issuance_payments, false, 1, 'เงินสดสุทธิจากการกู้ยืม/ชำระคืนเงินกู้')}
                    {cfItems.equity_issuance_proceeds.length>0 && renderGenericRow('equity_issuance_proceeds','Equity Issuance Proceeds (Broad Reported Basis)',cfItems.equity_issuance_proceeds,false,1,'ไม่ถือว่าเป็นหุ้นสามัญอย่างเดียว')}
                    {cfItems.dividends_to_noncontrolling_interests.length>0 && renderGenericRow('dividends_to_noncontrolling_interests','Dividends to Noncontrolling Interests',cfItems.dividends_to_noncontrolling_interests,false,1,'เงินปันผล NCI แยกจากการจ่ายอื่น')}
                    {renderGenericRow('issuance_of_common_stock', 'Common Stock Issuance Proceeds', cfItems.issuance_of_common_stock, false, 1, 'เงินสดจากการออกหุ้นสามัญ')}
                    {renderGenericRow('repurchase_of_common_stock', 'Common Stock Repurchases', cfItems.repurchase_of_common_stock, false, 1, 'เงินสดจ่ายซื้อหุ้นสามัญคืน')}
                    {renderGenericRow('option_exercise_proceeds', 'Stock Option Exercise Proceeds', cfItems.option_exercise_proceeds, false, 1, 'เงินสดจากการใช้สิทธิซื้อหุ้น')}
                    {cfItems.equity_compensation_and_option_proceeds.length > 0 && renderGenericRow('equity_compensation_and_option_proceeds','Stock Option Exercises & Other Stock Issuance Proceeds',cfItems.equity_compensation_and_option_proceeds,false,1,'รายงานรวม ไม่แยกเป็นเงินจากการใช้สิทธิเพียงอย่างเดียว')}
                    {renderGenericRow('ending_cash', 'Ending ' + cashBasisName, cfItems.ending_cash, true, 1, 'เงินสดคงเหลือปลายงวด')}

                    {/* 4. Free Cash Flow */}
                    {renderGenericRow('free_cash_flow', 'Free Cash Flow (FCF = OCF - CapEx)', cfItems.free_cash_flow, true, 0, 'กระแสเงินสดอิสระ (FCF = OCF - CapEx)')}
                  </>
                ) : (
                  <>
                    {/* 1. Operating Cash Flow Group */}
                    {renderGenericRow('ocf', 'Operating Cash Flow', cfItems.ocf, true, 0, 'กระแสเงินสดจากการดำเนินงาน (OCF)')}
                    {renderGenericRow('net_income_cont', 'Total Net Income', cfItems.net_income_cont, false, 1, 'กำไรสุทธิรวม')}
                    {renderGenericRow('depreciation', 'Depreciation & Depletion & Amortization', cfItems.depreciation, false, 1, 'ค่าเสื่อมราคาและค่าตัดจำหน่าย')}
                    {cfItems.depreciation_amortization_and_impairment.length > 0 && renderGenericRow('depreciation_amortization_and_impairment','Depreciation, Amortization & Impairment',cfItems.depreciation_amortization_and_impairment,false,1,'รวมด้อยค่า แยกจาก D&A ที่ใช้คำนวณ EBITDA')}
                    {cfItems.depreciation_amortization_and_accretion.length > 0 && renderGenericRow('depreciation_amortization_and_accretion','Depreciation, Amortization & Accretion',cfItems.depreciation_amortization_and_accretion,false,1,'รวม accretion แยกจาก D&A ที่ใช้คำนวณ EBITDA')}
                    {renderGenericRow('stock_based_compensation', 'Stock-Based Compensation (Non-Cash Add-back)', cfItems.stock_based_compensation, false, 1, 'ค่าตอบแทนในรูปหุ้น (บวกกลับรายการที่ไม่ใช่เงินสด)')}
                    {renderGenericRow('non_cash_items', 'Other Non-Cash Items', cfItems.non_cash_items, false, 1, 'รายการที่ไม่ใช่เงินสดอื่นๆ')}
                    {renderGenericRow('change_working_capital', 'Change in Working Capital', cfItems.change_working_capital, true, 1, 'การเปลี่ยนแปลงในเงินทุนหมุนเวียน')}
                    {renderGenericRow('change_receivables', 'Change in Receivables', cfItems.change_receivables, false, 2, 'การเปลี่ยนแปลงในลูกหนี้การค้า')}
                    {renderGenericRow('change_inventory', 'Change in Inventory', cfItems.change_inventory, false, 2, 'การเปลี่ยนแปลงในสินค้าคงเหลือ')}
                    {renderGenericRow('change_payables', 'Change in Payables and Accrued Expense', cfItems.change_payables, false, 2, 'การเปลี่ยนแปลงในเจ้าหนี้การค้าและค่าใช้จ่ายค้างจ่าย')}
                    {renderGenericRow('change_other_ca', 'Change in Other Current Assets', cfItems.change_other_ca, false, 2, 'การเปลี่ยนแปลงในสินทรัพย์หมุนเวียนอื่น')}
                    {renderGenericRow('change_other_cl', 'Change in Other Current Liabilities', cfItems.change_other_cl, false, 2, 'การเปลี่ยนแปลงในหนี้สินหมุนเวียนอื่น')}

                    {/* 2. Investing Cash Flow Group */}
                    {renderGenericRow('icf', 'Net Cash from Investing Activities', cfItems.icf, true, 0, 'กระแสเงินสดสุทธิจากกิจกรรมลงทุน (ICF)')}
                    {renderGenericRow('capex', 'Capital Expenditures (CapEx)', cfItems.capex, false, 1, 'รายจ่ายฝ่ายทุน (CapEx)')}
                    {renderGenericRow('investment_purchase', 'Net Investment Purchase and Sale', cfItems.investment_purchase, false, 1, 'เงินสดสุทธิซื้อ/ขายเงินลงทุน')}
                    {renderGenericRow('other_investing', 'Net Other Investing Changes', cfItems.other_investing, false, 1, 'การเปลี่ยนแปลงอื่นๆ ในกิจกรรมลงทุน')}

                    {/* 3. Financing Cash Flow Group */}
                    {renderGenericRow('fcf_financing', 'Financing Cash Flow (Net Cash from Financing)', cfItems.fcf_financing, true, 0, 'กระแสเงินสดจากกิจกรรมจัดหาเงิน (Financing Cash Flow)')}
                    {cfItems.debt_issuance.length > 0 && renderGenericRow('debt_issuance','Debt Issuance Proceeds',cfItems.debt_issuance,false,1,'เงินสดจากการออกหนี้')}
                    {cfItems.debt_repayments.length > 0 && renderGenericRow('debt_repayments','Debt Repayments',cfItems.debt_repayments,false,1,'เงินสดจ่ายคืนหนี้')}
                    {cfItems.finance_lease_payments.length > 0 && renderGenericRow('finance_lease_payments','Finance Lease Principal Payments',cfItems.finance_lease_payments,false,1,'เงินสดจ่ายคืนหนี้สัญญาเช่าการเงิน')}
                    {cfItems.distributions_to_noncontrolling_interests.length > 0 && renderGenericRow('distributions_to_noncontrolling_interests','Distributions to Noncontrolling Interests',cfItems.distributions_to_noncontrolling_interests,false,1,'เงินสดจ่ายส่วนได้เสียที่ไม่มีอำนาจควบคุม')}
                    {cfItems.distributions_to_noncontrolling_and_redeemable_interests.length > 0 && renderGenericRow('distributions_to_noncontrolling_and_redeemable_interests','Distributions to NCI & Redeemable Interests',cfItems.distributions_to_noncontrolling_and_redeemable_interests,false,1,'รายงานรวม NCI และส่วนที่ไถ่ถอนได้ แยกจาก NCI ปกติ')}
                    {renderGenericRow('debt_issuance_payments', 'Net Issuance Payments Of Debt', cfItems.debt_issuance_payments, false, 1, 'เงินสดสุทธิจากการกู้ยืม/ชำระคืนหนี้')}
                    {cfItems.equity_issuance_proceeds.length>0 && renderGenericRow('equity_issuance_proceeds','Equity Issuance Proceeds (Broad Reported Basis)',cfItems.equity_issuance_proceeds,false,1,'ไม่ถือว่าเป็นหุ้นสามัญอย่างเดียว')}
                    {cfItems.dividends_to_noncontrolling_interests.length>0 && renderGenericRow('dividends_to_noncontrolling_interests','Dividends to Noncontrolling Interests',cfItems.dividends_to_noncontrolling_interests,false,1,'เงินปันผล NCI แยกจากการจ่ายอื่น')}
                    {renderGenericRow('issuance_of_common_stock', 'Common Stock Issuance Proceeds', cfItems.issuance_of_common_stock, false, 1, 'เงินสดจากการออกหุ้นสามัญ')}
                    {renderGenericRow('repurchase_of_common_stock', 'Common Stock Repurchases', cfItems.repurchase_of_common_stock, false, 1, 'เงินสดจ่ายซื้อหุ้นสามัญคืน')}
                    {renderGenericRow('option_exercise_proceeds', 'Stock Option Exercise Proceeds', cfItems.option_exercise_proceeds, false, 1, 'เงินสดจากการใช้สิทธิซื้อหุ้น')}
                    {cfItems.equity_compensation_and_option_proceeds.length > 0 && renderGenericRow('equity_compensation_and_option_proceeds','Stock Option Exercises & Other Stock Issuance Proceeds',cfItems.equity_compensation_and_option_proceeds,false,1,'รายงานรวม ไม่แยกเป็นเงินจากการใช้สิทธิเพียงอย่างเดียว')}
                    {renderGenericRow('dividends_paid', 'Cash Dividends Paid', cfItems.dividends_paid, false, 1, 'เงินปันผลจ่าย')}
                    {renderGenericRow('other_financing', 'Net Other Financing Charges', cfItems.other_financing, false, 1, 'ค่าใช้จ่ายและรายการอื่นจากกิจกรรมจัดหาเงิน')}
                    {renderGenericRow('ending_cash', 'Ending ' + cashBasisName, cfItems.ending_cash, true, 1, 'เงินสดคงเหลือปลายงวด')}
                    {renderGenericRow('net_change_cash', 'Net Change in Cash', cfItems.net_change_cash, false, 2, 'การเปลี่ยนแปลงสุทธิในเงินสด')}
                    {renderGenericRow('beginning_cash', 'Beginning ' + cashBasisName, cfItems.beginning_cash, false, 2, 'เงินสดคงเหลือต้นงวด')}

                    {/* 4. Free Cash Flow */}
                    {renderGenericRow('free_cash_flow', 'Free Cash Flow (FCF = OCF - CapEx)', cfItems.free_cash_flow, true, 0, 'กระแสเงินสดอิสระ (FCF = OCF - CapEx)')}
                  </>
                )}

                {/* Metadata Footer */}
                <tr className="bg-stone-50/80 text-[11px] text-stone-500 font-mono">
                  <td className="py-2.5 px-4 sticky left-0 bg-stone-50 z-10 shadow-xs font-bold text-stone-600">Period End</td>
                  {periodIndices.map(i => deadlines[i]).map((d, idx) => (
                    <td key={idx} className="py-2.5 px-3 text-right">{d}</td>
                  ))}
                </tr>
                <tr className="bg-stone-50/80 text-[11px] text-stone-500 font-mono">
                  <td className="py-2 px-4 sticky left-0 bg-stone-50 z-10 shadow-xs font-bold text-stone-600">Accounting Standard</td>
                  {periods.map((_, idx) => (
                    <td key={idx} className="py-2 px-3 text-right">{effectiveData.verified_dataset?.generatedBy?.includes('ifrs') ? 'IFRS' : 'US_GAAP'}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

        {/* Dynamic AI Financial Analyst Live Deep-Dive Inspection Box */}
        {(() => {
          const activeCfg = chartConfig;
          const hasPoints = activeCfg.values.some(v => v !== null && v !== undefined && !Number.isNaN(v));
          const latestVal = hasPoints ? activeCfg.values[activeCfg.values.length - 1] : null;
          const uStr = activeCfg.unit || (activeCfg.isCurrency ? 'M' : '');
          const latestPeriod = activeCfg.periods[activeCfg.periods.length - 1];
          const latestYoY = hasPoints && activeCfg.yoy_pcts && activeCfg.yoy_pcts.length > 0
            ? activeCfg.yoy_pcts[activeCfg.yoy_pcts.length - 1]
            : null;

          const isSourceReconciled = selectedMetric.dataQuality.currentVerified;
          const metricContext = getMetricInterpretationContext({
            metricKey: selectedRowKey,
            metricName: activeCfg.title,
            metricNameTh: activeCfg.title_th || activeCfg.title,
            reportData: effectiveData,
            ticker,
            periods: activeCfg.periods,
            historyValues: activeCfg.values,
            yoyPcts: activeCfg.yoy_pcts,
            unit: uStr,
            isCurrency: activeCfg.isCurrency,
            isThai,
            isSourceReconciled,
            provenanceStatus: `Selected metric ${selectedMetric.dataQuality.status}; overall statement ${validation?.reconciliation_status || 'partial'}`
          });

          const cacheKey = selectedCacheKey;
          const liveInsight = hasPoints ? liveAiInsights[cacheKey] : undefined;
          const localInsight = deterministicMetricInsight(selectedMetric, metricContext, analystFailures[cacheKey]);
          const aiInsight = liveInsight || localInsight;
          const isFromGemini = liveInsight?.engine === 'GEMINI';

          const displayTitle = isThai ? (activeCfg.title_th || activeCfg.title) : activeCfg.title;
          const displaySubTitle = isThai ? activeCfg.title : activeCfg.title_th;

          // Helper to render bolded markdown text with clean highlighting
          const renderFormattedText = (text: string) => {
            if (!text) return null;
            const parts = text.split(/(\*\*[^*]+\*\*)/g);
            return parts.map((part, idx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                const inner = part.slice(2, -2);
                return (
                  <strong key={idx} className="font-bold text-[#0b5a4b] bg-emerald-500/10 px-1 py-0.5 rounded">
                    {inner}
                  </strong>
                );
              }
              return <span key={idx}>{part}</span>;
            });
          };

          return (
            <div className="p-5 sm:p-7 bg-gradient-to-b from-stone-50/90 via-white to-stone-50/40 border-t border-stone-200 flex flex-col gap-5">
              {/* 1. Executive Top Header Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-200/80">
                <div className="flex items-start gap-3.5">
                  <div className={`w-10 h-10 rounded-2xl ${
                    isFromGemini
                      ? 'bg-gradient-to-br from-emerald-600 via-[#0b5a4b] to-teal-800 text-white shadow-sm shadow-emerald-600/20'
                      : 'bg-gradient-to-br from-[#0b5a4b] to-emerald-700 text-white'
                  } flex items-center justify-center shrink-0 mt-0.5`}>
                    <Sparkles className="w-5 h-5" />
                  </div>

                  <div className="flex flex-col gap-1">
                    {/* Meta Tags & AI Badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/90 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        <span>{isFromGemini ? 'Gemini AI · Live Financial Analyst' : 'Deterministic Financial Analyst'}</span>
                      </span>

                      {/* Applicability & Business Archetype Chip */}
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium font-sans border shadow-2xs ${
                        metricContext.isFinancialSectorGuardActive
                          ? 'bg-amber-50 text-amber-900 border-amber-300'
                          : metricContext.applicability === 'PRIMARY'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : metricContext.applicability === 'RELEVANT'
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                          : metricContext.applicability === 'CONTEXT_ONLY'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-stone-100 text-stone-700 border-stone-200'
                      }`}>
                        <span>
                          {metricContext.isFinancialSectorGuardActive
                            ? 'Financial Sector Guard'
                            : (isThai ? metricContext.applicabilityLabelTh : metricContext.applicabilityLabelEn)}
                        </span>
                      </span>

                      {activeCfg.categoryLabel && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-stone-100 text-stone-600 border border-stone-200 font-sans">
                          <Layers className="w-3 h-3 text-stone-400" />
                          <span>{activeCfg.categoryLabel}</span>
                        </span>
                      )}

                      {isAiAnalyzing && !isFromGemini && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 font-sans animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-ping" />
                          <span>{isThai ? 'Gemini AI กำลังวิเคราะห์งบสด...' : 'Gemini AI analyzing live...'}</span>
                        </span>
                      )}
                    </div>

                    {/* Title & Subtitle */}
                    <h3 className="text-lg sm:text-xl font-bold text-stone-900 font-['Prompt','Nunito',sans-serif] tracking-tight leading-snug mt-0.5">
                      {displayTitle}
                    </h3>
                    {displaySubTitle && displaySubTitle !== displayTitle && (
                      <div className="text-xs font-mono text-stone-500">
                        {displaySubTitle}
                      </div>
                    )}
                  </div>
                </div>

                {/* Top Right: Hero KPI Stat + Status Diagnosis Badge */}
                <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-2.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-stone-150">
                  {/* Status Badge */}
                  <span className={`px-3 py-1 rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 shadow-2xs border ${
                    aiInsight.status === 'excellent'
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300/80'
                      : aiInsight.status === 'good'
                      ? 'bg-teal-50 text-teal-900 border-teal-200'
                      : aiInsight.status === 'neutral'
                      ? 'bg-stone-100 text-stone-800 border-stone-300'
                      : 'bg-rose-50 text-rose-900 border-rose-300/80'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      aiInsight.status === 'excellent' ? 'bg-emerald-600' :
                      aiInsight.status === 'good' ? 'bg-teal-600' :
                      aiInsight.status === 'neutral' ? 'bg-stone-500' : 'bg-rose-600'
                    }`} />
                    <span>{isThai ? aiInsight.status_label_th : aiInsight.status_label_en}</span>
                  </span>

                  {/* Hero Value Display */}
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-stone-900">
                      {hasPoints && latestVal !== null && latestVal !== undefined
                        ? (activeCfg.isCurrency ? `${formatNum(latestVal)}` : `${latestVal}${uStr}`)
                        : '—'}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs font-mono">
                      <span className="text-stone-400">({latestPeriod || (isThai ? 'งบล่าสุด' : 'Latest')})</span>
                      {hasPoints && latestYoY !== null && latestYoY !== undefined && (
                        <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                          latestYoY >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {formatMetricChange(selectedRowKey, latestYoY)} {compareMode === 'qoq' ? 'QoQ' : 'YoY'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Bento Grid Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* Left Column (7 cols): Definition & Live Deep-Dive Synthesis */}
                <div className="lg:col-span-7 flex flex-col gap-3.5">
                  <div className="bg-white rounded-2xl border border-stone-200/90 shadow-xs p-5 flex flex-col gap-3.5 h-full">
                    {/* Definition Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-stone-100 pb-2.5 min-w-0">
                      <span className="text-xs font-bold text-stone-700 uppercase tracking-wider font-mono flex items-start gap-1.5 min-w-0">
                        <Lightbulb className="w-3.5 h-3.5 text-[#0b5a4b]" />
                        <span>{isThai ? 'มุมมองการวิเคราะห์เชิงลึก (Analyst Synthesis)' : 'Institutional Analyst Synthesis'}</span>
                      </span>
                      <span title={aiInsight.fallbackReason || aiInsight.model} className="text-[11px] text-stone-500 font-mono break-words min-w-0 sm:max-w-[45%]">
                        {isFromGemini ? `${aiInsight.model} Synthesis` : aiInsight.fallbackReason ? metricAiFailureLabel(aiInsight.fallbackReason as AnalystFallbackReason, isThai) : 'Deterministic Financial Analyst'}
                      </span>
                    </div>

                    {/* Definition Context */}
                    <div className="bg-stone-50/70 p-3 rounded-xl border border-stone-150 text-xs text-stone-600 font-sans leading-relaxed flex items-start gap-2">
                      <Info className="w-3.5 h-3.5 text-stone-400 mt-0.5 shrink-0" />
                      <div>
                        <strong className="text-stone-800 font-medium mr-1">{isThai ? 'ความหมาย:' : 'Definition:'}</strong>
                        <span className="whitespace-pre-line">{isThai ? (aiInsight.what_is_it_th || localInsight.what_is_it_th) : (aiInsight.what_is_it_en || localInsight.what_is_it_en)}</span>
                      </div>
                    </div>

                    {/* Deep-Dive Live Analysis */}
                    <div className="text-xs sm:text-[13px] text-stone-800 font-sans leading-relaxed space-y-2">
                      <p className="whitespace-pre-line">
                        {renderFormattedText(isThai ? aiInsight.interpretation_th : aiInsight.interpretation_en)}
                      </p>
                    </div>

                    {/* Benchmark Context (Integrated neatly at bottom) */}
                    <div className="mt-auto pt-3 border-t border-stone-100 flex items-start gap-2.5 text-xs font-sans bg-stone-50/80 p-3 rounded-xl border border-stone-150">
                      <Activity className="w-4 h-4 text-[#0b5a4b] mt-0.5 shrink-0" />
                      <div>
                        <strong className="text-stone-900 font-bold">{isThai ? 'เกณฑ์มาตรฐานอ้างอิง (Rule of Thumb): ' : 'Benchmark Context: '}</strong>
                        <span className="text-stone-700">{isThai ? (aiInsight.benchmark_th || localInsight.benchmark_th) : (aiInsight.benchmark_en || localInsight.benchmark_en)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column (5 cols): Key Strengths (Pros) & Watchouts */}
                <div className="lg:col-span-5 flex flex-col gap-3.5">
                  {/* Box 1: Key Strengths (Pros) */}
                  <div className="bg-white rounded-2xl border border-stone-200/90 shadow-xs p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 uppercase tracking-wider font-mono">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>{isThai ? 'ข้อดี & ผลกระทบเชิงบวก (Key Strengths)' : 'Key Strengths & Moat Impact'}</span>
                    </div>
                    <ul className="space-y-2.5 text-xs text-stone-700 font-sans">
                      {(isThai ? aiInsight.pros_th : aiInsight.pros_en).length===0 && <li className="leading-relaxed text-stone-600">{isThai?'ยังสรุปข้อดีเฉพาะไม่ได้จากตัวชี้วัดที่ตรวจสอบได้เพียงอย่างเดียว':'No specific strength follows from this accepted metric alone.'}</li>}
                      {(isThai ? aiInsight.pros_th : aiInsight.pros_en).map((pro, pIdx) => (
                        <li key={pIdx} className="flex items-start gap-2.5">
                          <span className="w-4 h-4 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-200">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                          <span className="leading-snug">{renderFormattedText(pro)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Box 2: Watchouts & Risks */}
                  <div className="bg-amber-50/40 rounded-2xl border border-amber-200/80 shadow-xs p-5 flex flex-col gap-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase tracking-wider font-mono">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>{isThai ? 'สิ่งที่ต้องติดตาม / ข้อควรระวัง (Watchouts)' : 'Watchouts & Risk Factors'}</span>
                    </div>
                    <p className="text-xs text-amber-950/90 font-sans leading-relaxed whitespace-pre-line">
                      {renderFormattedText(isThai ? aiInsight.watchouts_th : aiInsight.watchouts_en)}
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. Subtle Footer Interactive Hint */}
              <div className="pt-2 border-t border-stone-200/70 flex items-center justify-center text-[11px] text-stone-400 font-sans">
                <span className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span>{isThai ? 'คลิกแถวเพื่อวิเคราะห์ตัวชี้วัดนั้นด้วยข้อมูลที่ตรวจสอบได้ โดยใช้ Gemini เมื่อพร้อม หรือแสดง Deterministic Analyst พร้อมเหตุผล' : 'Select a row for verified metric analysis. Gemini is used when available; otherwise the Deterministic Analyst shows its fallback reason.'}</span>
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Red Flags / Risk Callout */}
      {data.red_flags && data.red_flags.length > 0 && (
        <div className="bg-amber-50/80 rounded-2xl p-4 sm:p-5 border border-amber-200/80 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>{isThai ? 'จุดที่ต้องจับตา / สัญญาณเตือนในงบ (Red Flags & Watch Items)' : 'Financial Red Flags & Watch Items'}</span>
          </div>
          <ul className="space-y-1.5 pl-2">
            {data.red_flags.map((flag, idx) => (
              <li key={idx} className="text-sm text-amber-900/90 flex items-start gap-2">
                <span className="text-amber-600 font-bold mt-0.5">•</span>
                <span>{flag}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <CalculationModal
        detail={activeCalcDetail}
        isOpen={Boolean(activeCalcDetail)}
        onClose={() => setActiveCalcDetail(null)}
        isThai={isThai}
        periodLabel={activeCalcPeriod}
        currencyMode={currencyMode}
        currencyRate={currencyRate}
      />
    </div>
  );
}
