/** Explicit synthetic observation adapter for historical peer-selection tests.
 * These tests exercise taxonomy/median/sample policy, not network retrieval.
 * Production has no access to this adapter. Rejection markers and explicit
 * unverified statuses survive; a source label alone is tested separately. */
export function observedPeerFixtures<T>(peers:T[]):T[] {
  return peers.map(peer=>{
    const result=structuredClone(peer) as Record<string,unknown>;
    const marketKeys=['pe_trailing','ev_ebitda','ev_sales','price_to_book','p_affo_multiple','p_ffo_multiple'];
    const rejected=(source:unknown)=>typeof source==='string'&&/unverified|fallback|verified peer disclosure/i.test(source);
    const metrics=result.metrics as Record<string,Record<string,unknown>>|undefined;
    if(metrics)for(const [key,m]of Object.entries(metrics)) {
      if(m.value==null||rejected(m.source)||m.status==='FOUND_UNVERIFIED')continue;
      m.period??='TTM Q2 2026';m.status??='VERIFIED';
      if(marketKeys.includes(key))m.source='Yahoo Finance independently observed test quote';
    }
    else for(const key of [...marketKeys,'gross_margin_pct','net_margin_pct','roe_pct','roa_pct','net_interest_margin_pct','occupancy_rate_pct','same_store_noi_growth_pct','combined_ratio_pct','operating_income','income_before_tax','income_tax_expense','total_debt','total_equity','cash_and_equivalents','short_term_investments'])if(result[key]!=null&&!rejected(result.financial_source)&&result[`${key}_verified`]!==false) {
      result[`${key}_verified`]=true;result.financial_period??='TTM Q2 2026';
      if(marketKeys.includes(key))result.financial_source=String(result.financial_source??'')+' + Yahoo Finance independently observed test quote';
    }
    return result as T;
  });
}
