import type { ReportData } from '../types';
import { resolveValuationDispersion } from '../domain/valuationDispersion';

export function ValuationDispersion({report,isThai}:{report:ReportData;isThai:boolean}) {
  const rows=resolveValuationDispersion(report);if(rows.length<2)return null;
  const scale=Math.max(...rows.map(row=>row.value));
  return <details className="rounded-2xl border border-stone-200 bg-white p-5"><summary className="cursor-pointer text-sm font-semibold text-stone-900 focus-visible:outline-2 focus-visible:outline-teal-700">{isThai?'เปรียบเทียบมูลค่าจากแต่ละมุมมอง':'Valuation dispersion'}</summary>
    <div className="mt-4 space-y-4">{rows.map(row=><div key={row.label}><div className="flex justify-between gap-3 text-xs text-stone-800"><span>{row.label}</span><strong className="font-mono">${row.value.toFixed(2)}</strong></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-teal-800" style={{width:`${row.value/scale*100}%`}} /></div>
      <p className="mt-1 break-words text-[11px] text-stone-600">{row.asOf??'As of unavailable'} · {row.basis}</p></div>)}</div>
    <p className="mt-4 text-xs leading-relaxed text-stone-600">{isThai?'มูลค่าและราคาเป้าหมายอาจใช้วิธีประเมิน การเติบโต อัตรากำไร ความเสี่ยง และระยะเวลาต่างกัน ตัวเลขนี้แสดงความแตกต่าง ไม่ตัดสินว่าแหล่งใดถูก และไม่อนุมานสมมติฐานของแหล่งภายนอก':'Methods, growth, margins, risk and horizons may differ. This compares estimates without choosing a correct one or inventing external assumptions.'}</p>
  </details>;
}
