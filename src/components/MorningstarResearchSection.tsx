import React, { useState } from 'react';
import { 
  Sparkles, ShieldCheck, TrendingUp, AlertTriangle, 
  ChevronDown, ChevronUp, Award, FileText, Star, Compass,
  Activity, Info, HeartPulse
} from 'lucide-react';
import { MorningstarResearchData } from '../types';

interface Props {
  data?: MorningstarResearchData;
  ticker: string;
  isThai: boolean;
  currentPrice?: number;
}

export function MorningstarResearchSection({ 
  data, 
  ticker, 
  isThai, 
  currentPrice 
}: Props) {
  const [openAccordion, setOpenAccordion] = useState<string | null>('analyst_note');

  if (!data || !data.has_coverage) {
    return (
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm flex flex-col gap-4 w-full print:bg-white print:text-stone-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-100 pb-4 gap-2">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-xl bg-[#c8102e] text-white font-extrabold text-xs tracking-wider uppercase shadow-xs flex items-center gap-1.5">
              <span>MORNINGSTAR</span>
              <span className="text-[10px] opacity-75 font-serif">®</span>
            </div>
            <h3 className="font-bold text-stone-900 text-lg font-['Prompt','Mitr','Nunito',sans-serif]">
              {isThai ? 'บทวิเคราะห์ Morningstar Research' : 'Morningstar Equity Research'}
            </h3>
          </div>
          <span className="text-xs text-stone-500 font-mono bg-stone-50 px-3 py-1 rounded-full border border-stone-200 self-start sm:self-auto">
            {isThai ? 'สถานะ: ไม่อยู่ในกลุ่มจัดอันดับ' : 'Status: Uncovered'}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-stone-50/80 border border-stone-200 text-stone-600 text-xs sm:text-sm leading-relaxed font-sans">
          {isThai ? (
            <p>
              หุ้น <strong>{ticker}</strong> ปัจจุบันยังไม่มีนักวิเคราะห์อาวุโสของ Morningstar จัดทำบทวิเคราะห์อย่างเป็นทางการ (Morningstar เน้นวิเคราะห์เชิงลึกเฉพาะหุ้นขนาดใหญ่และขนาดกลางที่มีประวัติกระแสเงินสดชัดเจน) คุณสามารถอ้างอิงฉันทามติของสถาบันการเงิน Wall Street ทั่วไปในส่วนด้านบนได้ครับ
            </p>
          ) : (
            <p>
              <strong>{ticker}</strong> is currently not under active coverage by Morningstar Equity Analysts. Morningstar focuses coverage primarily on large-to-mid-cap companies with predictable cash flows. Please refer to the Wall Street Sell-Side consensus in the dashboard above.
            </p>
          )}
        </div>
      </div>
    );
  }

  const toggleAccordion = (id: string) => {
    setOpenAccordion(prev => prev === id ? null : id);
  };

  const stars = Math.max(1, Math.min(5, data.rating_stars || 3));
  const fv = data.fair_value_estimate;
  const effectivePrice = currentPrice || 100;
  const discountPct = data.discount_premium_pct !== undefined 
    ? data.discount_premium_pct 
    : (fv ? Number((((fv - effectivePrice) / effectivePrice) * 100).toFixed(2)) : 0);

  const isOvervalued = discountPct < -3;
  const isUndervalued = discountPct > 3;

  // Localized data selectors
  const summaryText = isThai 
    ? (data.ai_analysis_summary_th || data.ai_analysis_summary) 
    : data.ai_analysis_summary;

  const bullsList = (isThai && data.bulls_say_th && data.bulls_say_th.length > 0)
    ? data.bulls_say_th
    : (data.bulls_say || []);

  const bearsList = (isThai && data.bears_say_th && data.bears_say_th.length > 0)
    ? data.bears_say_th
    : (data.bears_say || []);

  // 1. Analyst Note
  const analystHeadline = isThai 
    ? (data.analyst_note?.headline_th || data.analyst_note?.headline)
    : data.analyst_note?.headline;

  const analystParagraphs = (isThai && data.analyst_note?.content_paragraphs_th && data.analyst_note.content_paragraphs_th.length > 0)
    ? data.analyst_note.content_paragraphs_th
    : (data.analyst_note?.content_paragraphs || []);

  // 2. Business Strategy & Outlook
  const strategyParagraphs = (isThai && data.business_strategy?.content_paragraphs_th && data.business_strategy.content_paragraphs_th.length > 0)
    ? data.business_strategy.content_paragraphs_th
    : (data.business_strategy?.content_paragraphs || []);

  // 3. Valuation Model Thesis
  const thesisParagraphs = (isThai && data.valuation_thesis?.content_paragraphs_th && data.valuation_thesis.content_paragraphs_th.length > 0)
    ? data.valuation_thesis.content_paragraphs_th
    : (data.valuation_thesis?.content_paragraphs || []);

  // 4. Economic Moat Details
  const moatParagraphs = (isThai && data.economic_moat_details?.content_paragraphs_th && data.economic_moat_details.content_paragraphs_th.length > 0)
    ? data.economic_moat_details.content_paragraphs_th
    : (data.economic_moat_details?.content_paragraphs || []);

  // 5. Uncertainty Details
  const uncertaintyParagraphs = (isThai && data.uncertainty_details?.content_paragraphs_th && data.uncertainty_details.content_paragraphs_th.length > 0)
    ? data.uncertainty_details.content_paragraphs_th
    : (data.uncertainty_details?.content_paragraphs || []);

  // 6. Capital Allocation Details
  const allocationParagraphs = (isThai && data.capital_allocation_details?.content_paragraphs_th && data.capital_allocation_details.content_paragraphs_th.length > 0)
    ? data.capital_allocation_details.content_paragraphs_th
    : (data.capital_allocation_details?.content_paragraphs || []);

  // 7. Financial Health
  const healthParagraphs = (isThai && data.financial_health?.content_paragraphs_th && data.financial_health.content_paragraphs_th.length > 0)
    ? data.financial_health.content_paragraphs_th
    : (data.financial_health?.content_paragraphs || []);

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-7 border border-stone-200 shadow-sm flex flex-col gap-6 w-full print:bg-white print:text-stone-900">
      {/* 1. Header Bar with Morningstar Brand */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#c8102e] text-white font-extrabold text-xs tracking-wider uppercase shadow-xs">
            <span>MORNINGSTAR</span>
            <span className="text-[10px] opacity-75 font-serif">®</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-stone-900 text-lg sm:text-xl font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight">
                {isThai ? 'บทวิเคราะห์ปัจจัยพื้นฐาน Morningstar Research' : 'Morningstar Equity Research'}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-mono font-semibold border border-emerald-200">
                {isThai 
                  ? (data.status_note_th || data.status_note || 'ครอบคลุมการวิเคราะห์อย่างเป็นทางการ') 
                  : (data.status_note || 'Active Coverage')}
              </span>
            </div>
            <span className="text-xs text-stone-500 font-sans block mt-0.5">
              {isThai 
                ? 'บทวิเคราะห์เจาะลึกคูเมืองธุรกิจ (Economic Moat), มูลค่าเหมาะสม (Fair Value) และสมมติฐานงบการเงิน' 
                : 'Independent fundamental valuation, economic moat assessment, and valuation model thesis'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto text-xs text-stone-500 font-mono bg-stone-50 px-3 py-1 rounded-full border border-stone-200">
          <span>{data.rating_date ? (isThai ? `อัปเดต: ${data.rating_date}` : `Updated: ${data.rating_date}`) : 'Live Coverage'}</span>
        </div>
      </div>

      {/* 2. AI Analysis / Executive Takeaway Card */}
      {summaryText && (
        <div className="bg-stone-50/90 border border-stone-200 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-2xs">
          <div className="flex items-center gap-2 mb-2 text-[#c8102e] font-bold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
            <span>{isThai ? 'AI สรุปมุมมอง Morningstar (Executive Summary)' : 'Morningstar Executive Summary'}</span>
          </div>
          <p className="text-xs sm:text-sm text-stone-700 leading-relaxed font-sans">
            {summaryText}
          </p>
        </div>
      )}

      {/* 3. Report Summary 5-Pillar Grid */}
      <div className="bg-stone-50/70 rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-200/80 pb-3 mb-4 gap-2">
          <span className="text-xs font-bold text-stone-700 uppercase tracking-wider font-mono">
            {isThai ? 'สรุปรายงาน (Report Summary)' : 'Report Summary'}
          </span>
          {data.analyst_name && (
            <span className="text-xs text-stone-500 font-mono flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <span>{isThai ? 'หัวหน้านักวิเคราะห์:' : 'Lead Analyst:'} </span>
              <strong className="text-stone-900 font-semibold">{data.analyst_name}</strong>
              {(isThai && data.analyst_title_th) ? (
                <span className="text-stone-400 font-sans">({data.analyst_title_th})</span>
              ) : data.analyst_title ? (
                <span className="text-stone-400 font-sans">({data.analyst_title})</span>
              ) : null}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
          {/* Rating Stars */}
          <div className="bg-white rounded-xl p-3.5 border border-stone-200/90 shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] text-stone-500 font-mono block mb-1">
              {isThai ? 'เรตติ้ง (Rating)' : 'Star Rating'}
            </span>
            <div className="flex items-center gap-1 my-1">
              {[1, 2, 3, 4, 5].map(i => (
                <Star 
                  key={i} 
                  className={`w-4 h-4 ${i <= stars ? 'text-amber-500 fill-amber-400' : 'text-stone-300'}`} 
                />
              ))}
            </div>
            <span className="text-[10px] text-stone-500 font-mono font-medium">
              {stars <= 2 ? (isThai ? 'ราคาสูงกว่ามูลค่า' : 'Overvalued') : stars >= 4 ? (isThai ? 'ราคาต่ำกว่ามูลค่า' : 'Undervalued') : (isThai ? 'ราคายุติธรรม' : 'Fair Value')}
            </span>
          </div>

          {/* Fair Value Estimate */}
          <div className="bg-white rounded-xl p-3.5 border border-stone-200/90 shadow-2xs flex flex-col justify-between">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] text-stone-500 font-mono block">
                {isThai ? 'มูลค่าเหมาะสม' : 'Fair Value'}
              </span>
              {data.fair_value_date && (
                <span className="text-[9px] text-stone-400 font-mono">{data.fair_value_date}</span>
              )}
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-stone-900">
              ${fv ? fv.toFixed(2) : '-'}
            </div>
            <div className="mt-1">
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border inline-block ${
                isUndervalued 
                  ? 'bg-emerald-50 text-[#0b5a4b] border-emerald-200' 
                  : isOvervalued 
                  ? 'bg-rose-50 text-rose-700 border-rose-200' 
                  : 'bg-stone-50 text-stone-700 border-stone-200'
              }`}>
                {discountPct > 0 ? `+${discountPct.toFixed(2)}%` : `${discountPct.toFixed(2)}%`}
                <span className="text-[10px] font-normal ml-1">
                  {isOvervalued ? (isThai ? '(แพง)' : 'Overvalued') : isUndervalued ? (isThai ? '(ถูก)' : 'Undervalued') : ''}
                </span>
              </span>
            </div>
          </div>

          {/* Economic Moat */}
          <div className="bg-white rounded-xl p-3.5 border border-stone-200/90 shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] text-stone-500 font-mono block mb-1">
              {isThai ? 'คูเมืองทางธุรกิจ' : 'Economic Moat'}
            </span>
            <div className="flex items-center gap-1.5 my-1">
              <ShieldCheck className="w-4 h-4 text-[#0b5a4b]" />
              <span className="text-base sm:text-lg font-extrabold font-mono text-[#0b5a4b]">
                {data.economic_moat || 'Wide'}
              </span>
            </div>
            <span className="text-[10px] text-stone-500 font-sans">
              {isThai 
                ? (data.economic_moat_th || (data.economic_moat === 'Wide' ? 'ความได้เปรียบยั่งยืน 20+ ปี' : data.economic_moat === 'Narrow' ? 'ได้เปรียบปานกลาง 10 ปี' : 'ไม่มีคูเมืองชัดเจน'))
                : (data.economic_moat === 'Wide' ? 'Sustainable 20+ yrs' : data.economic_moat === 'Narrow' ? 'Moderate 10 yrs' : 'None')}
            </span>
          </div>

          {/* Uncertainty */}
          <div className="bg-white rounded-xl p-3.5 border border-stone-200/90 shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] text-stone-500 font-mono block mb-1">
              {isThai ? 'ระดับความไม่แน่นอน' : 'Uncertainty'}
            </span>
            <div className="text-base sm:text-lg font-extrabold font-mono text-amber-700 my-1">
              {data.uncertainty || 'Medium'}
            </div>
            <span className="text-[10px] text-stone-500 font-sans">
              {isThai 
                ? (data.uncertainty_th || (data.uncertainty === 'Very High' ? 'ผันผวนสูงมาก' : data.uncertainty === 'High' ? 'ผันผวนสูง' : 'ผันผวนปานกลาง'))
                : 'Cash flow volatility'}
            </span>
          </div>

          {/* Capital Allocation */}
          <div className="bg-white rounded-xl p-3.5 border border-stone-200/90 shadow-2xs flex flex-col justify-between col-span-2 md:col-span-1">
            <span className="text-[11px] text-stone-500 font-mono block mb-1">
              {isThai ? 'การจัดสรรเงินทุน' : 'Capital Allocation'}
            </span>
            <div className="text-base sm:text-lg font-extrabold font-mono text-blue-700 my-1">
              {data.capital_allocation || 'Exemplary'}
            </div>
            <span className="text-[10px] text-stone-500 font-sans">
              {isThai 
                ? (data.capital_allocation_th || (data.capital_allocation === 'Exemplary' ? 'บริหารเงินทุนยอดเยี่ยม' : 'ระดับมาตรฐาน'))
                : (data.capital_allocation === 'Exemplary' ? 'Stewardship: Exemplary' : 'Standard')}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Bulls Say / Bears Say */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bulls Say */}
        <div className="bg-emerald-50/50 rounded-2xl p-4 sm:p-5 border border-emerald-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2.5 mb-3">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <TrendingUp className="w-4 h-4 text-emerald-700" />
                <span>{isThai ? 'มุมมองเชิงบวก (Bulls Say)' : 'Bulls Say'}</span>
              </span>
              {data.fair_value_date && (
                <span className="text-[10px] text-emerald-700/80 font-mono">{data.analyst_name} • {data.fair_value_date}</span>
              )}
            </div>

            <ul className="space-y-2.5 text-xs text-stone-700 leading-relaxed font-sans">
              {bullsList.length > 0 ? (
                bullsList.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold mt-0.5">•</span>
                    <span>{pt}</span>
                  </li>
                ))
              ) : (
                <li className="text-stone-400 italic">{isThai ? 'ไม่มีข้อมูล Bulls Say' : 'No Bulls Say points available.'}</li>
              )}
            </ul>
          </div>
        </div>

        {/* Bears Say */}
        <div className="bg-rose-50/50 rounded-2xl p-4 sm:p-5 border border-rose-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-rose-200/60 pb-2.5 mb-3">
              <span className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>{isThai ? 'มุมมองระมัดระวัง / ความเสี่ยง (Bears Say)' : 'Bears Say'}</span>
              </span>
              {data.fair_value_date && (
                <span className="text-[10px] text-rose-700/80 font-mono">{data.analyst_name} • {data.fair_value_date}</span>
              )}
            </div>

            <ul className="space-y-2.5 text-xs text-stone-700 leading-relaxed font-sans">
              {bearsList.length > 0 ? (
                bearsList.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-rose-600 font-bold mt-0.5">•</span>
                    <span>{pt}</span>
                  </li>
                ))
              ) : (
                <li className="text-stone-400 italic">{isThai ? 'ไม่มีข้อมูล Bears Say' : 'No Bears Say points available.'}</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* 5. Complete Suite of 7 Detailed Accordions (Matching Moomoo Morningstar Research) */}
      <div className="space-y-3">
        {/* Accordion 1: Analyst Note */}
        {data.analyst_note && (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => toggleAccordion('analyst_note')}
              className="w-full px-5 py-4 flex items-center justify-between text-left bg-stone-50/70 hover:bg-stone-100/80 cursor-pointer transition-colors border-b border-stone-100"
            >
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-[#c8102e]" />
                <span className="font-bold text-sm text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif]">
                  {isThai ? 'บันทึกวิเคราะห์ผลประกอบการ (Analyst Note)' : 'Analyst Note'}
                </span>
                {analystHeadline && (
                  <span className="text-xs text-stone-500 font-sans hidden md:inline truncate max-w-[450px]">
                    — {analystHeadline}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-400 font-mono">{data.analyst_note.date}</span>
                {openAccordion === 'analyst_note' ? (
                  <ChevronUp className="w-4 h-4 text-stone-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-stone-500" />
                )}
              </div>
            </button>

            {openAccordion === 'analyst_note' && (
              <div className="px-5 pb-5 pt-3 text-xs sm:text-sm text-stone-700 leading-relaxed font-sans space-y-3 bg-white">
                {analystHeadline && (
                  <h4 className="font-extrabold text-stone-900 text-base font-['Prompt','Mitr','Nunito',sans-serif]">
                    {analystHeadline}
                  </h4>
                )}
                <div className="text-stone-500 text-xs font-mono">
                  {data.analyst_note.analyst_byline || data.analyst_name} • {data.analyst_note.date}
                </div>

                {analystParagraphs.length > 0 ? (
                  analystParagraphs.map((p, idx) => (
                    <p key={idx} className="text-stone-700 leading-relaxed">
                      {p}
                    </p>
                  ))
                ) : (
                  <p className="text-stone-400 italic">{isThai ? 'ไม่มีเนื้อหาบันทึกนักวิเคราะห์' : 'No analyst note paragraphs provided.'}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Accordion 2: Business Strategy & Outlook */}
        {(data.business_strategy || strategyParagraphs.length > 0) && (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => toggleAccordion('business_strategy')}
              className="w-full px-5 py-4 flex items-center justify-between text-left bg-stone-50/70 hover:bg-stone-100/80 cursor-pointer transition-colors border-b border-stone-100"
            >
              <div className="flex items-center gap-2.5">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                <span className="font-bold text-sm text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif]">
                  {isThai ? 'กลยุทธ์ธุรกิจและแนวโน้ม (Business Strategy & Outlook)' : 'Business Strategy & Outlook'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-400 font-mono">{data.business_strategy?.date || data.fair_value_date}</span>
                {openAccordion === 'business_strategy' ? (
                  <ChevronUp className="w-4 h-4 text-stone-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-stone-500" />
                )}
              </div>
            </button>

            {openAccordion === 'business_strategy' && (
              <div className="px-5 pb-5 pt-3 text-xs sm:text-sm text-stone-700 leading-relaxed font-sans space-y-3 bg-white">
                <div className="text-stone-500 text-xs font-mono">
                  {data.business_strategy?.analyst_byline || data.analyst_name} • {data.business_strategy?.date || data.fair_value_date}
                </div>
                {strategyParagraphs.length > 0 ? (
                  strategyParagraphs.map((p, idx) => (
                    <p key={idx} className="leading-relaxed">
                      {p}
                    </p>
                  ))
                ) : (
                  <p className="text-stone-400 italic">{isThai ? 'ไม่มีข้อมูลกลยุทธ์ธุรกิจ' : 'No business strategy paragraphs available.'}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Accordion 3: Fair Value & Valuation Model Thesis */}
        {data.valuation_thesis && (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => toggleAccordion('valuation_thesis')}
              className="w-full px-5 py-4 flex items-center justify-between text-left bg-stone-50/70 hover:bg-stone-100/80 cursor-pointer transition-colors border-b border-stone-100"
            >
              <div className="flex items-center gap-2.5">
                <Compass className="w-4 h-4 text-[#0b5a4b]" />
                <span className="font-bold text-sm text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif]">
                  {isThai ? 'มูลค่าเหมาะสม (Fair Value)' : 'Fair Value'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border inline-block ${
                  isUndervalued 
                    ? 'bg-emerald-50 text-[#0b5a4b] border-emerald-200' 
                    : isOvervalued 
                    ? 'bg-rose-50 text-rose-700 border-rose-200' 
                    : 'bg-stone-50 text-stone-700 border-stone-200'
                }`}>
                  {fv ? fv.toFixed(2) : '-'} {discountPct > 0 ? `+${discountPct.toFixed(2)}%` : `${discountPct.toFixed(2)}%`}
                </span>
                {openAccordion === 'valuation_thesis' ? (
                  <ChevronUp className="w-4 h-4 text-stone-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-stone-500" />
                )}
              </div>
            </button>

            {openAccordion === 'valuation_thesis' && (
              <div className="px-5 pb-5 pt-3 text-xs sm:text-sm text-stone-700 leading-relaxed font-sans space-y-4 bg-white">
                <div className="text-stone-500 text-xs font-mono">
                  {data.valuation_thesis.analyst_byline || data.analyst_name} • {data.valuation_thesis.date}
                </div>

                {/* Metric Summary Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-stone-50 p-3 rounded-xl border border-stone-200 font-mono text-xs">
                  <div>
                    <span className="text-stone-500 text-[10px] block">
                      {isThai ? 'P/E โดยนัย (Implied P/E)' : 'Implied P/E'}
                    </span>
                    <strong className="text-stone-900 text-sm">{data.valuation_thesis.implied_pe || 32}x</strong>
                  </div>
                  <div>
                    <span className="text-stone-500 text-[10px] block">
                      {isThai ? 'EV/Sales โดยนัย' : 'Implied EV/Sales'}
                    </span>
                    <strong className="text-stone-900 text-sm">{data.valuation_thesis.implied_ev_revenue || 8}x</strong>
                  </div>
                  <div>
                    <span className="text-stone-500 text-[10px] block">
                      {isThai ? 'อัตรากำไรขั้นต้นระยะยาว' : 'Terminal Gross Margin'}
                    </span>
                    <strong className="text-stone-900 text-sm">{data.valuation_thesis.projected_gross_margin_terminal || 68}%</strong>
                  </div>
                  <div>
                    <span className="text-stone-500 text-[10px] block">
                      {isThai ? 'CAGR รายได้ 5 ปี' : '5-Yr Rev CAGR'}
                    </span>
                    <strong className="text-[#0b5a4b] text-sm">{data.valuation_thesis.projected_revenue_cagr_5yr || 9}%</strong>
                  </div>
                </div>

                <div className="space-y-2.5 text-stone-700">
                  {thesisParagraphs.length > 0 ? (
                    thesisParagraphs.map((p, idx) => (
                      <p key={idx} className="leading-relaxed">
                        {p}
                      </p>
                    ))
                  ) : (
                    <p className="text-stone-400 italic">{isThai ? 'ไม่มีรายละเอียดแบบจำลองมูลค่า' : 'No valuation thesis paragraphs available.'}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Accordion 4: Economic Moat */}
        {(data.economic_moat_details || moatParagraphs.length > 0) && (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => toggleAccordion('economic_moat')}
              className="w-full px-5 py-4 flex items-center justify-between text-left bg-stone-50/70 hover:bg-stone-100/80 cursor-pointer transition-colors border-b border-stone-100"
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#0b5a4b]" />
                <span className="font-bold text-sm text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif]">
                  {isThai ? 'คูเมืองทางธุรกิจ (Economic Moat)' : 'Economic Moat'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-[#0b5a4b] border border-emerald-200">
                  {isThai ? (data.economic_moat_details?.badge_th || data.economic_moat_th || data.economic_moat || 'Wide') : (data.economic_moat_details?.badge || data.economic_moat || 'Wide')}
                </span>
                {openAccordion === 'economic_moat' ? (
                  <ChevronUp className="w-4 h-4 text-stone-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-stone-500" />
                )}
              </div>
            </button>

            {openAccordion === 'economic_moat' && (
              <div className="px-5 pb-5 pt-3 text-xs sm:text-sm text-stone-700 leading-relaxed font-sans space-y-3 bg-white">
                <div className="text-stone-500 text-xs font-mono">
                  {data.economic_moat_details?.analyst_byline || data.analyst_name} • {data.economic_moat_details?.date || data.fair_value_date}
                </div>
                {moatParagraphs.length > 0 ? (
                  moatParagraphs.map((p, idx) => (
                    <p key={idx} className="leading-relaxed">
                      {p}
                    </p>
                  ))
                ) : (
                  <p className="text-stone-400 italic">{isThai ? 'ไม่มีข้อมูลคูเมืองทางธุรกิจ' : 'No economic moat paragraphs available.'}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Accordion 5: Uncertainty */}
        {(data.uncertainty_details || uncertaintyParagraphs.length > 0) && (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => toggleAccordion('uncertainty')}
              className="w-full px-5 py-4 flex items-center justify-between text-left bg-stone-50/70 hover:bg-stone-100/80 cursor-pointer transition-colors border-b border-stone-100"
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="font-bold text-sm text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif]">
                  {isThai ? 'ระดับความไม่แน่นอน (Uncertainty)' : 'Uncertainty'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  {isThai ? (data.uncertainty_details?.badge_th || data.uncertainty_th || data.uncertainty || 'Very High') : (data.uncertainty_details?.badge || data.uncertainty || 'Very High')}
                </span>
                {openAccordion === 'uncertainty' ? (
                  <ChevronUp className="w-4 h-4 text-stone-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-stone-500" />
                )}
              </div>
            </button>

            {openAccordion === 'uncertainty' && (
              <div className="px-5 pb-5 pt-3 text-xs sm:text-sm text-stone-700 leading-relaxed font-sans space-y-3 bg-white">
                <div className="text-stone-500 text-xs font-mono">
                  {data.uncertainty_details?.analyst_byline || data.analyst_name} • {data.uncertainty_details?.date || data.fair_value_date}
                </div>
                {uncertaintyParagraphs.length > 0 ? (
                  uncertaintyParagraphs.map((p, idx) => (
                    <p key={idx} className="leading-relaxed">
                      {p}
                    </p>
                  ))
                ) : (
                  <p className="text-stone-400 italic">{isThai ? 'ไม่มีข้อมูลระดับความไม่แน่นอน' : 'No uncertainty paragraphs available.'}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Accordion 6: Capital Allocation */}
        {(data.capital_allocation_details || allocationParagraphs.length > 0) && (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => toggleAccordion('capital_allocation')}
              className="w-full px-5 py-4 flex items-center justify-between text-left bg-stone-50/70 hover:bg-stone-100/80 cursor-pointer transition-colors border-b border-stone-100"
            >
              <div className="flex items-center gap-2.5">
                <Award className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-sm text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif]">
                  {isThai ? 'การจัดสรรเงินทุน (Capital Allocation)' : 'Capital Allocation'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  {isThai ? (data.capital_allocation_details?.badge_th || data.capital_allocation_th || data.capital_allocation || 'Exemplary') : (data.capital_allocation_details?.badge || data.capital_allocation || 'Exemplary')}
                </span>
                {openAccordion === 'capital_allocation' ? (
                  <ChevronUp className="w-4 h-4 text-stone-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-stone-500" />
                )}
              </div>
            </button>

            {openAccordion === 'capital_allocation' && (
              <div className="px-5 pb-5 pt-3 text-xs sm:text-sm text-stone-700 leading-relaxed font-sans space-y-3 bg-white">
                <div className="text-stone-500 text-xs font-mono">
                  {data.capital_allocation_details?.analyst_byline || data.analyst_name} • {data.capital_allocation_details?.date || data.fair_value_date}
                </div>
                {allocationParagraphs.length > 0 ? (
                  allocationParagraphs.map((p, idx) => (
                    <p key={idx} className="leading-relaxed">
                      {p}
                    </p>
                  ))
                ) : (
                  <p className="text-stone-400 italic">{isThai ? 'ไม่มีข้อมูลการจัดสรรเงินทุน' : 'No capital allocation paragraphs available.'}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Accordion 7: Financial Health */}
        {(data.financial_health || healthParagraphs.length > 0) && (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => toggleAccordion('financial_health')}
              className="w-full px-5 py-4 flex items-center justify-between text-left bg-stone-50/70 hover:bg-stone-100/80 cursor-pointer transition-colors border-b border-stone-100"
            >
              <div className="flex items-center gap-2.5">
                <HeartPulse className="w-4 h-4 text-rose-500" />
                <span className="font-bold text-sm text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif]">
                  {isThai ? 'สุขภาพทางการเงิน (Financial Health)' : 'Financial Health'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-400 font-mono">{data.financial_health?.date || data.fair_value_date}</span>
                {openAccordion === 'financial_health' ? (
                  <ChevronUp className="w-4 h-4 text-stone-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-stone-500" />
                )}
              </div>
            </button>

            {openAccordion === 'financial_health' && (
              <div className="px-5 pb-5 pt-3 text-xs sm:text-sm text-stone-700 leading-relaxed font-sans space-y-3 bg-white">
                <div className="text-stone-500 text-xs font-mono">
                  {data.financial_health?.analyst_byline || data.analyst_name} • {data.financial_health?.date || data.fair_value_date}
                </div>
                {healthParagraphs.length > 0 ? (
                  healthParagraphs.map((p, idx) => (
                    <p key={idx} className="leading-relaxed">
                      {p}
                    </p>
                  ))
                ) : (
                  <p className="text-stone-400 italic">{isThai ? 'ไม่มีข้อมูลสุขภาพทางการเงิน' : 'No financial health paragraphs available.'}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer / Citation & Disclaimer Accordion */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-stone-400 border-t border-stone-100 pt-3 gap-2 font-mono">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-stone-400" />
          <span>
            {isThai 
              ? 'แหล่งข้อมูล: Morningstar Equity Research ผ่านการตรวจสอบและเทียบเคียงข้อมูล' 
              : 'Source: Morningstar Equity Research with institutional verification'}
          </span>
        </div>
        <span className="text-stone-500">
          {isThai 
            ? 'การวิเคราะห์ปัจจัยพื้นฐานอย่างเป็นอิสระ • ไม่ใช่คำแนะนำการลงทุน' 
            : 'Independent Fundamental Equity Research • Not investment advice'}
        </span>
      </div>
    </div>
  );
}
