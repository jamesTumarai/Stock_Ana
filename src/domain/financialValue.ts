import type { FinancialStatementsData, ReportData } from '../types';

export type FinancialStatementSection = 'income_statement' | 'balance_sheet' | 'cash_flow';
export type FinancialValueType = 'reported' | 'derived' | 'estimated' | 'unclassified';
export type FinancialVerificationStatus = 'unverified' | 'source_linked' | 'verified';
export type FinancialUnit = 'USD_M' | 'percent' | 'per_share' | 'shares_M' | 'x' | 'count' | 'unknown';

export interface FinancialSourceMetadata {
  provider?: string;
  documentUrl?: string;
  documentType?: string;
  filingDate?: string;
  periodEnd?: string;
  accessionNumber?: string;
  retrievedAt?: string;
}

export interface CanonicalFinancialValue {
  metric: string;
  statement: FinancialStatementSection;
  value: number | null;
  unit: FinancialUnit;
  period: string;
  periodEnd?: string;
  type: FinancialValueType;
  verification: FinancialVerificationStatus;
  source?: FinancialSourceMetadata;
  derivation?: string;
}

export interface CanonicalFinancialDataset {
  ticker?: string;
  currency?: string;
  periods: string[];
  values: Record<string, CanonicalFinancialValue[]>;
  sourceCoverage: {
    sourceLinkedValues: number;
    verifiedValues: number;
    totalValues: number;
  };
}

const DERIVED_METRICS = new Set([
  'gross_margin_pct',
  'operating_margin_pct',
  'net_margin_pct',
  'yoy_revenue_growth_pct',
  'tax_rate',
  'current_ratio',
  'quick_ratio',
  'debt_to_equity',
  'debt_to_ebitda',
  'fcf_margin_pct',
  'fcf_vs_net_income_ratio',
  'free_cash_flow',
]);

const RATIO_METRICS = new Set([
  'current_ratio',
  'quick_ratio',
  'debt_to_equity',
  'debt_to_ebitda',
]);

const PER_SHARE_METRICS = new Set(['eps', 'eps_diluted']);

const inferUnit = (metric: string): FinancialUnit => {
  if (PER_SHARE_METRICS.has(metric)) return 'per_share';
  if (RATIO_METRICS.has(metric)) return 'x';
  if (metric.endsWith('_pct') || metric === 'tax_rate') return 'percent';
  return 'USD_M';
};

const inferType = (metric: string): FinancialValueType =>
  DERIVED_METRICS.has(metric) ? 'derived' : 'reported';

const inferProvider = (url?: string): string | undefined => {
  if (!url) return undefined;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === 'sec.gov' || host.endsWith('.sec.gov')) return 'SEC EDGAR';
    return host || undefined;
  } catch {
    return undefined;
  }
};

const toLatestSource = (fs: FinancialStatementsData): FinancialSourceMetadata | undefined => {
  const source = fs.source;
  if (!source?.document_url) return undefined;
  return {
    provider: inferProvider(source.document_url),
    documentUrl: source.document_url,
    documentType: source.document_type,
    filingDate: source.filing_date,
    periodEnd: source.period_end,
  };
};

/**
 * Converts the current legacy statement arrays into a provenance-aware canonical dataset.
 *
 * Important integrity rule: `financial_statements.source` describes only the primary/latest filing,
 * so its provenance is attached only to the latest period. Historical periods remain unverified
 * until each period has its own independently retrieved source.
 *
 * A linked source is NOT the same as independently verified data. This adapter never emits
 * `verification: "verified"`; a future SEC/XBRL ingestion service must earn that status.
 */
export function buildCanonicalFinancialDataset(report: Pick<ReportData, 'ticker' | 'financial_statements'>): CanonicalFinancialDataset | null {
  const fs = report.financial_statements;
  if (!fs || !Array.isArray(fs.periods) || fs.periods.length === 0) return null;

  const periods = [...fs.periods];
  const latestIndex = periods.length - 1;
  const latestSource = toLatestSource(fs);
  const values: Record<string, CanonicalFinancialValue[]> = {};

  const collect = (statement: FinancialStatementSection, section: Record<string, unknown> | undefined) => {
    if (!section) return;
    for (const [metric, raw] of Object.entries(section)) {
      if (metric === 'commentary' || !Array.isArray(raw)) continue;
      const key = `${statement}.${metric}`;
      values[key] = periods.map((period, index) => {
        const candidate = raw[index];
        const value = typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null;
        const source = index === latestIndex ? latestSource : undefined;
        return {
          metric,
          statement,
          value,
          unit: inferUnit(metric),
          period,
          periodEnd: index === latestIndex ? latestSource?.periodEnd : undefined,
          type: inferType(metric),
          verification: source ? 'source_linked' : 'unverified',
          source,
          derivation: metric === 'free_cash_flow' ? 'Operating cash flow less capital expenditures when derived by Lumina.' : undefined,
        };
      });
    }
  };

  collect('income_statement', fs.income_statement as unknown as Record<string, unknown>);
  collect('balance_sheet', fs.balance_sheet as unknown as Record<string, unknown>);
  collect('cash_flow', fs.cash_flow as unknown as Record<string, unknown>);

  const flattened = Object.values(values).flat();
  return {
    ticker: report.ticker,
    currency: fs.currency,
    periods,
    values,
    sourceCoverage: {
      sourceLinkedValues: flattened.filter(item => item.verification === 'source_linked').length,
      verifiedValues: 0,
      totalValues: flattened.length,
    },
  };
}
