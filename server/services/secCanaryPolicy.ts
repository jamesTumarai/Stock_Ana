import {createHash} from 'node:crypto';
export interface CanaryIssuer {cik_str:number;ticker:string;title:string}
export type CanaryFilingPolicy = 'US_PERIODIC' | 'FOREIGN_PERIODIC' | 'NO_SUPPORTED_PERIODIC_FILING';

/** US-GAAP tags can appear in 20-F companyfacts; filing form, not taxonomy
 * alone, determines whether the 10-K/10-Q period resolver is applicable. */
export function classifyCanaryFilingPolicy(forms: readonly string[]): CanaryFilingPolicy {
  if (forms.some(form => /^(?:10-K|10-Q)(?:\/A)?$/i.test(form))) return 'US_PERIODIC';
  if (forms.some(form => /^(?:20-F|40-F|6-K)(?:\/A)?$/i.test(form))) return 'FOREIGN_PERIODIC';
  return 'NO_SUPPORTED_PERIODIC_FILING';
}
/** Stable within a seed, rotates across seeds; no production ticker list. */
export function selectRotatingSecFilers(index: Record<string,CanaryIssuer>, seed: string, count: number): CanaryIssuer[] {
  const seen=new Set<number>();
  return Object.values(index).filter(v=>v.ticker && v.cik_str)
    .sort((a,b)=>createHash('sha256').update(seed+':'+a.cik_str).digest('hex').localeCompare(createHash('sha256').update(seed+':'+b.cik_str).digest('hex')))
    .filter(v=>seen.has(v.cik_str)?false:(seen.add(v.cik_str),true)).slice(0,count);
}
