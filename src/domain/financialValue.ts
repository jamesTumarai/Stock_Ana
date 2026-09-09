import type { FinancialStatementsData, ReportData } from '../types';

export type FinancialStatementSection = 'income_statement' | 'balance_sheet' | 'cash_flow';
export type FinancialValueType = 'reported' | 'derived' | 'estimated' | 'unclassified';
export type FinancialVerificationStatus = 'unverified' | 'source_linked' | 'verified';
export type FinancialUnit = 'USD_M' | 'percent' | 'per_share' | 'shares_M' | 'x' | 'count' | 'unknown';
export type FinancialProvenanceStatus = 'unverified' | 'partially_source_linked' | 'source_linked' | 'verified';

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

export interface FinancialProvenanceWarning {
  code: string;
  severity: 'info' | 'warning';
  message: string;
}

export interface CanonicalFinancialDataset {
  ticker?: string;
  currency?: string;
  periods: string[];
  values: Record<string, CanonicalFinancialValue[]>;
  provenanceStatus: FinancialProvenanceStatus;
  provenanceWarnings: FinancialProvenanceWarning[];
  sourceCoverage: {
    sourceLinkedValues: number;
    verifiedValues: number;
    nonNullValues: number;
    missingValues: number;
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
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return undefined;
    const host = parsed.hostname.toLowerCase();
    if (host === 'sec.gov' || host.endsWith('.sec.gov')) return 'SEC EDGAR';
    return host || undefined;
  } catch {
    return undefined;
  }
};

const isHttpUrl = (url?: string) => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const toLatestSource = (fs: FinancialStatementsData): FinancialSourceMetadata | undefined => {
  const source = fs.source;
  if (!source?.document_url || !isHttpUrl(source.document_url)) return undefined;
  return {
    provider: inferProvider(source.document_url),
    documentUrl: source.document_url,
    documentType: source.document_type,
    filingDate: source.filing_date,
    periodEnd: source.period_end,
  };
};

const deriveProvenanceWarnings = (
  fs: FinancialStatementsData,
  coverage: CanonicalFinancialDataset['sourceCoverage'],
): FinancialProvenanceWarning[] => {
  const warnings: FinancialProvenanceWarning[] = [];
  const source = fs.source;

  if (!source?.document_url) {
    warnings.push({
      code: 'FINANCIAL_SOURCE_UNLINKED',
      severity: 'info',
      message: 'Financial values are not linked to a filing document yet.',
    });
  } else if (!isHttpUrl(source.document_url)) {
    warnings.push({
      code: 'FINANCIAL_SOURCE_URL_INVALID',
      severity: 'warning',
      message: 'The supplied financial-statement source URL is invalid and was not trusted as provenance.',
    });
  } else {
    warnings.push({
      code: 'FINANCIAL_SOURCE_LINKED_NOT_VERIFIED',
      severity: 'info',
      message: 'A filing document is linked to the latest period, but values are not independently SEC/XBRL verified yet.',
    });
    if (!source.period_end) {
      warnings.push({
        code: 'FINANCIAL_SOURCE_PERIOD_END_MISSING',
        severity: 'warning',
        message: 'The linked filing does not include period_end metadata, so period provenance cannot be fully checked.',
      });
    }
    if (!source.filing_date) {
      warnings.push({
        code: 'FINANCIAL_SOURCE_FILING_DATE_MISSING',
        severity: 'warning',
        message: 'The linked filing does not include filing_date metadata.',
      });
    }
    if (source.period_end && fs.as_of_date && source.period_end !== fs.as_of_date) {
      warnings.push({
        code: 'FINANCIAL_SOURCE_DATE_CONFLICT',
        severity: 'warning',
        message: `Financial statement as_of_date (${fs.as_of_date}) does not match linked filing period_end (${source.period_end}).`,
      });
    }
  }

  if (coverage.nonNullValues > 0 && coverage.sourceLinkedValues < coverage.nonNullValues) {
    warnings.push({
      code: 'FINANCIAL_PROVENANCE_PARTIAL',
      severity: 'info',
      message: 'Only part of the non-null financial dataset has document-level provenance.',
    });
  }
  return warnings;
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
        // Document-level provenance is meaningful only for an actual value. Missing values
        // must remain unverified rather than being counted as source-backed simply because
        // the latest filing URL exists.
        const source = index === latestIndex && value !== null ? latestSource : undefined;
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
  const nonNullValues = flattened.filter(item => item.value !== null).length;
  const sourceLinkedValues = flattened.filter(item => item.value !== null && item.verification === 'source_linked').length;
  const verifiedValues = flattened.filter(item => item.value !== null && item.verification === 'verified').length;
  const coverage: CanonicalFinancialDataset['sourceCoverage'] = {
    sourceLinkedValues,
    verifiedValues,
    nonNullValues,
    missingValues: flattened.length - nonNullValues,
    totalValues: flattened.length,
  };

  const provenanceStatus: FinancialProvenanceStatus = verifiedValues > 0 && verifiedValues === nonNullValues
    ? 'verified'
    : sourceLinkedValues > 0 && sourceLinkedValues === nonNullValues
      ? 'source_linked'
      : sourceLinkedValues > 0
        ? 'partially_source_linked'
        : 'unverified';

  return {
    ticker: report.ticker,
    currency: fs.currency,
    periods,
    values,
    provenanceStatus,
    provenanceWarnings: deriveProvenanceWarnings(fs, coverage),
    sourceCoverage: coverage,
  };
}
