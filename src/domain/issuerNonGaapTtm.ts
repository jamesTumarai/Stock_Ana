import type { CanonicalFinancialDataset, CanonicalFinancialValue } from './financialValue';
import { reconcileCanonicalTtmFlow } from './canonicalTtmFlow';

/** Issuer-defined flows stay outside GAAP statements. Reuse the exact same
 * period engine, admitting only explicit standalone quarter USD amounts. */
export function resolveIssuerNonGaapTtm(ds: CanonicalFinancialDataset | undefined, metric: 'AFFO' | 'FFO') {
  if (!ds) return null;
  const key = `income_statement.${metric.toLowerCase()}` as 'income_statement.affo' | 'income_statement.ffo';
  const values: CanonicalFinancialValue[] = [];
  for (const period of ds.periods) {
    const observations = (ds.issuerReportedNonGaap ?? []).filter(f=>f.metric === `companyReported${metric}`
      && f.period===period && f.unit==='USD_M' && f.verification==='ISSUER_REPORTED_NON_GAAP'
      && f.periodStart && f.source.documentUrl && f.source.filingDate && Number.isFinite(f.value))
      .sort((a,b)=>b.source.filingDate!.localeCompare(a.source.filingDate!));
    const newest=observations.filter(f=>f.source.filingDate===observations[0]?.source.filingDate);
    if(new Set(newest.map(f=>JSON.stringify([f.value,f.periodStart,f.periodEnd]))).size!==1) continue;
    const f=newest[0], label=period.match(/^Q([1-4])\s+(?:FY)?(\d{4})$/);
    if(!f || !label) continue;
    values.push({metric:metric.toLowerCase(),statement:'income_statement',value:f.value,unit:'USD_M',currency:'USD',
      period,fiscalYear:Number(label[2]),fiscalQuarter:Number(label[1]) as 1|2|3|4,periodStart:f.periodStart,periodEnd:f.periodEnd,
      periodType:'standalone_quarter',type:'reported',verification:'verified',source:f.source,
      derivation:`Issuer-reported non-GAAP ${metric}; explicit standalone-quarter amount`});
  }
  const result=reconcileCanonicalTtmFlow({...ds,values:{[key]:values}},key);
  return result.canonicalValue===null?null:{value:result.canonicalValue,unit:'USD_M',period:result.periodsUsed.join('–'),source:result.source};
}
