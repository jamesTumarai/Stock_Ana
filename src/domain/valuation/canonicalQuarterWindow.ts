export interface StructuredFiscalPeriod {
  fiscalYear?: number | null;
  fiscalQuarter?: number | null;
  year?: number | null;
  quarter?: number | null;
  periodType?: 'standalone_quarter' | 'annual' | 'instant' | string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  period?: string | null;
  label?: string | null;
  fp?: string | null;
  fy?: number | null;
}

export type FiscalPeriodInput = string | StructuredFiscalPeriod;

/**
 * Computes a sequential fiscal quarter ordinal: fiscalYear * 4 + (fiscalQuarter - 1)
 * Returns NaN if input cannot be resolved to a standalone fiscal quarter.
 */
export function getFiscalQuarterOrdinal(input: FiscalPeriodInput): number {
  if (!input) return NaN;

  if (typeof input === 'object') {
    // If explicitly marked as annual or YTD, it cannot form a standalone quarter TTM
    if (input.periodType === 'annual' || (typeof input.periodType === 'string' && /annual|ytd|cumulative|6m|9m/i.test(input.periodType))) {
      return NaN;
    }
    const year = Number.isFinite(input.fiscalYear) ? (input.fiscalYear as number)
      : Number.isFinite(input.year) ? (input.year as number)
      : Number.isFinite(input.fy) ? (input.fy as number)
      : undefined;
    const quarter = Number.isFinite(input.fiscalQuarter) ? (input.fiscalQuarter as number)
      : Number.isFinite(input.quarter) ? (input.quarter as number)
      : input.fp && /^Q([1-4])$/i.test(input.fp) ? Number(input.fp.slice(1))
      : undefined;

    if (year !== undefined && quarter !== undefined && quarter >= 1 && quarter <= 4) {
      return year * 4 + (quarter - 1);
    }

    // Try text fallback from object's period/label
    const text = input.label || input.period || '';
    if (text) {
      return parseFiscalQuarterOrdinalFromLabel(text);
    }
    return NaN;
  }

  return parseFiscalQuarterOrdinalFromLabel(input);
}

/**
 * Parses fiscal quarter ordinal from display labels supporting various formats:
 * 'Q1 2026', 'Q1 FY2026', 'FY2026 Q1', '2026 Q1', '2026-Q1', 'Q1-2026', etc.
 * Rejects labels with explicit 'YTD', 'annual', 'FY' alone without quarter, etc.
 */
export function parseFiscalQuarterOrdinalFromLabel(label: string): number {
  if (typeof label !== 'string') return NaN;
  const trimmed = label.trim();
  if (!trimmed) return NaN;

  // Reject YTD, cumulative, semi-annual, or annual periods
  if (/\b(?:YTD|6M|9M|cumulative|annual|year\s*ended)\b/i.test(trimmed)) {
    return NaN;
  }
  // Pure FY (e.g. 'FY2024') without quarter
  if (/^FY\s*(?:20)?\d{2}$/i.test(trimmed)) {
    return NaN;
  }

  const shortFiscalQFirst = trimmed.match(/^Q([1-4])[\s\-_/]+FY\s*(\d{2})$/i);
  const shortFiscalYFirst = trimmed.match(/^FY\s*(\d{2})[\s\-_/]+Q([1-4])$/i);
  if (shortFiscalQFirst) return (2000 + Number(shortFiscalQFirst[2])) * 4 + Number(shortFiscalQFirst[1]) - 1;
  if (shortFiscalYFirst) return (2000 + Number(shortFiscalYFirst[1])) * 4 + Number(shortFiscalYFirst[2]) - 1;

  // 1. Q[1-4] followed by year, e.g. 'Q2 2026', 'Q2 FY2026', 'Q2-2026', 'Q2_2026', 'Q2/2026'
  const matchQFirst = trimmed.match(/^Q([1-4])[\s\-_/]+(?:FY)?((?:19|20)\d{2})$/i);
  if (matchQFirst) {
    const q = Number(matchQFirst[1]);
    const y = Number(matchQFirst[2]);
    return y * 4 + (q - 1);
  }

  // 2. Year followed by Q[1-4], e.g. 'FY2026 Q2', '2026 Q2', '2026-Q2', '2026_Q2'
  const matchYFirst = trimmed.match(/^(?:FY)?((?:19|20)\d{2})[\s\-_/]+Q([1-4])$/i);
  if (matchYFirst) {
    const y = Number(matchYFirst[1]);
    const q = Number(matchYFirst[2]);
    return y * 4 + (q - 1);
  }

  // 3. More flexible regex for other label variations:
  const qMatch = trimmed.match(/\bQ([1-4])\b/i);
  const yMatch = trimmed.match(/\b((?:19|20)\d{2})\b/);
  if (qMatch && yMatch && !/\bFY\d{4}\b/i.test(trimmed.replace(qMatch[0], ''))) {
    const q = Number(qMatch[1]);
    const y = Number(yMatch[1]);
    return y * 4 + (q - 1);
  }

  return NaN;
}

/** A TTM flow needs four distinct, consecutive standalone fiscal quarters. */
export function validTrailingFourQuarterLabels(periods: FiscalPeriodInput[]): boolean {
  if (!Array.isArray(periods) || periods.length !== 4) return false;
  const ordinals = periods.map(getFiscalQuarterOrdinal);
  return ordinals.every((ordinal, index) =>
    Number.isFinite(ordinal) && (index === 0 || ordinal === ordinals[index - 1] + 1)
  );
}

export const validTrailingFourQuarterWindow = validTrailingFourQuarterLabels;
