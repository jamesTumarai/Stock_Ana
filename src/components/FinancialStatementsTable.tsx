import { periodChanges } from '../utils/reportIntegrity';
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Table, AlertTriangle, TrendingUp, TrendingDown, Minus,
  ChevronDown, ChevronRight, Layers, DollarSign, ArrowRight,
  BarChart3, Activity, PieChart, Shield, Check, SlidersHorizontal, Sparkles, Lightbulb, Info
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, ReferenceLine
} from 'recharts';
import { FinancialStatementsData, KeyIndicatorsData, KeyIndicatorMetric, KeyIndicatorsCategory } from '../types';
import { getFinancialAiInsight, FinancialAiInsight } from '../utils/financialAiInsights';

interface Props {
  data?: FinancialStatementsData;
  isThai: boolean;
  currencyRate?: number;
  currencyMode?: 'USD' | 'THB';
  ticker?: string;
  companyName?: string;
}

export function FinancialStatementsTable({
  data,
  isThai,
  currencyRate = 35.5,
  currencyMode = 'USD',
  ticker = 'TSLA',
  companyName = 'Tesla, Inc.'
}: Props) {
  const [statementTab, setStatementTab] = useState<'indicators' | 'income' | 'balance' | 'cashflow'>('income');
  const [selectedRowKey, setSelectedRowKey] = useState<string>('revenue');
  const [isChartCollapsed, setIsChartCollapsed] = useState<boolean>(false);
  const [liveAiInsights, setLiveAiInsights] = useState<Record<string, FinancialAiInsight>>({});
  const [isAiAnalyzing, setIsAiAnalyzing] = useState<boolean>(false);

  // Dropdown States
  const [periodDropdownOpen, setPeriodDropdownOpen] = useState<boolean>(false);
  const [periodType, setPeriodType] = useState<'quarterly' | 'annual' | 'cumulative'>('quarterly');
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

  if (!data || !data.periods || data.periods.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-stone-200 text-stone-500 text-center italic">
        {isThai ? 'ไม่มีข้อมูลงบการเงินย้อนหลัง' : 'No historical financial statement data available.'}
      </div>
    );
  }

  const rawPeriods = data.periods;
  const statementTemplate = data.statement_template || 'standard';
  const validation = data.validation_summary;
  const currSym = currencyMode === 'THB' ? '฿' : '$';
  const multiplier = currencyMode === 'THB' ? currencyRate : 1;

  // Filter periods based on user selection
  const periodIndices = rawPeriods.map((_, i) => i).filter((i) => {
    const p = rawPeriods[i];
    if (quarterFilter === 'all') return true;
    return p.includes(quarterFilter);
  });

  const periods = periodIndices.map(i => rawPeriods[i]);

  // Auto-detect full raw currency scale (e.g. 100,000,000+ -> convert to millions)
  const isFullRawCurrencyScale = (() => {
    const revs = (data.income_statement?.revenue || []).filter((v): v is number => typeof v === 'number' && v > 0);
    if (revs.length === 0) return false;
    return Math.max(...revs) >= 100_000_000;
  })();

  const normalizeToMillions = (val: number | null | undefined): number | null | undefined => {
    if (val === null || val === undefined) return val;
    if (isFullRawCurrencyScale) return val / 1_000_000;
    return val;
  };

  const formatNum = (rawVal: number | null | undefined, isCurrency = true, decimals = 2): string => {
    if (rawVal === null || rawVal === undefined) return '-';
    if (!isCurrency) return rawVal.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

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
    return periodChanges(values, rawPeriods, compareMode,
      metricKey === 'revenue' ? data.income_statement?.yoy_revenue_growth_pct : undefined);
  };

  const income = data.income_statement;
  const balance = data.balance_sheet;
  const cashflow = data.cash_flow;

  // Dynamic Key Indicators derived deterministically from company's actual statements
  const grossMarginVals = rawPeriods.map((_, i) => {
    const rev = income?.revenue?.[i];
    const gp = income?.gross_profit?.[i];
    if (rev && gp !== undefined && gp !== null && rev > 0) return Number(((gp / rev) * 100).toFixed(2));
    if (income?.gross_margin_pct?.[i] !== undefined && income?.gross_margin_pct?.[i] !== null) return income.gross_margin_pct[i];
    return null;
  });

  const opMarginVals = rawPeriods.map((_, i) => {
    const rev = income?.revenue?.[i];
    const op = income?.operating_income?.[i];
    if (rev && op !== undefined && op !== null && rev > 0) return Number(((op / rev) * 100).toFixed(2));
    if (income?.operating_margin_pct?.[i] !== undefined && income?.operating_margin_pct?.[i] !== null) return income.operating_margin_pct[i];
    return null;
  });

  const netMarginVals = rawPeriods.map((_, i) => {
    const rev = income?.revenue?.[i];
    const ni = income?.net_income?.[i];
    if (rev && ni !== undefined && ni !== null && rev > 0) return Number(((ni / rev) * 100).toFixed(2));
    if (income?.net_margin_pct?.[i] !== undefined && income?.net_margin_pct?.[i] !== null) return income.net_margin_pct[i];
    return null;
  });

  const ebitdaMarginVals = rawPeriods.map((_, i) => {
    const rev = income?.revenue?.[i];
    const op = income?.operating_income?.[i];
    const dep = cashflow?.depreciation?.[i] || 0;
    if (rev && op !== undefined && op !== null && rev > 0) return Number((((op + dep) / rev) * 100).toFixed(2));
    return opMarginVals[i];
  });

  const taxRateVals = rawPeriods.map((_, i) => {
    if (income?.tax_rate?.[i] !== undefined && income?.tax_rate?.[i] !== null) {
      return income.tax_rate[i];
    }
    const preTax = income?.income_before_tax?.[i];
    const taxExpense = income?.income_tax_expense?.[i];
    if (preTax !== undefined && preTax !== null && preTax > 0 && taxExpense !== undefined && taxExpense !== null) {
      return Number(((taxExpense / preTax) * 100).toFixed(2));
    }
    return null;
  });

  const currentRatioVals = rawPeriods.map((_, i) => {
    const ca = balance?.total_current_assets?.[i];
    const cl = balance?.total_current_liabilities?.[i];
    if (ca && cl && cl > 0) return Number((ca / cl).toFixed(2));
    if (balance?.current_ratio?.[i] !== undefined && balance?.current_ratio?.[i] !== null) return balance.current_ratio[i];
    return null;
  });

  const quickRatioVals = rawPeriods.map((_, i) => {
    const ca = balance?.total_current_assets?.[i];
    const cl = balance?.total_current_liabilities?.[i];
    const inv = balance?.inventory?.[i] || 0;
    if (ca && cl && cl > 0) return Number(((ca - inv) / cl).toFixed(2));
    if (balance?.quick_ratio?.[i] !== undefined && balance?.quick_ratio?.[i] !== null) return balance.quick_ratio[i];
    return currentRatioVals[i];
  });

  const debtToEquityVals = rawPeriods.map((_, i) => {
    const debt = balance?.total_debt?.[i];
    const eq = balance?.total_equity?.[i];
    if (debt !== undefined && debt !== null && eq && eq > 0) return Number((debt / eq).toFixed(2));
    if (balance?.debt_to_equity?.[i] !== undefined && balance?.debt_to_equity?.[i] !== null) return balance.debt_to_equity[i];
    return null;
  });

  const equityRatioVals = rawPeriods.map((_, i) => {
    const eq = balance?.total_equity?.[i];
    const ta = balance?.total_assets?.[i];
    if (eq !== undefined && eq !== null && ta && ta > 0) return Number(((eq / ta) * 100).toFixed(2));
    return null;
  });

  const debtToAssetVals = rawPeriods.map((_, i) => {
    const debt = balance?.total_debt?.[i];
    const ta = balance?.total_assets?.[i];
    if (debt !== undefined && debt !== null && ta && ta > 0) return Number(((debt / ta) * 100).toFixed(2));
    return null;
  });

  // These are annualized from the reported quarter; they are not management-reported annual ratios.
  const roeVals = rawPeriods.map((_, i) => {
    const ni = income?.net_income?.[i];
    const eq = balance?.total_equity?.[i];
    if (ni !== undefined && ni !== null && eq && eq > 0) return Number(((ni * 4 / eq) * 100).toFixed(2));
    return null;
  });

  const roaVals = rawPeriods.map((_, i) => {
    const ni = income?.net_income?.[i];
    const ta = balance?.total_assets?.[i];
    if (ni !== undefined && ni !== null && ta && ta > 0) return Number(((ni * 4 / ta) * 100).toFixed(2));
    return null;
  });

  const roicVals = rawPeriods.map((_, i) => {
    const op = income?.operating_income?.[i];
    const taxRate = taxRateVals[i];
    const debt = balance?.total_debt?.[i] || 0;
    const eq = balance?.total_equity?.[i] || 1;
    const cash = balance?.cash_and_equivalents?.[i] || 0;
    const investedCap = Math.max(1, debt + eq - cash);
    if (op !== undefined && op !== null && investedCap > 0 && taxRate !== null && taxRate !== undefined) {
      const nopat = (op * 4) * (1 - taxRate / 100);
      return Number(((nopat / investedCap) * 100).toFixed(2));
    }
    return null;
  });

  const fcfMarginVals = rawPeriods.map((_, i) => {
    const rev = income?.revenue?.[i];
    const fcf = cashflow?.free_cash_flow?.[i] ?? (cashflow?.operating_cash_flow?.[i] !== undefined && cashflow?.capex?.[i] !== undefined ? cashflow.operating_cash_flow[i]! - Math.abs(cashflow.capex[i]!) : null);
    if (rev && fcf !== null && fcf !== undefined && rev > 0) return Number(((fcf / rev) * 100).toFixed(2));
    if (cashflow?.fcf_margin_pct?.[i] !== undefined && cashflow?.fcf_margin_pct?.[i] !== null) return cashflow.fcf_margin_pct[i];
    return null;
  });

  const fcfToNetIncomeVals = rawPeriods.map((_, i) => {
    const ni = income?.net_income?.[i];
    const fcf = cashflow?.free_cash_flow?.[i] ?? (cashflow?.operating_cash_flow?.[i] !== undefined && cashflow?.capex?.[i] !== undefined ? cashflow.operating_cash_flow[i]! - Math.abs(cashflow.capex[i]!) : null);
    if (ni && fcf !== null && fcf !== undefined && ni !== 0) return Number(((fcf / ni) * 100).toFixed(2));
    if (cashflow?.fcf_vs_net_income_ratio?.[i] !== undefined && cashflow?.fcf_vs_net_income_ratio?.[i] !== null) return Number((cashflow.fcf_vs_net_income_ratio[i] * 100).toFixed(2));
    return null;
  });

  // Working capital and operational turnover metrics
  const assetTurnoverVals = rawPeriods.map((_, i) => {
    const rev = income?.revenue?.[i];
    const ta = balance?.total_assets?.[i];
    if (rev && ta && ta > 0) return Number(((rev * 4) / ta).toFixed(2));
    return null;
  });

  const invTurnoverVals = rawPeriods.map((_, i) => {
    const cogs = income?.cogs?.[i];
    const inv = balance?.inventory?.[i];
    if (cogs && inv && inv > 0) return Number(((cogs * 4) / inv).toFixed(2));
    return null;
  });

  const dsoVals = rawPeriods.map((_, i) => {
    const ar = balance?.accounts_receivable?.[i] ?? balance?.receivables?.[i];
    const rev = income?.revenue?.[i];
    if (ar && rev && rev > 0) return Number(((ar / rev) * 90).toFixed(1));
    return null;
  });

  const dioVals = rawPeriods.map((_, i) => {
    const inv = balance?.inventory?.[i];
    const cogs = income?.cogs?.[i];
    if (inv && cogs && cogs > 0) return Number(((inv / cogs) * 90).toFixed(1));
    return null;
  });

  const dpoVals = rawPeriods.map((_, i) => {
    const ap = balance?.accounts_payable?.[i] ?? balance?.payables?.[i];
    const cogs = income?.cogs?.[i];
    if (ap && cogs && cogs > 0) return Number(((ap / cogs) * 90).toFixed(1));
    return null;
  });

  const cccVals = rawPeriods.map((_, i) => {
    const dso = dsoVals[i];
    const dio = dioVals[i];
    const dpo = dpoVals[i];
    if (dso !== null && dio !== null && dpo !== null) return Number((dso + dio - dpo).toFixed(1));
    if (dso !== null && dpo !== null) return Number((dso - dpo).toFixed(1));
    return null;
  });

  const keyIndicators: KeyIndicatorsData = {
    periods: rawPeriods,
    categories: [
      {
        category_key: 'profitability',
        category_title: isThai ? '1. ความสามารถในการทำกำไร (Profitability)' : 'Profitability',
        metrics: [
          { key: 'gross_margin', name: 'Gross Margin', name_th: 'อัตรากำไรขั้นต้น', category: 'profitability', unit: '%', values: grossMarginVals },
          { key: 'operating_margin', name: 'Operating Margin', name_th: 'อัตรากำไรจากการดำเนินงาน', category: 'profitability', unit: '%', values: opMarginVals },
          { key: 'ebit_margin', name: 'EBIT Margin', name_th: 'อัตรากำไรก่อนดอกเบี้ยและภาษี', category: 'profitability', unit: '%', values: opMarginVals },
          { key: 'net_margin', name: 'Net Margin', name_th: 'อัตรากำไรสุทธิ', category: 'profitability', unit: '%', values: netMarginVals },
          { key: 'ebitda_margin', name: 'EBITDA Margin', name_th: 'อัตรากำไรก่อนดอกเบี้ย ภาษี ค่าเสื่อม & ตัดจำหน่าย', category: 'profitability', unit: '%', values: ebitdaMarginVals },
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
          { key: 'debt_to_asset', name: 'Debt to Asset Ratio', name_th: 'อัตราส่วนหนี้สินรวมต่อสินทรัพย์รวม', category: 'solvency', unit: '%', values: debtToAssetVals }
        ]
      },
      {
        category_key: 'operating_capacity',
        category_title: isThai ? '3. ประสิทธิภาพการดำเนินงาน (Operating Capacity & Returns)' : 'Operating Capacity & Returns',
        metrics: [
          { key: 'roe', name: 'ROE (Return on Equity - Annualized)', name_th: 'ผลตอบแทนต่อส่วนของผู้ถือหุ้น (Annualized)', category: 'operating_capacity', unit: '%', values: roeVals },
          { key: 'roa', name: 'ROA (Return on Assets - Annualized)', name_th: 'ผลตอบแทนต่อสินทรัพย์รวม (Annualized)', category: 'operating_capacity', unit: '%', values: roaVals },
          { key: 'roic', name: 'ROIC (Return on Invested Capital - Annualized)', name_th: 'ผลตอบแทนจากเงินลงทุนรวม (Annualized)', category: 'operating_capacity', unit: '%', values: roicVals },
          { key: 'fcf_to_sales', name: 'FCF to Sales Margin', name_th: 'อัตราส่วนกระแสเงินสดอิสระต่อรายได้', category: 'operating_capacity', unit: '%', values: fcfMarginVals },
          { key: 'fcf_to_net_income', name: 'FCF to Net Income Ratio', name_th: 'สัดส่วนกระแสเงินสดอิสระต่อกำไรสุทธิ (Cash Conversion)', category: 'operating_capacity', unit: '%', values: fcfToNetIncomeVals },
          { key: 'asset_turnover', name: 'Asset Turnover', name_th: 'อัตราหมุนเวียนสินทรัพย์รวม (Asset Turnover)', category: 'operating_capacity', unit: 'x', values: assetTurnoverVals },
          { key: 'inventory_turnover', name: 'Inventory Turnover', name_th: 'อัตราหมุนเวียนสินค้าคงเหลือ', category: 'operating_capacity', unit: 'x', values: invTurnoverVals },
          { key: 'dso', name: 'Days Sales Outstanding (DSO)', name_th: 'ระยะเวลาเก็บหนี้เฉลี่ย (วัน)', category: 'operating_capacity', unit: 'D', values: dsoVals },
          { key: 'dio', name: 'Days Inventory Outstanding (DIO)', name_th: 'ระยะเวลาขายสินค้าเฉลี่ย (วัน)', category: 'operating_capacity', unit: 'D', values: dioVals },
          { key: 'dpo', name: 'Days Payables Outstanding (DPO)', name_th: 'ระยะเวลาชำระหนี้เฉลี่ย (วัน)', category: 'operating_capacity', unit: 'D', values: dpoVals },
          { key: 'ccc', name: 'Cash Conversion Cycle (CCC)', name_th: 'วงจรเงินสดหมุนเวียน (วัน)', category: 'operating_capacity', unit: 'D', values: cccVals }
        ]
      },
      ...(statementTemplate === 'banking' ? [{
        category_key: 'banking_metrics',
        category_title: isThai ? '4. ดัชนีชี้วัดเฉพาะธุรกิจธนาคาร & FinTech (Banking & FinTech Key Metrics)' : '4. Banking & FinTech Metrics',
        metrics: [
          { key: 'nim', name: 'Net Interest Margin (NIM)', name_th: 'อัตราส่วนต่างดอกเบี้ยสุทธิ (NIM %)', category: 'banking_metrics', unit: '%', values: rawPeriods.map((_, i) => income?.net_interest_margin_pct?.[i] ?? null) },
          { key: 'deposit_growth', name: 'Total Deposits', name_th: 'ฐานเงินฝากรวมของลูกค้า ($M)', category: 'banking_metrics', unit: '$', values: rawPeriods.map((_, i) => balance?.deposits?.[i] ?? null) },
          { key: 'loan_deposit_ratio', name: 'Loan-to-Deposit Ratio (LDR)', name_th: 'อัตราส่วนสินเชื่อต่อเงินฝาก (LDR %)', category: 'banking_metrics', unit: '%', values: rawPeriods.map((_, i) => {
            const loans = balance?.loans_held_for_investment?.[i];
            const dep = balance?.deposits?.[i];
            if (loans && dep && dep > 0) return Number(((loans / dep) * 100).toFixed(1));
            return null;
          }) },
          { key: 'efficiency_ratio', name: 'Efficiency Ratio (Cost/Income)', name_th: 'อัตราส่วนต้นทุนต่อรายได้ (Efficiency Ratio %)', category: 'banking_metrics', unit: '%', values: rawPeriods.map((_, i) => {
            const opex = income?.operating_expenses?.[i];
            const rev = income?.revenue?.[i];
            if (opex && rev && rev > 0) return Number(((opex / rev) * 100).toFixed(1));
            return null;
          }) }
        ]
      }] : [])
    ]
  };

  // Balance Sheet Data items (Derived safely from company's real balance sheet)
  const bsItems = {
    total_assets: balance?.total_assets || [],
    current_assets: balance?.total_current_assets || [],
    cash_and_investments: (balance?.cash_and_equivalents || []).map((c, i) => {
      const sti = balance?.short_term_investments?.[i] || 0;
      return c !== null && c !== undefined ? c + sti : null;
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
    total_liabilities: balance?.total_liabilities || (balance?.total_assets || []).map((ta, i) => {
      const eq = balance?.total_equity?.[i];
      if (ta !== null && ta !== undefined && eq !== null && eq !== undefined) return ta - eq;
      return null;
    }),
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
    long_term_debt: (balance?.total_debt || []).map((td, i) => {
      const std = balance?.short_term_debt?.[i] || 0;
      if (td !== null && td !== undefined) return Math.max(0, td - std);
      return null;
    }),
    total_equity: balance?.total_equity || [],
    capital_stock: balance?.capital_stock || balance?.common_stock || [],
    common_stock: balance?.common_stock || balance?.capital_stock || [],
    retained_earnings: balance?.retained_earnings || [],
    aoci: balance?.aoci || []
  };

  // Cash Flow Data items (Derived safely from company's real cash flow)
  const cfItems = {
    ocf: cashflow?.operating_cash_flow || [],
    net_income_cont: income?.net_income || [],
    depreciation: cashflow?.depreciation || [],
    non_cash_items: cashflow?.non_cash_items || [],
    change_working_capital: cashflow?.change_working_capital || [],
    change_receivables: cashflow?.change_receivables || [],
    change_inventory: cashflow?.change_inventory || [],
    change_payables: cashflow?.change_payables || [],
    change_other_ca: cashflow?.change_other_ca || [],
    change_other_cl: cashflow?.change_other_cl || [],
    icf: cashflow?.investing_cash_flow || (cashflow?.capex || []).map(c => c !== null && c !== undefined ? -Math.abs(c) : null),
    capex: (cashflow?.capex || []).map(c => c !== null && c !== undefined ? -Math.abs(c) : null),
    investment_purchase: cashflow?.investment_purchase || [],
    other_investing: cashflow?.other_investing || [],
    fcf_financing: cashflow?.financing_cash_flow || [],
    debt_issuance_payments: cashflow?.debt_issuance_payments || [],
    stock_issuance_repurchase: cashflow?.stock_issuance_repurchase || [],
    dividends_paid: cashflow?.dividends_paid || [],
    other_financing: cashflow?.other_financing || [],
    change_in_deposits: cashflow?.change_in_deposits || [],
    change_in_loans_held_for_sale: cashflow?.change_in_loans_held_for_sale || [],
    provision_addback: cashflow?.provision_addback || [],
    ending_cash: balance?.cash_and_equivalents || [],
    net_change_cash: cashflow?.net_change_cash || [],
    beginning_cash: cashflow?.beginning_cash || [],
    free_cash_flow: cashflow?.free_cash_flow || (cashflow?.operating_cash_flow || []).map((ocf, i) => {
      const c = cashflow?.capex?.[i];
      if (ocf !== null && ocf !== undefined && c !== null && c !== undefined) return ocf - Math.abs(c);
      return ocf;
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
        operating_income: { en: statementTemplate === 'banking' ? 'Operating Income (Pre-Tax Earnings)' : 'Operating Profit (EBIT)', th: 'กำไรจากการดำเนินงาน', raw: income.operating_income || income.gross_profit?.map((gp, i) => gp && income.operating_expenses?.[i] ? gp - income.operating_expenses[i] : null) || [], isCurrency: true },
        gross_profit: { en: 'Gross Profit', th: 'กำไรขั้นต้น', raw: income.gross_profit || income.revenue?.map((r, i) => r && income.cogs?.[i] ? r - income.cogs[i] : null) || [], isCurrency: true },
        net_income: { en: 'Net Income to Common Stockholders', th: 'กำไรสุทธิสำหรับผู้ถือหุ้นสามัญ', raw: income.net_income || [], isCurrency: true },
        eps: { en: 'Diluted EPS', th: 'กำไรต่อหุ้นปรับลด', raw: income.eps_diluted || [], isCurrency: false, unit: '$' },
        cogs: { en: 'Cost of Revenue', th: 'ต้นทุนขายและบริการ', raw: income.cogs || income.revenue?.map((r, i) => r && income.gross_profit?.[i] ? r - income.gross_profit[i] : null) || [], isCurrency: true },
        opex: { en: statementTemplate === 'banking' ? 'Non-Interest Expense (Operating Expense)' : 'Operating Expense (OPEX)', th: statementTemplate === 'banking' ? 'ค่าใช้จ่ายในการดำเนินงาน (เทคโนโลยี/บริหาร)' : 'ค่าใช้จ่ายในการดำเนินงาน (OPEX)', raw: income.operating_expenses || income.gross_profit?.map((gp, i) => gp && income.operating_income?.[i] ? gp - income.operating_income[i] : null) || [], isCurrency: true },
        other_income: { en: 'Other Non-Operating Income (Expenses)', th: 'รายได้ (ค่าใช้จ่าย) อื่นที่ไม่เกี่ยวกับการดำเนินงาน', raw: income.other_income || [], isCurrency: true }
      };

      const selected = rowMap[selectedRowKey] || rowMap.revenue;
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
        goodwill: { en: 'Goodwill and Other Intangible Assets', th: 'ค่าความนิยมและสินทรัพย์ไม่มีตัวตน' },
        total_liabilities: { en: 'Total Liabilities', th: 'หนี้สินรวม' },
        deposits: { en: '⚠️ Total Deposits (Interest & Non-Interest Bearing)', th: 'เงินฝากรวมของลูกค้า (ภาระผูกพันหลักของธนาคาร)' },
        current_liabilities: { en: 'Total Current Liabilities', th: 'หนี้สินหมุนเวียนรวม' },
        payables: { en: 'Payables', th: 'เจ้าหนี้การค้าและค่าใช้จ่ายค้างจ่าย' },
        accounts_payable: { en: 'Accounts Payable', th: 'เจ้าหนี้การค้า' },
        tax_payable: { en: 'Total Tax Payable', th: 'ภาษีเงินได้ค้างจ่าย' },
        short_term_debt: { en: 'Short-Term Debt & Capital Lease', th: 'หนี้สินระยะสั้นและหนี้สัญญาเช่า' },
        current_deferred_liabilities: { en: 'Current Deferred Liabilities', th: 'หนี้สินรอการรับรู้ระยะสั้น / รายได้รับล่วงหน้า' },
        non_current_liabilities: { en: 'Total Non-Current Liabilities', th: 'หนี้สินไม่หมุนเวียนรวม' },
        long_term_debt: { en: 'Long Term Debt and Capital Lease Obligation', th: 'หนี้สินระยะยาวและหนี้สัญญาเช่าระยะยาว' },
        total_equity: { en: 'Total Stockholders\' Equity', th: 'ส่วนของผู้ถือหุ้นรวม' },
        capital_stock: { en: 'Capital Stock', th: 'ทุนเรือนหุ้น' },
        common_stock: { en: 'Common Stock', th: 'หุ้นสามัญ' },
        retained_earnings: { en: 'Retained Earnings', th: 'กำไรสะสม' },
        aoci: { en: 'Gains/Losses Not Affecting Retained Earnings', th: 'กำไร(ขาดทุน)เบ็ดเสร็จอื่นสะสม' }
      };

      const raw = bsItems[selectedRowKey as keyof typeof bsItems] || bsItems.total_assets;
      const filteredRaw = periodIndices.map(i => raw[i] !== undefined ? raw[i] : null);
      const titleObj = bsTitles[selectedRowKey] || { en: 'Total Assets', th: 'สินทรัพย์รวม' };
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
        net_income_cont: { en: 'Net Income from Continuing Operations', th: 'กำไรสุทธิจากการดำเนินงานต่อเนื่อง' },
        provision_addback: { en: 'Provision for Credit Losses (Add-back)', th: 'บวกกลับสำรองหนี้สูญและผลขาดทุนด้านเครดิต' },
        depreciation: { en: 'Depreciation & Depletion & Amortization', th: 'ค่าเสื่อมราคาและค่าตัดจำหน่าย' },
        non_cash_items: { en: 'Other Non-Cash Items', th: 'รายการที่ไม่ใช่เงินสดอื่นๆ' },
        change_working_capital: { en: 'Change in Working Capital', th: 'การเปลี่ยนแปลงในเงินทุนหมุนเวียน' },
        change_in_loans_held_for_sale: { en: '⚠️ Change in Loans Held for Sale (Originations vs Sales)', th: 'การเปลี่ยนแปลงในเงินให้สินเชื่อเพื่อการค้า/ขาย (ตัวแปรหลักฉุด/ดัน OCF)' },
        change_receivables: { en: 'Change in Receivables', th: 'การเปลี่ยนแปลงในลูกหนี้การค้า' },
        change_inventory: { en: 'Change in Inventory', th: 'การเปลี่ยนแปลงในสินค้าคงเหลือ' },
        change_payables: { en: 'Change in Payables and Accrued Expense', th: 'การเปลี่ยนแปลงในเจ้าหนี้การค้าและค่าใช้จ่ายค้างจ่าย' },
        change_other_ca: { en: 'Change in Other Current Assets', th: 'การเปลี่ยนแปลงในสินทรัพย์หมุนเวียนอื่น' },
        change_other_cl: { en: 'Change in Other Current Liabilities', th: 'การเปลี่ยนแปลงในหนี้สินหมุนเวียนอื่น' },
        icf: { en: 'Net Cash Flow from Continuing Investing Activities', th: 'กระแสเงินสดสุทธิจากกิจกรรมลงทุน (ICF)' },
        capex: { en: 'Net PPE Purchase and Sale (CapEx)', th: 'รายจ่ายฝ่ายทุน ซื้อ/ขายสินทรัพย์ถาวร (CapEx)' },
        investment_purchase: { en: 'Net Investment Purchase and Sale', th: 'เงินสดสุทธิซื้อ/ขายเงินลงทุน' },
        other_investing: { en: 'Net Other Investing Changes', th: 'การเปลี่ยนแปลงอื่นๆ ในกิจกรรมลงทุน' },
        fcf_financing: { en: 'Financing Cash Flow', th: 'กระแสเงินสดจากกิจกรรมจัดหาเงิน' },
        change_in_deposits: { en: '⚠️ Change in Customer Deposits', th: 'การเปลี่ยนแปลงสุทธิในเงินฝากลูกค้า (เงินฝากไหลเข้า/ออก)' },
        debt_issuance_payments: { en: 'Net Issuance Payments Of Debt', th: 'เงินสดสุทธิจากการกู้ยืม/ชำระคืนหนี้' },
        stock_issuance_repurchase: { en: 'Net Common Stock Issuance & Buybacks', th: 'เงินสดสุทธิจากการออกหุ้น / ซื้อหุ้นคืน' },
        dividends_paid: { en: 'Cash Dividends Paid', th: 'เงินปันผลจ่าย' },
        other_financing: { en: 'Net Other Financing Charges', th: 'ค่าใช้จ่ายและรายการอื่นจากกิจกรรมจัดหาเงิน' },
        ending_cash: { en: 'Ending Cash Balance', th: 'เงินสดคงเหลือปลายงวด' },
        net_change_cash: { en: 'Net Change in Cash', th: 'การเปลี่ยนแปลงสุทธิในเงินสด' },
        beginning_cash: { en: 'Beginning Cash Balance', th: 'เงินสดคงเหลือต้นงวด' },
        free_cash_flow: { en: 'Free Cash Flow', th: 'กระแสเงินสดอิสระ (FCF = OCF - CapEx)' }
      };

      const raw = cfItems[selectedRowKey as keyof typeof cfItems] || cfItems.ocf;
      const filteredRaw = periodIndices.map(i => raw[i] !== undefined ? raw[i] : null);
      const titleObj = cfTitles[selectedRowKey] || { en: 'Operating Cash Flow', th: 'กระแสเงินสดจากการดำเนินงาน' };
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
  const chartData = chartConfig.periods.map((p, idx) => ({
    period: p,
    value: chartConfig.values[idx] !== undefined ? chartConfig.values[idx] : null,
    yoy_pct: chartConfig.yoy_pcts && chartConfig.yoy_pcts[idx] !== undefined ? chartConfig.yoy_pcts[idx] : null
  }));

  // Seamless Background Live AI Financial Analyst Fetching via Gemini 3.6 Flash
  useEffect(() => {
    const activeCfg = getActiveChartConfig();
    const cacheKey = `${ticker}_${selectedRowKey}_${(activeCfg.values || []).join(',')}_${isThai ? 'th' : 'en'}`;
    if (liveAiInsights[cacheKey]) return;

    let isSubscribed = true;
    const fetchLiveAi = async () => {
      setIsAiAnalyzing(true);
      try {
        const res = await fetch('/api/analyze-metric', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticker: ticker,
            companyName: companyName,
            metricKey: selectedRowKey,
            metricName: isThai ? (activeCfg.title_th || activeCfg.title) : activeCfg.title,
            periods: activeCfg.periods,
            historyValues: activeCfg.values,
            yoyPcts: activeCfg.yoy_pcts,
            unit: activeCfg.unit || (activeCfg.isCurrency ? 'M' : ''),
            isCurrency: activeCfg.isCurrency,
            context: {
              revenue: income?.revenue,
              operatingIncome: income?.operating_income,
              netIncome: income?.net_income,
              ocf: cashflow?.operating_cash_flow,
              capex: cashflow?.capex,
              fcf: cashflow?.free_cash_flow
            },
            redFlags: data?.red_flags || [],
            isThai,
            model: 'gemini-3.8-flash'
          })
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.insight && isSubscribed) {
            const localFallback = getFinancialAiInsight(
              selectedRowKey,
              activeCfg.values[activeCfg.values.length - 1],
              activeCfg.unit || (activeCfg.isCurrency ? 'M' : ''),
              isThai,
              activeCfg.values,
              activeCfg.yoy_pcts,
              activeCfg.periods,
              activeCfg.title,
              activeCfg.isCurrency
            );
            setLiveAiInsights(prev => ({
              ...prev,
              [cacheKey]: {
                ...localFallback,
                ...json.insight,
                key: selectedRowKey,
                name: activeCfg.title,
                name_th: activeCfg.title_th || activeCfg.title,
                what_is_it_th: (json.insight?.what_is_it_th && json.insight.what_is_it_th.trim() !== '')
                  ? json.insight.what_is_it_th
                  : localFallback.what_is_it_th,
                what_is_it_en: (json.insight?.what_is_it_en && json.insight.what_is_it_en.trim() !== '')
                  ? json.insight.what_is_it_en
                  : localFallback.what_is_it_en,
                benchmark_th: (json.insight?.benchmark_th && json.insight.benchmark_th.trim() !== '')
                  ? json.insight.benchmark_th
                  : localFallback.benchmark_th,
                benchmark_en: (json.insight?.benchmark_en && json.insight.benchmark_en.trim() !== '')
                  ? json.insight.benchmark_en
                  : localFallback.benchmark_en
              }
            }));
          }
        }
      } catch (err) {
        console.warn('Live AI insight fetch error:', err);
      } finally {
        if (isSubscribed) setIsAiAnalyzing(false);
      }
    };

    fetchLiveAi();
    return () => { isSubscribed = false; };
  }, [selectedRowKey, isThai, statementTab, quarterFilter, periodType]);

  const renderGenericRow = (
    key: string,
    title: string,
    rawValues: (number | null | undefined)[],
    isGroup = false,
    indent = 0,
    title_th?: string
  ) => {
    const isSelected = selectedRowKey === key;
    const values = periodIndices.map(i => rawValues[i] !== undefined ? rawValues[i] : null);
    const comparisonList = calculateComparison(values, key);
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
              <div className={`leading-snug ${isGroup ? 'font-bold text-stone-900' : indent === 1 ? 'font-semibold text-stone-800' : 'text-stone-700'}`}>
                {indent > 0 ? `— ${title}` : title}
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
            <td key={idx} className="py-2.5 px-3 text-right">
              <div className="font-mono text-stone-900 font-bold">
                {val !== null && val !== undefined ? formatNum(val) : '-'}
              </div>
              {compareMode !== 'hide' && comp !== null && (
                <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${comp >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  <span>{comp >= 0 ? '+' : ''}{comp.toFixed(2)}%</span>
                  <span className="text-[8px] text-stone-400 font-sans uppercase font-medium">({compareMode})</span>
                </div>
              )}
            </td>
          );
        })}
      </tr>
    );
  };

  const deadlines = ['Jun 29, 2024', 'Sep 28, 2024', 'Dec 28, 2024', 'Mar 29, 2025', 'Jun 28, 2025', 'Sep 27, 2025', 'Dec 27, 2025', 'Mar 28, 2026', 'Jun 27, 2026'];

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
                <span>{isThai ? `งบการเงินล่าสุด: ${rawPeriods[rawPeriods.length - 1]}` : `Latest Quarter: ${rawPeriods[rawPeriods.length - 1]}`}</span>
              </span>
            )}
            <span className="text-xs text-stone-500 font-mono">
              {isThai ? 'สกุลเงิน:' : 'Currency:'} <strong className="text-stone-800">{currencyMode}</strong>
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
                    <span>Assets = Liab + Equity (Balanced: Δ &lt; 1%)</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Assets ≠ Liab + Equity (Imbalance Δ &gt; 1%)</span>
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
                title={validation.failed_guards?.join('; ') || 'Accounting guards verified'}
              >
                {validation.impossible_guards_passed ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>{statementTemplate === 'banking' ? 'Assets ≥ Deposits (Guard OK)' : 'Accounting Guards Passed'}</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                    <span>{validation.failed_guards?.[0]?.split(':')[0] || 'Accounting Guard Alert'}</span>
                  </>
                )}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-stone-500 text-[11px] font-mono">
            <Shield className="w-3.5 h-3.5 text-[#0b5a4b]" />
            <span>Source reconciliation not verified</span>
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
                  ? 'อัตราส่วนทางการเงิน (เช่น ROE, Margin, D/E) อาจดูสมเหตุสมผลเนื่องจากตัวตั้งและตัวหารผิดพลาดไปในทิศทางเดียวกันและหักล้างกันเอง ข้อมูลดิบในบางไตรมาสยังไม่ผ่านเกณฑ์สมดุลบัญชี ระบบได้ทำเครื่องหมายเตือนไว้ที่ตัวเลขดิบที่เกี่ยวข้อง'
                  : 'Derived financial ratios (e.g. ROE, Margins, D/E) may appear normal because both numerator and denominator erred in the same direction, offsetting each other. Raw statement inputs have been flagged for audit review.'}
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
                  {chartConfig.values[chartConfig.values.length - 1] !== null
                    ? (chartConfig.isCurrency ? `${formatNum(chartConfig.values[chartConfig.values.length - 1])}` : `${chartConfig.values[chartConfig.values.length - 1]}${chartConfig.unit}`)
                    : '-'}
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
                    <span>{periodType === 'annual' ? 'Annual' : `Quarterly · ${quarterFilter === 'all' ? 'All' : quarterFilter}`}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
                  </button>

                  {periodDropdownOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-stone-200 rounded-2xl shadow-xl z-50 p-1.5 flex flex-col text-xs font-sans text-stone-800">
                      <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-2 py-1">Period Selection</div>
                      <button
                        type="button"
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
                      tickFormatter={(val: number) => `${val > 0 ? '+' : ''}${val.toFixed(1)}%`}
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
                                : `${Number(entry.value) > 0 ? '+' : ''}${Number(entry.value).toFixed(2)}%`;
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
                      connectNulls={true}
                      name="yoy_pct"
                      isAnimationActive={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
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

        {/* Tab 1: Key Indicators Table */}
        {statementTab === 'indicators' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  <th className="py-3 px-4 min-w-[220px] sticky left-0 bg-stone-50 z-10 shadow-xs">
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
                                <div className="font-mono text-stone-900 font-bold">
                                  {val !== null && val !== undefined ? `${val}${metric.unit}` : '-'}
                                </div>
                                {compareMode !== 'hide' && comp !== null && (
                                  <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${comp > 0 ? 'text-emerald-600' : comp < 0 ? 'text-rose-600' : 'text-stone-400'
                                    }`}>
                                    <span>{comp > 0 ? '+' : ''}{comp.toFixed(2)}%</span>
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
        )}

        {/* Tab 2: Income Statement Table (GAAP Detailed) */}
        {statementTab === 'income' && income && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  <th className="py-3 px-4 sticky left-0 bg-stone-50 z-10 shadow-xs min-w-[240px]">
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
                          <td key={idx} className="py-2.5 px-3 text-right">
                            <div className="font-mono text-stone-900 font-bold">{formatNum(vals[idx])}</div>
                            {compareMode !== 'hide' && comp !== null && (
                              <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${comp >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
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
                          <td key={idx} className="py-2.5 px-3 text-right">
                            <div className="font-mono text-stone-800 font-medium">{formatNum(vals[idx])}</div>
                            {compareMode !== 'hide' && comp !== null && (
                              <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${comp >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
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
                          <td key={idx} className="py-2.5 px-3 text-right">
                            <div className="font-mono text-stone-800 font-medium">{formatNum(vals[idx])}</div>
                            {compareMode !== 'hide' && comp !== null && (
                              <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${comp >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
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
                          <td key={idx} className="py-2.5 px-3 text-right">
                            <div className="font-mono text-rose-700 font-medium">
                              {vals[idx] !== null && vals[idx] !== undefined ? `(${formatNum(Math.abs(vals[idx]!))})` : '-'}
                            </div>
                            {compareMode !== 'hide' && comp !== null && (
                              <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${comp <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
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
                          <td key={idx} className="py-2.5 px-3 text-right">
                            <div className="font-mono text-stone-800">{formatNum(vals[idx])}</div>
                            {compareMode !== 'hide' && comp !== null && (
                              <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${comp >= 0 ? 'text-stone-500' : 'text-rose-600'}`}>
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
                          <td key={idx} className="py-2.5 px-3 text-right">
                            <div className="font-mono text-stone-900 font-bold">{formatNum(vals[idx])}</div>
                            {compareMode !== 'hide' && comp !== null && (
                              <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${comp >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
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
                          <td key={idx} className="py-2.5 px-3 text-right">
                            <div className="font-mono text-stone-900 font-bold">{formatNum(vals[idx])}</div>
                            {compareMode !== 'hide' && comp !== null && (
                              <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${comp >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
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
                        const rawCogs = income.cogs || income.revenue.map((r, i) => {
                          const gp = income.gross_profit?.[i];
                          if (r !== null && r !== undefined && gp !== null && gp !== undefined) return r - gp;
                          return null;
                        });
                        const vals = periodIndices.map(i => rawCogs[i]);
                        const comp = calculateComparison(vals, 'cogs')[idx];
                        return (
                          <td key={idx} className="py-2.5 px-3 text-right">
                            <div className="font-mono text-stone-800">{formatNum(vals[idx])}</div>
                            {compareMode !== 'hide' && comp !== null && (
                              <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${comp >= 0 ? 'text-stone-500' : 'text-rose-600'}`}>
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
                        const rawGp = income.gross_profit || income.revenue.map((r, i) => {
                          const c = income.cogs?.[i];
                          if (r !== null && r !== undefined && c !== null && c !== undefined) return r - c;
                          return null;
                        });
                        const vals = periodIndices.map(i => rawGp[i]);
                        const comp = calculateComparison(vals, 'gross_profit')[idx];
                        return (
                          <td key={idx} className="py-2.5 px-3 text-right">
                            <div className="font-mono text-stone-900 font-bold">{formatNum(vals[idx])}</div>
                            {compareMode !== 'hide' && comp !== null && (
                              <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${comp >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
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
                            <div className="text-[11px] font-normal text-stone-500 font-sans mt-0.5">ค่าใช้จ่ายในการดำเนินงานรวม (SG&A + R&D)</div>
                          </div>
                        </div>
                      </td>
                      {periods.map((_, idx) => {
                        const rawOpex = income.operating_expenses || (income.gross_profit || []).map((gp, i) => {
                          const op = income.operating_income?.[i];
                          if (gp !== null && gp !== undefined && op !== null && op !== undefined) return gp - op;
                          return null;
                        });
                        const vals = periodIndices.map(i => rawOpex[i]);
                        const comp = calculateComparison(vals, 'opex')[idx];
                        return (
                          <td key={idx} className="py-2.5 px-3 text-right">
                            <div className="font-mono text-stone-800">{formatNum(vals[idx])}</div>
                            {compareMode !== 'hide' && comp !== null && (
                              <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${comp >= 0 ? 'text-stone-500' : 'text-rose-600'}`}>
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
                            <div className="font-bold text-stone-900 leading-snug">Operating Profit (EBIT)</div>
                            <div className="text-[11px] font-normal text-stone-500 font-sans mt-0.5">กำไรจากการดำเนินงาน</div>
                          </div>
                        </div>
                      </td>
                      {periods.map((_, idx) => {
                        const rawOp = income.operating_income || (income.gross_profit || []).map((gp, i) => {
                          const opex = income.operating_expenses?.[i];
                          if (gp !== null && gp !== undefined && opex !== null && opex !== undefined) return gp - opex;
                          return null;
                        });
                        const vals = periodIndices.map(i => rawOp[i]);
                        const comp = calculateComparison(vals, 'operating_income')[idx];
                        return (
                          <td key={idx} className="py-2.5 px-3 text-right">
                            <div className="font-mono text-stone-900 font-bold">{formatNum(vals[idx])}</div>
                            {compareMode !== 'hide' && comp !== null && (
                              <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${comp >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
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

                {/* 6. Other Non-Operating Income */}
                <tr
                  onClick={() => setSelectedRowKey('other_income')}
                  className={`transition-colors cursor-pointer ${selectedRowKey === 'other_income' ? 'bg-stone-100/90 font-semibold text-stone-950 border-l-4 border-l-[#0b5a4b]' : 'hover:bg-stone-50/60 text-stone-600'}`}
                >
                  <td className="py-2.5 px-4 pl-8 sticky left-0 bg-inherit z-10 shadow-xs">
                    <div>
                      <div className="font-semibold text-stone-700 leading-snug">— Other Non-Operating Income (Expenses)</div>
                      <div className="text-[11px] font-normal text-stone-500 font-sans mt-0.5">รายได้ / ค่าใช้จ่ายอื่นที่ไม่เกี่ยวกับการดำเนินงาน</div>
                    </div>
                  </td>
                  {periods.map((_, idx) => {
                    const otherVals = income.other_income || [];
                    const vals = periodIndices.map(i => otherVals[i] !== undefined ? otherVals[i] : null);
                    const val = vals[idx];
                    const comp = calculateComparison(vals, 'other_income')[idx];
                    return (
                      <td key={idx} className="py-2.5 px-3 text-right">
                        <div className="font-mono text-stone-700 font-medium">{val !== null && val !== undefined ? formatNum(val) : '-'}</div>
                        {compareMode !== 'hide' && comp !== null && (
                          <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${comp >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            <span>{comp >= 0 ? '+' : ''}{comp.toFixed(2)}%</span>
                            <span className="text-[8px] text-stone-400 font-sans uppercase font-medium">({compareMode})</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* 7. Net Income */}
                <tr
                  onClick={() => setSelectedRowKey('net_income')}
                  className={`transition-colors cursor-pointer ${selectedRowKey === 'net_income' ? 'bg-stone-100/90 font-bold text-stone-950 border-l-4 border-l-[#0b5a4b]' : 'hover:bg-stone-50/60 font-bold text-stone-900'}`}
                >
                  <td className="py-2.5 px-4 sticky left-0 bg-inherit z-10 shadow-xs">
                    <div className="flex items-start gap-2">
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${selectedRowKey === 'net_income' ? 'bg-[#0b5a4b]' : 'bg-stone-400'}`} />
                      <div>
                        <div className="font-bold text-stone-900 leading-snug">Net Income to Common Stockholders</div>
                        <div className="text-[11px] font-normal text-stone-500 font-sans mt-0.5">กำไรสุทธิส่วนของผู้ถือหุ้นสามัญ</div>
                      </div>
                    </div>
                  </td>
                  {periods.map((_, idx) => {
                    const vals = periodIndices.map(i => income.net_income[i]);
                    const comp = calculateComparison(vals, 'net_income')[idx];
                    return (
                      <td key={idx} className="py-2.5 px-3 text-right">
                        <div className="font-mono font-bold text-stone-900">{formatNum(vals[idx])}</div>
                        {compareMode !== 'hide' && comp !== null && (
                          <div className={`font-mono text-[10px] flex items-center justify-end gap-1 ${comp >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                            <span>{comp >= 0 ? '+' : ''}{comp.toFixed(2)}%</span>
                            <span className="text-[8px] text-stone-400 font-sans uppercase font-medium">({compareMode})</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>

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
                        <div className="text-[11px] font-normal text-stone-500 font-sans mt-0.5">กำไรต่อหุ้นปรับลด (ดอลลาร์/หุ้น)</div>
                      </div>
                    </div>
                  </td>
                  {periods.map((_, idx) => {
                    const rawEps = income.eps_diluted || [];
                    const vals = periodIndices.map(i => rawEps[i] !== undefined ? rawEps[i] : null);
                    const epsVal = vals[idx];
                    const yoy = calculateComparison(vals)[idx];
                    return (
                      <td key={idx} className="py-2.5 px-3 text-right">
                        <div className="font-mono font-bold text-stone-900">{epsVal !== null && epsVal !== undefined ? `$${epsVal.toFixed(2)}` : '-'}</div>
                        {compareMode !== 'hide' && yoy !== null && (
                          <div className={`font-mono text-[10px] ${yoy >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {yoy >= 0 ? '+' : ''}{yoy.toFixed(2)}%
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Balance Sheet Table (Hierarchical GAAP) */}
        {statementTab === 'balance' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  <th className="py-3 px-4 sticky left-0 bg-stone-50 z-10 shadow-xs min-w-[240px]">
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
                    {renderGenericRow('goodwill', 'Goodwill & Intangibles (M&A Assets)', bsItems.goodwill, false, 1, 'ค่าความนิยมและสินทรัพย์ไม่มีตัวตนจากการซื้อกิจการ (Galileo, Technisys, Peach)')}

                    {/* 3. Total Liabilities */}
                    {renderGenericRow('total_liabilities', 'Total Liabilities', bsItems.total_liabilities, true, 0, 'หนี้สินรวม')}

                    {/* 4. Deposits - CRUCIAL BANK LIABILITY ROW */}
                    {renderGenericRow('deposits', '⚠️ Total Customer Deposits (Interest & Non-Interest)', bsItems.deposits, true, 1, 'เงินฝากรวมของลูกค้า (หนี้สินและแหล่งเงินทุนหลักของธนาคาร)')}

                    {/* 5. Other Bank Liabilities */}
                    {renderGenericRow('short_term_debt', 'Short-Term Borrowings & Repos', bsItems.short_term_debt, false, 1, 'เงินกู้ยืมระยะสั้นและธุรกรรมซื้อคืน')}
                    {renderGenericRow('long_term_debt', 'Long-Term Notes & Debt Obligations', bsItems.long_term_debt, false, 1, 'หนี้สินระยะยาวและหุ้นกู้')}

                    {/* 6. Total Stockholders' Equity */}
                    {renderGenericRow('total_equity', 'Total Stockholders\' Equity', bsItems.total_equity, true, 0, 'ส่วนของผู้ถือหุ้นรวม')}
                    {renderGenericRow('capital_stock', 'Common Stock & Additional Paid-in Capital', bsItems.capital_stock, false, 1, 'ทุนเรือนหุ้นและส่วนเกินมูลค่าหุ้น')}
                    {renderGenericRow('retained_earnings', 'Retained Earnings (Accumulated Deficit)', bsItems.retained_earnings, false, 1, 'กำไร(ขาดทุน)สะสม')}
                    {renderGenericRow('aoci', 'Accumulated Other Comprehensive Income (AOCI)', bsItems.aoci, false, 1, 'กำไร(ขาดทุน)เบ็ดเสร็จอื่นสะสม')}
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
                    {renderGenericRow('goodwill', 'Goodwill and Other Intangible Assets', bsItems.goodwill, false, 1, 'ค่าความนิยมและสินทรัพย์ไม่มีตัวตน')}

                    {/* 4. Total Liabilities */}
                    {renderGenericRow('total_liabilities', 'Total Liabilities', bsItems.total_liabilities, true, 0, 'หนี้สินรวม')}

                    {/* 5. Current Liabilities Group */}
                    {renderGenericRow('current_liabilities', 'Total Current Liabilities', bsItems.current_liabilities, true, 0, 'หนี้สินหมุนเวียนรวม')}
                    {renderGenericRow('payables', 'Payables', bsItems.payables, false, 1, 'เจ้าหนี้การค้าและค่าใช้จ่ายค้างจ่าย')}
                    {renderGenericRow('accounts_payable', 'Accounts Payable', bsItems.accounts_payable, false, 2, 'เจ้าหนี้การค้า')}
                    {renderGenericRow('tax_payable', 'Total Tax Payable', bsItems.tax_payable, false, 2, 'ภาษีเงินได้ค้างจ่าย')}
                    {renderGenericRow('short_term_debt', 'Short-Term Debt & Capital Lease', bsItems.short_term_debt, false, 1, 'หนี้สินระยะสั้นและหนี้สัญญาเช่า')}
                    {renderGenericRow('current_deferred_liabilities', 'Current Deferred Liabilities', bsItems.current_deferred_liabilities, false, 1, 'หนี้สินรอการรับรู้ระยะสั้น / รายได้รับล่วงหน้า')}

                    {/* 6. Non-Current Liabilities Group */}
                    {renderGenericRow('non_current_liabilities', 'Total Non-Current Liabilities', bsItems.non_current_liabilities, true, 0, 'หนี้สินไม่หมุนเวียนรวม')}
                    {renderGenericRow('long_term_debt', 'Long Term Debt and Capital Lease Obligation', bsItems.long_term_debt, false, 1, 'หนี้สินระยะยาวและหนี้สัญญาเช่าระยะยาว')}

                    {/* 7. Total Equity & Stockholders' Equity Group */}
                    {renderGenericRow('total_equity', 'Total Equity / Stockholders\' Equity', bsItems.total_equity, true, 0, 'ส่วนของผู้ถือหุ้นรวม')}
                    {renderGenericRow('capital_stock', 'Capital Stock', bsItems.capital_stock, false, 1, 'ทุนเรือนหุ้น')}
                    {renderGenericRow('common_stock', 'Common Stock', bsItems.common_stock, false, 2, 'หุ้นสามัญ')}
                    {renderGenericRow('retained_earnings', 'Retained Earnings', bsItems.retained_earnings, false, 1, 'กำไรสะสม')}
                    {renderGenericRow('aoci', 'Gains/Losses Not Affecting Retained Earnings', bsItems.aoci, false, 1, 'กำไร(ขาดทุน)เบ็ดเสร็จอื่นสะสม')}
                  </>
                )}

                {/* Metadata Footer */}
                <tr className="bg-stone-50/80 text-[11px] text-stone-500 font-mono">
                  <td className="py-2.5 px-4 sticky left-0 bg-stone-50 z-10 shadow-xs font-bold text-stone-600">Deadline</td>
                  {periodIndices.map(i => deadlines[i % deadlines.length]).map((d, idx) => (
                    <td key={idx} className="py-2.5 px-3 text-right">{d}</td>
                  ))}
                </tr>
                <tr className="bg-stone-50/80 text-[11px] text-stone-500 font-mono">
                  <td className="py-2 px-4 sticky left-0 bg-stone-50 z-10 shadow-xs font-bold text-stone-600">Accounting Standard</td>
                  {periods.map((_, idx) => (
                    <td key={idx} className="py-2 px-3 text-right">US_GAAP</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Cash Flow Table (Hierarchical GAAP) */}
        {statementTab === 'cashflow' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  <th className="py-3 px-4 sticky left-0 bg-stone-50 z-10 shadow-xs min-w-[240px]">
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
                    {renderGenericRow('net_income_cont', 'Net Income from Continuing Operations', cfItems.net_income_cont, false, 1, 'กำไรสุทธิจากการดำเนินงาน')}
                    {renderGenericRow('provision_addback', 'Provision for Credit Losses (Non-Cash Add-back)', cfItems.provision_addback, false, 1, 'บวกกลับสำรองหนี้สูญ (รายการที่ไม่ใช่เงินสด)')}
                    {renderGenericRow('depreciation', 'Depreciation & Amortization', cfItems.depreciation, false, 1, 'ค่าเสื่อมราคาและค่าตัดจำหน่าย')}
                    {renderGenericRow('non_cash_items', 'Other Operating Adjustments', cfItems.non_cash_items, false, 1, 'การปรับปรุงรายการดำเนินงานอื่นๆ')}
                    {renderGenericRow('change_in_loans_held_for_sale', '⚠️ Change in Loans Held for Sale (Originations vs Sales)', cfItems.change_in_loans_held_for_sale, true, 1, 'การเปลี่ยนแปลงในเงินให้สินเชื่อเพื่อการค้า/ขาย (ตัวแปรหลักฉุด/ดัน OCF สถาบันการเงิน)')}

                    {/* 2. Investing Cash Flow Group */}
                    {renderGenericRow('icf', 'Net Cash Flow from Investing Activities', cfItems.icf, true, 0, 'กระแสเงินสดจากกิจกรรมลงทุน (ICF)')}
                    {renderGenericRow('capex', 'Net PPE & Technology CapEx', cfItems.capex, false, 1, 'รายจ่ายฝ่ายทุน ซื้อสินทรัพย์และระบบเทคโนโลยี (CapEx)')}
                    {renderGenericRow('investment_purchase', 'Net Purchases/Sales of Investment Securities', cfItems.investment_purchase, false, 1, 'เงินสดสุทธิจากการซื้อ/ขายเงินลงทุนในหลักทรัพย์')}
                    {renderGenericRow('other_investing', 'Other Investing Activities', cfItems.other_investing, false, 1, 'กิจกรรมลงทุนอื่น')}

                    {/* 3. Financing Cash Flow Group */}
                    {renderGenericRow('fcf_financing', 'Financing Cash Flow', cfItems.fcf_financing, true, 0, 'กระแสเงินสดจากกิจกรรมจัดหาเงิน')}
                    {renderGenericRow('change_in_deposits', '⚠️ Net Change in Customer Deposits (Inflow/Outflow)', cfItems.change_in_deposits, true, 1, 'การเปลี่ยนแปลงสุทธิในเงินฝากลูกค้า (กระแสเงินสดหลักของธนาคาร)')}
                    {renderGenericRow('debt_issuance_payments', 'Net Issuance/Repayments Of Borrowings', cfItems.debt_issuance_payments, false, 1, 'เงินสดสุทธิจากการกู้ยืม/ชำระคืนเงินกู้')}
                    {renderGenericRow('stock_issuance_repurchase', 'Net Common Stock Issuance & Buybacks', cfItems.stock_issuance_repurchase, false, 1, 'เงินสดสุทธิจากการออกหุ้น / ซื้อหุ้นคืน')}
                    {renderGenericRow('ending_cash', 'Ending Cash & Cash Equivalents', cfItems.ending_cash, true, 1, 'เงินสดคงเหลือปลายงวด')}

                    {/* 4. Free Cash Flow */}
                    {renderGenericRow('free_cash_flow', 'Free Cash Flow (FCF = OCF - CapEx)', cfItems.free_cash_flow, true, 0, 'กระแสเงินสดอิสระ (FCF = OCF - CapEx)')}
                  </>
                ) : (
                  <>
                    {/* 1. Operating Cash Flow Group */}
                    {renderGenericRow('ocf', 'Operating Cash Flow', cfItems.ocf, true, 0, 'กระแสเงินสดจากการดำเนินงาน (OCF)')}
                    {renderGenericRow('net_income_cont', 'Net Income from Continuing Operations', cfItems.net_income_cont, false, 1, 'กำไรสุทธิจากการดำเนินงานต่อเนื่อง')}
                    {renderGenericRow('depreciation', 'Depreciation & Depletion & Amortization', cfItems.depreciation, false, 1, 'ค่าเสื่อมราคาและค่าตัดจำหน่าย')}
                    {renderGenericRow('non_cash_items', 'Other Non-Cash Items', cfItems.non_cash_items, false, 1, 'รายการที่ไม่ใช่เงินสดอื่นๆ')}
                    {renderGenericRow('change_working_capital', 'Change in Working Capital', cfItems.change_working_capital, true, 1, 'การเปลี่ยนแปลงในเงินทุนหมุนเวียน')}
                    {renderGenericRow('change_receivables', 'Change in Receivables', cfItems.change_receivables, false, 2, 'การเปลี่ยนแปลงในลูกหนี้การค้า')}
                    {renderGenericRow('change_inventory', 'Change in Inventory', cfItems.change_inventory, false, 2, 'การเปลี่ยนแปลงในสินค้าคงเหลือ')}
                    {renderGenericRow('change_payables', 'Change in Payables and Accrued Expense', cfItems.change_payables, false, 2, 'การเปลี่ยนแปลงในเจ้าหนี้การค้าและค่าใช้จ่ายค้างจ่าย')}
                    {renderGenericRow('change_other_ca', 'Change in Other Current Assets', cfItems.change_other_ca, false, 2, 'การเปลี่ยนแปลงในสินทรัพย์หมุนเวียนอื่น')}
                    {renderGenericRow('change_other_cl', 'Change in Other Current Liabilities', cfItems.change_other_cl, false, 2, 'การเปลี่ยนแปลงในหนี้สินหมุนเวียนอื่น')}

                    {/* 2. Investing Cash Flow Group */}
                    {renderGenericRow('icf', 'Net Cash Flow from Continuing Investing Activities', cfItems.icf, true, 0, 'กระแสเงินสดสุทธิจากกิจกรรมลงทุน (ICF)')}
                    {renderGenericRow('capex', 'Net PPE Purchase and Sale (CapEx)', cfItems.capex, false, 1, 'รายจ่ายฝ่ายทุน ซื้อ/ขายสินทรัพย์ถาวร (CapEx)')}
                    {renderGenericRow('investment_purchase', 'Net Investment Purchase and Sale', cfItems.investment_purchase, false, 1, 'เงินสดสุทธิซื้อ/ขายเงินลงทุน')}
                    {renderGenericRow('other_investing', 'Net Other Investing Changes', cfItems.other_investing, false, 1, 'การเปลี่ยนแปลงอื่นๆ ในกิจกรรมลงทุน')}

                    {/* 3. Financing Cash Flow Group */}
                    {renderGenericRow('fcf_financing', 'Financing Cash Flow (Net Cash from Financing)', cfItems.fcf_financing, true, 0, 'กระแสเงินสดจากกิจกรรมจัดหาเงิน (Financing Cash Flow)')}
                    {renderGenericRow('debt_issuance_payments', 'Net Issuance Payments Of Debt', cfItems.debt_issuance_payments, false, 1, 'เงินสดสุทธิจากการกู้ยืม/ชำระคืนหนี้')}
                    {renderGenericRow('stock_issuance_repurchase', 'Net Common Stock Issuance (Buybacks)', cfItems.stock_issuance_repurchase, false, 1, 'เงินสดสุทธิจากการออกหุ้น / ซื้อหุ้นคืน (Buybacks)')}
                    {renderGenericRow('dividends_paid', 'Cash Dividends Paid', cfItems.dividends_paid, false, 1, 'เงินปันผลจ่าย')}
                    {renderGenericRow('other_financing', 'Net Other Financing Charges', cfItems.other_financing, false, 1, 'ค่าใช้จ่ายและรายการอื่นจากกิจกรรมจัดหาเงิน')}
                    {renderGenericRow('ending_cash', 'Ending Cash Balance', cfItems.ending_cash, true, 1, 'เงินสดคงเหลือปลายงวด')}
                    {renderGenericRow('net_change_cash', 'Net Change in Cash', cfItems.net_change_cash, false, 2, 'การเปลี่ยนแปลงสุทธิในเงินสด')}
                    {renderGenericRow('beginning_cash', 'Beginning Cash Balance', cfItems.beginning_cash, false, 2, 'เงินสดคงเหลือต้นงวด')}

                    {/* 4. Free Cash Flow */}
                    {renderGenericRow('free_cash_flow', 'Free Cash Flow (FCF = OCF - CapEx)', cfItems.free_cash_flow, true, 0, 'กระแสเงินสดอิสระ (FCF = OCF - CapEx)')}
                  </>
                )}

                {/* Metadata Footer */}
                <tr className="bg-stone-50/80 text-[11px] text-stone-500 font-mono">
                  <td className="py-2.5 px-4 sticky left-0 bg-stone-50 z-10 shadow-xs font-bold text-stone-600">Deadline</td>
                  {periodIndices.map(i => deadlines[i % deadlines.length]).map((d, idx) => (
                    <td key={idx} className="py-2.5 px-3 text-right">{d}</td>
                  ))}
                </tr>
                <tr className="bg-stone-50/80 text-[11px] text-stone-500 font-mono">
                  <td className="py-2 px-4 sticky left-0 bg-stone-50 z-10 shadow-xs font-bold text-stone-600">Accounting Standard</td>
                  {periods.map((_, idx) => (
                    <td key={idx} className="py-2 px-3 text-right">US_GAAP</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Dynamic AI Financial Analyst Live Deep-Dive Inspection Box */}
        {(() => {
          const activeCfg = getActiveChartConfig();
          const latestVal = activeCfg.values[activeCfg.values.length - 1];
          const uStr = activeCfg.unit || (activeCfg.isCurrency ? 'M' : '');
          const latestPeriod = activeCfg.periods[activeCfg.periods.length - 1];
          const latestYoY = activeCfg.yoy_pcts && activeCfg.yoy_pcts.length > 0
            ? activeCfg.yoy_pcts[activeCfg.yoy_pcts.length - 1]
            : null;

          const cacheKey = `${ticker}_${selectedRowKey}_${(activeCfg.values || []).join(',')}_${isThai ? 'th' : 'en'}`;
          const liveInsight = liveAiInsights[cacheKey];
          const localInsight = getFinancialAiInsight(
            selectedRowKey,
            latestVal,
            uStr,
            isThai,
            activeCfg.values,
            activeCfg.yoy_pcts,
            activeCfg.periods,
            activeCfg.title,
            activeCfg.isCurrency
          );
          const aiInsight: FinancialAiInsight = liveInsight ? {
            ...localInsight,
            ...liveInsight,
            what_is_it_th: (liveInsight.what_is_it_th && liveInsight.what_is_it_th.trim() !== '')
              ? liveInsight.what_is_it_th
              : localInsight.what_is_it_th,
            what_is_it_en: (liveInsight.what_is_it_en && liveInsight.what_is_it_en.trim() !== '')
              ? liveInsight.what_is_it_en
              : localInsight.what_is_it_en,
            benchmark_th: (liveInsight.benchmark_th && liveInsight.benchmark_th.trim() !== '')
              ? liveInsight.benchmark_th
              : localInsight.benchmark_th,
            benchmark_en: (liveInsight.benchmark_en && liveInsight.benchmark_en.trim() !== '')
              ? liveInsight.benchmark_en
              : localInsight.benchmark_en,
          } : localInsight;
          const isFromGemini = !!liveInsight;

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
                        <span>{isFromGemini ? 'Gemini AI · Live Financial Analyst' : 'AI Financial Analyst'}</span>
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
                      {latestVal !== null && latestVal !== undefined
                        ? (activeCfg.isCurrency ? `${formatNum(latestVal)}` : `${latestVal}${uStr}`)
                        : '-'}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs font-mono">
                      <span className="text-stone-400">({latestPeriod || (isThai ? 'งบล่าสุด' : 'Latest')})</span>
                      {latestYoY !== null && latestYoY !== undefined && (
                        <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                          latestYoY >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {latestYoY >= 0 ? '+' : ''}{latestYoY.toFixed(1)}% YoY
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
                    <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
                      <span className="text-xs font-bold text-stone-700 uppercase tracking-wider font-mono flex items-center gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5 text-[#0b5a4b]" />
                        <span>{isThai ? 'มุมมองการวิเคราะห์เชิงลึก (Analyst Synthesis)' : 'Institutional Analyst Synthesis'}</span>
                      </span>
                      <span className="text-[11px] text-stone-400 font-mono">
                        {isFromGemini ? (aiInsight.model ? `${aiInsight.model} Synthesis` : 'Gemini AI Live Synthesis') : 'Harmonized Rule Engine'}
                      </span>
                    </div>

                    {/* Definition Context */}
                    <div className="bg-stone-50/70 p-3 rounded-xl border border-stone-150 text-xs text-stone-600 font-sans leading-relaxed flex items-start gap-2">
                      <Info className="w-3.5 h-3.5 text-stone-400 mt-0.5 shrink-0" />
                      <div>
                        <strong className="text-stone-800 font-medium mr-1">{isThai ? 'ความหมาย:' : 'Definition:'}</strong>
                        <span>{isThai ? (aiInsight.what_is_it_th || localInsight.what_is_it_th) : (aiInsight.what_is_it_en || localInsight.what_is_it_en)}</span>
                      </div>
                    </div>

                    {/* Deep-Dive Live Analysis */}
                    <div className="text-xs sm:text-[13px] text-stone-800 font-sans leading-relaxed space-y-2">
                      <p>
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
                    <p className="text-xs text-amber-950/90 font-sans leading-relaxed">
                      {renderFormattedText(isThai ? aiInsight.watchouts_th : aiInsight.watchouts_en)}
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. Subtle Footer Interactive Hint */}
              <div className="pt-2 border-t border-stone-200/70 flex items-center justify-center text-[11px] text-stone-400 font-sans">
                <span className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span>{isThai ? 'คลิกที่แถวใดก็ได้ในงบการเงิน เพื่อให้ Gemini AI อธิบายความหมายและวิเคราะห์สถานะสดทันที' : 'Click any row in the financial statement tables to inspect live Gemini AI synthesis.'}</span>
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
    </div>
  );
}
