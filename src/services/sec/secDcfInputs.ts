import type { CanonicalFinancialDataset, CanonicalFinancialValue } from '../../domain/financialValue';
import type { SecDcfCoverageAssessment, SecDcfCoverageIssue } from './secLegacyAdapter';
import type { SecShareSnapshot } from './secShareSnapshot';

export const SEC_DCF_FINANCIAL_INPUTS_VERSION = 1;

export interface SecDcfFinancialInputs {
  version: number;
  generatedBy: 'sec-verified-financial-inputs-v1';
  eligible: boolean;
  ticker: string;
  periods: string[];
  sourcePeriod: string | null;
  latestBalanceSheetPeriodEnd: string | null;
  shareAsOf: string | null;
  startingRevenueM: number | null;
  trailingFourFreeCashFlowM: number | null;
  historicalFcfMarginPct: number | null;
  cashAndEquivalentsM: number | null;
  shortTermInvestmentsM: number | null;
  totalDebtM: number | null;
  netCashM: number | null;
  currentSharesOutstandingM: number | null;
  issues: SecDcfCoverageIssue[];
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const round = (value: number, decimals = 8) => {
  const scale = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * scale) / scale;
};

const issueKey = (issue: SecDcfCoverageIssue) => `${issue.code}:${issue.field}:${issue.message}`;

const verifiedItemAt = (
  dataset: CanonicalFinancialDataset,
  key: string,
  index: number,
): CanonicalFinancialValue | null => {
  const item = dataset.values[key]?.[index];
  const period = dataset.periods[index];
  if (!item || item.period !== period || item.verification !== 'verified' || !finite(item.value)) return null;
  return item;
};

const lastFourVerified = (
  dataset: CanonicalFinancialDataset,
  key: string,
  options: { positive?: boolean } = {},
): CanonicalFinancialValue[] | null => {
  if (dataset.periods.length < 4) return null;
  const offset = dataset.periods.length - 4;
  const items: CanonicalFinancialValue[] = [];
  for (let index = offset; index < dataset.periods.length; index += 1) {
    const item = verifiedItemAt(dataset, key, index);
    if (!item || (options.positive && (item.value as number) <= 0)) return null;
    items.push(item);
  }
  return items;
};

const addIssue = (
  issues: Map<string, SecDcfCoverageIssue>,
  issue: SecDcfCoverageIssue,
) => {
  issues.set(issueKey(issue), issue);
};

/**
 * Converts an SEC-verified canonical dataset into the exact deterministic financial inputs needed
 * by the DCF engine. It deliberately does not provide price, WACC, terminal growth, projection
 * years, or scenario assumptions; those belong to separate market/assumption layers.
 *
 * This function re-validates the strict coverage invariants instead of trusting a caller-provided
 * `eligible` flag. Missing values never become zero and mismatched balance-sheet instants fail closed.
 */
export function buildSecDcfFinancialInputs(
  dataset: CanonicalFinancialDataset | null | undefined,
  shareSnapshot: SecShareSnapshot | null | undefined,
  coverage: SecDcfCoverageAssessment | null | undefined,
): SecDcfFinancialInputs {
  const issues = new Map<string, SecDcfCoverageIssue>();
  for (const issue of coverage?.issues ?? []) addIssue(issues, issue);

  const ticker = dataset?.ticker ?? shareSnapshot?.ticker ?? '';
  const periods = dataset?.periods.slice(-4) ?? [];
  const sourcePeriod = periods.length === 4 ? `${periods[0]}–${periods[3]}` : null;

  if (!dataset || !/sec-xbrl/i.test(dataset.generatedBy)) {
    addIssue(issues, {
      code: 'SEC_DCF_INPUT_DATASET_UNAVAILABLE',
      field: 'canonical_financials',
      message: 'SEC XBRL canonical financials are required for deterministic DCF inputs.',
    });
  }

  if (dataset && shareSnapshot?.ticker && dataset.ticker && dataset.ticker !== shareSnapshot.ticker) {
    addIssue(issues, {
      code: 'SEC_DCF_INPUT_TICKER_MISMATCH',
      field: 'ticker',
      message: 'SEC canonical financials and the SEC share snapshot refer to different tickers.',
    });
  }

  let startingRevenueM: number | null = null;
  let trailingFourFreeCashFlowM: number | null = null;
  let historicalFcfMarginPct: number | null = null;
  let cashAndEquivalentsM: number | null = null;
  let shortTermInvestmentsM: number | null = null;
  let totalDebtM: number | null = null;
  let netCashM: number | null = null;
  let latestBalanceSheetPeriodEnd: string | null = null;

  if (dataset) {
    const revenue = lastFourVerified(dataset, 'income_statement.revenue', { positive: true });
    if (!revenue) {
      addIssue(issues, {
        code: 'SEC_DCF_INPUT_REVENUE_INCOMPLETE',
        field: 'income_statement.revenue',
        message: 'Four verified positive quarterly revenue values are required.',
      });
    } else {
      startingRevenueM = round(revenue.reduce((sum, item) => sum + (item.value as number), 0));
    }

    const fcf = lastFourVerified(dataset, 'cash_flow.free_cash_flow');
    if (!fcf) {
      addIssue(issues, {
        code: 'SEC_DCF_INPUT_FCF_INCOMPLETE',
        field: 'cash_flow.free_cash_flow',
        message: 'Four verified quarterly free-cash-flow values are required.',
      });
    } else {
      trailingFourFreeCashFlowM = round(fcf.reduce((sum, item) => sum + (item.value as number), 0));
    }

    if (startingRevenueM !== null && startingRevenueM > 0 && trailingFourFreeCashFlowM !== null) {
      historicalFcfMarginPct = round((trailingFourFreeCashFlowM / startingRevenueM) * 100, 6);
    }

    const latestIndex = dataset.periods.length - 1;
    const cash = latestIndex >= 0 ? verifiedItemAt(dataset, 'balance_sheet.cash_and_equivalents', latestIndex) : null;
    const investments = latestIndex >= 0 ? verifiedItemAt(dataset, 'balance_sheet.short_term_investments', latestIndex) : null;
    const debt = latestIndex >= 0 ? verifiedItemAt(dataset, 'balance_sheet.total_debt', latestIndex) : null;

    if (!cash) {
      addIssue(issues, {
        code: 'SEC_DCF_INPUT_CASH_UNAVAILABLE',
        field: 'balance_sheet.cash_and_equivalents',
        message: 'Verified current-period cash and cash equivalents are required.',
      });
    } else {
      cashAndEquivalentsM = cash.value as number;
    }
    if (!investments) {
      addIssue(issues, {
        code: 'SEC_DCF_INPUT_INVESTMENTS_UNAVAILABLE',
        field: 'balance_sheet.short_term_investments',
        message: 'Verified current-period short-term investments are required.',
      });
    } else {
      shortTermInvestmentsM = investments.value as number;
    }
    if (!debt) {
      addIssue(issues, {
        code: 'SEC_DCF_INPUT_DEBT_UNAVAILABLE',
        field: 'balance_sheet.total_debt',
        message: 'Verified current-period total debt is required.',
      });
    } else {
      totalDebtM = debt.value as number;
    }

    if (cash && investments && debt) {
      const ends = [cash.periodEnd, investments.periodEnd, debt.periodEnd];
      if (ends.some(end => !end) || new Set(ends).size !== 1) {
        addIssue(issues, {
          code: 'SEC_DCF_INPUT_BALANCE_SHEET_INSTANT_MISMATCH',
          field: 'balance_sheet',
          message: 'Cash, short-term investments, and total debt must share the exact same SEC balance-sheet period end.',
        });
      } else {
        latestBalanceSheetPeriodEnd = ends[0] as string;
        netCashM = round((cash.value as number) + (investments.value as number) - (debt.value as number));
      }
    }
  }

  const currentSharesOutstandingM = shareSnapshot?.currentCommonSharesOutstanding?.sharesM;
  const sharesProvider = shareSnapshot?.currentCommonSharesOutstanding?.source.provider;
  if (sharesProvider !== 'SEC EDGAR XBRL' || !finite(currentSharesOutstandingM) || currentSharesOutstandingM <= 0) {
    addIssue(issues, {
      code: 'SEC_DCF_INPUT_CURRENT_SHARES_UNAVAILABLE',
      field: 'currentCommonSharesOutstanding',
      message: 'Verified point-in-time SEC common shares outstanding are required.',
    });
  }

  const issueList = Array.from(issues.values());
  const eligible = Boolean(
    coverage?.eligible
    && issueList.length === 0
    && periods.length === 4
    && startingRevenueM !== null
    && trailingFourFreeCashFlowM !== null
    && cashAndEquivalentsM !== null
    && shortTermInvestmentsM !== null
    && totalDebtM !== null
    && netCashM !== null
    && finite(currentSharesOutstandingM)
    && currentSharesOutstandingM > 0,
  );

  return {
    version: SEC_DCF_FINANCIAL_INPUTS_VERSION,
    generatedBy: 'sec-verified-financial-inputs-v1',
    eligible,
    ticker,
    periods,
    sourcePeriod,
    latestBalanceSheetPeriodEnd,
    shareAsOf: shareSnapshot?.currentCommonSharesOutstanding?.end ?? null,
    startingRevenueM,
    trailingFourFreeCashFlowM,
    historicalFcfMarginPct,
    cashAndEquivalentsM,
    shortTermInvestmentsM,
    totalDebtM,
    netCashM,
    currentSharesOutstandingM: finite(currentSharesOutstandingM) && currentSharesOutstandingM > 0
      ? currentSharesOutstandingM
      : null,
    issues: issueList,
  };
}
