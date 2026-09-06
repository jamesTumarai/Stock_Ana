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
}

export interface LiveQuotesResponse {
  quotes: Record<string, LiveQuoteItem>;
  asOf: string;
}

/**
 * Fetches real-time market data quotes from the Lumina backend for a list of ticker symbols.
 */
export async function fetchLiveQuotes(symbols: string[]): Promise<LiveQuotesResponse | null> {
  const cleanSymbols = symbols.map(s => s.trim().toUpperCase()).filter(Boolean);
  if (cleanSymbols.length === 0) return null;

  try {
    const res = await fetch(`/api/live-quotes?symbols=${encodeURIComponent(cleanSymbols.join(','))}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch live quotes: ${res.statusText}`);
    }
    const data: LiveQuotesResponse = await res.json();
    return data;
  } catch (error) {
    console.warn('[marketDataService] Error fetching live quotes:', error);
    return null;
  }
}
