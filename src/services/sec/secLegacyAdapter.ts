import { validateFinancialStatements } from '../../utils/statementValidator';
import { reconcileVerifiedDataset, buildVerifiedStatementPeriods } from '../../domain/verifiedFinancialStatements';
import { calculateVerifiedKeyIndicators } from '../../domain/verifiedKeyIndicators';
import type { CanonicalFinancialDataset, CanonicalFinancialValue } from '../../domain/financialValue';
import type {
  BalanceSheetData,
  CashFlowData,
  FinancialStatementsData,
  IncomeStatementData,
} from '../../types';
import type { SecShareSnapshot } from './secShareSnapshot';
import { reconcileCanonicalTtmFlow, type TtmFlowMetric } from '../../domain/canonicalTtmFlow';
import { resolveCurrentBalanceSheetSnapshot } from '../../domain/currentBalanceSheetSnapshot';

export interface SecDcfCoverageIssue {
  code: string;
  field: string;
  message: string;
}

export interface SecDcfCoverageAssessment {
  eligible: boolean;
  periods: string[];
  currentSharesOutstandingM: number | null;
  issues: SecDcfCoverageIssue[];
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const seriesValues = (
  dataset: CanonicalFinancialDataset,
  key: string,
  transform?: (value: number) => number,
): (number | null)[] | undefined => {
  const series = dataset.values[key];
  if (!series) return undefined;
  return dataset.periods.map((period, index) => {
    const item = series[index];
    if (!item || item.period !== period || !finite(item.value)) return null;
    return transform ? transform(item.value) : item.value;
  });
};

const latestVerifiedSource = (dataset: CanonicalFinancialDataset): CanonicalFinancialValue | undefined => {
  for (let periodIndex = dataset.periods.length - 1; periodIndex >= 0; periodIndex -= 1) {
    for (const series of Object.values(dataset.values)) {
      const item = series[periodIndex];
      if (item?.verification === 'verified' && finite(item.value) && item.source) return item;
    }
  }
  return undefined;
};

const assignSeries = <T extends Record<string, unknown>>(
  target: T,
  key: keyof T,
  values: (number | null)[] | undefined,
) => {
  if (values) target[key] = values as T[keyof T];
};

/**
 * Converts SEC canonical values into the legacy FinancialStatementsData shape used by existing UI.
 * This is an adapter only: it never fills a missing SEC metric from AI/report data.
 */
export function adaptSecCanonicalToFinancialStatements(input: CanonicalFinancialDataset): FinancialStatementsData | null {
  const dataset = reconcileVerifiedDataset(input);
  if (!dataset) return null;
  const snapshots = buildVerifiedStatementPeriods(dataset);
  // Absence of a total-income disclosure is a data gap, not a malformed series.
  // Parent/common earnings remain separate; never copy them into total income.
  const income: IncomeStatementData = {
    revenue: dataset.periods.map(() => null),
    net_income: dataset.periods.map(() => null),
  };
  const balance: BalanceSheetData = {};
  const cashFlow: CashFlowData = {};
  const sections = { income_statement: income, balance_sheet: balance, cash_flow: cashFlow };
  for (const [key, series] of Object.entries(dataset.values)) {
    const [section, metric] = key.split('.') as [keyof typeof sections, string];
    const outflow = section === 'cash_flow' && ['capex', 'dividends_paid', 'repurchase_of_common_stock', 'debt_repayments', 'finance_lease_payments','dividends_to_noncontrolling_interests', 'distributions_to_noncontrolling_interests','distributions_to_noncontrolling_and_redeemable_interests'].includes(metric);
    (sections[section] as Record<string, unknown>)[metric] = dataset.periods.map(period => {
      const item = series.find(v => v.period === period);
      return item?.verification === 'verified' && finite(item.value) ? outflow ? -Math.abs(item.value) : item.value : null;
    });
  }
  // Cash-flow reconciliation uses the explicit restricted-cash basis. A missing
  // restricted-cash observation is never replaced with ordinary balance-sheet cash.
  cashFlow.ending_cash = dataset.periods.map(p => {
    const s=snapshots.find(s=>s.label===p);
    return dataset.cashFlowCashBalances?.find(b=>b.period===p)?.ending
      ?? s?.observations['balance_sheet.cash_and_restricted_cash']?.value
      ?? s?.observations['balance_sheet.cash_and_restricted_cash_including_disposal_group']?.value ?? null;
  });
  cashFlow.beginning_cash = snapshots.map((p, i) => {
    const exact = dataset.cashFlowCashBalances?.find(b => b.period===p.label&&b.startDate===p.startDate&&b.endDate===p.endDate);
    if (exact) return exact.beginning;
    const prior = snapshots[i - 1];
    const endingKey=p.observations['balance_sheet.cash_and_restricted_cash']?'balance_sheet.cash_and_restricted_cash':'balance_sheet.cash_and_restricted_cash_including_disposal_group';
    return prior && p.startDate && Date.parse(p.startDate) - Date.parse(prior.endDate) === 86400000
      ? prior.observations[endingKey]?.value ?? null : null;
  });
  // A net debt-flow row is derived only when both compatible gross components are disclosed.
  cashFlow.debt_issuance_payments = dataset.periods.map((_,i)=>{
    const issuance=(cashFlow as any).debt_issuance?.[i],repayment=(cashFlow as any).debt_repayments?.[i];
    return finite(issuance)&&finite(repayment)?issuance-Math.abs(repayment):null;
  });
  const template = income.net_interest_income && balance.deposits ? 'banking'
    : income.net_premiums_earned && balance.loss_reserve ? 'insurance'
    : income.ffo || income.noi ? 'reit' : 'standard';
  const latest = snapshots.at(-1);
  const source = latest && Object.values(latest.observations).find(v => v.source?.documentUrl)?.source;
  const result: FinancialStatementsData = {
    currency: dataset.currency, unit: dataset.currency==='USD'?'USD_M':'CURRENCY_M', statement_template: template, fiscal_period_type: snapshots.every(p=>p.periodType==='annual')?'annual':'quarterly',
    as_of_date: latest?.endDate, periods: dataset.periods, income_statement: income,
    balance_sheet: balance, cash_flow: cashFlow, verified_dataset: dataset, period_snapshots: snapshots,
    quality_status: dataset.sourceCoverage.missingValues ? 'partial' : 'verified',
    source: source ? { document_url: source.documentUrl, document_type: source.documentType,
      filing_date: source.filingDate, period_end: latest?.endDate, units: `${dataset.currency} millions unless per-share` } : undefined,
  };
  result.validation_summary = validateFinancialStatements(result, template);
  result.indicator_details = calculateVerifiedKeyIndicators(result);
  return result;
}

const lastFourVerified = (dataset: CanonicalFinancialDataset, key: TtmFlowMetric, options: { positive?: boolean } = {}) => {
  const value = reconcileCanonicalTtmFlow(dataset, key).canonicalValue;
  return value !== null && (!options.positive || (value > 0
    && dataset.values[key]?.slice(-4).every(item => finite(item.value) && item.value > 0)));
};

/**
 * Strict gate for moving deterministic DCF onto SEC data. It intentionally requires every
 * balance-sheet input instead of assuming absent concepts are zero.
 */
export function assessSecDcfCoverage(
  dataset: CanonicalFinancialDataset | null | undefined,
  shareSnapshot: SecShareSnapshot | null | undefined,
): SecDcfCoverageAssessment {
  const issues: SecDcfCoverageIssue[] = [];
  if (!dataset || !/sec-xbrl/i.test(dataset.generatedBy)) {
    issues.push({ code: 'SEC_DATASET_UNAVAILABLE', field: 'canonical_financials', message: 'SEC XBRL canonical financial dataset is unavailable.' });
    return { eligible: false, periods: [], currentSharesOutstandingM: null, issues };
  }

  const periods = dataset.periods.slice(-4);
  if(dataset.currency!=='USD') issues.push({code:'SEC_NON_USD_VALUATION_UNAVAILABLE',field:'currency',message:'Foreign reported-currency statements require an explicit verified FX valuation contract; no USD relabeling.'});
  if (periods.length !== 4) {
    issues.push({ code: 'SEC_FOUR_QUARTERS_REQUIRED', field: 'periods', message: 'Four SEC-backed fiscal quarters are required for DCF.' });
  }
  if (!lastFourVerified(dataset, 'income_statement.revenue', { positive: true })) {
    issues.push({ code: 'SEC_REVENUE_INCOMPLETE', field: 'income_statement.revenue', message: 'Four verified quarterly revenue values are required.' });
  }
  if (!lastFourVerified(dataset, 'cash_flow.free_cash_flow')) {
    issues.push({ code: 'SEC_FCF_INCOMPLETE', field: 'cash_flow.free_cash_flow', message: 'Four verified quarterly free-cash-flow values are required.' });
  }
  const currentBalance = resolveCurrentBalanceSheetSnapshot({ canonical_financials: dataset });
  if (currentBalance.cashAndEquivalents === null) {
    issues.push({ code: 'SEC_CASH_UNAVAILABLE', field: 'balance_sheet.cash_and_equivalents', message: 'Verified current-period cash and cash equivalents are required.' });
  }
  if (currentBalance.shortTermInvestments === null) {
    issues.push({ code: 'SEC_SHORT_TERM_INVESTMENTS_UNAVAILABLE', field: 'balance_sheet.short_term_investments', message: 'Verified current-period short-term investments are required; missing is not assumed to be zero.' });
  }
  if (currentBalance.totalDebt === null) {
    issues.push({ code: 'SEC_TOTAL_DEBT_UNAVAILABLE', field: 'balance_sheet.total_debt', message: 'Verified current-period total debt is required; debt components are not guessed or double-counted.' });
  }

  const sharesM = shareSnapshot?.currentCommonSharesOutstanding?.sharesM;
  if (shareSnapshot?.currentCommonSharesOutstanding?.source.provider !== 'SEC EDGAR XBRL' || !finite(sharesM) || sharesM <= 0) {
    issues.push({ code: 'SEC_CURRENT_SHARES_UNAVAILABLE', field: 'currentCommonSharesOutstanding', message: 'Verified point-in-time SEC common shares outstanding are required.' });
  }

  return {
    eligible: issues.length === 0,
    periods,
    currentSharesOutstandingM: finite(sharesM) && sharesM > 0 ? sharesM : null,
    issues,
  };
}
