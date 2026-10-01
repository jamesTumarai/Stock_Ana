import { shareClassProviderSymbol, sameShareClassTicker } from '../../src/domain/tickerIdentity';

export interface EarningsReaction {
  reportDate: string;
  value: number | null;
  reason?: string;
  provider: 'Yahoo Finance';
  sourceUrl?: string;
  retrievedAt: string;
  basis: 'REPORTED_DATE_CLOSE_TO_NEXT_SESSION_CLOSE';
  beforeDate?: string;
  afterDate?: string;
  beforeClose?: number;
  afterClose?: number;
}

/** An observed close-to-close move, not an intraday/event-study estimate.
 * The earnings date is reported by the report's dated source; this provider
 * independently verifies prices, not the release timestamp or session timing.
 * Missing/non-trading dates and intervening splits fail closed.
 */
export function calculateEarningsReactions(dates: string[], chart: any, retrievedAt: string, sourceUrl?: string): EarningsReaction[] {
  const timestamps: number[] = chart?.timestamp || [];
  const closes: unknown[] = chart?.indicators?.quote?.[0]?.close || [];
  const timezone = typeof chart?.meta?.exchangeTimezoneName === 'string' ? chart.meta.exchangeTimezoneName : null;
  const day = (time: number) => timezone ? new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time*1000)) : null;
  const sessions = timestamps.flatMap((t,i) => typeof t === 'number' && Number.isFinite(t) && typeof closes[i] === 'number' && Number.isFinite(closes[i]) && Number(closes[i]) > 0
    ? [{time:t,date:day(t),close:Number(closes[i])}] : []).sort((a,b)=>a.time-b.time);
  return dates.map(reportDate => {
    const base: EarningsReaction = {reportDate,value:null,provider:'Yahoo Finance',retrievedAt,sourceUrl,basis:'REPORTED_DATE_CLOSE_TO_NEXT_SESSION_CLOSE'};
    const index=sessions.findIndex(s=>s.date===reportDate), before=sessions[index],after=sessions[index+1];
    if (!timezone) return {...base,reason:'EXCHANGE_TIMEZONE_UNAVAILABLE'};
    if (!before) return {...base,reason:'REPORTED_DATE_SESSION_CLOSE_UNAVAILABLE'};
    if (!after || after.time-before.time > 7*86400) return {...base,reason:'NEXT_SESSION_CLOSE_UNAVAILABLE'};
    const split=Object.values(chart?.events?.splits || {}).some((s:any)=>typeof s.date==='number' && s.date>before.time && s.date<=after.time);
    if (split) return {...base,reason:'CORPORATE_ACTION_WINDOW_NOT_COMPARABLE'};
    return {...base,value:Math.round((after.close/before.close-1)*10000)/100,beforeDate:before.date!,afterDate:after.date!,beforeClose:before.close,afterClose:after.close};
  });
}

export async function fetchEarningsReactions(ticker: string, dates: string[], fetcher: typeof fetch = fetch): Promise<EarningsReaction[]> {
  const retrievedAt=new Date().toISOString();
  const valid=dates.map(d=>Date.parse(d+'T00:00:00Z'));
  const period1=Math.floor(Math.min(...valid)/1000)-7*86400,period2=Math.floor(Math.max(...valid)/1000)+10*86400;
  const sourceUrl=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(shareClassProviderSymbol(ticker))}?interval=1d&period1=${period1}&period2=${period2}&events=splits`;
  try {
    const response=await fetcher(sourceUrl,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(6500)});
    if (!response.ok) throw Error('MARKET_HTTP_'+response.status);
    const body=await response.json(),chart=body?.chart?.result?.[0];
    if (!chart || typeof chart.meta?.symbol!=='string' || !sameShareClassTicker(chart.meta.symbol,ticker)) throw Error('MARKET_IDENTITY_OR_CHART_UNAVAILABLE');
    return calculateEarningsReactions(dates,chart,retrievedAt,sourceUrl);
  } catch {
    return dates.map(reportDate=>({reportDate,value:null,reason:'HISTORICAL_MARKET_SOURCE_FETCH_FAILED',provider:'Yahoo Finance',retrievedAt,sourceUrl,basis:'REPORTED_DATE_CLOSE_TO_NEXT_SESSION_CLOSE'}));
  }
}
