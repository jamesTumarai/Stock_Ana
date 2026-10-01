import { PRIMARY_STATEMENT_LABELS } from './canonicalMetricDefinitions';
import type { CanonicalFinancialDataset } from '../../domain/financialValue';
import { METRIC_SPECS, type SecCompanyBundleLike } from './secFinancialMapper';
import type { SecCompanyFact } from './secClient';
import { buildVerifiedStatementPeriods } from '../../domain/verifiedFinancialStatements';

export const COMPLETION_METRICS = [...new Set([...METRIC_SPECS.map(s=>`${s.statement}.${s.metric}`),'income_statement.eps_diluted','balance_sheet.net_ppe','cash_flow.depreciation',
  'balance_sheet.total_debt','balance_sheet.short_term_debt','balance_sheet.long_term_debt',
  'cash_flow.debt_issuance','cash_flow.debt_repayments','cash_flow.finance_lease_payments','cash_flow.issuance_of_common_stock',
  'cash_flow.option_exercise_proceeds','cash_flow.repurchase_of_common_stock','cash_flow.dividends_paid',
  'cash_flow.distributions_to_noncontrolling_interests','cash_flow.other_financing'])];
const attrs=(text:string):Record<string,string>=>Object.fromEntries([...text.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(m=>[m[1].toLowerCase(),m[2]]));
// Presentation labels contain encoded apostrophes/dashes in real filings.
// Decode text only; never broaden the reviewed label/scope rules or execute HTML.
export const filingPlainText=(text:string)=>text.replace(/<[^>]*>/g,' ')
  .replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(entity,code:string)=>{
    const point=code.toLowerCase().startsWith('x')?parseInt(code.slice(1),16):Number(code);
    return point>0&&point<=0x10ffff&&!(point>=0xd800&&point<=0xdfff)?String.fromCodePoint(point):entity;
  }).replace(/&(nbsp|amp|quot|apos|ndash|mdash);/gi,(_entity,name:string)=>
    ({nbsp:' ',amp:'&',quot:'"',apos:"'",ndash:'–',mdash:'—'} as Record<string,string>)[name.toLowerCase()])
  .replace(/\s+/g,' ').trim();
export interface FilingInlineFact {concept:string;value:number;unit:string;start?:string;end:string;contextId:string;label?:string;roundingTolerance:number}
const entityWideInlineContexts=(html:string,cik:string)=>{
  const contexts=new Map<string,{start?:string;end:string}>();
  for(const m of html.matchAll(/<(?:xbrli:)?context\b([^>]*)>([\s\S]*?)<\/(?:xbrli:)?context>/gi)) {
    if(/<(?:\w+:)?(?:explicitMember|typedMember)\b/i.test(m[2])) continue;
    const entity=m[2].match(/<(?:xbrli:)?identifier\b[^>]*>(\d+)<\/(?:xbrli:)?identifier>/i)?.[1];
    const end=m[2].match(/<(?:xbrli:)?(?:instant|endDate)>(\d{4}-\d{2}-\d{2})<\/(?:xbrli:)?(?:instant|endDate)>/i)?.[1];
    const start=m[2].match(/<(?:xbrli:)?startDate>(\d{4}-\d{2}-\d{2})<\/(?:xbrli:)?startDate>/i)?.[1];
    if(entity&&Number(entity)===Number(cik)&&end) contexts.set(attrs(m[1]).id,{start,end});
  }
  return contexts;
};

/** Reviewed inline date transforms only; numeric dates never use locale guessing. */
export function parseInlineFilingDate(text:string,format?:string):string|null {
  const plain=filingPlainText(text);
  let year:number,month:number,day:number;
  const iso=plain.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const transform=(format||'').toLowerCase();
  if(iso){year=Number(iso[1]);month=Number(iso[2]);day=Number(iso[3]);}
  else {
    const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
    const monthIndex=(name:string)=>months.findIndex(m=>name.toLowerCase()===m||name.toLowerCase()===m.slice(0,3)) + 1;
    const mdy=/^ixt:(?:date-monthname-day-year-en|datemonthdayyearen)$/.test(transform)
      ? plain.match(/^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i):null;
    const dmy=/^ixt:date-day-monthname-year-en$/.test(transform)
      ? plain.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/i):null;
    if(mdy){month=monthIndex(mdy[1]);day=Number(mdy[2]);year=Number(mdy[3]);}
    else if(dmy){day=Number(dmy[1]);month=monthIndex(dmy[2]);year=Number(dmy[3]);}
    else return null;
  }
  if(year<1900||month<1||month>12||day<1||day>31)return null;
  const date=new Date(Date.UTC(year,month-1,day));
  return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?date.toISOString().slice(0,10):null;
}

/** Entity-wide contexts only; unsupported transformations/units/dimensions never become observations. */
export function parseFilingInlineFacts(html:string,cik:string):FilingInlineFact[] {
  const contexts=entityWideInlineContexts(html,cik),units=new Map<string,string>();
  for(const m of html.matchAll(/<(?:xbrli:)?unit\b([^>]*)>([\s\S]*?)<\/(?:xbrli:)?unit>/gi)) {
    const currency=m[2].match(/<(?:xbrli:)?measure>iso4217:([A-Z]{3})<\/(?:xbrli:)?measure>/)?.[1];
    if(currency) units.set(attrs(m[1]).id,/<(?:xbrli:)?divide/i.test(m[2])&&/<(?:xbrli:)?measure>xbrli:shares<\/(?:xbrli:)?measure>/i.test(m[2])?`${currency}/shares`:currency);
    else if(/<(?:xbrli:)?measure>xbrli:pure<\/(?:xbrli:)?measure>/i.test(m[2])) units.set(attrs(m[1]).id,'pure');
  }
  const out:FilingInlineFact[]=[];
  for(const m of html.matchAll(/<ix:nonfraction\b([^>]*)>([\s\S]*?)<\/ix:nonfraction>/gi)) {
    const a=attrs(m[1]),context=contexts.get(a.contextref),unit=units.get(a.unitref);
    if(!context||!unit||a['xsi:nil']==='true'||a.nil==='true'||(a.format&&!/^(?:ixt|ixt-sec):(?:num-dot-decimal|numdotdecimal|num-zero|zerodash)$/.test(a.format))||! /^-?\d+$/.test(a.scale||'0')) continue;
    const raw=filingPlainText(m[2]).replace(/,/g,'');
    const zero=/^(?:ixt|ixt-sec):(?:num-zero|zerodash)$/.test(a.format||'')&&/^[-—–]$/.test(raw);
    if(!zero&&!/^\d+(?:\.\d+)?$/.test(raw)) continue;
    const value=(zero?0:Number(raw))*10**Number(a.scale||'0')*(a.sign==='-'?-1:1);
    const roundingTolerance=/^-?\d+$/.test(a.decimals||'')?0.5*10**(-Number(a.decimals)):0;
    if(Number.isFinite(value)) out.push({concept:a.name,value,unit,...context,contextId:a.contextref,roundingTolerance});
  }
  return out;
}

/** Exact presentation labels, independent of issuer taxonomy names. No approximate PPE/lease synonym. */

export function completeBundleFromInlineStatements(bundle:SecCompanyBundleLike,anchors:CanonicalFinancialDataset):SecCompanyBundleLike {
  const next=structuredClone(bundle); next.companyFacts.facts ||= {}; next.companyFacts.facts['us-gaap'] ||= {};
  const periodAnchors=Object.values(anchors.values).flat().filter(v=>v.fiscalYear&&v.fiscalQuarter&&v.periodEnd);
  for(const doc of next.filingDocuments||[]) {
    if(!/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\//.test(doc.documentUrl)) continue;
    const facts=parseFilingInlineFacts(doc.html,next.identity.cik);
    const contexts=entityWideInlineContexts(doc.html,next.identity.cik);
    const focus = (name:string) => {
      // Target the field's opening tag. Scanning arbitrary fact pairs can swallow
      // a nested DEI field inside another inline text disclosure in real filings.
      const field=new RegExp(`<ix:(nonnumeric|nonfraction)\\b(?=[^>]*\\bname=["']dei:${name}["'])([^>]*)>([\\s\\S]*?)<\\/ix:\\1>`,'gi');
      const values=[...doc.html.matchAll(field)]
        .filter(m=>contexts.has(attrs(m[2]).contextref))
        .map(m=>name==='DocumentPeriodEndDate'?parseInlineFilingDate(m[3],attrs(m[2]).format):filingPlainText(m[3]));
      const unique=new Set(values);
      return unique.size===1&&values[0]!=null?values[0]:'';
    };
    const focusYear=Number(focus('DocumentFiscalYearFocus')),focusPeriod=focus('DocumentFiscalPeriodFocus');
    const focusEnd=focus('DocumentPeriodEndDate');
    // Missing Company Facts history is repaired by that period's own filed DEI
    // focus and consolidated primary facts, never by relabeling latest YTD.
    if (/^\d{4}-\d{2}-\d{2}$/.test(focusEnd)&&Number.isInteger(focusYear)&&focusYear>=1900
      && ['Q1','Q2','Q3','FY'].includes(focusPeriod)&&facts.some(f=>f.end===focusEnd)) {
      periodAnchors.push({metric:'filing_focus',statement:'balance_sheet',value:null,unit:'USD_M',type:'reported',verification:'unverified',
        fiscalYear:focusYear,fiscalQuarter:focusPeriod==='FY'?4:Number(focusPeriod.slice(1)) as 1|2|3,
        periodEnd:focusEnd,period:`${focusPeriod==='FY'?'Q4':focusPeriod} ${focusYear}`});
    }
    const compatibleCustom=new Map<string,{metric:string;label:string;statement:string}>();
    for(const table of doc.html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) for(const row of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const label=filingPlainText(row[1].split(/<ix:nonfraction/i)[0]).replace(/[\s$()]+$/,'');
      const spec=PRIMARY_STATEMENT_LABELS.find(l=>l.pattern.test(label));
      const tableText=filingPlainText(table[1]);
      const isCashFlowTable=/Cash flows from operating activities|Net cash (?:provided by|used in).{0,30}operating activities/i.test(tableText)&&/financing activities/i.test(tableText);
      const isBalanceTable=/Total assets/i.test(tableText)&&/Total liabilities/i.test(tableText)&&/equity|stockholders|shareholders/i.test(tableText);
      const isIncomeTable=/(?:Net income|Net loss|Income tax)/i.test(tableText)&&/(?:Revenues|Net sales|Operating income)/i.test(tableText)&&!isCashFlowTable&&!isBalanceTable;
      const statement=spec&&METRIC_SPECS.find(s=>s.metric===spec.metric)?.statement;
      if(spec && (statement==='balance_sheet'?isBalanceTable:statement==='cash_flow'?isCashFlowTable:isIncomeTable))
        for(const fact of row[1].matchAll(/<ix:nonfraction\b([^>]*)>/gi)) compatibleCustom.set(attrs(fact[1]).name,{metric:spec.metric,label,statement:statement!});
    }
    for(const fact of facts) {
      if(!['USD','USD/shares','pure'].includes(fact.unit)) continue;
      const anchor=periodAnchors.find(a=>a.periodEnd===fact.end);
      if(!anchor) continue;
      const evidence=compatibleCustom.get(fact.concept);
      const customMetric=evidence?.metric;
      // Marketable debt securities are investment assets, never borrowing debt.
      // Admit this narrower standard family only with its reviewed primary-row
      // evidence AND the Current instant concept, not a maturity footnote/total.
      if (customMetric==='short_term_investments' && /^Marketable debt securities$/i.test(evidence!.label)
        && fact.concept!=='us-gaap:DebtSecuritiesCurrent') continue;
      const spec=METRIC_SPECS.find(s=>s.metric===customMetric)||METRIC_SPECS.find(s=>s.concepts.some(c=>fact.concept===`us-gaap:${c}`));
      if(!spec||spec.unit!==fact.unit||Boolean(fact.start)!==(spec.factKind==='duration')) continue;
      const localName=fact.concept.split(':')[1];
      const name=spec.concepts.includes(localName)?localName:spec.concepts[0];
      const concept=next.companyFacts.facts['us-gaap'][name] ||= {units:{}};
      concept.units ||= {}; const list=concept.units[fact.unit] ||= [];
      // Never replace existing companyfacts or resolve a conflicting value by convenient selection.
      const existing=list.find(f=>f.end===fact.end&&f.start===fact.start&&f.accn===doc.accession);
      if(existing) {
        const tolerance=Math.max(fact.roundingTolerance,fact.unit==='USD/shares'?0.005:fact.unit==='USD'?1e6:0.0001);
        const existingConcept=existing.presentationConcept||`us-gaap:${name}`;
        if(existingConcept!==fact.concept) continue; // Distinct source concepts cannot conflict solely because they share a canonical slot.
        if(typeof existing.val==='number'&&Math.abs(existing.val-fact.value)>tolerance) {
          next.completionConflicts ||= [];
          next.completionConflicts.push({metric:`${spec.statement}.${spec.metric}`,period:anchor.period,documentUrl:doc.documentUrl,canonicalValue:existing.val,presentationValue:fact.value});
        }
        continue;
      }
      const source:SecCompanyFact={val:fact.value,start:fact.start,end:fact.end,fy:anchor.fiscalYear,
        fp:anchor.fiscalQuarter===4?'FY':`Q${anchor.fiscalQuarter}`,form: ['8-K','6-K'].includes(doc.form)?'10-K':doc.form,
        accn:doc.accession,filed:doc.filingDate,presentationConcept:fact.concept,presentationDocumentUrl:doc.documentUrl,presentationForm:doc.form,
        semanticEvidence:evidence?{definition:evidence.label,statementLocation:evidence.statement,entityCik:next.identity.cik,consolidated:true,unit:fact.unit,contextId:fact.contextId,periodStart:fact.start,periodEnd:fact.end,policy:'EXACT_PRIMARY_STATEMENT_ROW'}:undefined};
      list.push(source);
    }
  }
  return next;
}

/** Primary balance-sheet wording owns redeemable NCI inclusion. Do not use
 * the numerical balance equation itself to manufacture a scope classification.
 */
export function attachRedeemableNciPresentation(dataset:CanonicalFinancialDataset,bundle:SecCompanyBundleLike):CanonicalFinancialDataset {
  const next=structuredClone(dataset);
  for (const doc of bundle.filingDocuments || []) {
    const facts=parseFilingInlineFacts(doc.html,bundle.identity.cik);
    for (const table of doc.html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
      const text=filingPlainText(table[1]);
      if (!/Total assets/i.test(text) || !/Total liabilities/i.test(text)) continue;
      for (const row of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const label=filingPlainText(row[1]);
        const included=/^Noncontrolling interests?\s*\(includes? redeemable noncontrolling interest/i.test(label);
        const separate=/^Redeemable noncontrolling interests?\b/i.test(label);
        if (!included && !separate) continue;
        const ids=[...row[1].matchAll(/<ix:nonfraction\b([^>]*)>/gi)].map(m=>attrs(m[1]).contextref);
        for (const fact of facts.filter(f=>f.concept==='us-gaap:RedeemableNoncontrollingInterestEquityCarryingAmount' && ids.includes(f.contextId) && !f.start && f.unit==='USD')) {
          const value=next.values['balance_sheet.redeemable_noncontrolling_interest']?.find(v=>v.periodEnd===fact.end && v.verification==='verified' && v.value!==null && Math.abs(v.value*1e6-fact.value)<=Math.max(1,fact.roundingTolerance));
          if (value) value.balancePresentation={classification:included?'INCLUDED_IN_NCI':'SEPARATE_MEZZANINE',evidence:included?'Primary NCI row explicitly includes redeemable NCI':'Separate primary redeemable NCI row',documentUrl:doc.documentUrl,contextId:fact.contextId};
        }
      }
    }
  }
  return next;
}

/** Untagged filed earnings tables require explicit fiscal-quarter columns; ambiguous layouts fail closed. */
export function attachReportedEarningsTableFacts(dataset:CanonicalFinancialDataset,bundle:SecCompanyBundleLike):CanonicalFinancialDataset {
  const next=structuredClone(dataset), snapshots=buildVerifiedStatementPeriods(dataset);
  const epsConflicts=new Set<string>();
  next.issuerReportedNonGaap ||= [];
  for(const doc of bundle.filingDocuments||[]) {
    if(!/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\//.test(doc.documentUrl)) continue;
    const tables=[...doc.html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map(t=>({html:t[1],rows:[...t[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(row=>[...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c=>filingPlainText(c[1])))}));
    // Filed slide exhibits can expose their tabular transcript in a FONT block.
    // Require explicit quarter columns and exact row labels/value counts; never scan arbitrary prose numbers.
    for(const font of doc.html.matchAll(/<font\b[^>]*>([\s\S]*?)<\/font>/gi)) {
      const text=filingPlainText(font[1]);
      const headers=text.match(/(?:Q[1-4][\s-]+20\d{2}\s+){2,}Q[1-4][\s-]+20\d{2}/i)?.[0].match(/Q[1-4][\s-]+20\d{2}/gi);
      if(!headers) continue;
      const rows:string[][]=[['',...headers]];
      const money='(?:\\(?-?\\d[\\d,]*(?:\\.\\d+)?\\)?%?)';
      for(const label of ['EPS attributable to common stockholders, diluted \\(GAAP\\)','GAAP diluted EPS','Adjusted EBITDA margin','Adjusted EBITDA']) {
        const match=text.match(new RegExp(`(${label})(?:\\s*\\(\\d+\\))*\\s+((?:${money}\\s+){${headers.length-1}}${money})(?=\\s|$)`,'i'));
        if(match) rows.push([match[1],...match[2].trim().split(/\s+/)]);
      }
      if(rows.length>1) tables.push({html:text,rows});
    }
    for(const table of tables) {
      const rows=table.rows;
      const headers=rows.map(cells=>cells.map((cell,index)=>{const m=cell.match(/^(?:Q([1-4])[\s-]*(20\d{2})|(20\d{2})[\s-]*Q([1-4]))$/i);return m?{index,period:`Q${m[1]||m[4]} ${m[2]||m[3]}`} : null;}).filter(Boolean)).find(c=>c.length>=1);
      if(!headers) continue;
      const headerRow=rows.find(cells=>cells.some(c=>/^Q[1-4][\s-]*20\d{2}$|^20\d{2}[\s-]*Q[1-4]$/i.test(c)))!;
      for(const cells of rows) {
        const label=(cells[0]||'').replace(/\s*\(\d+\)/g,'').trim();
        const eps=/^(?:(?:GAAP )?(?:Diluted (?:earnings|net income) per share|EPS[, —()-]*diluted)(?:\s*\(GAAP\))?|GAAP diluted EPS|EPS attributable to common stockholders, diluted \(GAAP\))$/i.test(label);
        const adjusted=/^(?:Adjusted EBITDA|Adjusted EBITDA margin)(?:\s*\(non.GAAP\))?$/i.test(label);
        const reit=/^(?:Adjusted funds from operations|AFFO|Funds from operations|FFO)(?:\s*\(non.GAAP\))?$/i.test(label);
        if((!eps&&!adjusted&&!reit)||cells.length!==headerRow.length) continue;
        for(const header of headers) {
          const h=header!,anchor=snapshots.find(s=>s.label===h.period);
          const raw=(cells[h.index]||'').replace(/[$,%\s]/g,'');
          if(!anchor||! /^\(?-?\d+(?:\.\d+)?\)?$/.test(raw)) continue;
          const value=Number(raw.replace(/[()]/g,''))*(raw.startsWith('(')?-1:1);
          const source={provider:'SEC EDGAR filed earnings exhibit',authorityTier:1 as const,documentUrl:doc.documentUrl,documentType:doc.form,
            accessionNumber:doc.accession,filingDate:doc.filingDate,periodEnd:anchor.endDate,retrievedAt:bundle.retrievedAt};
          if(reit) {
            // FFO and AFFO are distinct issuer-defined measures, never GAAP
            // earnings or per-share values. Only explicitly scaled quarter
            // amounts can enter the shared four-quarter duration aggregator.
            if(!explicitlyUsdMillions(filingPlainText(table.html))) continue;
            const metric=/^AFFO$|^Adjusted/i.test(label)?'companyReportedAFFO':'companyReportedFFO';
            next.issuerReportedNonGaap.push({metric,value,unit:'USD_M',period:h.period,periodStart:anchor.startDate,
              periodEnd:anchor.endDate,source,verification:'ISSUER_REPORTED_NON_GAAP'});
          } else if(adjusted) {
            const margin=/margin/i.test(label);
            const unit=margin?'percent':explicitlyUsdMillions(filingPlainText(table.html))?'USD_M':null;
            if(unit&&!next.issuerReportedNonGaap.some(v=>v.metric===(margin?'companyReportedAdjustedEbitdaMargin':'companyReportedAdjustedEbitda')&&v.period===h.period))
              next.issuerReportedNonGaap.push({metric:margin?'companyReportedAdjustedEbitdaMargin':'companyReportedAdjustedEbitda',value,unit,period:h.period,periodEnd:anchor.endDate,source,verification:'ISSUER_REPORTED_NON_GAAP'});
          } else {
            const key='income_statement.eps_diluted',index=next.periods.indexOf(h.period);
            if(epsConflicts.has(h.period)) continue;
            const series=next.values[key] ||= next.periods.map(period=>({metric:'eps_diluted',statement:'income_statement',value:null,unit:'per_share',period,type:'reported',verification:'unverified'}));
            const old=series[index];
            if(old?.value!=null) {
              if(Math.abs(old.value-value)>0.005) {epsConflicts.add(h.period);series[index]={...old,value:null,verification:'unverified',derivation:'Conflicting reported GAAP EPS disclosures'};next.provenanceWarnings.push({code:'REPORTED_EPS_CONFLICT',severity:'warning',message:`Conflicting reported GAAP diluted EPS at ${h.period}`});}
              continue;
            }
            series[index]={metric:'eps_diluted',statement:'income_statement',value,unit:'per_share',currency:'USD',period:h.period,periodStart:anchor.startDate,periodEnd:anchor.endDate,
              fiscalYear:anchor.fiscalYear,fiscalQuarter:anchor.fiscalQuarter,periodType:'standalone_quarter',type:'reported',verification:'verified',source,accession:doc.accession,form:doc.form,
              concept:'FiledEarningsTable:GAAPDilutedEPS',derivation:`Directly reported ${label}; explicit quarter column ${h.period}. Never FY minus YTD EPS.`};
          }
        }
      }
    }
  }
  return next;
}

export function suppressCompletionConflicts(dataset:CanonicalFinancialDataset,bundle:SecCompanyBundleLike):CanonicalFinancialDataset {
  const next=structuredClone(dataset);
  for(const conflict of bundle.completionConflicts||[]) {
    const observation=next.values[conflict.metric]?.find(o=>o.period===conflict.period);
    if(observation) {observation.value=null;observation.verification='unverified';observation.derivation='Conflicting inline presentation and companyfacts observations; no substitute value.';}
    next.provenanceWarnings.push({code:'INLINE_SOURCE_CONFLICT',severity:'warning',message:`${conflict.metric}: ${conflict.period}; companyfacts=${conflict.canonicalValue}, presentation=${conflict.presentationValue}; ${conflict.documentUrl}`});
  }
  return next;
}

export function attachExactCashFlowBalances(dataset:CanonicalFinancialDataset,bundle:SecCompanyBundleLike):CanonicalFinancialDataset {
  const next=structuredClone(dataset),snapshots=buildVerifiedStatementPeriods(dataset);
  const observations:Array<{value:number;end:string;accession:string;url:string;form?:string;filed?:string;basis:string}>=[];
  const recent=bundle.submissions.filings?.recent;
  const cashConcepts=['CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents','CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsIncludingDisposalGroupAndDiscontinuedOperations'];
  for(const basis of cashConcepts) for(const fact of bundle.companyFacts.facts?.['us-gaap']?.[basis]?.units?.USD||[]) {
    if(fact.start||!fact.end||!fact.accn||typeof fact.val!=='number') continue;
    const i=recent?.accessionNumber?.indexOf(fact.accn)??-1;
    const url=typeof fact.presentationDocumentUrl==='string'?fact.presentationDocumentUrl:i>=0&&recent?.primaryDocument?.[i]?`https://www.sec.gov/Archives/edgar/data/${Number(bundle.identity.cik)}/${fact.accn.replace(/-/g,'')}/${recent.primaryDocument[i]}`:'';
    if(url) observations.push({value:fact.val/1e6,end:fact.end,accession:fact.accn,url,form:fact.form,filed:fact.filed,basis});
  }
  for(const doc of bundle.filingDocuments||[]) for(const fact of parseFilingInlineFacts(doc.html,bundle.identity.cik)) {
    if(cashConcepts.includes(fact.concept.split(':')[1])&&!fact.start&&fact.unit==='USD')
      observations.push({value:fact.value/1e6,end:fact.end,accession:doc.accession,url:doc.documentUrl,form:doc.form,filed:doc.filingDate,basis:fact.concept.split(':')[1]});
  }
  next.cashFlowCashBalances=snapshots.flatMap(p=>{
    if(!p.startDate) return [];
    const before=new Date(Date.parse(p.startDate)-86400000).toISOString().slice(0,10);
    const ending=p.observations['balance_sheet.cash_and_restricted_cash']||p.observations['balance_sheet.cash_and_restricted_cash_including_disposal_group'];
    const basis: NonNullable<CanonicalFinancialDataset['cashFlowCashBalances']>[number]['basis']=ending?.metric==='cash_and_restricted_cash'?'CASH_AND_RESTRICTED_CASH':'CASH_AND_RESTRICTED_CASH_INCLUDING_DISPOSAL_GROUP';
    const concept=basis==='CASH_AND_RESTRICTED_CASH'?cashConcepts[0]:cashConcepts[1];
    const candidates=observations.filter(o=>o.end===before&&o.basis===concept).sort((a,b)=>(b.filed||'').localeCompare(a.filed||''));
    const latest=candidates[0], same=candidates.filter(o=>o.filed===latest?.filed);
    if(!latest||new Set(same.map(o=>o.value)).size!==1||ending?.value==null||!ending.source) return [];
    return [{period:p.label,startDate:p.startDate,endDate:p.endDate,beginning:latest.value,ending:ending.value,basis,
      beginningSource:{provider:'SEC EDGAR XBRL',documentUrl:latest.url,documentType:latest.form,accessionNumber:latest.accession,periodEnd:before,filingDate:latest.filed,authorityTier:1 as const},endingSource:ending.source}];
  });
  return next;
}
export function attachCompletionAudit(dataset:CanonicalFinancialDataset,bundle:SecCompanyBundleLike):CanonicalFinancialDataset {
  const next=structuredClone(dataset);
  next.completionAudit=COMPLETION_METRICS.flatMap(metric=>next.periods.map((period,i)=>{
    const value=next.values[metric]?.[i];
    const paths=[`SEC companyfacts/${metric}`,...(bundle.completionAttempts||[]).map(a=>`${a.documentUrl} [${a.status}${a.reasonCode?`: ${a.reasonCode}`:''}]`),
      ...(bundle.filingDocuments||[]).map(d=>d.documentUrl)];
    const combined=metric==='cash_flow.depreciation'&&next.values['cash_flow.depreciation_amortization_and_impairment']?.[i]?.value!=null;
    const accretion=metric==='cash_flow.depreciation'&&next.values['cash_flow.depreciation_amortization_and_accretion']?.[i]?.value!=null;
    const conflict=next.provenanceWarnings.some(w=>/CONFLICT/.test(w.code)&&w.message.includes(period)&&
      (w.message.includes(metric)||metric==='income_statement.eps_diluted'&&/EPS/.test(w.message)));
    const equityCombined=['cash_flow.option_exercise_proceeds','cash_flow.issuance_of_common_stock'].includes(metric)&&next.values['cash_flow.equity_compensation_and_option_proceeds']?.[i]?.value!=null;
    return {metric,period,reasonCode:conflict?'SOURCE_CONFLICT':value?.value!=null&&value.verification==='verified'?'COMPLETED_VERIFIED':combined?'COMBINED_IMPAIRMENT_COMPONENT_NOT_SEPARABLE':accretion?'COMBINED_ACCRETION_COMPONENT_NOT_SEPARABLE':equityCombined?'COMBINED_EQUITY_OPTION_PROCEEDS_NOT_SEPARABLE':bundle.completionAttempts?.some(a=>a.status==='unavailable')?'AUTHORITATIVE_SOURCE_UNAVAILABLE':bundle.filingDocuments?.length?'NOT_DISCLOSED_IN_RETRIEVED_SOURCES':'PRIMARY_SOURCE_SEARCH_REQUIRED',sourcePathsAttempted:[...new Set(paths)]};
  }));
  return next;
}
import { explicitlyUsdMillions } from './secAmountUnits';
