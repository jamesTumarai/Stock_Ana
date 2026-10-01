/** Preserve Lumina's price-relative return convention across canonical runs,
 * scenario cards and the formula dialog. Quotes never change intrinsic value.
 * Missing/nonpositive denominators remain unavailable rather than 0%. */
export function resolveValuationPriceMetrics(fairValue: unknown, price: unknown): {upsidePct:number|null; marginOfSafetyPct:number|null} {
  if(typeof fairValue!=='number'||!Number.isFinite(fairValue)||fairValue<=0
    ||typeof price!=='number'||!Number.isFinite(price)||price<=0)return {upsidePct:null,marginOfSafetyPct:null};
  const value=Math.round(((fairValue-price)/price*100+Number.EPSILON)*100)/100;
  return {upsidePct:value,marginOfSafetyPct:value};
}
