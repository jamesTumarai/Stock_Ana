import {
  FinancialStatementsData,
  KeyIndicatorsData,
  KeyIndicatorMetric,
  KeyIndicatorsCategory
} from '../types';
import { MetricValueState } from './financialMetricContext';

export type UnavailableReason =
  | 'MISSING_NUMERATOR'
  | 'MISSING_DENOMINATOR'
  | 'ZERO_DENOMINATOR'
  | 'PERIOD_MISMATCH'
  | 'UNSUPPORTED_FORMULA'
  | 'NO_VERIFIED_SOURCE';

export interface MetricResolutionResult {
  metricKey: string;
  periodKey: string;
  value: number | null;
  sourcePath: string;
  formula?: string;
  valueState: MetricValueState;
  unavailableReason?: UnavailableReason;
}

export interface PeriodIdentity {
  raw: string;
  year: number | null;
  quarter: number | null;
  isAnnual: boolean;
  canonicalKey: string;
}

/**
 * Parses a financial period string (e.g., 'Q3 2025', '2025-Q3', 'FY 2024', '2024')
 * into a canonical period identity for deterministic matching.
 */
export function parsePeriodIdentity(period: string): PeriodIdentity {
  if (!period || typeof period !== 'string') {
    return { raw: '', year: null, quarter: null, isAnnual: false, canonicalKey: '' };
  }
  const trimmed = period.trim();
  const yearMatch = trimmed.match(/\b(20\d{2}|19\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : null;

  const quarterMatch = trimmed.match(/Q([1-4])/i);
  const quarter = quarterMatch ? Number(quarterMatch[1]) : null;

  const isAnnual = /\b(FY|ANNUAL|LTM|FULL YEAR)\b/i.test(trimmed) || (year !== null && quarter === null && !/\b(Q[1-4]|H[1-2]|6M|9M)\b/i.test(trimmed));

  let canonicalKey = trimmed.toUpperCase();
  if (year !== null && quarter !== null) {
    canonicalKey = `${year}-Q${quarter}`;
  } else if (year !== null && isAnnual) {
    canonicalKey = `${year}-FY`;
  }

  return {
    raw: trimmed,
    year,
    quarter,
    isAnnual,
    canonicalKey
  };
}

/**
 * Checks whether two period strings refer to the exact same economic period.
 */
export function periodsMatch(p1: string, p2: string): boolean {
  if (!p1 || !p2) return false;
  if (p1.trim().toLowerCase() === p2.trim().toLowerCase()) return true;

  const id1 = parsePeriodIdentity(p1);
  const id2 = parsePeriodIdentity(p2);

  if (id1.year !== null && id2.year !== null && id1.year === id2.year) {
    if (id1.quarter !== null && id2.quarter !== null) {
      return id1.quarter === id2.quarter;
    }
    if (id1.isAnnual && id2.isAnnual) {
      return true;
    }
  }

  return false;
}

/**
 * Centralized metric alias mappings for standard financial indicators.
 */
export const METRIC_ALIASES: Record<string, string[]> = {
  gross_margin: [
    'gross_margin',
    'grossmargin',
    'gross_profit_margin',
    'grossprofitmargin',
    'gross_margin_pct',
    'grossmarginpct',
    'อัตรากำไรขั้นต้น'
  ],
  operating_margin: [
    'operating_margin',
    'operatingmargin',
    'operating_margin_pct',
    'operatingmarginpct',
    'ebit_margin',
    'ebitmargin',
    'อัตรากำไรจากการดำเนินงาน'
  ],
  ebit_margin: [
    'ebit_margin',
    'ebitmargin',
    'ebit_margin_pct',
    'ebitmarginpct'
  ],
  net_margin: [
    'net_margin',
    'netmargin',
    'net_margin_pct',
    'netmarginpct',
    'อัตรากำไรสุทธิ'
  ],
  ebitda_margin: [
    'ebitda_margin',
    'ebitdamargin',
    'ebitda_margin_pct',
    'ebitdamarginpct'
  ],
  tax_rate: [
    'tax_rate',
    'taxrate',
    'effective_tax_rate',
    'effectivetaxrate'
  ],
  current_ratio: [
    'current_ratio',
    'currentratio'
  ],
  quick_ratio: [
    'quick_ratio',
    'quickratio'
  ],
  debt_to_equity: [
    'debt_to_equity',
    'debttoequity',
    'de_ratio',
    'deratio'
  ]
};

/**
 * Normalizes a metric name or key into a clean lookup token.
 */
export function normalizeMetricLookupKey(keyOrName: string): string {
  return (keyOrName || '').toLowerCase().replace(/[\s_-]+/g, '');
}

/**
 * Finds a key indicator in either production-shaped `KeyIndicatorsData`
 * ({ periods: string[], categories: KeyIndicatorsCategory[] })
 * or synthetic flat array of `KeyIndicatorMetric[]`.
 */
export function findKeyIndicatorInSource(
  keyIndicators: KeyIndicatorsData | KeyIndicatorMetric[] | unknown,
  targetMetricKey: string
): { periods?: string[]; values: (number | null)[] } | null {
  if (!keyIndicators) return null;

  const aliases = METRIC_ALIASES[targetMetricKey] || [targetMetricKey];
  const targetTokens = new Set(aliases.map(normalizeMetricLookupKey));
  targetTokens.add(normalizeMetricLookupKey(targetMetricKey));

  // Case A: Synthetic or flat array of metrics
  if (Array.isArray(keyIndicators)) {
    const found = keyIndicators.find((item: any) => {
      const k = normalizeMetricLookupKey(item.key || item.name || item.name_en || '');
      return targetTokens.has(k);
    });
    if (found && Array.isArray(found.values)) {
      return {
        periods: Array.isArray(found.periods) ? found.periods : undefined,
        values: found.values
      };
    }
    return null;
  }

  // Case B: Production-shaped KeyIndicatorsData ({ periods, categories: [...] })
  const kiData = keyIndicators as Partial<KeyIndicatorsData>;
  if (Array.isArray(kiData.categories)) {
    for (const category of kiData.categories) {
      if (!Array.isArray(category.metrics)) continue;
      const found = category.metrics.find(metric => {
        const k = normalizeMetricLookupKey(metric.key || metric.name || '');
        return targetTokens.has(k);
      });
      if (found && Array.isArray(found.values)) {
        return {
          periods: Array.isArray(kiData.periods) ? kiData.periods : undefined,
          values: found.values
        };
      }
    }
  }

  return null;
}

/**
 * Aligns a source metric values array to the target periods array by period identity.
 * - If `sourcePeriods` is provided: values are matched by period identity.
 *   Missing periods in source receive `null`.
 * - If `sourcePeriods` is missing: values are only accepted if length matches
 *   targetPeriods.length (fail-closed otherwise).
 */
export function alignMetricValuesByPeriod(
  targetPeriods: string[],
  sourcePeriods: string[] | undefined,
  sourceValues: (number | null)[]
): (number | null)[] {
  if (!Array.isArray(targetPeriods) || targetPeriods.length === 0) return [];
  if (!Array.isArray(sourceValues) || sourceValues.length === 0) {
    return targetPeriods.map(() => null);
  }

  // 1. Period-aware matching when source has its own period labels
  if (Array.isArray(sourcePeriods) && sourcePeriods.length > 0) {
    return targetPeriods.map(targetP => {
      const sourceIdx = sourcePeriods.findIndex(srcP => periodsMatch(targetP, srcP));
      if (sourceIdx >= 0 && sourceIdx < sourceValues.length) {
        const val = sourceValues[sourceIdx];
        return typeof val === 'number' && Number.isFinite(val) ? val : null;
      }
      return null;
    });
  }

  // 2. Fallback when source has no period labels:
  // Only accept if lengths match exactly (same canonical dataset guarantee).
  if (sourceValues.length === targetPeriods.length) {
    return sourceValues.map(v => (typeof v === 'number' && Number.isFinite(v) ? v : null));
  }

  // 3. Strict fail-closed on period ambiguity
  return targetPeriods.map(() => null);
}

/**
 * Resolves Gross Margin deterministically for a specific period according to explicit source priority:
 * 1. Trusted canonical / verified reported Gross Margin (gross_margin_pct)
 * 2. Verified Gross Profit / Revenue
 * 3. Verified Revenue + compatible Cost of Revenue / COGS (non-banking templates only)
 * 4. Existing deterministic canonical Key Indicator series (period-aligned)
 * 5. Unavailable with deterministic reason
 */
export function resolveGrossMarginLineage(
  period: string,
  periodIndex: number,
  data: FinancialStatementsData
): MetricResolutionResult {
  const inc = data.income_statement;
  const rawPeriods = data.periods || [];
  const statementTemplate = data.statement_template || 'standard';
  const isFinancialOrBanking = statementTemplate === 'banking' || statementTemplate === 'insurance';

  // Priority 1: Trusted canonical / verified reported Gross Margin
  const reportedGm = inc?.gross_margin_pct?.[periodIndex];
  if (typeof reportedGm === 'number' && Number.isFinite(reportedGm)) {
    return {
      metricKey: 'gross_margin',
      periodKey: period,
      value: reportedGm,
      sourcePath: 'income_statement.gross_margin_pct',
      formula: 'Reported Gross Margin %',
      valueState: 'REPORTED'
    };
  }

  // Priority 2: Verified Gross Profit / Revenue
  const rev = inc?.revenue?.[periodIndex];
  const gp = inc?.gross_profit?.[periodIndex];

  if (typeof rev === 'number' && Number.isFinite(rev)) {
    if (rev === 0) {
      return {
        metricKey: 'gross_margin',
        periodKey: period,
        value: null,
        sourcePath: 'income_statement.revenue',
        formula: 'Gross Margin = Gross Profit / Revenue',
        valueState: 'NOT_AVAILABLE',
        unavailableReason: 'ZERO_DENOMINATOR'
      };
    }

    if (typeof gp === 'number' && Number.isFinite(gp)) {
      const calculatedGm = Number(((gp / rev) * 100).toFixed(2));
      return {
        metricKey: 'gross_margin',
        periodKey: period,
        value: calculatedGm,
        sourcePath: 'income_statement.gross_profit / income_statement.revenue',
        formula: 'Gross Margin = (Gross Profit / Revenue) * 100',
        valueState: 'CALCULATED'
      };
    }
  }

  // Priority 3: Verified Revenue + compatible Cost of Revenue / COGS
  // Guard: For banking and financial institutions, interest and operating expenses
  // must NOT be coerced into COGS (Section 8 & 9).
  if (!isFinancialOrBanking) {
    const cogs = inc?.cogs?.[periodIndex];
    if (typeof rev === 'number' && Number.isFinite(rev) && rev > 0 && typeof cogs === 'number' && Number.isFinite(cogs)) {
      const derivedGp = rev - cogs;
      const calculatedGm = Number(((derivedGp / rev) * 100).toFixed(2));
      return {
        metricKey: 'gross_margin',
        periodKey: period,
        value: calculatedGm,
        sourcePath: '(income_statement.revenue - income_statement.cogs) / income_statement.revenue',
        formula: 'Gross Margin = ((Revenue - COGS) / Revenue) * 100',
        valueState: 'CALCULATED'
      };
    }
  }

  // Priority 4: Existing deterministic canonical Key Indicator series
  const existingKi = findKeyIndicatorInSource(data.key_indicators, 'gross_margin');
  if (existingKi) {
    const alignedVals = alignMetricValuesByPeriod(rawPeriods, existingKi.periods, existingKi.values);
    const kiVal = alignedVals[periodIndex];
    if (typeof kiVal === 'number' && Number.isFinite(kiVal)) {
      return {
        metricKey: 'gross_margin',
        periodKey: period,
        value: kiVal,
        sourcePath: 'financial_statements.key_indicators.gross_margin',
        formula: 'Canonical Key Indicator',
        valueState: 'CALCULATED'
      };
    }
  }

  // Priority 5: Unavailable
  let unavailableReason: UnavailableReason = 'NO_VERIFIED_SOURCE';
  if (rev === undefined || rev === null) {
    unavailableReason = 'MISSING_DENOMINATOR';
  } else if (rev === 0) {
    unavailableReason = 'ZERO_DENOMINATOR';
  } else if (gp === undefined || gp === null) {
    unavailableReason = isFinancialOrBanking ? 'UNSUPPORTED_FORMULA' : 'MISSING_NUMERATOR';
  }

  return {
    metricKey: 'gross_margin',
    periodKey: period,
    value: null,
    sourcePath: 'unavailable',
    valueState: 'NOT_AVAILABLE',
    unavailableReason
  };
}
