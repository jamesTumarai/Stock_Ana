/** US single-letter share classes use dot or hyphen at provider boundaries.
 * This preserves distinct A/B classes and other symbol syntax; callers use the
 * US-equity convention, never infer a CIK from a symbol spelling. */
export function shareClassProviderSymbol(ticker:string):string {
  const normalized=ticker.trim().toUpperCase();
  return normalized.replace(/^([A-Z][A-Z0-9]{0,9})\.([A-Z])$/,'$1-$2');
}

export function sameShareClassTicker(a:string,b:string):boolean {
  return Boolean(a.trim()&&b.trim())&&shareClassProviderSymbol(a)===shareClassProviderSymbol(b);
}
