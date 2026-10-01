import type { ReportData } from '../types';
import { buildResearchIntegrity, compareCanonicalValuationRuns } from './reportResearchIntegrity';
import { valuationFingerprint } from './valuation/adaptiveValuationPolicy';
import type { CanonicalFinancialDataset } from './financialValue';
import { extractDraftThesisFromReport } from './thesisExpectations';

export function compareResearchVersions(previous: ReportData,current: ReportData) {
  const changes=compareCanonicalValuationRuns(previous.intrinsic_value,current.intrinsic_value);
  const before=previous.research_integrity ?? buildResearchIntegrity(previous);
  const after=current.research_integrity ?? buildResearchIntegrity(current);
  const rows:Array<{key:string;previous:unknown;current:unknown}>=[];
  const add=(key:string,a:unknown,b:unknown)=>{if(valuationFingerprint(a)!==valuationFingerprint(b))rows.push({key,previous:a??null,current:b??null});};
  add('Market price',previous.market_snapshot?.price,current.market_snapshot?.price);
  add('Base fair value',previous.intrinsic_value?.canonical_run?.baseFairValue,current.intrinsic_value?.canonical_run?.baseFairValue);
  add('Conviction',previous.verdict?.conviction_score,current.verdict?.conviction_score);
  const latestFacts=(report:ReportData)=>{const ds=report.canonical_financials as CanonicalFinancialDataset|undefined;return Object.fromEntries(Object.entries(ds?.values??{}).map(([key,series])=>[key,series.filter(f=>f.period===ds?.periods.at(-1)).map(f=>({value:f.value,unit:f.unit,period:f.period,periodStart:f.periodStart,periodEnd:f.periodEnd,verification:f.verification,sourceConcept:f.sourceConcept}))]));};
  const oldFacts=latestFacts(previous),newFacts=latestFacts(current);
  for(const key of new Set([...Object.keys(oldFacts),...Object.keys(newFacts)]))add('Financial fact: '+key,oldFacts[key],newFacts[key]);
  const thesis=(report:ReportData)=>{const draft=extractDraftThesisFromReport(report);return {summary:draft.summary,catalysts:draft.catalysts,risks:draft.keyRisks,invalidation:draft.invalidationConditions};};
  add('Report thesis',thesis(previous),thesis(current));
  for(const key of new Set([...Object.keys(previous.intrinsic_value?.canonical_run?.inputSnapshot??{}),...Object.keys(current.intrinsic_value?.canonical_run?.inputSnapshot??{})]))
    add('Input: '+key,previous.intrinsic_value?.canonical_run?.inputSnapshot[key],current.intrinsic_value?.canonical_run?.inputSnapshot[key]);
  for(const key of new Set([...Object.keys(previous.intrinsic_value?.canonical_run?.assumptionSnapshot??{}),...Object.keys(current.intrinsic_value?.canonical_run?.assumptionSnapshot??{})]))
    add('Assumption: '+key,previous.intrinsic_value?.canonical_run?.assumptionSnapshot[key],current.intrinsic_value?.canonical_run?.assumptionSnapshot[key]);
  add('Corporate events',before.events,after.events);
  add('Active management guidance',before.activeGuidance,after.activeGuidance);
  return {...changes,rows,previousDate:previous.generated_at,currentDate:current.generated_at};
}
