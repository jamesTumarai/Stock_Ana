import { useEffect,useRef,useState } from 'react';
import type { ReportData } from '../types';
import { compareResearchVersions } from '../domain/reportVersionCompare';
import { unwrapHistoryRecord } from '../utils/researchTimeline';
import { loadReportSnapshot } from '../services/reportPersistenceService';

export function ReportVersionCompare({current,records,userId,isThai}:{current:ReportData;records:unknown[];userId?:string;isThai:boolean}) {
  const [comparison,setComparison]=useState<ReturnType<typeof compareResearchVersions>|null>(null);
  const [loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null);
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const currentTime=Date.parse(current.generated_at);
  const previous=records.map(raw=>({raw,record:unwrapHistoryRecord(raw)}))
    .filter(item=>item.record?.ticker===current.ticker && item.record.createdTimestamp<currentTime)
    .sort((a,b)=>b.record!.createdTimestamp-a.record!.createdTimestamp)[0];
  if(!previous)return null;
  const compare=async()=>{
    if(loading)return;
    setLoading(true);setError(null);
    try {
      const raw=previous.raw as {persistenceVersion?:number;id?:string;isSummaryOnly?:boolean};
      if(raw.persistenceVersion===2 && !userId)throw new Error(isThai?'เข้าสู่ระบบเพื่ออ่านรายงานก่อนหน้า':'Sign in to load the previous snapshot');
      const saved=raw.persistenceVersion===2 ? await loadReportSnapshot(raw.id!,userId!) : previous.record!.data;
      if(alive.current)setComparison(compareResearchVersions(saved,current));
    } catch(e) {if(alive.current)setError(e instanceof Error?e.message:'Snapshot comparison unavailable');}
    finally{if(alive.current)setLoading(false);}
  };
  const render=(value:unknown)=>value===null?'—':typeof value==='object'?JSON.stringify(value):String(value);
  return <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
    <button type="button" disabled={loading} onClick={compare} className="rounded-xl border border-stone-200 px-3 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-teal-700 disabled:opacity-50">
      {loading?(isThai?'กำลังอ่าน snapshot…':'Loading snapshot…'):(isThai?'เปรียบเทียบกับรายงานเวอร์ชันก่อน':'Compare with the previous report version')}</button>
    {error&&<p role="alert" className="mt-3 text-sm text-rose-800">{error}</p>}
    {comparison&&<div className="mt-4 space-y-3"><p className="text-xs text-stone-600">{comparison.previousDate} → {comparison.currentDate} · {comparison.status}</p>
      <p className="break-words text-xs text-stone-700">{comparison.changes.join(' · ') || (isThai?'ข้อมูลและสมมติฐานมูลค่าเดิม':'Identical valuation inputs and assumptions')}</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">{isThai?'สิ่งที่เปลี่ยน':'Change'}</th><th className="p-2">{isThai?'ก่อน':'Before'}</th><th className="p-2">{isThai?'ปัจจุบัน':'Current'}</th></tr></thead><tbody>
        {comparison.rows.map(row=><tr key={row.key} className="border-t border-stone-100"><th className="p-2 font-medium">{row.key}</th><td className="max-w-60 break-words p-2">{render(row.previous)}</td><td className="max-w-60 break-words p-2">{render(row.current)}</td></tr>)}
      </tbody></table></div>
      <p className="text-xs text-stone-600">{isThai?'อ่าน snapshot ที่บันทึกไว้เท่านั้น ไม่คำนวณมูลค่าของรายงานเก่าใหม่ การแก้ Thesis ใช้ประวัติ revision แยกต่างหาก':'Uses saved snapshots without recalculating old valuations. Thesis changes retain their separate immutable revision history.'}</p>
    </div>}
  </section>;
}
