export type WorkingCapitalSemantic = 'CASH_FLOW_EFFECT' | 'BALANCE_CHANGE';

/** Exact taxonomy direction, not an inference from a balance-sheet account.
 * These US-GAAP concepts encode increases/decreases, even when the filing's
 * cash-flow presentation uses the opposite (negated-label/calculation) sign.
 * An already signed CASH_FLOW_EFFECT must never be inverted again. */
const balanceToCashEffect: Record<string, number> = {
  IncreaseDecreaseInAccountsReceivable: -1,
  IncreaseDecreaseInInventories: -1,
  IncreaseDecreaseInAccountsPayable: 1,
};
export function workingCapitalCashEffect(concept: string, value: number, sourceSemantic?: WorkingCapitalSemantic) {
  const local = concept.split(':').at(-1)!;
  const multiplier = sourceSemantic === 'CASH_FLOW_EFFECT' ? 1 : balanceToCashEffect[local];
  if (!Number.isFinite(value) || multiplier === undefined) return null;
  return { value: value * multiplier, semantic: 'CASH_FLOW_EFFECT' as const,
    sourceSemantic: sourceSemantic || 'BALANCE_CHANGE' as const, sourceValue: value, multiplier };
}
export function formatWorkingCapitalCashEffect(value: number): string {
  const number = Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(3)}B` : `${Number(value.toFixed(3))}M`;
  return `${value > 0 ? '+' : ''}${number}`;
}
