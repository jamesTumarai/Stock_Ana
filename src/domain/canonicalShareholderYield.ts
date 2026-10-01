import type { ReportData } from '../types';
import { reconcileCanonicalTtmFlow } from './canonicalTtmFlow';
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
const round=(n:number)=>Math.round(n*1e4)/1e4;

/** One common-equity cash-yield contract. Missing issuance/dividends are never
 * zero; buyback authorizations cannot substitute for executed payments. */
export function resolveCanonicalShareholderYield(report:Partial<ReportData>) {
  const ds=report.canonical_financials?.ticker?.toUpperCase()===report.ticker?.toUpperCase()?report.canonical_financials:undefined,m=report.market_snapshot;
  const dividend=reconcileCanonicalTtmFlow(ds,'cash_flow.dividends_common');
  const repurchase=reconcileCanonicalTtmFlow(ds,'cash_flow.repurchase_of_common_stock');
  const issuance=reconcileCanonicalTtmFlow(ds,'cash_flow.issuance_of_common_stock');
  const cap=m?.dataKind==='market_quote'&&m.provider&&m.ticker===report.ticker&&finite(m.marketCapRaw)&&m.marketCapRaw>0?m.marketCapRaw/1e6:null;
  const dividendYieldPct=finite(cap)&&finite(dividend.canonicalValue)&&dividend.canonicalValue>=0?round(dividend.canonicalValue/cap*100):null;
  const netBuybackYieldPct=finite(cap)&&finite(repurchase.canonicalValue)&&finite(issuance.canonicalValue)
    && JSON.stringify(repurchase.periodsUsed)===JSON.stringify(issuance.periodsUsed)
    ?round((repurchase.canonicalValue-issuance.canonicalValue)/cap*100):null;
  const sameWindow=JSON.stringify(dividend.periodsUsed)===JSON.stringify(repurchase.periodsUsed);
  return {dividendYieldPct,netBuybackYieldPct,totalPct:sameWindow&&finite(dividendYieldPct)&&finite(netBuybackYieldPct)?round(dividendYieldPct+netBuybackYieldPct):null,
    basis:'Executed common dividends + common repurchases − common issuance proceeds; same TTM / provider market capitalization',
    periods:repurchase.periodsUsed,source:[dividend.source,repurchase.source,issuance.source,m?.provider].filter(Boolean).join(' + ')};
}
