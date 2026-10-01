import type { FinancialStatementsData } from '../types';
import { buildVerifiedStatementPeriods } from './verifiedFinancialStatements';
import { calculateCanonicalRoic, calculateInvestedCapital } from './valuation/canonicalRoic';
import { reconcileCanonicalTtmFlow, type TtmFlowMetric } from './canonicalTtmFlow';

export interface VerifiedIndicator {
  value: number | null;
  status: 'derived' | 'approximate' | 'unavailable';
  formula: string;
  basis: string;
  unit: string;
  variables: Record<string, number | null>;
  periodsUsed: string[];
  sourceUrls: string[];
  reason?: string;
}
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const ratio = (n: number | null, d: number | null, scale = 1) => finite(n) && finite(d) && d > 0 ? n / d * scale : null;
const sum = (values: (number | null)[]) => values.length && values.every(finite) ? values.reduce<number>((a, b) => a + b!, 0) : null;
const mean = (a: number | null, b: number | null) => finite(a) && finite(b) ? (a + b) / 2 : null;

/** All table values and calculation details use this contract. No model-ratio fallback. */
export function calculateVerifiedKeyIndicators(data: FinancialStatementsData): Record<string, VerifiedIndicator[]> {
  const history = buildVerifiedStatementPeriods(data.verified_dataset);
  const details: Record<string, VerifiedIndicator[]> = {};
  const keys = ['gross_margin', 'operating_margin', 'ebit_margin', 'net_margin', 'ebitda_margin', 'tax_rate',
    'current_ratio', 'quick_ratio', 'debt_to_equity', 'equity_ratio', 'debt_to_asset', 'roe', 'roa', 'roic',
    'fcf_to_sales', 'fcf_to_net_income', 'asset_turnover', 'inventory_turnover', 'dso', 'dio', 'dpo', 'ccc',
    'nim', 'deposit_growth', 'loan_deposit_ratio', 'efficiency_ratio'];
  for (const key of keys) details[key] = [];
  data.periods.forEach((label, index) => {
    const selected = data.period_snapshots?.[index];
    const endIndex = history.findIndex(p => p.endDate === selected?.endDate);
    const ending = history[endIndex];
    const get = (section: 'income_statement' | 'balance_sheet' | 'cash_flow', key: string) => {
      if (data.quality_status === 'unavailable' || !ending) return null;
      const observation = data.fiscal_period_type === 'annual' ? selected?.observations[`${section}.${key}`] : ending.observations[`${section}.${key}`];
      return observation?.verification === 'verified' && finite(observation.value) ? observation.value : null;
    };
    const hist = (i: number, key: string) => history[i]?.observations[key]?.value ?? null;
    const ttm = (key: string) => {
      return ending ? reconcileCanonicalTtmFlow(data.verified_dataset, key as TtmFlowMetric, undefined, ending.label).canonicalValue : null;
    };
    const previousQuarter = ending && history[endIndex - 1]
      && ending.fiscalYear * 4 + ending.fiscalQuarter === history[endIndex - 1].fiscalYear * 4 + history[endIndex - 1].fiscalQuarter + 1
      ? endIndex - 1 : -1;
    const yearBeginning = history.findIndex(p => ending && p.fiscalYear * 4 + p.fiscalQuarter === ending.fiscalYear * 4 + ending.fiscalQuarter - 4);
    const isAnnual = data.fiscal_period_type === 'annual';
    const avg = (key: string, annual: boolean) => mean(hist(annual ? yearBeginning : previousQuarter, `balance_sheet.${key}`), get('balance_sheet', key));
    const rev = get('income_statement', 'revenue');
    const cogs = get('income_statement', 'cogs');
    const op = get('income_statement', 'operating_income');
    const commonNi = get('income_statement', 'net_income_common');
    const totalNi = get('income_statement', 'net_income');
    const debt = get('balance_sheet', 'total_debt');
    const equity = get('balance_sheet', 'stockholders_equity');
    const assets = get('balance_sheet', 'total_assets');
    const cash = get('balance_sheet', 'cash_and_equivalents');
    const sti = get('balance_sheet', 'short_term_investments');
    const ar = get('balance_sheet', 'accounts_receivable');
    const cl = get('balance_sheet', 'total_current_liabilities');
    const ocf = get('cash_flow', 'operating_cash_flow');
    const capex = get('cash_flow', 'capex');
    const fcf = finite(ocf) && finite(capex) ? ocf - Math.abs(capex) : null;
    const periodDays = selected?.startDate && selected.endDate ? (Date.parse(selected.endDate) - Date.parse(selected.startDate)) / 86400000 + 1 : null;
    const sectorRestricted = ['banking', 'insurance'].includes(data.statement_template || '');
    const usedHistory = history.slice(Math.max(0, yearBeginning >= 0 ? yearBeginning : endIndex - 3), endIndex + 1);
    const urls = [...new Set([...usedHistory.flatMap(p => Object.values(p.observations)), ...Object.values(selected?.observations || {})]
      .map(o => o.source?.documentUrl).filter((v): v is string => Boolean(v)))];
    const put = (key: string, value: number | null, formula: string, variables: Record<string, number | null>, unit = '%', approximate = false, basis = isAnnual ? 'Annual' : 'Standalone quarter') => {
      details[key].push({ value: value === null ? null : Math.round(value * 100) / 100, status: value === null ? 'unavailable' : approximate ? 'approximate' : 'derived', formula, variables, unit, basis,
        periodsUsed: /TTM/.test(basis) ? history.slice(Math.max(0, endIndex - 3), endIndex + 1).map(p => p.label) : [label],
        sourceUrls: urls, reason: value === null ? 'Compatible verified inputs are incomplete or the denominator is not meaningful.' : undefined });
    };
    put('gross_margin', sectorRestricted ? null : ratio(get('income_statement', 'gross_profit'), rev, 100), 'Gross profit / Revenue × 100', { grossProfit: get('income_statement', 'gross_profit'), revenue: rev });
    put('operating_margin', ratio(op, rev, 100), 'Operating income / Revenue × 100', { operatingIncome: op, revenue: rev });
    put('ebit_margin', null, 'EBIT requires a separately verified definition; operating income is not silently renamed EBIT', {});
    put('net_margin', ratio(commonNi ?? totalNi, rev, 100), `${commonNi !== null ? 'Common' : 'Total'} net income / Revenue × 100`, { netIncome: commonNi ?? totalNi, revenue: rev }, '%', false, `${isAnnual ? 'Annual' : 'Quarterly'} ${commonNi !== null ? 'common' : 'total'} net income`);
    const da = get('cash_flow', 'depreciation');
    put('ebitda_margin', sectorRestricted ? null : ratio(finite(op) && finite(da) ? op + da : null, rev, 100), 'Derived EBITDA = Operating income + D&A; margin = Derived EBITDA / Revenue × 100', { operatingIncome: op, depreciation: da, revenue: rev });
    put('tax_rate', ratio(get('income_statement', 'income_tax_expense'), get('income_statement', 'income_before_tax'), 100), 'Tax expense / Positive pretax income × 100', { tax: get('income_statement', 'income_tax_expense'), pretax: get('income_statement', 'income_before_tax') });
    put('current_ratio', sectorRestricted ? null : ratio(get('balance_sheet', 'total_current_assets'), cl), 'Current assets / Current liabilities', { currentAssets: get('balance_sheet', 'total_current_assets'), currentLiabilities: cl }, 'x', false, 'Instant');
    put('quick_ratio', sectorRestricted ? null : ratio(sum([cash, sti, ar]), cl), '(Cash + Short-term investments + Receivables) / Current liabilities', { cash, shortTermInvestments: sti, receivables: ar, currentLiabilities: cl }, 'x', false, 'Instant — strict quick assets');
    put('debt_to_equity', ratio(debt, equity), 'Canonical debt / Stockholders equity', { debt, equity }, 'x', false, 'Instant');
    put('equity_ratio', ratio(get('balance_sheet', 'total_equity'), assets, 100), 'Equity including NCI / Total assets × 100', { totalEquity: get('balance_sheet', 'total_equity'), assets }, '%', false, 'Instant — total equity');
    put('debt_to_asset', ratio(debt, assets, 100), 'Canonical debt / Total assets × 100', { debt, assets }, '%', false, 'Instant');
    const commonTtm = ttm('income_statement.net_income_common');
    const totalTtm = ttm('income_statement.net_income');
    const averageEquity = avg('common_equity', true);
    const averageAssets = avg('total_assets', true);
    // Fail only the accounting snapshots used by this return calculation. An
    // unrelated historical failure must not erase a reconciled current window.
    const relevantLabels = new Set([ending?.label, history[yearBeginning]?.label].filter(Boolean));
    const balanceFailed = data.validation_summary?.failed_guards?.some(guard =>
      /BALANCE_SHEET_IMBALANCE|IMPOSSIBLE_VALUE|TOTAL_DEBT_UNDERSTATED|CRITICAL_BANKING/.test(guard)
      && [...relevantLabels].some(period => guard.includes(`: ${period}`))) ?? false;
    put('roe', balanceFailed ? null : ratio(commonTtm, averageEquity, 100), 'TTM common net income / Average common stockholders equity × 100', { commonNetIncomeTtm: commonTtm, averageEquity }, '%', false, 'TTM / beginning-ending average common equity');
    put('roa', balanceFailed ? null : ratio(totalTtm, averageAssets, 100), 'TTM total net income / Average total assets × 100', { totalNetIncomeTtm: totalTtm, averageAssets }, '%', false, 'TTM / beginning-ending average');
    const ic = (i: number) => {
      const equityKey = history[i]?.observations['balance_sheet.stockholders_equity'] ? 'stockholders_equity' : 'total_equity';
      const inputs = [equityKey, 'total_debt', 'cash_and_equivalents', 'short_term_investments'].map(k => hist(i, `balance_sheet.${k}`));
      return inputs.every(finite) ? calculateInvestedCapital(...inputs as [number, number, number, number]) : null;
    };
    const endIc = ic(endIndex), beginIc = ic(yearBeginning);
    const operatingTtm = ttm('income_statement.operating_income');
    const roic = !sectorRestricted && !balanceFailed && finite(endIc) && finite(operatingTtm)
      ? calculateCanonicalRoic({ operatingIncome: operatingTtm, incomeBeforeTax: ttm('income_statement.income_before_tax') ?? undefined,
        incomeTaxExpense: ttm('income_statement.income_tax_expense') ?? undefined, beginningInvestedCapital: beginIc ?? undefined,
        endingInvestedCapital: endIc, periodBasis: 'TTM' }) : null;
    const endingCapitalBasis = Boolean(roic?.basis.includes('Ending'));
    put('roic', roic?.value ?? null, `TTM operating income × (1 - Tax rate) / ${endingCapitalBasis ? 'Ending' : 'Average'} (Stockholders equity + Debt - Cash - STI) × 100`,
      { operatingIncomeTtm: operatingTtm, beginningInvestedCapital: beginIc, endingInvestedCapital: endIc, investedCapitalUsed: roic?.averageInvestedCapital ?? null, taxRate: roic?.taxRateUsed ?? null }, '%', endingCapitalBasis || roic?.taxRateMethod === 'FALLBACK', roic?.basis || 'TTM');
    put('fcf_to_sales', sectorRestricted ? null : ratio(fcf, rev, 100), '(OCF - abs(CapEx)) / Revenue × 100', { ocf, capex, revenue: rev });
    put('fcf_to_net_income', sectorRestricted ? null : ratio(fcf, commonNi, 100), '(OCF - abs(CapEx)) / Positive common net income × 100', { ocf, capex, commonNetIncome: commonNi });
    const revenueTtm = ttm('income_statement.revenue'), cogsTtm = ttm('income_statement.cogs');
    const averageInventory = avg('inventory', true);
    put('asset_turnover', sectorRestricted ? null : ratio(revenueTtm, averageAssets), 'TTM revenue / Average assets', { revenueTtm, averageAssets }, 'x', false, 'TTM / beginning-ending average');
    put('inventory_turnover', sectorRestricted ? null : ratio(cogsTtm, averageInventory), 'TTM COGS / Average inventory', { cogsTtm, averageInventory }, 'x', false, 'TTM / beginning-ending average');
    const averageAr = avg('accounts_receivable', isAnnual), averageInv = avg('inventory', isAnnual), averageAp = avg('accounts_payable', isAnnual);
    const dso = sectorRestricted || !finite(periodDays) ? null : ratio(averageAr, rev, periodDays);
    const dio = sectorRestricted || !finite(periodDays) ? null : ratio(averageInv, cogs, periodDays);
    const dpo = sectorRestricted || !finite(periodDays) ? null : ratio(averageAp, cogs, periodDays);
    put('dso', dso, 'Average receivables / Period revenue × Actual period days', { averageReceivables: averageAr, revenue: rev, days: periodDays }, 'D');
    put('dio', dio, 'Average inventory / Period COGS × Actual period days', { averageInventory: averageInv, cogs, days: periodDays }, 'D');
    put('dpo', dpo, 'Average payables / Period COGS × Actual period days (COGS proxy for purchases)', { averagePayables: averageAp, cogs, days: periodDays }, 'D', true);
    put('ccc', finite(dso) && finite(dio) && finite(dpo) ? dso + dio - dpo : null, 'DSO + DIO - DPO (same period; purchases proxy)', { dso, dio, dpo }, 'D', true);
    const deposits = get('balance_sheet', 'deposits'), loans = get('balance_sheet', 'loans_held_for_investment');
    put('nim', get('income_statement', 'net_interest_margin_pct'), 'Separately reported net interest margin; never sum quarterly percentages', {}, '%');
    put('deposit_growth', deposits, 'Total deposits at the accepted period end (level, not growth rate)', { deposits }, 'USD_M', false, 'Instant');
    put('loan_deposit_ratio', ratio(loans, deposits, 100), 'Net loans held for investment / Deposits × 100', { loans, deposits }, '%', false, 'Instant');
    put('efficiency_ratio', ratio(get('income_statement', 'operating_expenses'), rev, 100), 'Reported operating expenses / Net revenue × 100', { operatingExpenses: get('income_statement', 'operating_expenses'), revenue: rev });
  });
  return details;
}
