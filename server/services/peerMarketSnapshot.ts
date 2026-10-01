import { shareClassProviderSymbol, sameShareClassTicker } from '../../src/domain/tickerIdentity';
export interface PeerMarketPrice { ticker: string; price: number; asOf: string; source: string; }

/** Observe a quote independently of the discovery/model payload. No invented
 * market cap or multiple is accepted when the provider cannot be reached. */
export async function fetchPeerMarketPrice(ticker: string): Promise<PeerMarketPrice | null> {
  const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(shareClassProviderSymbol(ticker))}?interval=1d&range=5d`;
  try {
    const response=await fetch(url,{signal:AbortSignal.timeout(3000),headers:{'User-Agent':'Mozilla/5.0'}});
    if(!response.ok)return null;
    const payload=await response.json();
    const meta=payload?.chart?.result?.[0]?.meta;
    if(typeof meta?.symbol!=='string'||!sameShareClassTicker(meta.symbol,ticker) || meta.currency !== 'USD' || typeof meta.regularMarketPrice!=='number'
      || !Number.isFinite(meta.regularMarketPrice) || meta.regularMarketPrice<=0
      || typeof meta.regularMarketTime!=='number' || !Number.isFinite(meta.regularMarketTime)
      || meta.regularMarketTime*1000 > Date.now()+300_000
      || Date.now()-meta.regularMarketTime*1000 > 7*86_400_000)return null;
    return {ticker,price:meta.regularMarketPrice,asOf:new Date(meta.regularMarketTime*1000).toISOString(),source:url};
  } catch { return null; }
}
