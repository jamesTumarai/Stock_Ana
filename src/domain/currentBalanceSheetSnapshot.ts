import type { BalanceSheetData, ReportData } from '../types';
import type { CanonicalFinancialDataset, CanonicalFinancialValue } from './financialValue';
import { getFiscalQuarterOrdinal } from './valuation/canonicalQuarterWindow';

export interface CurrentInstantFact {
  value: number;
  period: string;
  periodEnd: string | null;
  fiscalYear?: number;
  fiscalQuarter?: number;
  form?: string;
  accession?: string;
  sourceConcept?: string;
  source: string;
  verification: 'verified' | 'unverified';
}

export interface CurrentBalanceSheetSnapshot {
  period: string | null;
  periodEnd: string | null;
  source: string;
  verification: 'verified' | 'unverified' | 'unavailable';
  facts: Record<string, CurrentInstantFact>;
  cashAndEquivalents: number | null;
  shortTermInvestments: number | null;
  cashPlusShortTermInvestments: number | null;
  currentDebt: number | null;
  longTermDebt: number | null;
  financeLeaseLiabilities: number | null;
  totalDebt: number | null;
  totalDebtBasis: 'REPORTED_TOTAL' | 'REPORTED_DEBT_AND_FINANCE_LEASES' | 'CURRENT_PLUS_LONG_TERM' | null;
  longTermDebtAndFinanceLeases: number | null;
  netCash: number | null;
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const dateOnly = (value?: string | null): string | null =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : null;

const periodOrder = (period: string): number => {
  const quarter = getFiscalQuarterOrdinal(period);
  if (Number.isFinite(quarter)) return quarter;
  const shortYearQuarter = period.match(/^Q([1-4])[\s_-]+FY(\d{2})$/i);
  if (shortYearQuarter) return (2000 + Number(shortYearQuarter[2])) * 4 + Number(shortYearQuarter[1]) - 1;
  const annual = period.match(/^(?:FY\s*)?((?:19|20)\d{2})$/i);
  if (annual) return Number(annual[1]) * 4 + 3;
  const shortAnnual = period.match(/^FY\s*(\d{2})$/i);
  return shortAnnual ? (2000 + Number(shortAnnual[1])) * 4 + 3 : NaN;
};

const latestPeriodIndex = (periods: string[]): number => {
  let best = -1;
  let order = -Infinity;
  periods.forEach((period, index) => {
    const candidate = periodOrder(period);
    if (Number.isFinite(candidate) && candidate > order) {
      best = index;
      order = candidate;
    }
  });
  return best;
};

const sameFiscalIdentity = (fact: CanonicalFinancialValue, period: string): boolean => {
  if (fact.period !== period) return false;
  const quarter = getFiscalQuarterOrdinal(period);
  if (Number.isFinite(quarter)) {
    if (finite(fact.fiscalYear) && fact.fiscalYear !== Math.floor(quarter / 4)) return false;
    if (finite(fact.fiscalQuarter) && fact.fiscalQuarter !== quarter % 4 + 1) return false;
  } else {
    const annualYear = period.match(/^(?:FY\s*)?((?:19|20)\d{2})$/i);
    if (annualYear && finite(fact.fiscalYear) && fact.fiscalYear !== Number(annualYear[1])) return false;
  }
  return true;
};

const compose = (
  period: string | null,
  periodEnd: string | null,
  facts: Record<string, CurrentInstantFact>,
  source: string,
): CurrentBalanceSheetSnapshot => {
  const value = (key: string) => facts[key]?.value ?? null;
  const cash = value('cash_and_equivalents');
  const investments = value('short_term_investments');
  // A missing component is never silently treated as zero. All verified components
  // have already been restricted to the exact same balance-sheet instant.
  const cashPlus = cash !== null && investments !== null ? cash + investments : null;
  const currentDebt = value('short_term_debt');
  const longTermDebt = value('long_term_debt');
  const reportedTotal = value('total_debt');
  const financeLeaseCurrent = value('finance_lease_liabilities_current');
  const financeLeaseNonCurrent = value('finance_lease_liabilities_non_current');
  const financeLeaseLiabilities = financeLeaseCurrent !== null && financeLeaseNonCurrent !== null
    ? financeLeaseCurrent + financeLeaseNonCurrent : null;
  const totalDebt = reportedTotal ?? (currentDebt !== null && longTermDebt !== null ? currentDebt + longTermDebt : null);
  const totalDebtBasis = reportedTotal !== null
    ? (facts.total_debt?.sourceConcept === 'DebtAndFinanceLeaseObligations' ? 'REPORTED_DEBT_AND_FINANCE_LEASES' : 'REPORTED_TOTAL')
    : totalDebt !== null ? 'CURRENT_PLUS_LONG_TERM' : null;
  return {
    period, periodEnd, source,
    verification: Object.keys(facts).length ? (source === 'SEC EDGAR XBRL' ? 'verified' : 'unverified') : 'unavailable',
    facts,
    cashAndEquivalents: cash,
    shortTermInvestments: investments,
    cashPlusShortTermInvestments: cashPlus,
    currentDebt,
    longTermDebt,
    financeLeaseLiabilities,
    totalDebt,
    totalDebtBasis,
    longTermDebtAndFinanceLeases: value('long_term_debt_and_finance_leases'),
    netCash: cashPlus !== null && totalDebt !== null ? cashPlus - totalDebt : null,
  };
};

/** One current-period instant shared by report, valuation, scoring and research views. */
export function resolveCurrentBalanceSheetSnapshot(report: Partial<ReportData>): CurrentBalanceSheetSnapshot {
  const dataset = report.canonical_financials as CanonicalFinancialDataset | undefined;
  if (dataset && /sec[-_]?xbrl/i.test(dataset.generatedBy || '')
    && dataset.ticker && report.ticker && dataset.ticker.toUpperCase() !== report.ticker.toUpperCase()) {
    return compose(null, null, {}, 'SEC ticker mismatch');
  }
  const hasSecAuthority = Boolean(dataset && /sec[-_]?xbrl/i.test(dataset.generatedBy || '')
    && (!dataset.ticker || !report.ticker || dataset.ticker.toUpperCase() === report.ticker.toUpperCase()));

  if (hasSecAuthority && dataset) {
    const periodIndex = latestPeriodIndex(dataset.periods || []);
    const period = periodIndex >= 0 ? dataset.periods[periodIndex] : null;
    if (!period) return compose(null, null, {}, 'SEC EDGAR XBRL');

    const candidates = Object.entries(dataset.values || {}).flatMap(([key, series]) =>
      key.startsWith('balance_sheet.') && Array.isArray(series)
        ? series.filter(item => item.statement === 'balance_sheet'
            && item.periodType === 'instant' && item.verification === 'verified'
            && finite(item.value) && dateOnly(item.periodEnd) && sameFiscalIdentity(item, period))
            .map(item => ({ key: key.slice('balance_sheet.'.length), item }))
        : []);
    const verifiedEnds = candidates.map(({ item }) => item.periodEnd!).sort();
    // A report-level source date may lag; use the latest verified instant belonging
    // to this fiscal period, then require every component to match it exactly.
    const periodEnd = verifiedEnds.at(-1) || null;
    const facts: Record<string, CurrentInstantFact> = {};
    candidates.sort((a, b) => (b.item.source?.filingDate || '').localeCompare(a.item.source?.filingDate || '')
      || (b.item.accession || '').localeCompare(a.item.accession || ''));
    for (const { key, item } of candidates) {
      if (item.periodEnd !== periodEnd || facts[key]) continue;
      facts[key] = {
        value: item.value as number, period, periodEnd,
        fiscalYear: item.fiscalYear, fiscalQuarter: item.fiscalQuarter,
        form: item.form, accession: item.accession,
        sourceConcept: item.concept, source: item.source?.provider || 'SEC EDGAR XBRL',
        verification: 'verified',
      };
    }
    // A partial SEC snapshot must never be completed with historical/AI arrays.
    return compose(period, periodEnd, facts, 'SEC EDGAR XBRL');
  }

  const statements = report.financial_statements;
  const index = latestPeriodIndex(statements?.periods || []);
  const period = index >= 0 ? statements!.periods[index] : null;
  const periodEnd = index === (statements?.periods?.length || 0) - 1
    ? dateOnly(statements?.source?.period_end) : null;
  const facts: Record<string, CurrentInstantFact> = {};
  if (period && statements?.balance_sheet) {
    for (const [key, series] of Object.entries(statements.balance_sheet as BalanceSheetData)) {
      if (!Array.isArray(series) || !finite(series[index])) continue;
      facts[key] = {
        value: series[index], period, periodEnd,
        source: statements.source?.document_url || 'Financial Statements (unverified)',
        verification: 'unverified',
      };
    }
  }
  return compose(period, periodEnd, facts, 'Financial Statements (unverified)');
}
