import type { CanonicalFinancialDataset, CanonicalFinancialValue } from '../../domain/financialValue';
import type {
  BalanceSheetData,
  CashFlowData,
  FinancialStatementsData,
  IncomeStatementData,
} from '../../types';
import type { SecShareSnapshot } from './secShareSnapshot';

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
export function adaptSecCanonicalToFinancialStatements(dataset: CanonicalFinancialDataset): FinancialStatementsData | null {
  if (!dataset.periods.length || !dataset.values || !/sec-xbrl/i.test(dataset.generatedBy)) return null;

  const income: IncomeStatementData = {
    revenue: seriesValues(dataset, 'income_statement.revenue') ?? dataset.periods.map(() => null),
    net_income: seriesValues(dataset, 'income_statement.net_income') ?? dataset.periods.map(() => null),
  };
  assignSeries(income as unknown as Record<string, unknown>, 'gross_profit', seriesValues(dataset, 'income_statement.gross_profit'));
  assignSeries(income as unknown as Record<string, unknown>, 'operating_income', seriesValues(dataset, 'income_statement.operating_income'));
  assignSeries(income as unknown as Record<string, unknown>, 'interest_expense', seriesValues(dataset, 'income_statement.interest_expense'));
  assignSeries(income as unknown as Record<string, unknown>, 'income_before_tax', seriesValues(dataset, 'income_statement.income_before_tax'));
  assignSeries(income as unknown as Record<string, unknown>, 'income_tax_expense', seriesValues(dataset, 'income_statement.income_tax_expense'));
  assignSeries(income as unknown as Record<string, unknown>, 'eps_diluted', seriesValues(dataset, 'income_statement.eps_diluted'));
  assignSeries(income as unknown as Record<string, unknown>, 'net_interest_income', seriesValues(dataset, 'income_statement.net_interest_income'));
  assignSeries(income as unknown as Record<string, unknown>, 'non_interest_income', seriesValues(dataset, 'income_statement.non_interest_income'));
  assignSeries(income as unknown as Record<string, unknown>, 'provision_for_credit_losses', seriesValues(dataset, 'income_statement.provision_for_credit_losses'));
  assignSeries(income as unknown as Record<string, unknown>, 'net_interest_margin_pct', seriesValues(dataset, 'income_statement.net_interest_margin_pct'));
  assignSeries(income as unknown as Record<string, unknown>, 'ffo', seriesValues(dataset, 'income_statement.ffo'));
  assignSeries(income as unknown as Record<string, unknown>, 'noi', seriesValues(dataset, 'income_statement.noi'));
  assignSeries(income as unknown as Record<string, unknown>, 'rental_revenue', seriesValues(dataset, 'income_statement.rental_revenue'));
  assignSeries(income as unknown as Record<string, unknown>, 'combined_ratio_pct', seriesValues(dataset, 'income_statement.combined_ratio_pct'));
  assignSeries(income as unknown as Record<string, unknown>, 'net_premiums_earned', seriesValues(dataset, 'income_statement.net_premiums_earned'));

  const balance: BalanceSheetData = {};
  const balanceKeys: Array<[keyof BalanceSheetData, string]> = [
    ['cash_and_equivalents', 'balance_sheet.cash_and_equivalents'],
    ['short_term_investments', 'balance_sheet.short_term_investments'],
    ['total_current_assets', 'balance_sheet.total_current_assets'],
    ['accounts_receivable', 'balance_sheet.accounts_receivable'],
    ['inventory', 'balance_sheet.inventory'],
    ['net_ppe', 'balance_sheet.net_ppe'],
    ['goodwill', 'balance_sheet.goodwill'],
    ['total_assets', 'balance_sheet.total_assets'],
    ['total_current_liabilities', 'balance_sheet.total_current_liabilities'],
    ['accounts_payable', 'balance_sheet.accounts_payable'],
    ['total_liabilities', 'balance_sheet.total_liabilities'],
    ['total_equity', 'balance_sheet.total_equity'],
    ['total_debt', 'balance_sheet.total_debt'],
    ['deposits', 'balance_sheet.deposits'],
    ['loans_held_for_investment', 'balance_sheet.loans_held_for_investment'],
    ['tier1_capital_ratio', 'balance_sheet.tier1_capital_ratio'],
    ['loss_reserve', 'balance_sheet.loss_reserve'],
  ];
  for (const [legacyKey, canonicalKey] of balanceKeys) {
    const values = seriesValues(dataset, canonicalKey);
    if (values) (balance as Record<string, unknown>)[legacyKey] = values;
  }

  const cashFlow: CashFlowData = {};
  assignSeries(cashFlow as unknown as Record<string, unknown>, 'operating_cash_flow', seriesValues(dataset, 'cash_flow.operating_cash_flow'));
  assignSeries(
    cashFlow as unknown as Record<string, unknown>,
    'capex',
    seriesValues(dataset, 'cash_flow.capex', value => -Math.abs(value)),
  );
  assignSeries(
    cashFlow as unknown as Record<string, unknown>,
    'dividends_paid',
    seriesValues(dataset, 'cash_flow.dividends_paid', value => -Math.abs(value)),
  );
  assignSeries(cashFlow as unknown as Record<string, unknown>, 'free_cash_flow', seriesValues(dataset, 'cash_flow.free_cash_flow'));

  const latestSourceValue = latestVerifiedSource(dataset);
  const source = latestSourceValue?.source;
  const latestPeriodEnd = latestSourceValue?.periodEnd ?? source?.periodEnd;

  return {
    currency: dataset.currency ?? 'USD',
    fiscal_period_type: 'quarterly',
    as_of_date: latestPeriodEnd,
    periods: [...dataset.periods],
    income_statement: income,
    balance_sheet: balance,
    cash_flow: cashFlow,
    source: source ? {
      document_url: source.documentUrl,
      document_type: source.documentType,
      filing_date: source.filingDate,
      period_end: source.periodEnd,
      units: 'USD millions unless per-share',
    } : undefined,
  };
}

const lastFourVerified = (dataset: CanonicalFinancialDataset, key: string, options: { positive?: boolean } = {}) => {
  const series = dataset.values[key];
  if (!series || dataset.periods.length < 4) return false;
  const lastFourPeriods = dataset.periods.slice(-4);
  const offset = dataset.periods.length - 4;
  return lastFourPeriods.every((period, index) => {
    const item = series[offset + index];
    return item?.period === period
      && item.verification === 'verified'
      && finite(item.value)
      && (!options.positive || item.value > 0);
  });
};

const latestVerified = (dataset: CanonicalFinancialDataset, key: string) => {
  const series = dataset.values[key];
  const item = series?.[dataset.periods.length - 1];
  return item?.verification === 'verified' && finite(item.value);
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
  if (periods.length !== 4) {
    issues.push({ code: 'SEC_FOUR_QUARTERS_REQUIRED', field: 'periods', message: 'Four SEC-backed fiscal quarters are required for DCF.' });
  }
  if (!lastFourVerified(dataset, 'income_statement.revenue', { positive: true })) {
    issues.push({ code: 'SEC_REVENUE_INCOMPLETE', field: 'income_statement.revenue', message: 'Four verified quarterly revenue values are required.' });
  }
  if (!lastFourVerified(dataset, 'cash_flow.free_cash_flow')) {
    issues.push({ code: 'SEC_FCF_INCOMPLETE', field: 'cash_flow.free_cash_flow', message: 'Four verified quarterly free-cash-flow values are required.' });
  }
  if (!latestVerified(dataset, 'balance_sheet.cash_and_equivalents')) {
    issues.push({ code: 'SEC_CASH_UNAVAILABLE', field: 'balance_sheet.cash_and_equivalents', message: 'Verified current-period cash and cash equivalents are required.' });
  }
  if (!latestVerified(dataset, 'balance_sheet.short_term_investments')) {
    issues.push({ code: 'SEC_SHORT_TERM_INVESTMENTS_UNAVAILABLE', field: 'balance_sheet.short_term_investments', message: 'Verified current-period short-term investments are required; missing is not assumed to be zero.' });
  }
  if (!latestVerified(dataset, 'balance_sheet.total_debt')) {
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
