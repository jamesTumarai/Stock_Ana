import { buildUsdThbFxSnapshot, type FxSnapshot } from '../domain/fxSnapshot';
import { fetchLiveQuotes } from './marketDataService';

export const USD_THB_PROVIDER_SYMBOL = 'THB=X';

/**
 * Fetch the USD/THB presentation conversion rate through Lumina's existing provider boundary.
 * This is a display-time provider snapshot only; it does not rewrite the persisted USD report.
 */
export async function fetchUsdThbFxSnapshot(): Promise<FxSnapshot | null> {
  const response = await fetchLiveQuotes([USD_THB_PROVIDER_SYMBOL]);
  const quote = response?.quotes?.[USD_THB_PROVIDER_SYMBOL];
  if (!quote) return null;

  return buildUsdThbFxSnapshot({
    symbol: quote.symbol,
    price: quote.price,
    shortName: quote.shortName,
    provider: quote.provider || response?.provider,
    asOf: quote.asOf || response?.asOf,
    retrievedAt: quote.retrievedAt,
  });
}
