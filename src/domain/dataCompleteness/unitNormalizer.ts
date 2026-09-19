import type { FinancialUnit } from '../financialValue.js';

export interface NormalizedNumericValue {
  value: number;
  normalizedValue: number;
  targetUnit: FinancialUnit | string;
  normalizedUnit: FinancialUnit | string;
  originalUnit: string;
  originalRawValue: string | number;
  scaleFactor: number;
}

function parseUnitString(u: string): string {
  const s = u.trim().toLowerCase().replace(/_/g, ' ');
  if (s === 'b' || s === 'billion' || s === 'billions' || s === 'usd b' || s === 'usd billions') return 'billions';
  if (s === 'm' || s === 'million' || s === 'millions' || s === 'usd m' || s === 'usd millions') return 'millions';
  if (s === 'k' || s === 'thousand' || s === 'thousands' || s === 'usd k' || s === 'usd thousands') return 'thousands';
  if (s === 'usd' || s === 'dollars' || s === '$') return 'usd';
  if (s === 'bps' || s === 'bp' || s === 'basis points') return 'bps';
  if (s === '%' || s === 'pct' || s === 'percent') return 'percent';
  if (s === 'ratio' || s === 'decimal') return 'ratio';
  if (s === 'shares' || s === 'count') return 'shares';
  return s;
}

/**
 * Normalizes numbers and currency/unit strings into canonical Lumina units (USD_M, percent, per_share, etc.)
 * Avoids 1,000x scaling errors while preserving original unit strings.
 */
export function normalizeFinancialUnit(
  rawValue: string | number | null | undefined,
  sourceOrTargetUnit: FinancialUnit | string,
  targetOrSourceUnit?: FinancialUnit | string
): NormalizedNumericValue | null {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return null;
  }

  const rawStr = String(rawValue).trim();
  const cleaned = rawStr.replace(/[\$,]/g, '').trim();

  // Match number and unit suffix
  const match = cleaned.match(/^([+-]?(?:\d+\.?\d*|\.\d+))\s*([a-zA-Z%]*)$/i);
  let num: number;
  let inlineUnit = '';

  if (match) {
    num = parseFloat(match[1]);
    if (match[2]) inlineUnit = match[2];
  } else {
    num = parseFloat(cleaned);
  }

  if (!Number.isFinite(num)) {
    return null;
  }

  let fromUnit = inlineUnit || (sourceOrTargetUnit ? String(sourceOrTargetUnit) : '');
  let toUnit = targetOrSourceUnit ? String(targetOrSourceUnit) : fromUnit;

  // If source and target are provided, determine which is source and which is target
  const parsed1 = parseUnitString(String(sourceOrTargetUnit || ''));
  const parsed2 = parseUnitString(String(targetOrSourceUnit || ''));

  if (targetOrSourceUnit) {
    fromUnit = parsed1;
    toUnit = parsed2;
  } else {
    fromUnit = inlineUnit ? parseUnitString(inlineUnit) : parsed1;
    toUnit = parsed1;
  }

  let scaleFactor = 1;

  if (toUnit === 'millions' || toUnit === 'usd m') {
    if (fromUnit === 'billions') scaleFactor = 1000;
    else if (fromUnit === 'thousands') scaleFactor = 0.001;
    else if (fromUnit === 'usd') scaleFactor = 0.000001;
    else if (fromUnit === 'millions') scaleFactor = 1;
  } else if (toUnit === 'percent') {
    if (fromUnit === 'bps') scaleFactor = 0.01;
    else if (fromUnit === 'ratio' || fromUnit === 'decimal' || (num > -1 && num < 1 && num !== 0 && !inlineUnit)) {
      scaleFactor = 100;
    } else if (fromUnit === 'percent') {
      scaleFactor = 1;
    }
  } else if (toUnit === 'billions') {
    if (fromUnit === 'millions') scaleFactor = 0.001;
    else if (fromUnit === 'usd') scaleFactor = 0.000000001;
  }

  const normalized = Math.round((num * scaleFactor + Number.EPSILON) * 10000) / 10000;

  return {
    value: normalized,
    normalizedValue: normalized,
    targetUnit: targetOrSourceUnit || sourceOrTargetUnit,
    normalizedUnit: targetOrSourceUnit || sourceOrTargetUnit,
    originalUnit: String(sourceOrTargetUnit || inlineUnit || 'raw'),
    originalRawValue: rawValue,
    scaleFactor,
  };
}
