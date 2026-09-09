export interface LiveQuoteItem {
  symbol: string;
  price: number;
  changePercent?: number | null;
  change?: number | null;
  marketCap?: string | null;
  marketCapRaw?: number | null;
  trailingPE?: number | null;
  forwardPE?: number | null;
  pegRatio?: number | null;
  priceToSales?: number | null;
  priceToBook?: number | null;
  enterpriseToRevenue?: number | null;
  enterpriseToEbitda?: number | null;
  enterpriseValue?: string | null;
  enterpriseValueRaw?: number | null;
  fiftyTwoWeekHigh?: number | null;
  fiftyTwoWeekLow?: number | null;
  volume?: number | null;
  shortName?: string;
  revenueGrowthYoY?: number | null;
  grossMargin?: number | null;
  netMargin?: number | null;
  forecast_data?: any;
  provider?: string;
  asOf?: string;
  retrievedAt?: string;
}

export interface LiveQuotesResponse {
  quotes: Record<string, LiveQuoteItem>;
  asOf: string;
  provider?: string;
  dataType?: 'market_quote' | string;
  isRealtime?: boolean;
}

// `/api/live-quotes` is currently implemented exclusively with Yahoo Finance quote/chart endpoints.
// Keep this explicit at the provider boundary instead of making downstream report code guess the source.
export const MARKET_QUOTE_PROVIDER = 'Yahoo Finance';

/**
 * Fetches market quote data from the Lumina backend for a list of ticker symbols.
 * The backend may return delayed/session-dependent data, so callers must not label it guaranteed real-time.
 */
export async function fetchLiveQuotes(symbols: string[]): Promise<LiveQuotesResponse | null> {
  const cleanSymbols = symbols.map(s => s.trim().toUpperCase()).filter(Boolean);
  if (cleanSymbols.length === 0) return null;

  try {
    const res = await fetch(`/api/live-quotes?symbols=${encodeURIComponent(cleanSymbols.join(','))}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch market quotes: ${res.statusText}`);
    }

    const raw = await res.json() as LiveQuotesResponse;
    const provider = typeof raw.provider === 'string' && raw.provider.trim()
      ? raw.provider.trim()
      : MARKET_QUOTE_PROVIDER;
    const retrievedAt = new Date().toISOString();
    const quotes = Object.fromEntries(
      Object.entries(raw.quotes || {}).map(([symbol, quote]) => [symbol, {
        ...quote,
        provider,
        asOf: raw.asOf,
        retrievedAt,
      }]),
    );

    return {
      ...raw,
      provider,
      dataType: raw.dataType ?? 'market_quote',
      // The current provider does not guarantee exchange-real-time delivery.
      isRealtime: false,
      quotes,
    };
  } catch (error) {
    console.warn('[marketDataService] Error fetching market quotes:', error);
    return null;
  }
}
