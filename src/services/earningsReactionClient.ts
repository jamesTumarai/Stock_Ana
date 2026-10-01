import type { EarningsAnalysisData } from '../types';

export async function enrichEarningsReactions(ticker: string, earnings: EarningsAnalysisData | undefined, signal: AbortSignal): Promise<void> {
  if (!earnings?.past_earnings_history?.length) return;
  // Clear model-produced market reactions before accepting independently fetched prices.
  for (const item of earnings.past_earnings_history) {
    item.stock_reaction_1d_pct=undefined;
    item.reaction_observation={reportDate:item.report_date,value:null,reason:'REPORTED_EVENT_DATE_OR_MARKET_SOURCE_UNAVAILABLE',provider:'Yahoo Finance',retrievedAt:new Date().toISOString(),basis:'REPORTED_DATE_CLOSE_TO_NEXT_SESSION_CLOSE'};
  }
  const dates=[...new Set(earnings.past_earnings_history.slice(-4).map(q=>q.report_date).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')))];
  if (!dates.length) return;
  try {
    const response=await fetch(`/api/earnings-reactions?ticker=${encodeURIComponent(ticker)}&dates=${encodeURIComponent(dates.join(','))}`,{signal:AbortSignal.any([signal,AbortSignal.timeout(12000)])});
    const body=response.ok?await response.json():null;
    if (body?.ticker!==ticker || !Array.isArray(body.reactions)) return;
    for (const item of earnings.past_earnings_history) {
      const observation=body.reactions.find((r:any)=>r.reportDate===item.report_date && r.provider==='Yahoo Finance');
      if (!observation) continue;
      item.reaction_observation=observation;
      if (typeof observation.value==='number' && Number.isFinite(observation.value)) item.stock_reaction_1d_pct=observation.value;
    }
  } catch { /* Independent missing market history never erases actual/estimate data. */ }
}
