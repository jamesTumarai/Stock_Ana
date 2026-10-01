import type { CanonicalValuationRun } from '../domain/valuation/adaptiveValuationPolicy';
import { buildMethodSensitivity } from '../domain/valuation/methodSensitivity';

export function MethodSensitivity({run,isThai}:{run:CanonicalValuationRun;isThai:boolean}) {
  const grid=buildMethodSensitivity(run);if(!grid)return null;
  return <details className="mt-4 border-t border-stone-100 pt-3"><summary className="cursor-pointer text-sm font-semibold text-stone-800 focus-visible:outline-2 focus-visible:outline-teal-700">{isThai?'ทดสอบความไวตามวิธีประเมิน':'Method-specific sensitivity'}</summary>
    <p className="mt-2 text-xs text-stone-600">{grid.rowLabel} × {grid.columnLabel}</p>
    <div className="mt-2 overflow-x-auto"><table className="w-full text-right text-xs font-mono"><thead><tr><th className="p-2 text-left">{grid.rowLabel}</th>{grid.columns.map((column,c)=><th key={c} className="p-2">{column.toFixed(2)}</th>)}</tr></thead>
      <tbody>{grid.rows.map((row,r)=><tr key={r}><th className="p-2 text-left">{row.toFixed(2)}</th>{grid.values[r].map((value,c)=><td key={c} className={`rounded-lg p-2 ${r===grid.baseRow&&c===grid.baseColumn?'bg-teal-50 font-bold text-teal-900':'text-stone-700'}`}>{value===null?'—':`$${value.toFixed(2)}`}</td>)}</tr>)}</tbody></table></div>
    <p className="mt-2 text-[11px] leading-relaxed text-stone-600">{isThai?'ตารางนี้เปลี่ยนสมมติฐานเพื่อทดสอบความไว โดยใช้ข้อมูล canonical เดิม ค่าหลักและรายงานเก่าไม่ถูกแก้ไข':grid.basis}</p>
  </details>;
}
