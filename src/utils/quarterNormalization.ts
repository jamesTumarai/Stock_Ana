/**
 * Deterministic Quarterly Flow Normalization Utility
 *
 * In SEC Form 10-Q filings:
 * - Q1 reports 3-month standalone figures.
 * - Q2 reports 3-month standalone figures AND 6-month YTD (H1) figures.
 * - Q3 reports 3-month standalone figures AND 9-month YTD (9M) figures.
 *
 * This module ensures flow metrics (Revenue, Net Income, Operating Income, Cash Flow)
 * are accurately converted to standalone 3-month quarters without double-subtraction
 * or period-type conflation.
 */

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const rounded = (v: number, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.sign(v) * Math.round((Math.abs(v) + Number.EPSILON) * factor) / factor;
};

/**
 * Checks whether a period label explicitly indicates a cumulative YTD period.
 */
export function isYtdPeriodLabel(label: string): boolean {
  if (!label || typeof label !== 'string') return false;
  const trimmed = label.trim();
  return /\b(YTD|H1|6M|9M)\b/i.test(trimmed);
}

/**
 * Derives a standalone Q2 flow metric from Q1 standalone and H1 YTD (6-month cumulative).
 * Strict fail-closed: returns null if either input is invalid or non-finite.
 */
export function deriveStandaloneQuarterFromYtd(
  q1Standalone: number | null | undefined,
  h1Ytd: number | null | undefined
): number | null {
  if (!finite(q1Standalone) || !finite(h1Ytd)) return null;
  return rounded(h1Ytd - q1Standalone, 2);
}

/**
 * Derives a standalone Q3 flow metric from H1 YTD (6-month) and 9M YTD (9-month cumulative).
 * Strict fail-closed: returns null if either input is invalid or non-finite.
 */
export function deriveQ3StandaloneFromYtd(
  h1Ytd: number | null | undefined,
  m9Ytd: number | null | undefined
): number | null {
  if (!finite(h1Ytd) || !finite(m9Ytd)) return null;
  return rounded(m9Ytd - h1Ytd, 2);
}

export interface QuarterNormalizationInput {
  period: string;
  value: number | null | undefined;
  isYtd?: boolean;
}

export interface QuarterNormalizationResult {
  period: string;
  raw: number | null | undefined;
  normalized: number | null;
  wasDerived: boolean;
  sourceType: 'STANDALONE_REPORTED' | 'DERIVED_FROM_YTD' | 'UNAVAILABLE';
}

/**
 * Normalizes a series of flow metrics into standalone quarterly figures.
 * Prevents double subtraction: each derivation step consumes only the original cumulative and standalone anchors.
 */
export function normalizeQuarterlyFlowSeries(
  items: QuarterNormalizationInput[]
): QuarterNormalizationResult[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  const results: QuarterNormalizationResult[] = [];
  let previousCumulative: number | null = null;
  let q1Standalone: number | null = null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isYtd = Boolean(item.isYtd || isYtdPeriodLabel(item.period));
    const val = finite(item.value) ? item.value : null;

    if (val === null) {
      results.push({
        period: item.period,
        raw: item.value,
        normalized: null,
        wasDerived: false,
        sourceType: 'UNAVAILABLE',
      });
      continue;
    }

    if (!isYtd) {
      // Standalone reported quarter
      if (i === 0 || /Q1/i.test(item.period)) {
        q1Standalone = val;
        previousCumulative = val;
      } else if (previousCumulative !== null) {
        // Accumulate running total for subsequent YTD comparisons
        previousCumulative += val;
      }
      results.push({
        period: item.period,
        raw: item.value,
        normalized: val,
        wasDerived: false,
        sourceType: 'STANDALONE_REPORTED',
      });
    } else {
      // Cumulative YTD quarter (e.g. H1 YTD or 9M YTD)
      if (/Q2|H1|6M/i.test(item.period)) {
        const anchorQ1 = q1Standalone !== null ? q1Standalone : (results[0]?.normalized ?? null);
        const derived = deriveStandaloneQuarterFromYtd(anchorQ1, val);
        previousCumulative = val; // Store H1 YTD as anchor for Q3
        results.push({
          period: item.period,
          raw: item.value,
          normalized: derived,
          wasDerived: derived !== null,
          sourceType: derived !== null ? 'DERIVED_FROM_YTD' : 'UNAVAILABLE',
        });
      } else if (/Q3|9M/i.test(item.period)) {
        const anchorH1 = previousCumulative;
        const derived = deriveQ3StandaloneFromYtd(anchorH1, val);
        results.push({
          period: item.period,
          raw: item.value,
          normalized: derived,
          wasDerived: derived !== null,
          sourceType: derived !== null ? 'DERIVED_FROM_YTD' : 'UNAVAILABLE',
        });
      } else {
        // Unrecognized YTD type: do not guess or double-subtract
        results.push({
          period: item.period,
          raw: item.value,
          normalized: val,
          wasDerived: false,
          sourceType: 'STANDALONE_REPORTED',
        });
      }
    }
  }

  return results;
}
