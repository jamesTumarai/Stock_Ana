import type { CanonicalFinancialDataset, CanonicalFinancialValue } from './financialValue';
import { getFiscalQuarterOrdinal } from './valuation/canonicalQuarterWindow';

export const STATEMENT_MAPPING_VERSION = 'period-true-statements-v2';
export const STATEMENT_NORMALIZATION_VERSION = 'standalone-source-v2';
export interface VerifiedStatementPeriod {
  fiscalYear: number;
  fiscalQuarter: 1 | 2 | 3 | 4;
  label: string;
  periodType: 'standalone_quarter' | 'annual';
  startDate?: string;
  endDate: string;
  durationDays?: number;
  currency: string;
  observations: Record<string, CanonicalFinancialValue>;
  rejected: Record<string, string>;
}
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const days = (start?: string, end?: string) => start && end
  ? (Date.parse(end) - Date.parse(start)) / 86400000 + 1 : NaN;
const sourceAccepted = (value: CanonicalFinancialValue) => {
  // Older reports with unqualified working-capital signs are not evidence of
  // cash-flow effects. Other accepted lines stay usable; refresh these cells.
  if (value.statement === 'cash_flow' && ['change_receivables','change_inventory','change_payables'].includes(value.metric)
    && value.valueSemantic !== 'CASH_FLOW_EFFECT') return false;
  const source = value.source;
  if (!source?.documentUrl || !source.provider || value.verification !== 'verified' || !['reported','derived'].includes(value.type)) return false;
  try {
    const url = new URL(source.documentUrl);
    if (url.protocol !== 'https:') return false;
    // A URL attached by a model is not evidence. Only independently ingested packages
    // enter this boundary; other source tiers require an explicit ingestion contract.
    return /sec edgar/i.test(source.provider) && (url.hostname === 'sec.gov' || url.hostname.endsWith('.sec.gov'))
      && Boolean(value.accession || source.accessionNumber);
  } catch { return false; }
};

/** Index observations by their own identities, never by series position. Conflicts fail closed. */
export function buildVerifiedStatementPeriods(dataset?: CanonicalFinancialDataset | null): VerifiedStatementPeriod[] {
  if(dataset?.generatedBy==='lumina+sec-xbrl-ifrs-annual-v3'&&dataset.mappingVersion===STATEMENT_MAPPING_VERSION&&dataset.normalizationVersion===STATEMENT_NORMALIZATION_VERSION&&/^[A-Z]{3}$/.test(dataset.currency||'')) {
    return dataset.periods.flatMap(label=>{
      const fy=label.match(/^FY(20\d{2})$/); if(!fy) return [];
      const group=Object.values(dataset.values).flat().filter(o=>o.period===label&&o.fiscalYear===Number(fy[1])&&o.periodEnd&&sourceAccepted(o));
      const anchors=group.filter(o=>o.metric==='revenue'&&o.periodType==='annual'&&days(o.periodStart,o.periodEnd)>=300&&days(o.periodStart,o.periodEnd)<=400);
      if(anchors.length!==1) return [];
      const anchor=anchors[0],observations:Record<string,CanonicalFinancialValue>={},rejected:Record<string,string>={};
      for(const o of group) {
        const key=`${o.statement}.${o.metric}`,valid=o.currency===dataset.currency&&o.source?.accountingStandard==='IFRS'&&o.source.periodEnd===o.periodEnd&&o.periodEnd===anchor.periodEnd
          &&o.unit===(o.metric==='eps_diluted'?'per_share':dataset.currency==='USD'?'USD_M':'CURRENCY_M')
          &&(o.statement==='balance_sheet'?o.periodType==='instant'&&!o.periodStart:o.periodType==='annual'&&o.periodStart===anchor.periodStart);
        if(!valid||observations[key]) {delete observations[key];rejected[key]='Conflicting/incompatible annual IFRS observation';}
        else if(!rejected[key]) observations[key]=o;
      }
      return [{fiscalYear:Number(fy[1]),fiscalQuarter:4 as const,label,periodType:'annual' as const,startDate:anchor.periodStart,endDate:anchor.periodEnd!,currency:dataset.currency!,observations,rejected}];
    });
  }
  if (!dataset || !/sec[-_]?xbrl/i.test(dataset.generatedBy || '') || !dataset.values
    || dataset.currency !== 'USD' || dataset.mappingVersion !== STATEMENT_MAPPING_VERSION
    || dataset.normalizationVersion !== STATEMENT_NORMALIZATION_VERSION) return [];
  if (new Set(dataset.periods.map(getFiscalQuarterOrdinal)).size !== dataset.periods.length) return [];
  const grouped = new Map<number, CanonicalFinancialValue[]>();
  for (const series of Object.values(dataset.values)) for (const item of series) {
    const ordinal = getFiscalQuarterOrdinal(item);
    if (!Number.isFinite(ordinal) || !item.fiscalYear || !item.fiscalQuarter
      || getFiscalQuarterOrdinal(item.period) !== ordinal || !item.periodEnd) continue;
    const group = grouped.get(ordinal) || [];
    group.push(item); grouped.set(ordinal, group);
  }
  const periods: VerifiedStatementPeriod[] = [];
  for (const [, group] of [...grouped].sort(([a], [b]) => a - b)) {
    // Revenue anchors the duration; assets anchors the instant when revenue is unavailable.
    // A conflicting anchor must never be resolved by choosing a convenient array slot.
    let anchors = group.filter(item => ['revenue', 'total_assets'].includes(item.metric)
      && finite(item.value) && sourceAccepted(item));
    if (!anchors.length) anchors = group.filter(item => ['operating_income','operating_cash_flow','net_income','net_income_common'].includes(item.metric)
      && finite(item.value) && item.periodType === 'standalone_quarter' && sourceAccepted(item));
    if (!anchors.length) anchors = group.filter(item => finite(item.value) && item.periodType === 'standalone_quarter' && sourceAccepted(item));
    const ends = [...new Set(anchors.map(item => item.periodEnd!))];
    if (ends.length !== 1) continue;
    const endDate = ends[0];
    const durationAnchor = anchors.find(item => item.periodType === 'standalone_quarter');
    const first = anchors[0];
    const period: VerifiedStatementPeriod = {
      fiscalYear: first.fiscalYear!, fiscalQuarter: first.fiscalQuarter!,
      label: `Q${first.fiscalQuarter} ${first.fiscalYear}`, periodType: 'standalone_quarter',
      startDate: durationAnchor?.periodStart, endDate,
      durationDays: finite(days(durationAnchor?.periodStart, endDate)) ? days(durationAnchor?.periodStart, endDate) : undefined,
      currency: dataset.currency, observations: {}, rejected: {},
    };
    const keys = [...new Set(group.map(item => `${item.statement}.${item.metric}`))];
    for (const key of keys) {
      const candidates = group.filter(item => `${item.statement}.${item.metric}` === key && finite(item.value));
      const accepted = candidates.filter(item => {
        const expectedUnit = item.metric.includes('eps') ? 'per_share'
          : item.metric.endsWith('_pct') || ['tax_rate','tier1_capital_ratio','cet1_ratio'].includes(item.metric) ? 'percent'
          : ['current_ratio','quick_ratio','debt_to_equity','debt_to_ebitda'].includes(item.metric) ? 'x' : 'USD_M';
        if (!sourceAccepted(item) || item.unit !== expectedUnit || item.periodEnd !== endDate
          || item.source?.periodEnd !== item.periodEnd || (item.currency && item.currency !== dataset.currency)) return false;
        if (item.statement === 'balance_sheet') return item.periodType === 'instant' && !item.periodStart;
        const duration = days(item.periodStart, item.periodEnd);
        return item.periodType === 'standalone_quarter' && duration >= 60 && duration <= (item.fiscalQuarter === 4 ? 126 : 112)
          && (!period.startDate || item.periodStart === period.startDate);
      });
      if (accepted.length === 1 && candidates.length === 1) period.observations[key] = accepted[0];
      else period.rejected[key] = candidates.length > 1 ? 'Duplicate/conflicting observation' : 'Missing or incompatible period/source/unit';
    }
    periods.push(period);
  }
  return periods;
}

/** Rebuild a canonical package from accepted period cells, preserving every rejection. */
export function reconcileVerifiedDataset(dataset?: CanonicalFinancialDataset | null): CanonicalFinancialDataset | null {
  const snapshots = buildVerifiedStatementPeriods(dataset);
  if (!dataset || !snapshots.length) return null;
  for(const period of snapshots) {
    const key='cash_flow.depreciation';
    if(period.observations[key]||dataset.values[key]?.some(o=>o.period===period.label&&finite(o.value))) continue;
    const depreciation=period.observations['cash_flow.depreciation_expense'],amortization=period.observations['cash_flow.amortization_of_intangibles'];
    if(!depreciation||!amortization||depreciation.periodStart!==amortization.periodStart||depreciation.unit!==amortization.unit||depreciation.currency!==amortization.currency) continue;
    period.observations[key]={...depreciation,metric:'depreciation',value:depreciation.value!+amortization.value!,type:'derived',sourceComponents:[depreciation,amortization],
      derivation:'Derived D&A = compatible standalone reported Depreciation + AmortizationOfIntangibleAssets. Finance-lease amortization is not added separately or double-counted. Impairment is excluded.'};
  }
  for (const period of snapshots) for (const [metric, leftKey, rightKey] of [
    ['gross_profit','revenue','cogs'], ['cogs','revenue','gross_profit'],
  ]) {
    const key=`income_statement.${metric}`;
    if (period.observations[key]) continue;
    // An incompatible/conflicting disclosed value is not a missing disclosure.
    // Keep its rejection instead of masking the conflict with an identity.
    if (dataset.values[key]?.some(item => item.period === period.label && (finite(item.value) || /conflicting/i.test(item.derivation||'')))) continue;
    const left=period.observations[`income_statement.${leftKey}`], right=period.observations[`income_statement.${rightKey}`];
    if (!left || !right || !['USD_M','CURRENCY_M'].includes(left.unit) || right.unit!==left.unit || left.periodStart!==right.periodStart) continue;
    period.observations[key]={...left,metric,value:Math.round((left.value!-right.value!)*1e8)/1e8,type:'derived',sourceComponents:[left,right],
      derivation:`Canonical ${metric} = compatible verified ${leftKey} - ${rightKey}; same standalone quarter and currency.`};
    delete period.rejected[key];
  }
  const keys = [...new Set([...Object.keys(dataset.values),...snapshots.flatMap(p=>Object.keys(p.observations))])];
  const values: CanonicalFinancialDataset['values'] = {};
  for (const key of keys) values[key] = snapshots.map(period => {
    if (period.observations[key]) return period.observations[key];
    // A rejected null observation can explain a source conflict/sign convention.
    // Preserve that evidence without promoting it or an invalid finite value.
    const rejected = dataset.values[key]?.filter(item => item.period === period.label && item.value === null) || [];
    const evidence = rejected.length === 1 ? rejected[0] : undefined;
    return {
      ...evidence,
      metric: key.split('.')[1], statement: key.split('.')[0] as CanonicalFinancialValue['statement'],
      value: null, unit: dataset.values[key]?.[0]?.unit || 'unknown', period: period.label,
      fiscalYear: period.fiscalYear, fiscalQuarter: period.fiscalQuarter,
      periodEnd: period.endDate, type: evidence?.type || 'reported', verification: 'unverified',
      derivation: evidence?.derivation || period.rejected[key] || 'Not disclosed in the accepted source package.',
    } as CanonicalFinancialValue;
  });
  // FCF is never an independent provider/model override, even if it has a source.
  values['cash_flow.free_cash_flow'] = snapshots.map(period => {
    const ocf = period.observations['cash_flow.operating_cash_flow'];
    const capex = period.observations['cash_flow.capex'];
    const compatible = ocf && capex && ocf.unit === capex.unit && ocf.periodStart === capex.periodStart;
    return compatible ? { ...ocf, metric: 'free_cash_flow', value: Math.round((ocf.value! - Math.abs(capex.value!)) * 1e8) / 1e8,
      type: 'derived' as const, sourceComponents: [ocf, capex],
      derivation: 'Canonical FCF = verified standalone OCF - absolute verified standalone CapEx.' }
      : { metric: 'free_cash_flow', statement: 'cash_flow' as const, value: null, unit: 'USD_M' as const,
        period: period.label, fiscalYear: period.fiscalYear, fiscalQuarter: period.fiscalQuarter,
        periodEnd: period.endDate, type: 'derived' as const, verification: 'unverified' as const,
        derivation: 'Compatible OCF and CapEx unavailable; provider FCF is not a substitute.' };
  });
  const all = Object.values(values).flat();
  const count = all.filter(item => finite(item.value)).length;
  return { ...dataset, mappingVersion: STATEMENT_MAPPING_VERSION, normalizationVersion: STATEMENT_NORMALIZATION_VERSION,
    periods: snapshots.map(period => period.label), values,
    provenanceStatus: count === all.length ? 'verified' : 'partially_source_linked',
    sourceCoverage: { sourceLinkedValues: count, verifiedValues: count, nonNullValues: count,
      missingValues: all.length - count, totalValues: all.length },
  };
}
