import type { CanonicalFinancialDataset, CanonicalFinancialValue } from '../../domain/financialValue';
import type { FinancialStatementsData, ReportData } from '../../types';

export type SecReportComparisonStatus = 'match' | 'mismatch' | 'sec_only' | 'report_only' | 'unavailable';

export interface SecReportMetricComparison {
  key: string;
  period: string;
  secValue: number | null;
  reportValue: number | null;
  status: SecReportComparisonStatus;
  relativeDifferencePct: number | null;
  tolerancePct: number;
  secVerification: CanonicalFinancialValue['verification'] | 'unavailable';
  note?: string;
}

export interface SecReportComparisonResult {
  ticker?: string;
  comparedPeriods: string[];
  comparisons: SecReportMetricComparison[];
  summary: {
    matched: number;
    mismatched: number;
    secOnly: number;
    reportOnly: number;
    unavailable: number;
    verifiedComparable: number;
  };
  hasMaterialConflicts: boolean;
  periodAlignment: 'aligned' | 'partial' | 'none';
}

type MetricRule = {
  canonicalKey: string;
  reportSection: 'income_statement' | 'balance_sheet' | 'cash_flow';
  reportKey: string;
  tolerancePct: number;
  normalize?: (value: number) => number;
};

const METRIC_RULES: MetricRule[] = [
  { canonicalKey: 'income_statement.revenue', reportSection: 'income_statement', reportKey: 'revenue', tolerancePct: 1 },
  { canonicalKey: 'income_statement.gross_profit', reportSection: 'income_statement', reportKey: 'gross_profit', tolerancePct: 1 },
  { canonicalKey: 'income_statement.operating_income', reportSection: 'income_statement', reportKey: 'operating_income', tolerancePct: 1 },
  { canonicalKey: 'income_statement.net_income', reportSection: 'income_statement', reportKey: 'net_income', tolerancePct: 1 },
  { canonicalKey: 'income_statement.eps_diluted', reportSection: 'income_statement', reportKey: 'eps_diluted', tolerancePct: 1 },
  { canonicalKey: 'balance_sheet.cash_and_equivalents', reportSection: 'balance_sheet', reportKey: 'cash_and_equivalents', tolerancePct: 1 },
  { canonicalKey: 'balance_sheet.short_term_investments', reportSection: 'balance_sheet', reportKey: 'short_term_investments', tolerancePct: 1 },
  { canonicalKey: 'balance_sheet.total_assets', reportSection: 'balance_sheet', reportKey: 'total_assets', tolerancePct: 1 },
  { canonicalKey: 'balance_sheet.total_liabilities', reportSection: 'balance_sheet', reportKey: 'total_liabilities', tolerancePct: 1 },
  { canonicalKey: 'balance_sheet.total_equity', reportSection: 'balance_sheet', reportKey: 'total_equity', tolerancePct: 1 },
  { canonicalKey: 'balance_sheet.common_stock', reportSection: 'balance_sheet', reportKey: 'common_stock', tolerancePct: 1 },
  { canonicalKey: 'balance_sheet.retained_earnings', reportSection: 'balance_sheet', reportKey: 'retained_earnings', tolerancePct: 1 },
  { canonicalKey: 'balance_sheet.short_term_debt', reportSection: 'balance_sheet', reportKey: 'short_term_debt', tolerancePct: 1 },
  { canonicalKey: 'balance_sheet.long_term_debt', reportSection: 'balance_sheet', reportKey: 'long_term_debt', tolerancePct: 1 },
  { canonicalKey: 'balance_sheet.total_debt', reportSection: 'balance_sheet', reportKey: 'total_debt', tolerancePct: 1 },
  { canonicalKey: 'balance_sheet.operating_lease_liabilities', reportSection: 'balance_sheet', reportKey: 'operating_lease_liabilities', tolerancePct: 1 },
  { canonicalKey: 'cash_flow.operating_cash_flow', reportSection: 'cash_flow', reportKey: 'operating_cash_flow', tolerancePct: 1 },
  { canonicalKey: 'cash_flow.depreciation', reportSection: 'cash_flow', reportKey: 'depreciation', tolerancePct: 1 },
  { canonicalKey: 'cash_flow.stock_based_compensation', reportSection: 'cash_flow', reportKey: 'stock_based_compensation', tolerancePct: 1 },
  // SEC capex commonly arrives as a positive cash outflow while legacy report arrays use a negative sign.
  { canonicalKey: 'cash_flow.capex', reportSection: 'cash_flow', reportKey: 'capex', tolerancePct: 1, normalize: Math.abs },
  { canonicalKey: 'cash_flow.dividends_paid', reportSection: 'cash_flow', reportKey: 'dividends_paid', tolerancePct: 1, normalize: Math.abs },
  { canonicalKey: 'cash_flow.free_cash_flow', reportSection: 'cash_flow', reportKey: 'free_cash_flow', tolerancePct: 1 },
];

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const normalizePeriod = (value: string) => {
  const trimmed = value.trim();
  const qFirst = trimmed.match(/^Q([1-4])\s*[-/]?\s*(20\d{2})$/i);
  if (qFirst) return `Q${qFirst[1]} ${qFirst[2]}`;
  const yearFirst = trimmed.match(/^(20\d{2})\s*[-/]?\s*Q([1-4])$/i);
  if (yearFirst) return `Q${yearFirst[2]} ${yearFirst[1]}`;
  return trimmed;
};

const relativeDifferencePct = (a: number, b: number) => {
  const denominator = Math.max(Math.abs(a), Math.abs(b), 1e-9);
  return Math.abs(a - b) / denominator * 100;
};

const reportSeries = (fs: FinancialStatementsData, rule: MetricRule): Array<number | null> | undefined => {
  const section = fs[rule.reportSection] as unknown as Record<string, unknown>;
  const raw = section?.[rule.reportKey];
  return Array.isArray(raw) ? raw.map(value => finite(value) ? value : null) : undefined;
};

/**
 * Compares overlapping SEC-verified quarterly facts against the AI/report statement arrays.
 * This function is diagnostic only: it never mutates either source and never promotes report values.
 * SEC values are considered comparable only when their canonical verification is `verified`.
 */
export function compareSecCanonicalToReport(
  dataset: CanonicalFinancialDataset | null | undefined,
  report: Pick<ReportData, 'ticker' | 'financial_statements'> | null | undefined,
): SecReportComparisonResult {
  const fs = report?.financial_statements;
  if (!dataset || !fs || !Array.isArray(dataset.periods) || !Array.isArray(fs.periods)) {
    return {
      ticker: report?.ticker ?? dataset?.ticker,
      comparedPeriods: [],
      comparisons: [],
      summary: { matched: 0, mismatched: 0, secOnly: 0, reportOnly: 0, unavailable: 0, verifiedComparable: 0 },
      hasMaterialConflicts: false,
      periodAlignment: 'none',
    };
  }

  const secPeriodMap = new Map(dataset.periods.map((period, index) => [normalizePeriod(period), index]));
  const reportPeriodMap = new Map(fs.periods.map((period, index) => [normalizePeriod(period), index]));
  const overlapping = Array.from(secPeriodMap.keys()).filter(period => reportPeriodMap.has(period));
  const periodAlignment: SecReportComparisonResult['periodAlignment'] = overlapping.length === 0
    ? 'none'
    : overlapping.length === Math.min(dataset.periods.length, fs.periods.length)
      ? 'aligned'
      : 'partial';

  const comparisons: SecReportMetricComparison[] = [];
  for (const rule of METRIC_RULES) {
    const secSeries = dataset.values[rule.canonicalKey];
    const legacySeries = reportSeries(fs, rule);
    const periods = Array.from(new Set([...dataset.periods.map(normalizePeriod), ...fs.periods.map(normalizePeriod)]));

    for (const period of periods) {
      const secIndex = secPeriodMap.get(period);
      const reportIndex = reportPeriodMap.get(period);
      const secItem = secIndex === undefined ? undefined : secSeries?.[secIndex];
      const rawSec = secItem && finite(secItem.value) ? secItem.value : null;
      const rawReport = reportIndex === undefined ? null : legacySeries?.[reportIndex] ?? null;
      const secValue = rawSec === null ? null : rule.normalize ? rule.normalize(rawSec) : rawSec;
      const reportValue = rawReport === null || !finite(rawReport) ? null : rule.normalize ? rule.normalize(rawReport) : rawReport;
      const secVerified = secItem?.verification === 'verified';

      let status: SecReportComparisonStatus = 'unavailable';
      let difference: number | null = null;
      let note: string | undefined;
      if (secValue !== null && secVerified && reportValue !== null) {
        difference = relativeDifferencePct(secValue, reportValue);
        status = difference <= rule.tolerancePct ? 'match' : 'mismatch';
      } else if (secValue !== null && secVerified && reportValue === null) {
        status = 'sec_only';
      } else if ((secValue === null || !secVerified) && reportValue !== null) {
        status = 'report_only';
        note = secValue !== null && !secVerified
          ? 'SEC canonical value exists but is not independently verified.'
          : 'No verified SEC value is available for this metric/period.';
      }

      comparisons.push({
        key: rule.canonicalKey,
        period,
        secValue,
        reportValue,
        status,
        relativeDifferencePct: difference,
        tolerancePct: rule.tolerancePct,
        secVerification: secItem?.verification ?? 'unavailable',
        note,
      });
    }
  }

  const count = (status: SecReportComparisonStatus) => comparisons.filter(item => item.status === status).length;
  const mismatches = count('mismatch');
  return {
    ticker: report?.ticker ?? dataset.ticker,
    comparedPeriods: overlapping,
    comparisons,
    summary: {
      matched: count('match'),
      mismatched: mismatches,
      secOnly: count('sec_only'),
      reportOnly: count('report_only'),
      unavailable: count('unavailable'),
      verifiedComparable: comparisons.filter(item => item.status === 'match' || item.status === 'mismatch').length,
    },
    hasMaterialConflicts: mismatches > 0,
    periodAlignment,
  };
}
