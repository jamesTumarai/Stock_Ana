import type { ReportData } from '../types';

/** External estimates keep their own date and methodology. Source-linked model
 * retrieval is never promoted to independently verified financial evidence. */
export function resolveValuationDispersion(report:Partial<ReportData>) {
  const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>0;
  const run=report.intrinsic_value?.canonical_run,morningstar=report.morningstar_research,forecast=report.forecast_dashboard;
  const rows:Array<{label:string;value:number;asOf:string|null;basis:string}>=[];
  if(valid(report.market_snapshot?.price))rows.push({label:'Market price',value:report.market_snapshot!.price,asOf:report.market_snapshot?.asOf??null,basis:'Market quote snapshot'});
  if(run?.status==='AVAILABLE'&&valid(run.baseFairValue))rows.push({label:'Lumina fair value',value:run.baseFairValue,asOf:report.generated_at??null,basis:`${run.primaryMethod} · ${run.valuationRunId}`});
  if(morningstar?.has_coverage&&valid(morningstar.fair_value_estimate))rows.push({label:'Morningstar fair value',value:morningstar.fair_value_estimate,asOf:morningstar.fair_value_date??morningstar.as_of_date??null,basis:'External estimate; independent retrieval/assumptions not established by this comparison'});
  if(valid(forecast?.price_target?.mean))rows.push({label:'Wall Street mean target',value:forecast.price_target.mean,asOf:forecast.as_of_date??null,basis:'External analyst target; target horizon and assumptions retain their own source basis'});
  return rows;
}
