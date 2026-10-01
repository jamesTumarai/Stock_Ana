import type { CanonicalFinancialDataset, CanonicalFinancialValue } from '../../domain/financialValue';
import type { SecCompanyBundleLike } from './secFinancialMapper';
import { filingPlainText, parseFilingInlineFacts } from './secStatementCompletion';

const names = ['CommonStockValue','AdditionalPaidInCapital','AdditionalPaidInCapitalCommonStock',
  'AccumulatedOtherComprehensiveIncomeLossNetOfTax','RetainedEarningsAccumulatedDeficit'];
const attribute = (tag: string, name: string) => tag.match(new RegExp(`${name}=["']([^"']+)["']`,'i'))?.[1];

/** Common equity may be derived from a complete, explicitly presented common
 * capital bridge. This does NOT create a missing preferred-equity observation
 * or assume that an undisclosed preferred component is zero. All four common
 * capital components must be tagged, same-instant, and reconcile to the filed
 * parent subtotal. Other equity classes or incomplete bridges fail closed. */
export function attachCommonEquityFromVerifiedPresentation(dataset: CanonicalFinancialDataset, bundle: SecCompanyBundleLike): CanonicalFinancialDataset {
  const next = structuredClone(dataset);
  if (dataset.ticker !== bundle.identity.ticker) return next;
  for (const doc of [...bundle.filingDocuments??[]].sort((a,b)=>(b.filingDate??'').localeCompare(a.filingDate??''))) {
    if (!/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\//.test(doc.documentUrl) || !doc.accession) continue;
    const instantContexts=new Set([...doc.html.matchAll(/<(?:xbrli:)?context\b([^>]*)>([\s\S]*?)<\/(?:xbrli:)?context>/gi)]
      .filter(m=>/<(?:xbrli:)?instant>\d{4}-\d{2}-\d{2}<\/(?:xbrli:)?instant>/i.test(m[2]))
      .map(m=>attribute(m[1],'id')));
    const facts = parseFilingInlineFacts(doc.html,bundle.identity.cik).filter(f=>f.unit==='USD' && !f.start && instantContexts.has(f.contextId));
    for (const table of doc.html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
      const text=filingPlainText(table[1]);
      if (!/Total assets/i.test(text) || !/Total liabilities/i.test(text)
        || /preferred (?:stock|shares|equity)|noncontrolling|non-controlling|minority interest/i.test(text)) continue;
      const rows=[...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(row=>row[1]);
      const tagged=(row:string)=>[...row.matchAll(/<ix:nonfraction\b([^>]*)>/gi)].flatMap(match=>{
        const name=attribute(match[1],'name'),context=attribute(match[1],'contextRef');
        const candidates=facts.filter(f=>f.concept===name && f.contextId===context);
        // Duplicated tagged assertions must agree; don't arbitrarily pick one.
        return candidates.length && new Set(candidates.map(f=>f.value)).size===1 ? [candidates[0]] : [];
      });
      const commonRows=rows.map((row,i)=>({i,facts:tagged(row)})).filter(row=>row.facts.some(f=>f.concept==='us-gaap:CommonStockValue'));
      if(commonRows.length!==1)continue;
      const start=commonRows[0].i;
      const stop=rows.findIndex((row,i)=>i>start && tagged(row).some(f=>f.concept==='us-gaap:StockholdersEquity'));
      if(stop<0)continue;
      const components=rows.slice(start,stop).flatMap(tagged);
      if(components.some(f=>!names.includes(f.concept.replace(/^us-gaap:/,''))))continue;
      for(const total of tagged(rows[stop]).filter(f=>f.concept==='us-gaap:StockholdersEquity')) {
        const selected=components.filter(f=>f.end===total.end);
        const concepts=selected.map(f=>f.concept.replace(/^us-gaap:/,''));
        if(selected.length!==4 || new Set(concepts).size!==4 || !concepts.includes('CommonStockValue')
          || !concepts.includes('RetainedEarningsAccumulatedDeficit')
          || !concepts.includes('AccumulatedOtherComprehensiveIncomeLossNetOfTax')
          || !concepts.some(c=>/^AdditionalPaidInCapital(?:CommonStock)?$/.test(c)))continue;
        const sum=selected.reduce((n,f)=>n+f.value,0),tolerance=selected.reduce((n,f)=>n+f.roundingTolerance,0)+total.roundingTolerance;
        if(Math.abs(sum-total.value)>Math.max(0.01,tolerance))continue;
        const parent=next.values['balance_sheet.stockholders_equity']?.find(f=>f.periodEnd===total.end && f.unit==='USD_M' && f.verification==='verified' && f.value!==null);
        if(!parent || Math.abs(parent.value!-total.value/1e6)>Math.max(0.000001,tolerance/1e6))continue;
        const existing=next.values['balance_sheet.common_equity']?.find(f=>f.period===parent.period);
        if(existing?.verification==='verified' && existing.value!==null)continue;
        const source={...parent.source!,documentUrl:doc.documentUrl,filingDate:doc.filingDate,accessionNumber:doc.accession,provider:'SEC EDGAR common-capital presentation'};
        const sourceComponents:CanonicalFinancialValue[]=selected.map(f=>({...parent,metric:f.concept.replace(/^us-gaap:/,''),value:f.value/1e6,
          concept:f.concept,sourceConcept:f.concept,canonicalMetric:undefined,mappingKind:'STANDARD_EXACT',
          derivation:undefined,type:'reported',source,sourceComponents:undefined}));
        const derived:CanonicalFinancialValue={...parent,metric:'common_equity',value:sum/1e6,type:'derived',mappingKind:'DERIVED',
          source,sourceComponents,concept:undefined,sourceConcept:undefined,canonicalMetric:'common_equity',
          derivation:'Complete filed common-capital bridge: common stock + additional paid-in capital + accumulated other comprehensive income/loss + retained earnings/deficit, reconciled to same-instant parent equity. Preferred equity is not inferred.',
          mappingEvidence:{definition:'Complete common-capital presentation',statementLocation:'Consolidated balance-sheet common equity bridge',
            entityCik:bundle.identity.cik,consolidated:true,unit:'USD',contextId:total.contextId,periodEnd:total.end,policy:'COMPLETE_COMMON_CAPITAL_BRIDGE'}};
        const series=next.values['balance_sheet.common_equity']??=[];
        const index=series.findIndex(f=>f.period===parent.period);
        if(index<0)series.push(derived);else series[index]=derived;
      }
    }
  }
  return next;
}
