export type MarketDataKind = 'market_quote';

export interface MarketSnapshot {
  ticker: string;
  price: number;
  change?: number | null;
  changePercent?: number | null;
  marketCapRaw?: number | null;
  enterpriseValueRaw?: number | null;
  trailingPE?: number | null;
  forwardPE?: number | null;
  pegRatio?: number | null;
  priceToSales?: number | null;
  priceToBook?: number | null;
  enterpriseToRevenue?: number | null;
  enterpriseToEbitda?: number | null;
  fiftyTwoWeekHigh?: number | null;
  fiftyTwoWeekLow?: number | null;
  volume?: number | null;
  provider?: string;
  asOf?: string;
  retrievedAt: string;
  dataKind: MarketDataKind;
  isRealtime: false;
}

export interface MarketQuoteLike {
  symbol?: string;
  price?: number | null;
  change?: number | null;
  changePercent?: number | null;
  marketCapRaw?: number | null;
  enterpriseValueRaw?: number | null;
  trailingPE?: number | null;
  forwardPE?: number | null;
  pegRatio?: number | null;
  priceToSales?: number | null;
  priceToBook?: number | null;
  enterpriseToRevenue?: number | null;
  enterpriseToEbitda?: number | null;
  fiftyTwoWeekHigh?: number | null;
  fiftyTwoWeekLow?: number | null;
  volume?: number | null;
  provider?: string;
  asOf?: string;
  retrievedAt?: string;
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const finiteOrNull = (value: unknown): number | null | undefined => value === null ? null : finite(value) ? value : undefined;
const omitUndefined = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;

/**
 * Convert one provider quote into Lumina's canonical market snapshot.
 * Missing metadata remains missing. The helper never invents prices, timestamps, or providers.
 */
export function buildMarketSnapshot(ticker: string, quote?: MarketQuoteLike | null): MarketSnapshot | null {
  const normalizedTicker = ticker.trim().toUpperCase();
  if (!normalizedTicker || !quote || !finite(quote.price) || quote.price <= 0) return null;

  return omitUndefined({
    ticker: normalizedTicker,
    price: quote.price,
    change: finiteOrNull(quote.change),
    changePercent: finiteOrNull(quote.changePercent),
    marketCapRaw: finiteOrNull(quote.marketCapRaw),
    enterpriseValueRaw: finiteOrNull(quote.enterpriseValueRaw),
    trailingPE: finiteOrNull(quote.trailingPE),
    forwardPE: finiteOrNull(quote.forwardPE),
    pegRatio: finiteOrNull(quote.pegRatio),
    priceToSales: finiteOrNull(quote.priceToSales),
    priceToBook: finiteOrNull(quote.priceToBook),
    enterpriseToRevenue: finiteOrNull(quote.enterpriseToRevenue),
    enterpriseToEbitda: finiteOrNull(quote.enterpriseToEbitda),
    fiftyTwoWeekHigh: finiteOrNull(quote.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: finiteOrNull(quote.fiftyTwoWeekLow),
    volume: finiteOrNull(quote.volume),
    provider: typeof quote.provider === 'string' && quote.provider.trim() ? quote.provider.trim() : undefined,
    asOf: typeof quote.asOf === 'string' && quote.asOf.trim() ? quote.asOf : undefined,
    retrievedAt: typeof quote.retrievedAt === 'string' && quote.retrievedAt.trim() ? quote.retrievedAt : new Date().toISOString(),
    dataKind: 'market_quote',
    // Yahoo-backed quotes can be delayed or session-dependent, so Lumina must not claim guaranteed real-time data.
    isRealtime: false,
  });
}
