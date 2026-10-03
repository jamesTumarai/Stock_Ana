interface HistoryMetricRecord {
  fairValue?: number | null;
  marketPrice?: number | null;
  data?: {
    currentPrice?: number | null;
    canonical_executive_snapshot?: {
      canonicalValuation?: { baseFairValue?: number | null };
      valuation?: { fairValue?: number | null };
      market?: { currentPrice?: number | null };
    };
    intrinsic_value?: {
      canonical_run?: { baseFairValue?: number | null };
      current_price?: number | null;
      summary?: { base_case_fair_value?: number | null; dcf_fair_value?: number | null; current_price?: number | null };
    };
  };
}

const firstDefined = (...values: Array<number | null | undefined>) => values.find(value => value !== undefined);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Read saved values only; hydration must not change a compact History badge. */
export function historyQuickMetric(record: HistoryMetricRecord): string | null {
  const data = record.data, intrinsic = data?.intrinsic_value, snapshot = data?.canonical_executive_snapshot;
  const fairValue = firstDefined(record.fairValue, intrinsic?.canonical_run
    ? intrinsic.canonical_run.baseFairValue ?? null
    : firstDefined(snapshot?.canonicalValuation?.baseFairValue, snapshot?.valuation?.fairValue,
      intrinsic?.summary?.base_case_fair_value, intrinsic?.summary?.dcf_fair_value));
  const price = firstDefined(record.marketPrice, snapshot?.market?.currentPrice,
    intrinsic?.current_price, intrinsic?.summary?.current_price, data?.currentPrice);
  // An explicit null rejects stale aliases; real zero remains a saved value.
  if (finite(fairValue)) return `Fair Value: $${fairValue.toFixed(2)}`;
  if (finite(price)) return `$${price.toFixed(2)}`;
  return null;
}
