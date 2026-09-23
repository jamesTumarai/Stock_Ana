/**
 * Canonical Shared ROIC Calculator
 *
 * Provides a single, deterministic, accounting-grade ROIC calculation consumed
 * identically by Target Five Pillars (Pillar 2) and Peer Benchmark Matrix (Pillar 5).
 *
 * Core Formula:
 *   ROIC = NOPAT / Invested Capital × 100
 *   NOPAT = Operating Income × (1 - Applicable Tax Rate)
 *   Invested Capital = Total Equity + Total Debt - Cash & Short-Term Investments
 *   Average Invested Capital = (Beginning IC + Ending IC) / 2
 *
 * Invariants:
 * 1. Positive and finite negative ROIC are valid (loss-making companies can produce negative ROIC).
 * 2. Pretax <= 0 uses deterministic fallback tax rate (21%), never produces NaN or tax benefit artifact.
 * 3. Non-positive invested capital fails closed with UNAVAILABLE ('Invested capital is non-positive').
 * 4. Tracks exact period basis ('TTM', 'ANNUAL', 'QUARTERLY') to prevent period mixing.
 */

export interface CanonicalRoicInput {
  operatingIncome: number;
  incomeBeforeTax?: number;
  incomeTaxExpense?: number;
  beginningInvestedCapital?: number;
  endingInvestedCapital: number;
  periodBasis: 'TTM' | 'ANNUAL' | 'QUARTERLY';
  periodLabel?: string;
  source?: string;
}

export interface CanonicalRoicResult {
  value: number | null;
  status: 'CALCULATED' | 'VERIFIED' | 'UNAVAILABLE' | 'GUARDED';
  basis: string;
  periodBasis: 'TTM' | 'ANNUAL' | 'QUARTERLY';
  period?: string;
  formula: string;
  taxRateUsed: number;
  taxRateMethod: 'OBSERVED' | 'FALLBACK';
  averageInvestedCapital: number | null;
  investedCapitalBeginning?: number;
  investedCapitalEnding: number;
  source?: string;
  reason?: string;
  reasonTh?: string;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const rounded = (v: number) => Math.sign(v) * Math.round((Math.abs(v) + Number.EPSILON) * 100) / 100;

export function calculateCanonicalRoic(input: CanonicalRoicInput): CanonicalRoicResult {
  const {
    operatingIncome,
    incomeBeforeTax,
    incomeTaxExpense,
    beginningInvestedCapital,
    endingInvestedCapital,
    periodBasis,
    periodLabel,
    source,
  } = input;

  const formula = 'Operating Income × (1 - Tax Rate) / Invested Capital (Equity + Debt - Cash)';

  // 1. Invested Capital validation
  let avgIC: number | null = null;
  let basis = 'NOPAT / Ending Invested Capital';

  if (finite(beginningInvestedCapital) && beginningInvestedCapital > 0 && endingInvestedCapital > 0) {
    avgIC = rounded((beginningInvestedCapital + endingInvestedCapital) / 2);
    basis = periodBasis === 'TTM'
      ? 'TTM NOPAT / Average Invested Capital'
      : periodBasis === 'ANNUAL'
        ? 'Annual NOPAT / Average Invested Capital'
        : 'Quarterly NOPAT / Average Invested Capital';
  } else if (endingInvestedCapital > 0) {
    avgIC = endingInvestedCapital;
    basis = periodBasis === 'TTM'
      ? 'TTM NOPAT / Ending Invested Capital'
      : periodBasis === 'ANNUAL'
        ? 'Annual NOPAT / Ending Invested Capital'
        : 'Quarterly NOPAT / Ending Invested Capital';
  }

  if (avgIC === null || avgIC <= 0) {
    return {
      value: null,
      status: 'UNAVAILABLE',
      basis,
      periodBasis,
      period: periodLabel,
      formula,
      taxRateUsed: 0.21,
      taxRateMethod: 'FALLBACK',
      averageInvestedCapital: null,
      investedCapitalBeginning: beginningInvestedCapital,
      investedCapitalEnding: endingInvestedCapital,
      source,
      reason: 'Invested capital is non-positive',
      reasonTh: 'เงินลงทุนดำเนินงานสุทธิ (Invested Capital) มีค่าติดลบหรือไม่เป็นบวก',
    };
  }

  // 2. Deterministic Tax Rate Policy
  // If pretax is positive and tax expense is meaningful: observed effective rate
  // Otherwise (including pretax <= 0 for loss-making companies): deterministic 21% fallback
  let taxRateUsed = 0.21;
  let taxRateMethod: 'OBSERVED' | 'FALLBACK' = 'FALLBACK';

  if (
    finite(incomeBeforeTax) &&
    incomeBeforeTax > 0 &&
    finite(incomeTaxExpense) &&
    incomeTaxExpense >= 0 &&
    incomeTaxExpense <= incomeBeforeTax
  ) {
    taxRateUsed = incomeTaxExpense / incomeBeforeTax;
    taxRateMethod = 'OBSERVED';
  }

  // 3. Compute NOPAT and ROIC
  const nopat = operatingIncome * (1 - taxRateUsed);
  const roicVal = rounded((nopat / avgIC) * 100);

  return {
    value: roicVal,
    status: 'CALCULATED',
    basis,
    periodBasis,
    period: periodLabel,
    formula,
    taxRateUsed: rounded(taxRateUsed),
    taxRateMethod,
    averageInvestedCapital: avgIC,
    investedCapitalBeginning: beginningInvestedCapital,
    investedCapitalEnding: endingInvestedCapital,
    source,
  };
}

/**
 * Calculates invested capital from components:
 * Invested Capital = Total Equity + Total Debt - Cash & Cash Equivalents - Short-Term Investments
 */
export function calculateInvestedCapital(
  totalEquity?: number | null,
  totalDebt?: number | null,
  cash?: number | null,
  shortTermInvestments?: number | null
): number | null {
  if (!finite(totalEquity) || !finite(totalDebt) || !finite(cash)) {
    return null;
  }
  const st = finite(shortTermInvestments) ? shortTermInvestments : 0;
  return rounded(totalEquity + totalDebt - cash - st);
}
