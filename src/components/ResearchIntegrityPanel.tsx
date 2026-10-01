import { useState } from 'react';
import type { ResearchIntegritySummary, ResearchMetric } from '../domain/reportResearchIntegrity';

export function ResearchIntegrityPanel({ data, isThai }: { data: ResearchIntegritySummary; isThai: boolean }) {
  const [details, setDetails] = useState(false);
  const value=(m:ResearchMetric)=>m.value===null?'—':`${m.unit==='USD_M'?'$':''}${m.value.toLocaleString(undefined,{maximumFractionDigits:2})}${m.unit==='USD_M'?'M':m.unit}`;
  const labels={ STRONG_CASH_BACKING:['กำไรมีเงินสดรองรับ','Strong cash-backed earnings'],
    MIXED:['การเปลี่ยนกำไรเป็นเงินสดยังผสมกัน','Mixed cash conversion'],
    WEAK_CASH_CONVERSION:['เงินสดต่ำเมื่อเทียบกำไร','Weak cash conversion'],
    NOT_APPLICABLE:['ใช้เกณฑ์เฉพาะธุรกิจการเงิน','Sector-specific cash economics'],
    INSUFFICIENT_DATA:['ข้อมูลที่ตรวจสอบได้ยังไม่เพียงพอ','Insufficient verified inputs'] };
  const table=(metrics:ResearchMetric[]) => <dl className="mt-3 space-y-2">{metrics.map(m=><div key={m.key} className="border-b border-stone-100 pb-2 last:border-0">
    <div className="flex justify-between gap-3 text-xs"><dt className="text-stone-600">{m.label}</dt><dd className="shrink-0 font-mono font-semibold text-stone-900">{value(m)}</dd></div>
    {details&&<p className="mt-1 break-words text-[11px] text-stone-500">{m.period??'—'} · {m.basis}{m.reason?` · ${m.reason}`:''}{m.source&&<span className="block">{m.source}</span>}</p>}
  </div>)}</dl>;
  return <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6" aria-label="Verified research evidence">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-base font-bold text-stone-900">{isThai?'คุณภาพกำไรและการใช้เงินสด':'Earnings quality & capital allocation'}</h3>
      <button type="button" aria-pressed={details} onClick={()=>setDetails(!details)} className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs text-stone-700 transition-colors hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-teal-700">
        {details?(isThai?'รายละเอียด · Analyst':'Analyst details'):(isThai?'อ่านง่าย · Beginner':'Beginner view')}</button>
    </div>
    <div className="mt-4 grid gap-5 lg:grid-cols-2"><div>
      <h4 className="text-sm font-semibold text-stone-800">{labels[data.earningsQuality.classification][isThai?0:1]}</h4>
      <p className="mt-1 text-xs leading-relaxed text-stone-600">{data.earningsQuality.classification==='NOT_APPLICABLE'
        ?(isThai?'เงินสดจากดำเนินงานอาจเปลี่ยนตามพอร์ตสินเชื่อและแหล่งเงินทุน จึงไม่ใช้เกณฑ์ OCF/กำไรแบบบริษัททั่วไป ควรดูผลตอบแทนส่วนทุน คุณภาพสินทรัพย์ และเงินกองทุนร่วมกัน':'Operating cash flow also reflects loan inventory and funding. Industrial OCF/earnings thresholds do not apply; assess equity returns, asset quality and capital together.')
        :(isThai?'เทียบกำไรกับเงินสดจากดำเนินงานและเงินสดที่เหลือหลังลงทุน โดยใช้สี่ไตรมาสที่ตรวจสอบแล้วในงวดเดียวกัน':'Compare earnings, operating cash flow and cash after capital expenditure using the same four verified quarters.')}</p>
      {table(data.earningsQuality.metrics)}{details&&<p className="mt-2 text-[11px] text-stone-500">{data.earningsQuality.methodology}</p>}
    </div><div>
      <h4 className="text-sm font-semibold text-stone-800">{isThai?'เงินสดไปที่ไหน?':'Where is the cash going?'}</h4>
      <p className="mt-1 text-xs leading-relaxed text-stone-600">{isThai?'ซื้อหุ้นคืนและปันผลเป็นรายการที่จ่ายจริง แยกจากวงเงินอนุมัติ — หมายถึงยังยืนยันข้อมูลไม่ได้':'Repurchases and dividends are executed cash payments, separate from authorizations. A dash means the observation is unavailable.'}</p>
      {table(data.capitalAllocation)}
      <div className="mt-3 flex justify-between gap-3 rounded-xl bg-stone-50 p-3 text-xs"><span>Shareholder Yield</span><strong className="font-mono">{data.shareholderYield.totalPct===null?'—':`${data.shareholderYield.totalPct.toFixed(2)}%`}</strong></div>
      {details&&<p className="mt-1 text-[11px] text-stone-500">{data.shareholderYield.basis}</p>}
    </div></div>
    {data.businessKpis.length>0&&<details className="mt-4 border-t border-stone-100 pt-3"><summary className="cursor-pointer text-sm font-semibold text-stone-800 focus-visible:outline-2 focus-visible:outline-teal-700">{isThai?'ตัวชี้วัดตามลักษณะธุรกิจ':'Business-specific indicators'}</summary>{table(data.businessKpis)}</details>}
    <p className="mt-4 text-xs text-stone-600">{isThai?'ความเชื่อมั่นของคะแนน':'Score confidence'}: {data.scoreConfidence} · {isThai?'ความครอบคลุมข้อมูลของคะแนน':'Score input coverage'}: {data.verifiedScoreInputCoveragePct===null?'—':`${data.verifiedScoreInputCoveragePct.toFixed(1)}%`}</p>
    {details&&data.diagnostics.length>0&&<p className="mt-2 break-words text-xs text-amber-800">{data.diagnostics.join(' · ')}</p>}
  </section>;
}
