import type { ReportData } from '../types';
import { reconcileCanonicalTtmFlow, type TtmFlowMetric } from './canonicalTtmFlow';
import { resolveBusinessArchetype } from './financialMetricContext';
import { resolveCurrentBalanceSheetSnapshot } from './currentBalanceSheetSnapshot';
import { resolveFundamentalMetrics } from './valuation/metricRegistry';
import { valuationFingerprint } from './valuation/adaptiveValuationPolicy';
import { resolveIssuerNonGaapTtm } from './issuerNonGaapTtm';
import { resolveCanonicalShareholderYield } from './canonicalShareholderYield';
import { auditReportRevenueHierarchy } from './revenueHierarchy';
import { buildVerifiedStatementPeriods } from './verifiedFinancialStatements';
export { reconcileRevenueHierarchy } from './revenueHierarchy';

export type EventDateType = 'EVENT_DATE' | 'FILING_DATE' | 'PRESS_RELEASE_DATE' | 'EXPECTED_DATE';
export interface CanonicalResearchEvent {
  eventId: string; eventType: string; title: string; description: string;
  eventDate: string | null; eventDateType: EventDateType; publishedAt: string | null;
  filingDate: string | null; source: string | null;
  sourceConfidence: 'ISSUER_CONFIRMED' | 'SOURCE_LINKED' | 'UNCONFIRMED';
  issuerConfirmed: boolean; asOf: string | null;
}
export interface ManagementGuidanceObservation {
  metricKey: string; guidanceLow: number; guidanceHigh: number; fiscalPeriod: string;
  issuedDate: string; source: string; status: 'ACTIVE' | 'SUPERSEDED' | 'WITHDRAWN';
  sourceConfidence: 'ISSUER_CONFIRMED' | 'SOURCE_LINKED';
}
export interface ResearchMetric {
  key: string; label: string; value: number | null; unit: 'USD_M' | '%' | 'x' | 'months';
  period: string | null; source: string | null; basis: string; reason: string | null;
}
export interface ResearchIntegritySummary {
  version: 1; events: CanonicalResearchEvent[];
  activeGuidance: ManagementGuidanceObservation[];
  guidanceHistory: ManagementGuidanceObservation[];
  diagnostics: string[];
  businessKpis: ResearchMetric[];
  earningsQuality: { classification: 'STRONG_CASH_BACKING' | 'MIXED' | 'WEAK_CASH_CONVERSION' | 'NOT_APPLICABLE' | 'INSUFFICIENT_DATA'; metrics: ResearchMetric[]; methodology: string };
  capitalAllocation: ResearchMetric[];
  shareholderYield: { dividendYieldPct: number | null; netBuybackYieldPct: number | null; totalPct: number | null; basis: string };
  scoreConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNAVAILABLE';
  verifiedScoreInputCoveragePct: number | null;
}
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const date = (s: unknown): string | null => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s+'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === s ? s : null;
};
const url = (s: unknown): string | null => {
  try { const u=new URL(String(s)); return u.protocol==='https:' ? u.href : null; } catch { return null; }
};
const round = (n: number) => Math.round(n*1e4)/1e4;

/** Upcoming dates resolve against the report's own day, so saved reports never
 * acquire a different calendar result merely because they are reopened later. */
export function resolveUpcomingEarningsEvent(events:CanonicalResearchEvent[],asOf?:string) {
  const reference=date(asOf?.slice(0,10));
  if(!reference) return undefined;
  const upcoming=events.filter(e=>e.eventType==='earnings' && e.eventDate && e.eventDate>=reference);
  const confirmed=upcoming.filter(e=>e.issuerConfirmed);
  return (confirmed.length?confirmed:upcoming).sort((a,b)=>a.eventDate!.localeCompare(b.eventDate!))[0];
}

/** Typed observations remain source-linked unless an independent retrieval
 * service supplied issuer confirmation. A date or a plausible amount alone
 * cannot promote model prose to verified evidence. */
export function resolveResearchEvents(report: Partial<ReportData>) {
  const diagnostics: string[]=[];
  const raw=report.catalysts_and_events?.items ?? [];
  const events: CanonicalResearchEvent[]=raw.map(item=>{
    const eventDate=date(item.date), source=url(item.source);
    const proof=report.canonical_financials?.verifiedResearchEvents?.find(e=>e.source===source && e.eventDate===eventDate && e.eventType===item.category);
    const issuerConfirmed=Boolean(proof?.issuerConfirmed);
    const dateType:EventDateType=issuerConfirmed ? proof!.eventDateType : 'EXPECTED_DATE';
    return {eventId:item.event_id || valuationFingerprint({type:item.category,title:item.title}),
      eventType:item.category || 'other',title:item.title,description:item.description,eventDate,eventDateType:dateType,
      publishedAt:issuerConfirmed?proof!.publishedAt:date(item.published_at),filingDate:issuerConfirmed?proof!.filingDate:date(item.filing_date),source,
      sourceConfidence:issuerConfirmed?'ISSUER_CONFIRMED':source?'SOURCE_LINKED':'UNCONFIRMED',
      issuerConfirmed,asOf:date(report.as_of_date)};
  });
  events.push(...(report.canonical_financials?.verifiedResearchEvents ?? []));
  const groups=new Map<string,CanonicalResearchEvent[]>();
  for (const event of events) {const group=groups.get(event.eventId)??[];group.push(event);groups.set(event.eventId,group);}
  const canonical=[...groups.values()].map(group=>{
    const dates=new Set(group.map(e=>e.eventDate).filter(Boolean));
    if (dates.size>1) {
      diagnostics.push('EVENT_DATE_CONFLICT:'+group[0].eventId);
      return {...group[0],eventDate:null,issuerConfirmed:false,sourceConfidence:'UNCONFIRMED' as const,eventDateType:'EXPECTED_DATE' as const};
    }
    return group.find(e=>e.issuerConfirmed)??group[0];
  });
  const earnings=report.earnings_analysis;
  if (earnings?.next_earnings_date) {
    const earningsDate=date(earnings.next_earnings_date);
    const upcoming=resolveUpcomingEarningsEvent(canonical,report.as_of_date || report.generated_at);
    if (upcoming?.eventDate && upcoming.eventDate!==earningsDate) diagnostics.push('CROSS_SECTION_EARNINGS_DATE_CONFLICT');
  }
  return {events:canonical,diagnostics};
}

export function resolveGuidanceRegistry(observations: ManagementGuidanceObservation[],completedFiscalYear?:number) {
  const diagnostics: string[]=[];
  const history=observations.filter(o=>o.metricKey && o.fiscalPeriod && date(o.issuedDate) && url(o.source)
    && finite(o.guidanceLow) && finite(o.guidanceHigh) && o.guidanceLow<=o.guidanceHigh
    && ['ACTIVE','SUPERSEDED','WITHDRAWN'].includes(o.status));
  const invalid = observations.filter(o=>!history.includes(o));
  diagnostics.push(...invalid.map(o=>'GUIDANCE_INVALID_OBSERVATION:'+o.metricKey+'|'+o.fiscalPeriod));
  const groups=new Map<string,ManagementGuidanceObservation[]>();
  for(const o of history){const key=o.metricKey+'|'+o.fiscalPeriod;const g=groups.get(key)??[];g.push({...o});groups.set(key,g);}
  const active:ManagementGuidanceObservation[]=[],normalized:ManagementGuidanceObservation[]=[];
  for(const group of groups.values()){
    const authoritative=group.filter(o=>o.sourceConfidence==='ISSUER_CONFIRMED').sort((a,b)=>b.issuedDate.localeCompare(a.issuedDate));
    const latestDate=authoritative[0]?.issuedDate;
    const latest=authoritative.filter(o=>o.issuedDate===latestDate);
    const signatures=new Set(latest.map(o=>JSON.stringify([o.status,o.guidanceLow,o.guidanceHigh])));
    if(signatures.size>1) diagnostics.push('GUIDANCE_CONFLICT:'+group[0].metricKey+'|'+group[0].fiscalPeriod);
    const newerInvalid=invalid.some(o=>o.metricKey===group[0].metricKey && o.fiscalPeriod===group[0].fiscalPeriod
      && o.sourceConfidence==='ISSUER_CONFIRMED' && date(o.issuedDate) && o.issuedDate >= (latestDate ?? ''));
    const chosen=signatures.size===1 && !newerInvalid ? latest[0] : null;
    const fiscalYear=Number(chosen?.fiscalPeriod.match(/^FY\s*(\d{4})$/)?.[1]);
    const closed=Number.isFinite(completedFiscalYear)&&Number.isFinite(fiscalYear)&&fiscalYear<=completedFiscalYear!;
    if(closed&&chosen)diagnostics.push('GUIDANCE_PERIOD_CLOSED:'+chosen.metricKey+'|'+chosen.fiscalPeriod);
    if(chosen?.status==='ACTIVE'&&!closed)active.push(chosen);
    normalized.push(...group.map(o=>chosen && o.issuedDate<chosen.issuedDate && o.status==='ACTIVE'
      ? {...o,status:'SUPERSEDED' as const}:o));
  }
  return {active,history:normalized,diagnostics};
}

export function buildResearchIntegrity(report: Partial<ReportData>): ResearchIntegritySummary {
  const ds=report.canonical_financials;
  const diagnostics:string[]=[];
  const flow=(key:TtmFlowMetric,label:string):ResearchMetric=>{
    const r=reconcileCanonicalTtmFlow(ds,key);
    return {key,label,value:r.canonicalValue,unit:'USD_M',period:r.periodsUsed.length?r.periodsUsed.join('–'):null,
      source:r.source,basis:'Four verified standalone quarters; USD millions',reason:r.canonicalValue===null?r.status:null};
  };
  const instant=(key:string,label:string):ResearchMetric=>{
    const matches=ds?.values[key]?.filter(f=>f.period===ds.periods.at(-1) && f.periodType==='instant'
      && f.verification==='verified' && f.unit==='USD_M' && finite(f.value) && f.source?.documentUrl)??[];
    const fact=matches.length===1?matches[0]:null;
    return {key,label,value:fact?.value??null,unit:'USD_M',period:fact?.period??null,
      source:fact?.source?.documentUrl??null,basis:'Verified period-end snapshot',reason:fact?'':'VERIFIED_INSTANT_UNAVAILABLE'};
  };
  const ratio=(key:string,label:string,n:ResearchMetric,d:ResearchMetric):ResearchMetric=>({
    key,label,value:finite(n.value)&&finite(d.value)&&d.value>0&&n.period===d.period?round(n.value/d.value*100):null,
    unit:'%',period:n.period===d.period?n.period:null,source:n.source&&d.source?[n.source,d.source].join(' | '):null,
    basis:n.label+' / '+d.label,reason:!finite(n.value)||!finite(d.value)||d.value<=0?'COMPATIBLE_INPUTS_UNAVAILABLE':n.period!==d.period?'PERIOD_MISMATCH':null});
  const revenue=flow('income_statement.revenue','Revenue');
  const incomeKeys=['income_statement.net_income','income_statement.net_income_parent','income_statement.net_income_common'] as const;
  const incomeLabels=['Total net income','Net income attributable to parent','Net income available to common'];
  const incomes=incomeKeys.map((key,i)=>flow(key,incomeLabels[i]));
  const netIncome=incomes.find(m=>finite(m.value))??incomes[0];
  const ocf=flow('cash_flow.operating_cash_flow','Operating cash flow');
  const fcf=flow('cash_flow.free_cash_flow','Free cash flow');
  const sbc=flow('cash_flow.stock_based_compensation','Stock-based compensation');
  const capex=flow('cash_flow.capex','Capital expenditure');
  const op=flow('income_statement.operating_income','Operating income');
  const cashConversion=ratio('cash_conversion','OCF / '+netIncome.label,ocf,netIncome);
  const archetype=resolveBusinessArchetype(report,report.ticker);
  const financial=['bank','lender','fintech','insurer','broker_exchange','asset_manager','conglomerate'].includes(archetype);
  if(financial) {
    cashConversion.value=null;
    cashConversion.reason='NOT_APPLICABLE_FINANCIAL_FUNDING_ECONOMICS';
    cashConversion.basis='Industrial OCF/earnings cash-conversion thresholds do not apply to financial funding and loan inventory.';
  }
  const classification=financial?'NOT_APPLICABLE':!finite(cashConversion.value)?'INSUFFICIENT_DATA'
    :cashConversion.value>=100 && finite(fcf.value) && fcf.value>0?'STRONG_CASH_BACKING'
      :cashConversion.value<50?'WEAK_CASH_CONVERSION':'MIXED';
  const capitalAllocation=[fcf,flow('cash_flow.repurchase_of_common_stock','Executed share repurchases'),
    flow('cash_flow.dividends_common','Common dividends paid'),flow('cash_flow.acquisitions','Cash paid for business acquisitions, net of cash acquired'),
    flow('cash_flow.debt_issuance','Debt proceeds'),flow('cash_flow.debt_repayments','Debt repayments'),
    flow('cash_flow.issuance_of_common_stock','Common share issuance proceeds'),sbc];
  const shares=(ds?.commonShareObservations??[]).filter(o=>finite(o.sharesM)&&o.sharesM>0&&date(o.end)&&url(o.source.documentUrl)).sort((a,b)=>a.end.localeCompare(b.end));
  const latestShares=shares.at(-1),priorShares=latestShares?shares.filter(o=>Date.parse(latestShares.end)-Date.parse(o.end)>=350*86400000&&Date.parse(latestShares.end)-Date.parse(o.end)<=380*86400000).at(-1):undefined;
  const shareChange:ResearchMetric={key:'net_common_share_count_change_pct',label:'Common share-count change (year-over-year)',unit:'%',
    value:latestShares&&priorShares?round((latestShares.sharesM/priorShares.sharesM-1)*100):null,period:priorShares&&latestShares?`${priorShares.end}–${latestShares.end}`:null,
    source:priorShares&&latestShares?[priorShares.source.documentUrl,latestShares.source.documentUrl].join(' | '):null,
    basis:'Point-in-time disclosed aggregate common shares; includes splits/issuance/repurchases, not a measure of SBC alone',reason:priorShares?'':'COMPATIBLE_COMMON_SHARE_HISTORY_UNAVAILABLE'};
  capitalAllocation.push(shareChange);
  const shareholderYield=resolveCanonicalShareholderYield(report);
  const resolved=resolveFundamentalMetrics(report,report.ticker);
  const resolvedItem=(key:keyof typeof resolved,label:string,unit:ResearchMetric['unit']):ResearchMetric=>{
    const m=resolved[key];if(typeof m!=='object'||!m)return {key,label,value:null,unit,period:null,source:null,basis:'',reason:'NOT_APPLICABLE'};
    return {key,label,value:finite(m.value)?m.value:null,unit,period:m.period??null,source:m.source??null,basis:m.basis??'',reason:m.reason??null};
  };
  let businessKpis:ResearchMetric[]=[];
  if(archetype==='saas_software') businessKpis=[ratio('sbc_revenue','SBC / Revenue',sbc,revenue),
    ratio('rd_revenue','Reported R&D / Revenue',flow('income_statement.research_and_development','Total R&D'),revenue),
    ratio('rd_excluding_acquired_revenue','R&D excluding acquired / Revenue',flow('income_statement.research_and_development_excluding_acquired','R&D excluding acquired'),revenue),
    ratio('marketing_revenue','Selling & Marketing / Revenue',flow('income_statement.selling_and_marketing','Selling & Marketing'),revenue)];
  else if(['bank','lender','fintech'].includes(archetype)) businessKpis=[resolvedItem('nim','Net interest margin','%'),
    instant('balance_sheet.loans_held_for_investment','Net loans held for investment'),instant('balance_sheet.deposits','Deposits'),
    ratio('loan_deposit','Loan / Deposit',instant('balance_sheet.loans_held_for_investment','Net loans held for investment'),instant('balance_sheet.deposits','Deposits')),
    resolvedItem('cet1Ratio','CET1 ratio','%'),flow('income_statement.provision_for_credit_losses','Credit loss provision')];
  else if(archetype==='reit')businessKpis=[flow('income_statement.ffo','FFO'),flow('income_statement.affo','AFFO'),
    flow('income_statement.noi','NOI'),resolvedItem('occupancyRate','Occupancy','%')];
  else if(archetype==='insurer')businessKpis=[resolvedItem('combinedRatio','Combined ratio','%'),flow('income_statement.net_premiums_earned','Net premiums earned')];
  else if(['early_stage','biotech'].includes(archetype))businessKpis=[resolvedItem('cashRunwayMonths','Cash runway','months'),
    resolvedItem('revenueGrowthYoY','Revenue growth','%'),resolvedItem('grossMargin','Gross margin','%'),sbc,shareChange];
  const kpiPolicy:Partial<Record<typeof archetype,string[]>>={saas_software:['arr','arr_growth_pct','rpo','crpo','subscription_mix_pct'],bank:['nim','cet1','npl'],lender:['nim','cet1','npl'],fintech:['nim','cet1','npl'],reit:['occupancy','same_store_noi_growth_pct'],insurer:['combined_ratio','premium_growth_pct','investment_yield_pct']};
  for(const kpi of ds?.verifiedBusinessKpis??[])if(kpiPolicy[archetype]?.includes(kpi.key)&&kpi.period===ds?.periods.at(-1)&&!businessKpis.some(m=>m.label===kpi.label&&m.value!==null))businessKpis.push({...kpi,reason:null});
  const eventRegistry=resolveResearchEvents(report);
  // Model-provided source URLs and confirmation flags are not verification.
  const latestPeriod=ds?buildVerifiedStatementPeriods(ds).at(-1):undefined;
  const completedFiscalYear=latestPeriod?latestPeriod.fiscalYear-(latestPeriod.fiscalQuarter===4?0:1):undefined;
  const guidance=resolveGuidanceRegistry([...(report.management_guidance_history??[]).map(o=>({...o,sourceConfidence:'SOURCE_LINKED' as const})),
    ...(ds?.verifiedManagementGuidance??[])],completedFiscalYear);
  diagnostics.push(...eventRegistry.diagnostics,...guidance.diagnostics,...auditReportRevenueHierarchy(report));
  // A headcount with no denominator basis must never look like an exact
  // average-headcount productivity ratio merely because it has a numeric value.
  for(const row of report.business_analysis?.operational_efficiency??[]) {
    if(!row.headcount_basis||!date(row.headcount_as_of)||!url(row.headcount_source))diagnostics.push('HEADCOUNT_BASIS_OR_SOURCE_UNVERIFIED:'+row.period);
    if(finite(row.revenue_per_employee_k_usd)&&row.headcount_basis!=='AVERAGE')diagnostics.push('EMPLOYEE_RATIO_DENOMINATOR_BASIS_MISMATCH:'+row.period);
  }
  for(const metric of businessKpis) if(metric.key==='income_statement.ffo' || metric.key==='income_statement.affo') {
    const source=resolveIssuerNonGaapTtm(ds,metric.key.endsWith('.affo')?'AFFO':'FFO');
    if(metric.value===null && source)Object.assign(metric,{value:source.value,source:source.source,period:source.period,basis:'Issuer-defined non-GAAP; four verified standalone quarter amounts',reason:null});
  }
  const currentAssets=instant('balance_sheet.total_current_assets','Current assets'),currentLiabilities=instant('balance_sheet.total_current_liabilities','Current liabilities');
  const workingCapital:ResearchMetric={key:'working_capital',label:'Working capital (period-end)',unit:'USD_M',
    value:finite(currentAssets.value)&&finite(currentLiabilities.value)&&currentAssets.period===currentLiabilities.period?round(currentAssets.value-currentLiabilities.value):null,
    period:currentAssets.period,source:currentAssets.source&&currentLiabilities.source?[currentAssets.source,currentLiabilities.source].join(' | '):null,
    basis:'Current assets − current liabilities; balance-sheet level, not a cash-flow change',reason:currentAssets.value===null||currentLiabilities.value===null?'COMPATIBLE_INSTANT_INPUTS_UNAVAILABLE':null};
  const coverage=report.verdict?.conviction_breakdown?.verified_input_coverage_pct;
  const verifiedScoreInputCoveragePct=finite(coverage)&&coverage>=0&&coverage<=100?coverage:null;
  const scoreConfidence=verifiedScoreInputCoveragePct===null?'UNAVAILABLE':coverage!>=90?'HIGH':coverage!>=65?'MEDIUM':'LOW';
  return {version:1,events:eventRegistry.events,activeGuidance:guidance.active,guidanceHistory:guidance.history,
    diagnostics:[...new Set(diagnostics)],businessKpis,earningsQuality:{classification,metrics:[netIncome,op,ocf,fcf,sbc,workingCapital,capex,cashConversion],
      methodology:'Positive same-period earnings: OCF / earnings ≥100% with positive FCF = strong; <50% = weak; otherwise mixed. Financial institutions use sector-specific economics. Negative/zero income has no positive-earnings conversion interpretation.'},
    capitalAllocation,shareholderYield,scoreConfidence,verifiedScoreInputCoveragePct};
}

/** Each hierarchy level reconciles only to its own parent and explicit period.
 * A child of Subscription cannot share a flat total with Product revenue. */
export function compareCanonicalValuationRuns(previous:ReportData['intrinsic_value'],current:ReportData['intrinsic_value']) {
  const before=previous?.canonical_run,after=current?.canonical_run;
  if(!before||!after)return {status:'LEGACY_COMPARISON_UNAVAILABLE',changes:['CANONICAL_RUN_MISSING']};
  const changes:string[]=[];
  if(before.financialSnapshotId!==after.financialSnapshotId)changes.push('FINANCIAL_SNAPSHOT_CHANGED');
  if(before.primaryMethod!==after.primaryMethod)changes.push('METHOD_CHANGED');
  if(before.modelVersion!==after.modelVersion)changes.push('MODEL_VERSION_CHANGED');
  for(const field of ['inputSnapshot','assumptionSnapshot'] as const){
    const keys=new Set([...Object.keys(before[field]??{}),...Object.keys(after[field]??{})]);
    for(const key of keys)if(valuationFingerprint(before[field]?.[key])!==valuationFingerprint(after[field]?.[key]))changes.push(field+'.'+key);
  }
  const same=before.inputHash===after.inputHash&&before.assumptionHash===after.assumptionHash&&before.modelVersion===after.modelVersion;
  const changed=before.baseFairValue!==after.baseFairValue;
  if(same&&changed)changes.push('VALUATION_NON_DETERMINISTIC_OUTPUT');
  return {status:same&&changed?'FAIL':changes.length?'CHANGED':'UNCHANGED',changes};
}
