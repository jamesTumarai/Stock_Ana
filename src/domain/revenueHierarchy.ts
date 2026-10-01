import type { ReportData, RevenueSegmentItem } from '../types';
import { reconcileCanonicalTtmFlow } from './canonicalTtmFlow';
export const parseRevenueMillions=(value:unknown):number|null=>{
  if(typeof value==='number' && Number.isFinite(value))return value;
  if(typeof value!=='string')return null;
  const match=value.replace(/,/g,'').trim().match(/^\$?\s*(-?\d+(?:\.\d+)?)\s*([MB])$/i);
  return match?Number(match[1])*(match[2].toUpperCase()==='B'?1000:1):null;
};
export function reconcileRevenueHierarchy(nodes:Array<{id:string;parentId:string|null;period:string;value:number}>,totals:Record<string,number>,tolerance=0.01) {
  const diagnostics:string[]=[],identities=new Set<string>(),groups=new Map<string,typeof nodes>();
  for(const node of nodes){const id=node.id+'|'+node.period;if(identities.has(id))diagnostics.push('DUPLICATE_BREAKDOWN_NODE:'+id);identities.add(id);
    const key=(node.parentId??'TOTAL')+'|'+node.period;const g=groups.get(key)??[];g.push(node);groups.set(key,g);
    const visited=new Set<string>([node.id]);let parent=node.parentId;
    while(parent){if(visited.has(parent)){diagnostics.push('BREAKDOWN_HIERARCHY_CYCLE:'+id);break;}visited.add(parent);parent=nodes.find(n=>n.id===parent&&n.period===node.period)?.parentId??null;}
  }
  for(const [key,children]of groups){const [parent,period]=key.split('|');const total=parent==='TOTAL'?totals[period]:nodes.find(n=>n.id===parent&&n.period===period)?.value;
    if(typeof total!=='number'||!Number.isFinite(total)||children.some(n=>!Number.isFinite(n.value))
      ||Math.abs(children.reduce((s,n)=>s+n.value,0)-total)>Math.max(0.01,Math.abs(total)*tolerance))diagnostics.push('BREAKDOWN_RECONCILIATION_FAILED:'+key);
  }
  return [...new Set(diagnostics)];
}
export function auditReportRevenueHierarchy(report:Partial<ReportData>) {
  const breakdown=report.business_analysis?.revenue_breakdown,ds=report.canonical_financials;
  if(!breakdown)return [];
  const diagnostics:string[]=[];
  for(const kind of ['by_business','by_region'] as const) {
    const items=breakdown[kind]??[];if(!items.length)continue;
    const nodes=items.map(item=>({id:item.id??item.name,parentId:item.parent_id??null,period:item.period??breakdown.period??'',value:parseRevenueMillions(item.revenue_usd)??NaN}));
    const totals:Record<string,number>={};
    for(const period of new Set(nodes.map(n=>n.period))) {
      const facts=ds?.values['income_statement.revenue']?.filter(f=>f.period===period&&f.verification==='verified'&&typeof f.value==='number')??[];
      const result=reconcileCanonicalTtmFlow(ds,'income_statement.revenue');
      const ttm=period===`TTM ${result.periodsUsed.at(-1)}`?result.canonicalValue:null;
      if(facts.length===1)totals[period]=facts[0].value!;else if(ttm!==null)totals[period]=ttm;
    }
    diagnostics.push(...reconcileRevenueHierarchy(nodes,totals).map(code=>code+':'+kind));
  }
  return diagnostics;
}

/** One chart level at a time; children are percentages of their own parent.
 * No child is added to its parent in a consolidated pie. */
export function resolveRevenueLevel(items:RevenueSegmentItem[],period:string,parentId:string|null) {
  const compatible=items.filter(item=>!item.period||item.period===period);
  const parent=parentId?compatible.find(item=>(item.id??item.name)===parentId):undefined;
  const children=compatible.filter(item=>(item.parent_id??null)===parentId);
  const amounts=children.map(item=>parseRevenueMillions(item.revenue_usd));
  const total=parent?parseRevenueMillions(parent.revenue_usd):amounts.every(n=>n!==null)?amounts.reduce<number>((s,n)=>s+n!,0):null;
  const reconciles=total!==null&&total>0&&amounts.every(n=>n!==null)
    &&Math.abs(amounts.reduce<number>((s,n)=>s+n!,0)-total)<=Math.max(0.01,total*0.01);
  return {parent,reconciles,items:children.map((item,index)=>({...item,
    ratio_pct:reconciles?Math.round(amounts[index]!/total!*10000)/100:item.ratio_pct,
    hasChildren:compatible.some(child=>child.parent_id===(item.id??item.name))}))};
}
