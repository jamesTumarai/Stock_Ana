import type { CanonicalFinancialDataset, CanonicalFinancialValue } from './financialValue';
import type { ReportData } from '../types';
import { getFiscalQuarterOrdinal, validTrailingFourQuarterLabels } from './valuation/canonicalQuarterWindow';

/** Only duration, currency-denominated facts may be summed. Balance-sheet instants are excluded. */
export const TTM_FLOW_METRICS = [
  'income_statement.revenue',
  'income_statement.gross_profit',
  'income_statement.operating_income',
  'income_statement.interest_expense',
  'income_statement.net_income',
  'income_statement.net_income_parent',
  'income_statement.net_income_common',
  'income_statement.cogs',
  'income_statement.income_before_tax',
  'income_statement.income_tax_expense',
  'income_statement.rental_revenue',
  'income_statement.net_interest_income',
  'income_statement.non_interest_income',
  'income_statement.provision_for_credit_losses',
  'income_statement.ffo',
  'income_statement.affo',
  'income_statement.research_and_development',
  'income_statement.research_and_development_excluding_acquired',
  'income_statement.selling_general_administrative',
  'income_statement.selling_and_marketing',
  'income_statement.general_and_administrative',
  'income_statement.noi',
  'income_statement.net_premiums_earned',
  'cash_flow.operating_cash_flow',
  'cash_flow.depreciation',
  'cash_flow.stock_based_compensation',
  'cash_flow.capex',
  'cash_flow.free_cash_flow',
  'cash_flow.dividends_paid',
  'cash_flow.dividends_common',
  'cash_flow.repurchase_of_common_stock',
  'cash_flow.issuance_of_common_stock',
  'cash_flow.debt_issuance',
  'cash_flow.debt_repayments',
  'cash_flow.acquisitions',
  'cash_flow.change_working_capital',
] as const;

export type TtmFlowMetric = typeof TTM_FLOW_METRICS[number];
export interface TtmProviderObservation { value: number; source: string; }
export interface TtmFlowReconciliation {
  metric: TtmFlowMetric;
  canonicalValue: number | null;
  providerValue: number | null;
  delta: number | null;
  disagrees: boolean;
  periodsUsed: string[];
  source: string | null;
  providerSource?: string | null;
  status: 'verified' | 'unverified' | 'insufficient_history' | 'invalid_period' | 'missing_fact' | 'not_flow_metric';
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export const TTM_CURRENCY_ROUNDING_TOLERANCE_M = 0.01;
const sumCurrencyFlows = (values: number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) * 1e8) / 1e8;

export function reconcileCanonicalTtmFlow(
  dataset: CanonicalFinancialDataset | null | undefined,
  metric: TtmFlowMetric,
  provider?: TtmProviderObservation | null,
  endingPeriod?: string,
): TtmFlowReconciliation {
  const providerValue = finite(provider?.value) ? provider.value : null;
  const base = {
    metric, canonicalValue: null, providerValue, delta: null, disagrees: false,
    periodsUsed: [] as string[], source: null, providerSource: provider?.source ?? null,
  };
  if (!TTM_FLOW_METRICS.includes(metric)) return { ...base, status: 'not_flow_metric' };
  if (!dataset || !Array.isArray(dataset.periods) || dataset.periods.length < 4) return { ...base, status: 'insufficient_history' };

  const endingIndex = endingPeriod ? dataset.periods.indexOf(endingPeriod) : dataset.periods.length - 1;
  const periods = dataset.periods.slice(Math.max(0, endingIndex - 3), endingIndex + 1);
  if (endingIndex < 3 || periods.length !== 4) return { ...base, status: 'insufficient_history' };
  if (!validTrailingFourQuarterLabels(periods)) return { ...base, status: 'invalid_period' };
  const [statement, name] = metric.split('.');
  const series = dataset.values?.[metric];
  const quarters: CanonicalFinancialValue[] = [];
  for (const period of periods) {
    const matches = series?.filter(item => getFiscalQuarterOrdinal(item) === getFiscalQuarterOrdinal(period)) || [];
    const item = matches.length === 1 ? matches[0] : undefined;
    if (!item || getFiscalQuarterOrdinal(item.period) !== getFiscalQuarterOrdinal(period) || item.statement !== statement || item.metric !== name
      || item.verification !== 'verified' || item.periodType !== 'standalone_quarter'
      || item.unit !== 'USD_M' || !finite(item.value)
      || getFiscalQuarterOrdinal(item) !== getFiscalQuarterOrdinal(period)) {
      return { ...base, status: 'missing_fact' };
    }
    // A YTD/annual duration cannot be relabeled as a standalone quarter. A 53-week
    // fiscal year may have a 14-week quarter, so allow up to 112 days here.
    if (item.periodStart && item.periodEnd) {
      const durationDays = (Date.parse(item.periodEnd) - Date.parse(item.periodStart)) / 86_400_000 + 1;
      if (!Number.isFinite(durationDays) || durationDays < 60 || durationDays > (item.fiscalQuarter === 4 ? 126 : 112)) {
        return { ...base, status: 'invalid_period' };
      }
    }
    quarters.push(item);
  }
  if (dataset.schemaVersion >= 2 && quarters.some(item => !item.periodStart || !item.periodEnd)) return { ...base, status: 'invalid_period' };
  if (quarters.some((item, i) => i && item.periodStart && quarters[i - 1].periodEnd
    && Date.parse(item.periodStart) - Date.parse(quarters[i - 1].periodEnd!) !== 86400000)) return { ...base, status: 'invalid_period' };
  const ends = quarters.map(item => item.periodEnd).filter((end): end is string => Boolean(end));
  if (new Set(ends).size !== ends.length) return { ...base, status: 'invalid_period' };

  const canonicalValue = sumCurrencyFlows(quarters.map(item => item.value as number));
  const delta = providerValue === null ? null : providerValue - canonicalValue;
  return {
    metric, canonicalValue, providerValue, delta, providerSource: provider?.source ?? null,
    disagrees: delta !== null && Math.abs(delta) > TTM_CURRENCY_ROUNDING_TOLERANCE_M,
    periodsUsed: periods,
    source: quarters.map(item => item.source?.provider || item.source?.documentUrl || 'Verified filing').filter((source, index, all) => all.indexOf(source) === index).join(' + '),
    status: 'verified',
  };
}

export function reconcileAllCanonicalTtmFlows(
  dataset: CanonicalFinancialDataset | null | undefined,
  providers: Partial<Record<TtmFlowMetric, TtmProviderObservation>> = {},
): Partial<Record<TtmFlowMetric, TtmFlowReconciliation>> {
  return Object.fromEntries(TTM_FLOW_METRICS.map(metric => [metric, reconcileCanonicalTtmFlow(dataset, metric, providers[metric])])) as Partial<Record<TtmFlowMetric, TtmFlowReconciliation>>;
}

/** Legacy report arrays remain usable, but are never promoted to SEC-verified evidence. */
export function resolveReportTtmFlow(
  report: Partial<ReportData>,
  metric: TtmFlowMetric,
  provider?: TtmProviderObservation | null,
): TtmFlowReconciliation {
  const dataset = report.canonical_financials as CanonicalFinancialDataset | undefined;
  if (dataset && /sec[-_]?xbrl/i.test(dataset.generatedBy || '')) {
    return reconcileCanonicalTtmFlow(dataset, metric, provider);
  }
  const [statement, name] = metric.split('.') as ['income_statement' | 'cash_flow', string];
  const financials = report.financial_statements;
  const periods = financials?.periods?.slice(-4) || [];
  const providerValue = finite(provider?.value) ? provider.value : null;
  const base = {
    metric, canonicalValue: null, providerValue, delta: null, disagrees: false,
    periodsUsed: [] as string[], source: null, providerSource: provider?.source ?? null,
  };
  if (!TTM_FLOW_METRICS.includes(metric)) return { ...base, status: 'not_flow_metric' };
  if (periods.length < 4) return { ...base, status: 'insufficient_history' };
  if (!validTrailingFourQuarterLabels(periods)) return { ...base, status: 'invalid_period' };
  const values = (financials?.[statement] as unknown as Record<string, (number | null)[]> | undefined)?.[name];
  if (!Array.isArray(values) || values.length !== financials?.periods?.length) return { ...base, status: 'missing_fact' };
  const latest = values.slice(-4);
  if (latest.some(value => !finite(value))) return { ...base, status: 'missing_fact' };
  const canonicalValue = sumCurrencyFlows(latest as number[]);
  const delta = providerValue === null ? null : providerValue - canonicalValue;
  return {
    metric, canonicalValue, providerValue, delta, providerSource: provider?.source ?? null,
    disagrees: delta !== null && Math.abs(delta) > TTM_CURRENCY_ROUNDING_TOLERANCE_M,
    periodsUsed: periods, source: 'Report financial statements (unverified)', status: 'unverified',
  };
}
