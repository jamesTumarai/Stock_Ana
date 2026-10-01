import type { CanonicalFinancialDataset } from '../../domain/financialValue';
import type { SecCompanyBundleLike } from './secFinancialMapper';
import type { ManagementGuidanceObservation } from '../../domain/reportResearchIntegrity';
import { filingPlainText } from './secStatementCompletion';
import { buildVerifiedStatementPeriods } from '../../domain/verifiedFinancialStatements';

import { explicitlyUsdMillions } from './secAmountUnits';
const KPI_LABELS:Record<string,{key:string;label:string;unit:'USD_M'|'%';basis:string}>={
  'annual recurring revenue':{key:'arr',label:'Annual recurring revenue',unit:'USD_M',basis:'Issuer-defined ARR; point-in-time run rate, not GAAP revenue'},
  'remaining performance obligations':{key:'rpo',label:'Remaining performance obligations',unit:'USD_M',basis:'Period-end remaining obligations, not a TTM flow'},
  'current remaining performance obligations':{key:'crpo',label:'Current remaining performance obligations',unit:'USD_M',basis:'Issuer-defined current obligations'},
  'net interest margin':{key:'nim',label:'Net interest margin',unit:'%',basis:'Reported non-additive period ratio'},
  'cet1 ratio':{key:'cet1',label:'CET1 ratio',unit:'%',basis:'Reported period-end regulatory capital ratio'},
  'common equity tier 1 capital ratio':{key:'cet1',label:'CET1 ratio',unit:'%',basis:'Reported period-end regulatory capital ratio'},
  'nonperforming loans':{key:'npl',label:'Nonperforming loans',unit:'USD_M',basis:'Period-end nonperforming loan amount'},
  'occupancy rate':{key:'occupancy',label:'Occupancy',unit:'%',basis:'Issuer-defined reported period ratio'},
  'same-store noi growth':{key:'same_store_noi_growth_pct',label:'Same-store NOI growth',unit:'%',basis:'Issuer-defined comparable-property growth; not additive'},
  'combined ratio':{key:'combined_ratio',label:'Combined ratio',unit:'%',basis:'Reported insurance ratio; not additive'},
  'investment yield':{key:'investment_yield_pct',label:'Investment yield',unit:'%',basis:'Reported investment yield for the stated period'},
};

/** Confirmation comes from retrieved documents, never from model flags.
 * This conservative table parser accepts only explicit future guidance,
 * metric scope, fiscal columns, amount units and ranges. Ambiguity stays linked. */
export function attachSecResearchEvidence(ds:CanonicalFinancialDataset,bundle:SecCompanyBundleLike):CanonicalFinancialDataset {
  const verifiedResearchEvents:NonNullable<CanonicalFinancialDataset['verifiedResearchEvents']>=[];
  const verifiedManagementGuidance:ManagementGuidanceObservation[]=[];
  const verifiedBusinessKpis:NonNullable<CanonicalFinancialDataset['verifiedBusinessKpis']>=[];
  const periods=buildVerifiedStatementPeriods(ds);
  const withdrawals:Array<{metricKey:string;fiscalPeriod:string;issuedDate:string;source:string}>=[];
  for(const doc of bundle.filingDocuments ?? []) {
    const path=doc.documentUrl.match(/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/(\d+)\//);
    if(!path || Number(path[1])!==Number(bundle.identity.cik) || !/^\d{4}-\d{2}-\d{2}$/.test(doc.filingDate ?? '')
      ||!Number.isFinite(Date.parse(doc.filingDate!))||new Date(doc.filingDate!).toISOString().slice(0,10)!==doc.filingDate)continue;
    verifiedResearchEvents.push({eventId:`SEC:${doc.accession}:${doc.documentUrl}`,eventType:'filing',title:`SEC ${doc.form ?? 'filing'}`,
      description:'Regulatory document filed; this is a filing date, not the earnings-release or economic-event date.',
      eventDate:doc.filingDate!,eventDateType:'FILING_DATE',filingDate:doc.filingDate!,publishedAt:null,
      source:doc.documentUrl,sourceConfidence:'ISSUER_CONFIRMED',issuerConfirmed:true,asOf:bundle.retrievedAt.slice(0,10)});
    for(const table of doc.html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
      const text=filingPlainText(table[1]);
      const rows=[...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(r=>[...r[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c=>filingPlainText(c[1])));
      if(!/guidance|outlook|estimate/i.test(text)) {
        const quarterHeader=rows.find(row=>row.some(cell=>/^Q[1-4]\s+20\d{2}$/.test(cell)));
        if(quarterHeader)for(const row of rows){const definition=KPI_LABELS[row[0]?.toLowerCase().trim()];if(!definition||row.length!==quarterHeader.length)continue;
          for(let i=1;i<row.length;i++){const anchor=periods.find(p=>p.label===quarterHeader[i]);const raw=row[i].replace(/[$,\s]/g,'');
            if(!anchor||!(definition.unit==='%'?/^-?\d+(?:\.\d+)?%$/:/^-?\d+(?:\.\d+)?$/).test(raw)||definition.unit==='USD_M'&&!explicitlyUsdMillions(text))continue;
            verifiedBusinessKpis.push({...definition,value:Number(raw.replace('%','')),period:anchor.label,periodEnd:anchor.endDate,source:doc.documentUrl});
          }
        }
      }
      if(!/guidance|outlook/i.test(text))continue;
      const header=rows.find(row=>row.some(cell=>/^(?:FY|Full[- ]year)\s*20\d{2}(?:\s+(?:guidance|outlook))?$/i.test(cell)));
      if(!header)continue;
      for(const cells of rows) {
        const label=cells[0]?.trim();
        const metricKey=/^(?:Total )?(?:Revenue|Revenues|Net revenue)$/i.test(label)?'revenue':/^(?:Diluted )?GAAP EPS$/i.test(label)?'eps':null;
        if(!metricKey || cells.length!==header.length)continue;
        for(let i=1;i<header.length;i++) {
          const year=header[i].match(/^(?:FY|Full[- ]year)\s*(20\d{2})(?:\s+(?:guidance|outlook))?$/i)?.[1];
          if(year && /^(?:withdrawn|guidance withdrawn|suspended)$/i.test(cells[i]?.trim()??'')) {
            withdrawals.push({metricKey,fiscalPeriod:`FY ${year}`,issuedDate:doc.filingDate!,source:doc.documentUrl});continue;
          }
          if(metricKey==='revenue'&&!explicitlyUsdMillions(text))continue;
          if(metricKey==='eps'&&!/(?:per.share|USD|\$)/i.test(text))continue;
          const range=cells[i]?.replace(/[$,]/g,'').match(/^(-?\d+(?:\.\d+)?)\s*(?:[-–—]|to)\s*(-?\d+(?:\.\d+)?)$/i);
          if(!year || !range || Number(range[1])>Number(range[2])||Number(year)<(periods.at(-1)?.fiscalYear??0))continue;
          verifiedManagementGuidance.push({metricKey,guidanceLow:Number(range[1]),guidanceHigh:Number(range[2]),fiscalPeriod:`FY ${year}`,
            issuedDate:doc.filingDate!,source:doc.documentUrl,status:'ACTIVE',sourceConfidence:'ISSUER_CONFIRMED'});
        }
      }
    }
  }
  // A withdrawal supersedes an earlier disclosed range without fabricating a
  // new amount. The retained bounds describe that old range, not active guidance.
  for(const withdrawal of withdrawals) {
    const prior=verifiedManagementGuidance.filter(g=>g.metricKey===withdrawal.metricKey&&g.fiscalPeriod===withdrawal.fiscalPeriod&&g.issuedDate<withdrawal.issuedDate)
      .sort((a,b)=>b.issuedDate.localeCompare(a.issuedDate))[0];
    if(prior)verifiedManagementGuidance.push({...prior,...withdrawal,status:'WITHDRAWN'});
  }
  // Multiple filed tables can repeat a fact; equal values deduplicate, while
  // conflicting amounts remain unavailable instead of choosing the first.
  const groups=new Map<string,typeof verifiedBusinessKpis>();
  for(const kpi of verifiedBusinessKpis){const key=kpi.key+'|'+kpi.period;groups.set(key,[...(groups.get(key)??[]),kpi]);}
  const canonicalKpis=[...groups.values()].flatMap(group=>new Set(group.map(k=>k.value)).size===1?[group[0]]:[]);
  return {...ds,verifiedResearchEvents,verifiedManagementGuidance,verifiedBusinessKpis:canonicalKpis};
}
