import type { CanonicalValuationRun } from './adaptiveValuationPolicy';
import { calculateStrictDCFValue } from '../../utils/valuation/dcfMathEngine';

export interface MethodSensitivity { rowLabel:string;columnLabel:string;rows:number[];columns:number[];values:(number|null)[][];baseRow:number;baseColumn:number;basis:string; }
const number=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:null;
/** Hypothetical sensitivities consume frozen run inputs. They neither rewrite
 * a historical run nor introduce an independent current fair-value path. */
export function buildMethodSensitivity(run:CanonicalValuationRun):MethodSensitivity|null {
  if(run.status!=='AVAILABLE')return null;
  const i=run.inputSnapshot,a=run.assumptionSnapshot;
  const n=(key:string)=>number(i[key]),s=(key:string)=>number(a[key]);
  let rowLabel='',columnLabel='',rows:number[]=[],columns:number[]=[],calc:(r:number,c:number)=>number|null;
  if(run.primaryMethod==='RESIDUAL_INCOME') {
    const book=n('bookValuePerShare'),roe=n('roePct'),cost=s('costOfEquityPct'),growth=s('terminalGrowthPct');
    if(book===null||roe===null||cost===null||growth===null)return null;
    rowLabel='Sustainable ROE (%)';columnLabel='Cost of equity (%)';rows=[roe-1,roe,roe+1];columns=[cost-1,cost,cost+1];
    calc=(r,c)=>c>growth?book+book*(r-c)/(c-growth):null;
  } else if(run.primaryMethod==='AFFO_MULTIPLE') {
    const affo=n('affoPerShare'),multiple=s('peerMedianAffoMultiple');if(affo===null||multiple===null)return null;
    rowLabel='AFFO scenario change (%)';columnLabel='P/AFFO (x)';rows=[-10,0,10];columns=[multiple-2,multiple,multiple+2];
    calc=(r,c)=>c>0?affo*(1+r/100)*c:null;
  } else if(run.primaryMethod==='PEER_EV_SALES') {
    const revenue=n('revenueM'),shares=n('sharesM'),netCash=n('netCashM'),multiple=s('peerMedianMultiple');
    if(revenue===null||shares===null||shares<=0||netCash===null||multiple===null)return null;
    rowLabel='Revenue scenario change (%)';columnLabel='EV/Sales (x)';rows=[-10,0,10];columns=[multiple*0.8,multiple,multiple*1.2];
    calc=(r,c)=>(revenue*(1+r/100)*c+netCash)/shares;
  } else if(run.primaryMethod==='SOTP') {
    const shares=n('shares'),bridge=n('bridge'),corporate=s('corporateAdjustments');
    const parts=i.components as Array<{name:string;input:number}>|undefined;
    const multiples=a.componentMultiples as Array<{name:string;multiple:number}>|undefined;
    if(shares===null||shares<=0||bridge===null||corporate===null||!parts||!multiples)return null;
    const value=parts.reduce((sum,part)=>sum+part.input*(multiples.find(m=>m.name===part.name)?.multiple??NaN),0);
    if(!Number.isFinite(value))return null;
    rowLabel='Hypothetical share-count increase (%)';columnLabel='Segment multiple scale (%)';rows=[0,5,10];columns=[90,100,110];
    calc=(r,c)=>(value*c/100+corporate+bridge)/(shares*(1+r/100));
  } else if(run.primaryMethod==='CYCLICAL_NORMALIZED_DCF') {
    const revenue=n('revenueM'),shares=n('sharesM'),netCash=n('netCashM'),margin=n('normalizedMarginPct'),wacc=s('waccPct'),growth=s('growthPct'),years=s('projectionYears');
    const scenarios=a.scenarios as {base?:{revenueGrowth?:number}}|undefined;
    const cagr=number(scenarios?.base?.revenueGrowth);
    if([revenue,shares,netCash,margin,wacc,growth,years,cagr].some(v=>v===null))return null;
    rowLabel='Normalized FCF margin (%)';columnLabel='WACC (%)';rows=[margin!-1,margin!,margin!+1];columns=[wacc!-1,wacc!,wacc!+1];
    calc=(r,c)=>calculateStrictDCFValue(revenue!,shares!,netCash!,c,growth!,cagr!,r,years!);
  } else if(run.primaryMethod==='DIVIDEND_DISCOUNT') {
    const dividend=n('dividendPerShare'),cost=s('cost_of_equity_pct'),growth=s('terminal_growth_pct');
    if(dividend===null||cost===null||growth===null)return null;
    rowLabel='Long-term growth (%)';columnLabel='Cost of equity (%)';rows=[growth-1,growth,growth+1];columns=[cost-1,cost,cost+1];
    calc=(r,c)=>r>=0&&c>r&&c>0?dividend*(1+r/100)/((c-r)/100):null;
  } else return null;
  return {rowLabel,columnLabel,rows,columns,baseRow:run.primaryMethod==='SOTP'?0:1,baseColumn:1,values:rows.map(r=>columns.map(c=>{
    const value=calc(r,c);return value!==null&&Number.isFinite(value)&&value>0?Math.round(value*100)/100:null;
  })),basis:'Hypothetical model assumptions applied to the saved canonical financial inputs; main valuation and historical snapshot remain unchanged.'};
}
