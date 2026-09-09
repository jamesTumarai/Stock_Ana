export type FxDataKind = 'fx_quote';

export interface FxSnapshot {
  pair: 'USD/THB';
  baseCurrency: 'USD';
  quoteCurrency: 'THB';
  rate: number;
  provider?: string;
  asOf?: string;
  retrievedAt: string;
  dataKind: FxDataKind;
  isRealtime: false;
}

export interface FxQuoteLike {
  symbol?: string;
  price?: number | null;
  shortName?: string;
  provider?: string;
  asOf?: string;
  retrievedAt?: string;
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/**
 * Convert a provider USD/THB quote into Lumina's canonical FX snapshot.
 * Missing or invalid rates fail closed; no fallback exchange rate is invented.
 */
export function buildUsdThbFxSnapshot(quote?: FxQuoteLike | null): FxSnapshot | null {
  if (!quote || !finite(quote.price) || quote.price <= 0) return null;

  const symbol = typeof quote.symbol === 'string' ? quote.symbol.trim().toUpperCase() : '';
  const shortName = typeof quote.shortName === 'string' ? quote.shortName.trim().toUpperCase() : '';
  const isUsdThb = symbol === 'THB=X' || shortName === 'USD/THB';
  if (!isUsdThb) return null;

  return {
    pair: 'USD/THB',
    baseCurrency: 'USD',
    quoteCurrency: 'THB',
    rate: quote.price,
    provider: typeof quote.provider === 'string' && quote.provider.trim() ? quote.provider.trim() : undefined,
    asOf: typeof quote.asOf === 'string' && quote.asOf.trim() ? quote.asOf : undefined,
    retrievedAt: typeof quote.retrievedAt === 'string' && quote.retrievedAt.trim()
      ? quote.retrievedAt
      : new Date().toISOString(),
    dataKind: 'fx_quote',
    // Yahoo-backed FX quotes can be delayed/session-dependent; never claim guaranteed real-time delivery.
    isRealtime: false,
  };
}
