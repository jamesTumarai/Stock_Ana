/** A TTM flow needs four distinct, consecutive standalone fiscal quarters. */
export function validTrailingFourQuarterLabels(periods: string[]): boolean {
  if (periods.length !== 4) return false;
  const ordinals = periods.map(period => {
    const match = period.trim().match(/^Q([1-4])\s+(?:FY)?(20\d{2})$/i);
    return match ? Number(match[2]) * 4 + Number(match[1]) - 1 : NaN;
  });
  return ordinals.every((ordinal, index) => Number.isFinite(ordinal)
    && (index === 0 || ordinal === ordinals[index - 1] + 1));
}
