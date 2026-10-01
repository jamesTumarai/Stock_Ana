import type { CanonicalFinancialDataset, CanonicalFinancialValue } from '../../domain/financialValue';
import type { SecCompanyBundleLike } from './secFinancialMapper';
import { normalizeDurationFactsToStandaloneQuarters, normalizeInstantFactsToFiscalQuarters } from './xbrlNormalizer';
import { filingPlainText } from './secStatementCompletion';

const attributes = (text: string): Record<string,string> => Object.fromEntries([...text.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(m=>[m[1].toLowerCase(),m[2]]));
const metricNames: Record<string,string> = {
  RevenueFromContractWithCustomerExcludingAssessedTax:'revenue', Revenues:'revenue', RevenuesNetOfInterestExpense:'revenue',
  OperatingIncomeLoss:'operating_income', NetIncomeLoss:'net_income_parent', ProfitLoss:'net_income',
  StockholdersEquity:'stockholders_equity',
};

/** Segment contexts are admitted only into a separate dimensional registry.
 * They never fill consolidated statement cells, and mixed axes are never added.
 * No issuer names or ticker lists participate in discovery. */
export function attachVerifiedOperatingSegments(dataset: CanonicalFinancialDataset, bundle: SecCompanyBundleLike): CanonicalFinancialDataset {
  const groups = new Map<string,{name:string;axis:string;member:string;facts:Map<string,any[]>}>();
  const sourceByAccession = new Map<string,NonNullable<SecCompanyBundleLike['filingDocuments']>[number]>();
  const anchors = Object.values(dataset.values).flat().filter(v=>v.periodEnd&&v.fiscalYear&&v.fiscalQuarter);
  for (const doc of bundle.filingDocuments ?? []) {
    if (!/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\//.test(doc.documentUrl)) continue;
    if(!/^(?:10-[KQ]|8-K)(?:\/A)?$/.test(doc.form ?? ''))continue;
    sourceByAccession.set(doc.accession, doc);
    const contexts = new Map<string,{start?:string;end:string;axis:string;member:string}>();
    const units = new Set<string>();
    for (const match of doc.html.matchAll(/<(?:xbrli:)?unit\b([^>]*)>([\s\S]*?)<\/(?:xbrli:)?unit>/gi)) {
      if (/<(?:xbrli:)?measure>iso4217:USD<\/(?:xbrli:)?measure>/i.test(match[2]) && !/<(?:xbrli:)?divide/i.test(match[2])) units.add(attributes(match[1]).id);
    }
    for (const match of doc.html.matchAll(/<(?:xbrli:)?context\b([^>]*)>([\s\S]*?)<\/(?:xbrli:)?context>/gi)) {
      const entity = match[2].match(/<(?:xbrli:)?identifier\b[^>]*>(\d+)<\/(?:xbrli:)?identifier>/i)?.[1];
      const members = [...match[2].matchAll(/<(?:xbrldi:)?explicitMember\b([^>]*)>([^<]+)<\/(?:xbrldi:)?explicitMember>/gi)];
      if (Number(entity) !== Number(bundle.identity.cik) || members.length !== 1 || /typedMember/i.test(match[2])) continue;
      const axis = attributes(members[0][1]).dimension, member = members[0][2].trim();
      if (!/:(?:StatementBusinessSegmentsAxis|BusinessSegmentsAxis|OperatingSegmentsAxis)$/.test(axis ?? '') || /Eliminations|Corporate|Consolidated/i.test(member)) continue;
      const end = match[2].match(/<(?:xbrli:)?(?:instant|endDate)>(\d{4}-\d{2}-\d{2})<\/(?:xbrli:)?(?:instant|endDate)>/i)?.[1];
      const start = match[2].match(/<(?:xbrli:)?startDate>(\d{4}-\d{2}-\d{2})<\/(?:xbrli:)?startDate>/i)?.[1];
      if (end) contexts.set(attributes(match[1]).id, {start,end,axis,member});
    }
    for (const match of doc.html.matchAll(/<ix:nonfraction\b([^>]*)>([\s\S]*?)<\/ix:nonfraction>/gi)) {
      const a = attributes(match[1]), context = contexts.get(a.contextref);
      const metric = metricNames[a.name?.replace(/^us-gaap:/,'')];
      if (!context || !metric || !a.name?.startsWith('us-gaap:') || !units.has(a.unitref) || a['xsi:nil']==='true'
        || (a.format && !/^(?:ixt|ixt-sec):(?:num-dot-decimal|numdotdecimal|num-zero|zerodash)$/.test(a.format))
        || !/^-?\d+$/.test(a.scale ?? '0')) continue;
      const raw = filingPlainText(match[2]).replace(/,/g,'');
      const zero = /^(?:ixt|ixt-sec):(?:num-zero|zerodash)$/.test(a.format ?? '') && /^[-—–]$/.test(raw);
      if (!zero && !/^\d+(?:\.\d+)?$/.test(raw)) continue;
      const anchor = anchors.find(f=>f.periodEnd===context.end);
      if (!anchor || (metric==='stockholders_equity') === Boolean(context.start)) continue;
      const key = `${context.axis}|${context.member}`;
      const group = groups.get(key) ?? { name:context.member.split(':').at(-1)!.replace(/Member$/,'').replace(/([a-z])([A-Z])/g,'$1 $2'),axis:context.axis,member:context.member,facts:new Map() };
      const series = group.facts.get(metric) ?? [];
      series.push({start:context.start,end:context.end,val:(zero?0:Number(raw))*10**Number(a.scale ?? '0')*(a.sign==='-'?-1:1),
        fy:anchor.fiscalYear,fp:anchor.fiscalQuarter===4?'FY':`Q${anchor.fiscalQuarter}`,
        // 8-K exhibits are accepted through the independently verified fiscal
        // anchor above. Preserve their real form in output provenance; the
        // companyfacts normalizer's 10-K/Q form filter must not erase them.
        form:doc.form?.startsWith('8-K')?undefined:doc.form,filed:doc.filingDate,accn:doc.accession,sourceConcept:a.name});
      group.facts.set(metric, series); groups.set(key, group);
    }
  }
  const operatingSegments: NonNullable<CanonicalFinancialDataset['operatingSegments']> = [];
  const provenanceWarnings=[...dataset.provenanceWarnings];
  for (const [id,group] of groups) {
    const values: Record<string,CanonicalFinancialValue[]> = {};
    for (const [metric,facts] of group.facts) {
      const durationGroups=new Map<string,typeof facts>();
      for(const fact of facts){const key=`${fact.start??'instant'}|${fact.end}`;const g=durationGroups.get(key)??[];g.push(fact);durationGroups.set(key,g);}
      const compatibleFacts=[...durationGroups.values()].flatMap(observations=>{
        const newest=[...observations].sort((a,b)=>(b.filed??'').localeCompare(a.filed??''))[0];
        const sameDate=observations.filter(f=>f.filed===newest.filed);
        if(new Set(sameDate.map(f=>f.val)).size!==1){provenanceWarnings.push({code:'SEGMENT_FACT_CONFLICT',severity:'warning',message:`${id}: ${metric} ${newest.end}; conflicting retrieved segment disclosures`});return [];}
        return [newest];
      });
      const normalized = metric==='stockholders_equity' ? normalizeInstantFactsToFiscalQuarters(compatibleFacts) : normalizeDurationFactsToStandaloneQuarters(compatibleFacts);
      values[`${metric==='stockholders_equity'?'balance_sheet':'income_statement'}.${metric}`] = normalized.flatMap(fact=>{
        const accession = fact.accessionNumbers.at(-1) ?? '';
        const source = sourceByAccession.get(accession);
        const period = `Q${fact.fiscalQuarter} ${fact.fiscalYear}`;
        if (!source || !dataset.periods.includes(period)) return [];
        return [{metric,statement:metric==='stockholders_equity'?'balance_sheet':'income_statement',value:fact.value/1e6,unit:'USD_M',period,
          fiscalYear:fact.fiscalYear,fiscalQuarter:fact.fiscalQuarter,periodStart:fact.start,periodEnd:fact.end,
          periodType:metric==='stockholders_equity'?'instant':'standalone_quarter',
          type:fact.derivation.startsWith('derived_')?'derived':'reported',derivation:fact.derivation,verification:'verified',
          sourceConcept:String(fact.sourceFacts.at(-1)?.sourceConcept ?? ''),accession,source:{provider:'SEC EDGAR operating-segment XBRL',documentUrl:source.documentUrl,
            documentType:source.form,filingDate:source.filingDate,accessionNumber:source.accession,retrievedAt:bundle.retrievedAt}} as CanonicalFinancialValue];
      });
    }
    if (Object.values(values).some(v=>v.length)) operatingSegments.push({id,name:group.name,axis:group.axis,member:group.member,values});
  }
  return {...dataset,operatingSegments,provenanceWarnings};
}
