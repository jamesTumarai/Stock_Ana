import type { FinancialStatementsData } from '../types';
import { METRIC_SPECS } from '../services/sec/canonicalMetricDefinitions';
import { verifiedMetricSeries } from './financialSynthesisGuard';
import { calculateVerifiedKeyIndicators } from './verifiedKeyIndicators';
import { METRIC_MEANING_REGISTRY, type MetricMeaning } from './financialMetricMeaning';
import { metricAssessmentPolicy, type MetricAssessmentPolicy } from './metricAssessmentPolicy';
import { STATEMENT_SEMANTIC_LABELS } from './statementSemanticLabels';

export const METRIC_CONTEXT_VERSION = 'selected-verified-metric-v3';
export type ChangeSemantic = 'RELATIVE_PERCENT' | 'PERCENTAGE_POINT' | 'BASIS_POINT' | 'ABSOLUTE_AMOUNT' | 'ABSOLUTE_RATIO' | 'MULTIPLE_DELTA' | 'DAYS_DELTA' | 'PER_SHARE_CHANGE';
export interface FinancialMetricDefinition {
  key: string; canonicalKey: string; unit: string; valueType: 'money' | 'rate' | 'ratio' | 'days' | 'per_share';
  changeSemantic: ChangeSemantic; contextDependencies: string[]; archetype: 'all' | 'banking' | 'insurance' | 'reit';
  selectableForInsight: boolean;
  meaning?: MetricMeaning;
  assessmentPolicy: MetricAssessmentPolicy;
}
const aliases: Record<string,string> = { eps:'eps_diluted', opex:'operating_expenses', cash:'cash_and_equivalents',
  current_assets:'total_current_assets', current_liabilities:'total_current_liabilities', receivables:'accounts_receivable', payables:'accounts_payable',
  ocf:'operating_cash_flow', icf:'investing_cash_flow', fcf_financing:'financing_cash_flow', net_income_cont:'net_income', sbc:'stock_based_compensation', da:'depreciation' };
export const FINANCIAL_METRIC_REGISTRY: Record<string,FinancialMetricDefinition> = {};
function register(key: string, unit: string, dependencies: string[] = [], archetype: FinancialMetricDefinition['archetype'] = 'all') {
  const valueType = unit === '%' ? 'rate' : unit === 'x' ? 'ratio' : unit === 'D' ? 'days' : unit === 'per_share' ? 'per_share' : 'money';
  const canonicalKey = aliases[key] || key;
  const meaning = METRIC_MEANING_REGISTRY[canonicalKey] || METRIC_MEANING_REGISTRY[key];
  const canonicalName = STATEMENT_SEMANTIC_LABELS[canonicalKey]?.en || canonicalKey.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  FINANCIAL_METRIC_REGISTRY[key] = { key, canonicalKey: aliases[key] || key, unit, valueType, contextDependencies: dependencies, archetype,
    changeSemantic: valueType === 'rate' ? 'PERCENTAGE_POINT' : valueType === 'ratio' ? 'MULTIPLE_DELTA' : valueType === 'days' ? 'DAYS_DELTA' : valueType === 'per_share' ? 'PER_SHARE_CHANGE' : 'RELATIVE_PERCENT', selectableForInsight: true, assessmentPolicy:metricAssessmentPolicy(canonicalKey), meaning: meaning ? { ...meaning, name: canonicalName } : undefined };
}
for (const spec of METRIC_SPECS) register(spec.metric, spec.canonicalUnit === 'percent' ? '%' : spec.canonicalUnit === 'per_share' ? 'per_share' : spec.canonicalUnit === 'x' ? 'x' : 'M');
for (const [key, canonical] of Object.entries(aliases)) register(key, FINANCIAL_METRIC_REGISTRY[canonical]?.unit || 'M');
for (const key of ['gross_margin','operating_margin','ebit_margin','net_margin','ebitda_margin','tax_rate','equity_ratio','debt_to_asset','roe','roa','roic','fcf_to_sales','fcf_to_net_income','loan_deposit_ratio','efficiency_ratio','nim']) register(key,'%');
for (const key of ['current_ratio','quick_ratio','debt_to_equity','debt_to_ebitda','asset_turnover','inventory_turnover']) register(key,'x');
for (const key of ['dso','dio','dpo','ccc']) register(key,'D');
for (const key of ['cash_and_investments','non_current_assets','non_current_liabilities','ebitda','beginning_cash','ending_cash','debt_issuance_payments','other_financing','non_cash_items','change_working_capital','deposit_growth','current_debt_and_finance_leases','noncurrent_debt_and_finance_leases','free_cash_flow','common_equity']) register(key,'M');
const related: Record<string,string[]> = {
  gross_margin:['gross_profit','revenue','cogs','operating_margin'], operating_margin:['operating_income','revenue','operating_expenses'],
  revenue:['gross_profit','gross_margin','operating_margin','operating_income','operating_cash_flow','free_cash_flow'], total_assets:['total_liabilities','cash','revenue','roa','roic','total_debt','total_equity','asset_turnover'],
  operating_expenses:['revenue','operating_income','operating_margin','research_and_development','selling_general_administrative'],
  opex:['revenue','operating_income','operating_margin','research_and_development','selling_general_administrative'],
  ocf:['net_income','net_income_parent','net_income_common','change_receivables','change_inventory','change_payables','capex','free_cash_flow','stock_based_compensation'], operating_cash_flow:['net_income','net_income_parent','net_income_common','change_receivables','change_inventory','change_payables','capex','free_cash_flow'],
  roic:['operating_income','total_debt','stockholders_equity','cash_and_investments'], roe:['net_income_common','common_equity'],
  roa:['net_income','total_assets'], quick_ratio:['cash','short_term_investments','accounts_receivable','current_liabilities'],
  ebitda:['operating_income','depreciation'], ebitda_margin:['operating_income','depreciation','revenue'],
  free_cash_flow:['operating_cash_flow','capex'], debt_to_equity:['total_debt','stockholders_equity'],
  inventory:['revenue','cogs','inventory_turnover','dio','change_inventory'], total_debt:['cash_and_investments','operating_cash_flow','stockholders_equity'],
  capex:['operating_cash_flow','free_cash_flow','net_ppe'],
  net_income:['operating_income','operating_cash_flow','free_cash_flow'], net_income_common:['net_income_parent','operating_cash_flow','free_cash_flow'],
  current_ratio:['total_current_assets','total_current_liabilities','quick_ratio','operating_cash_flow'],
  debt_to_asset:['total_debt','total_assets'], equity_ratio:['total_equity','total_assets'], ccc:['dso','dio','dpo'] };
for (const [key,deps] of Object.entries(related)) FINANCIAL_METRIC_REGISTRY[key].contextDependencies = deps;
for(const key of ['nim','net_interest_income','net_interest_margin_pct','deposits','deposit_growth','loan_deposit_ratio','efficiency_ratio','loans_held_for_investment','tier1_capital_ratio','cet1_ratio']) FINANCIAL_METRIC_REGISTRY[key].archetype='banking';
for(const key of ['combined_ratio_pct','net_premiums_earned','loss_reserve']) FINANCIAL_METRIC_REGISTRY[key].archetype='insurance';
for(const key of ['ffo','noi','rental_revenue']) FINANCIAL_METRIC_REGISTRY[key].archetype='reit';
// Banking spread levels remain percent; their changes are conventionally shown in basis points.
for(const key of ['nim','net_interest_margin_pct']) FINANCIAL_METRIC_REGISTRY[key].changeSemantic='BASIS_POINT';

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export function metricPeriodChanges(key: string, values: (number | null | undefined)[], periods: string[], mode: string): (number | null)[] {
  const semantic = FINANCIAL_METRIC_REGISTRY[key]?.changeSemantic;
  return values.map((value,i) => {
    if (!finite(value) || mode === 'hide' || !semantic) return null;
    const q = periods[i]?.match(/Q([1-4])\s+(20\d{2})/), fy = periods[i]?.match(/^FY\s*(20\d{2})$/);
    let previous = -1;
    if (q) {
      const ordinal=Number(q[2])*4+Number(q[1])-(mode==='yoy'?4:1);
      previous=periods.findIndex(p=>{ const m=p.match(/Q([1-4])\s+(20\d{2})/); return m && Number(m[2])*4+Number(m[1])===ordinal; });
    } else if (fy && mode==='yoy') previous=periods.findIndex(p=>p.replace(/\s/g,'')===`FY${Number(fy[1])-1}`);
    const baseline=values[previous];
    if (!finite(baseline)) return null;
    const difference=value-baseline;
    const change=semantic==='RELATIVE_PERCENT' ? baseline===0?null:difference/Math.abs(baseline)*100 : semantic==='BASIS_POINT'?difference*100:difference;
    return change===null?null:Math.round(change*1e8)/1e8;
  });
}
export function formatMetricChange(key: string, value: number | null | undefined): string {
  if (!finite(value)) return '—';
  const semantic=FINANCIAL_METRIC_REGISTRY[key]?.changeSemantic;
  const unit=semantic==='PERCENTAGE_POINT'?'pp':semantic==='BASIS_POINT'?'bps':semantic==='DAYS_DELTA'?'D':semantic==='PER_SHARE_CHANGE'?' / share':semantic==='RELATIVE_PERCENT'?'%':semantic==='ABSOLUTE_AMOUNT'?'M':'x';
  return `${value>=0?'+':''}${value.toFixed(2)}${unit==='pp'||unit==='bps'?' ':''}${unit}`;
}
export interface MetricDataQuality {
  status: 'VERIFIED' | 'DERIVED_FROM_VERIFIED' | 'PARTIAL' | 'APPROXIMATE' | 'UNAVAILABLE' | 'CONFLICT';
  currentVerified: boolean; historicalVerifiedPeriods: string[]; sourceCoverage: number;
  eligibleForAi: boolean; reasonCode?: 'INSUFFICIENT_VERIFIED_DATA' | 'UNSUPPORTED_METRIC' | 'NOT_APPLICABLE'; reason?: string;
}
export interface SelectedFinancialMetric {
  currency: string;
  metricKey: string; definition: FinancialMetricDefinition | null; values: (number|null)[]; periods: string[];
  changes: (number|null)[]; currentValue: number|null; dataQuality: MetricDataQuality;
  relatedMetrics: Record<string,(number|null)[]>; sourceUrls: string[]; identity: string;
}
/** Stable data identity includes all accepted dependencies, filing revisions, schema and context version. */
export function financialMetricDataIdentity(data: FinancialStatementsData): string {
  const dataset=data.verified_dataset;
  const text=JSON.stringify([METRIC_CONTEXT_VERSION,dataset?.schemaVersion,dataset?.mappingVersion,dataset?.normalizationVersion,
    dataset?.ticker,dataset?.currency,dataset?.periods,dataset?.values,dataset?.cashFlowCashBalances,data.fiscal_period_type],(key,value)=>key==='retrievedAt'?undefined:value);
  let hash=2166136261; for(let i=0;i<text.length;i++) hash=Math.imul(hash^text.charCodeAt(i),16777619);
  return `${METRIC_CONTEXT_VERSION}:${(hash>>>0).toString(16)}:${text.length}`;
}
export function selectFinancialMetric(data: FinancialStatementsData, key: string, periods: string[], mode='yoy'): SelectedFinancialMetric {
  return resolveSelectedMetric(data,key,periods,mode,true);
}
function resolveSelectedMetric(data: FinancialStatementsData, key: string, periods: string[], mode: string, includeRelated: boolean): SelectedFinancialMetric {
  const definition=FINANCIAL_METRIC_REGISTRY[key] || null;
  const notApplicable=Boolean(definition&&definition.archetype!=='all'&&definition.archetype!==data.statement_template)||
    ['banking','insurance'].includes(data.statement_template||'')&&['gross_margin','ebitda_margin','roic','quick_ratio','current_ratio','fcf_to_sales','fcf_to_net_income','asset_turnover','inventory_turnover','dso','dio','dpo','ccc'].includes(key);
  const values=definition?verifiedMetricSeries(data,key,periods):periods.map(()=>null);
  const indices=periods.map(p=>data.periods.indexOf(p));
  const details=calculateVerifiedKeyIndicators(data)[key];
  const accountingDependencies: Record<string,string[]> = {
    gross_margin:['revenue','gross_profit'], operating_margin:['revenue','operating_income'], net_margin:['revenue','net_income_common','net_income'],
    roic:['operating_income','income_tax_expense','income_before_tax','total_debt','stockholders_equity','cash_and_investments'],
    roe:['net_income_common','common_equity'], roa:['net_income','total_assets'],
    quick_ratio:['cash','short_term_investments','accounts_receivable','total_current_liabilities'], current_ratio:['total_current_assets','total_current_liabilities'],
    debt_to_equity:['total_debt','stockholders_equity'], debt_to_asset:['total_debt','total_assets'], equity_ratio:['total_equity','total_assets'],
    asset_turnover:['revenue','total_assets'], inventory_turnover:['cogs','inventory'], dso:['revenue','accounts_receivable'], dio:['cogs','inventory'], dpo:['cogs','accounts_payable'],
    free_cash_flow:['operating_cash_flow','capex'], fcf:['operating_cash_flow','capex'], cash_and_investments:['cash','short_term_investments'],
    ebitda:['operating_income','depreciation'], ebitda_margin:['operating_income','depreciation','revenue'],
    tax_rate:['income_tax_expense','income_before_tax'], fcf_to_sales:['operating_cash_flow','capex','revenue'],
    fcf_to_net_income:['operating_cash_flow','capex','net_income_common'], debt_to_ebitda:['total_debt','operating_income','depreciation'],
    ccc:['revenue','cogs','accounts_receivable','inventory','accounts_payable'],
  };
  const dependencyKeys=new Set([definition?.canonicalKey,...(accountingDependencies[key]||[]).map(k=>aliases[k]||k)]);
  // Conflicts matter only if they touch selected inputs in selected periods.
  const relevantConflict=indices.some(i=>Object.entries(data.period_snapshots?.[i]?.rejected||{}).some(([k,reason])=>dependencyKeys.has(k.split('.')[1]) && /conflict|duplicate/i.test(reason))) ||
    Boolean(data.verified_dataset?.provenanceWarnings.some(w=>{
      const metric=w.code==='REPORTED_EPS_CONFLICT'?'eps_diluted':w.message.match(/^[a-z_]+\.([a-z_]+):/)?.[1];
      return /CONFLICT/.test(w.code)&&periods.some(p=>w.message.includes(p))&&metric&&dependencyKeys.has(metric);
    }));
  const guardFailed=data.validation_summary?.failed_guards?.some(guard=>periods.some(p=>guard.includes(`: ${p}`)) &&
    ((/BALANCE_SHEET|TOTAL_DEBT/.test(guard) && ['roe','roa','roic','quick_ratio','current_ratio','debt_to_equity','debt_to_asset','equity_ratio','total_assets','total_liabilities','total_equity','total_debt'].includes(key)) || (/CASH_FLOW/.test(guard)&&['beginning_cash','ending_cash','net_change_cash','financing_cash_flow','investing_cash_flow','operating_cash_flow','ocf'].includes(key)))) || false;
  const currentVerified=finite(values.at(-1)) && !relevantConflict && !guardFailed;
  const historicalVerifiedPeriods=periods.filter((_,i)=>finite(values[i]));
  const approximate=indices.some(i=>details?.[i]?.status==='approximate');
  const derived=Boolean(details) || indices.some(i=>Object.values(data.period_snapshots?.[i]?.observations||{}).some(o=>o.metric===definition?.canonicalKey&&o.type==='derived'));
  const status=relevantConflict||guardFailed?'CONFLICT':!currentVerified?'UNAVAILABLE':approximate?'APPROXIMATE':historicalVerifiedPeriods.length<periods.length?'PARTIAL':derived?'DERIVED_FROM_VERIFIED':'VERIFIED';
  const eligibleForAi=currentVerified && historicalVerifiedPeriods.length>=2 && status!=='APPROXIMATE' && !notApplicable;
  const relatedMetrics=Object.fromEntries((includeRelated?definition?.contextDependencies||[]:[]).flatMap(k=>{
    const related=resolveSelectedMetric(data,k,periods,mode,false);
    // A named null series is not a verified observation. Keep teaching companions
    // in definition metadata, but do not invite model trend claims about them.
    return related.dataQuality.currentVerified && related.dataQuality.status!=='APPROXIMATE' && related.dataQuality.reasonCode!=='NOT_APPLICABLE' ? [[k,related.values] as const] : [];
  }));
  const sourceUrls=[...new Set(indices.flatMap(i=>Object.values(data.period_snapshots?.[i]?.observations||{})).filter(o=>dependencyKeys.has(o.metric)).map(o=>o.source?.documentUrl).filter((v):v is string=>Boolean(v)))];
  return {currency:data.currency||data.verified_dataset?.currency||'USD',metricKey:key,definition,values,periods,currentValue:values.at(-1)??null,
    changes:indices.map(i=>metricPeriodChanges(key,verifiedMetricSeries(data,key,data.periods),data.periods,mode)[i]??null),
    dataQuality:{status,currentVerified,historicalVerifiedPeriods,sourceCoverage:periods.length?historicalVerifiedPeriods.length/periods.length:0,eligibleForAi,
      reasonCode:eligibleForAi?undefined:!definition?'UNSUPPORTED_METRIC':notApplicable?'NOT_APPLICABLE':'INSUFFICIENT_VERIFIED_DATA',reason:notApplicable?'Sector methodology is not applicable':guardFailed?'Selected accounting guard failed':relevantConflict?'Selected source conflict':!currentVerified?'Current accepted metric unavailable':historicalVerifiedPeriods.length<2?'Insufficient verified history':approximate?'Approximate methodology: deterministic explanation only':undefined},
    relatedMetrics,sourceUrls,identity:financialMetricDataIdentity(data)};
}
