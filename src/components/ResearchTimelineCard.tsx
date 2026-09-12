import React, { useMemo, useState } from 'react';
import {
  Clock, TrendingUp, TrendingDown, ArrowRight, History,
  ChevronDown, ChevronUp, Scale, Sparkles, ShieldCheck, Layers
} from 'lucide-react';
import { ReportData } from '../types';
import {
  buildResearchTimeline,
  computeHistoricalDelta,
  extractReportDate,
  getPreviousReport
} from '../utils/researchTimeline';
import { ProvenanceBadge } from './ProvenanceBadge';

interface Props {
  ticker: string;
  currentReport: ReportData;
  historyReports?: any[];
  isThai: boolean;
}

export function ResearchTimelineCard({
  ticker,
  currentReport,
  historyReports = [],
  isThai
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  const timeline = useMemo(() => {
    return buildResearchTimeline(ticker, historyReports, currentReport);
  }, [ticker, historyReports, currentReport]);

  const previousReport = useMemo(() => {
    return getPreviousReport(ticker, historyReports, currentReport);
  }, [ticker, historyReports, currentReport]);

  const delta = useMemo(() => {
    if (!previousReport) return null;
    return computeHistoricalDelta(currentReport, previousReport);
  }, [currentReport, previousReport]);

  // If there is only 1 report and no previous history, show an initial baseline badge
  if (timeline.length <= 1 && !delta) {
    return null;
  }

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-xs flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-stone-100 text-[#0b5a4b] flex items-center justify-center shadow-2xs shrink-0">
            <History className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight">
                {isThai ? 'ไทม์ไลน์งานวิจัย & สิ่งที่เปลี่ยนแปลง (Research Timeline & What Changed)' : 'Research Timeline & Historical Deltas'}
              </h3>
              <ProvenanceBadge classification="calculated" isThai={isThai} size="xs" />
            </div>
            <p className="text-xs text-stone-500 font-sans">
              {isThai
                ? `เปรียบเทียบข้อเท็จจริงกับบทวิเคราะห์ก่อนหน้า (${timeline.length > 1 ? timeline.length - 1 : 0} บันทึกประวัติศาสตร์)`
                : `Empirical comparison across ${timeline.length} documented analysis snapshots`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 transition-colors flex items-center gap-1 cursor-pointer"
        >
          <span>{isExpanded ? (isThai ? 'ย่อ' : 'Collapse') : (isThai ? 'ดูไทม์ไลน์' : 'Expand Timeline')}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Primary What Changed Delta Box */}
      {delta && (
        <div className="bg-stone-50/90 rounded-2xl p-4 border border-stone-200/90 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-stone-500 font-mono">
            <span>
              {isThai ? 'ช่วงห่างจากบทวิเคราะห์ก่อนหน้า:' : 'Elapsed Since Prior Report:'} <strong>{delta.daysBetween} {isThai ? 'วัน' : 'days'}</strong> ({delta.previousReportDate} → {delta.currentReportDate})
            </span>
            <span className="text-[10px] uppercase font-bold text-stone-400">
              {isThai ? 'ตัวเลขจริง ไม่ใช่คำบรรยายแต่งเติม' : 'Empirical Deltas Only'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Market Price Change */}
            {delta.priceDelta && (
              <div className="p-3 bg-white rounded-xl border border-stone-200/80 flex flex-col">
                <span className="text-[10px] font-mono uppercase font-bold text-stone-400">
                  {isThai ? 'ราคาตลาด' : 'Market Price'}
                </span>
                <span className="text-sm font-mono font-bold text-stone-900 mt-0.5">
                  ${delta.priceDelta.previous.toFixed(2)} → ${delta.priceDelta.current.toFixed(2)}
                </span>
                <span className={`text-[10px] font-mono font-bold mt-0.5 ${delta.priceDelta.deltaPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {delta.priceDelta.deltaPct >= 0 ? '+' : ''}{delta.priceDelta.deltaPct.toFixed(2)}%
                </span>
              </div>
            )}

            {/* Base Fair Value Change */}
            {delta.fairValueDelta && (
              <div className="p-3 bg-white rounded-xl border border-stone-200/80 flex flex-col">
                <span className="text-[10px] font-mono uppercase font-bold text-stone-400">
                  {isThai ? 'มูลค่าแท้จริง DCF' : 'Base Fair Value'}
                </span>
                <span className="text-sm font-mono font-bold text-[#0b5a4b] mt-0.5">
                  ${delta.fairValueDelta.previous.toFixed(2)} → ${delta.fairValueDelta.current.toFixed(2)}
                </span>
                <span className={`text-[10px] font-mono font-bold mt-0.5 ${delta.fairValueDelta.deltaPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {delta.fairValueDelta.deltaPct >= 0 ? '+' : ''}{delta.fairValueDelta.deltaPct.toFixed(2)}%
                </span>
              </div>
            )}

            {/* Conviction Score Delta */}
            {delta.convictionScoreDelta && (
              <div className="p-3 bg-white rounded-xl border border-stone-200/80 flex flex-col">
                <span className="text-[10px] font-mono uppercase font-bold text-stone-400">
                  {isThai ? 'คะแนน Conviction' : 'Conviction Score'}
                </span>
                <span className="text-sm font-mono font-bold text-stone-900 mt-0.5">
                  {delta.convictionScoreDelta.previous} → {delta.convictionScoreDelta.current}
                </span>
                <span className={`text-[10px] font-mono font-bold mt-0.5 ${delta.convictionScoreDelta.deltaPoints >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {delta.convictionScoreDelta.deltaPoints >= 0 ? '+' : ''}{delta.convictionScoreDelta.deltaPoints} pts
                </span>
              </div>
            )}

            {/* Operating Margin Delta */}
            {delta.operatingMarginDelta && (
              <div className="p-3 bg-white rounded-xl border border-stone-200/80 flex flex-col">
                <span className="text-[10px] font-mono uppercase font-bold text-stone-400">
                  {isThai ? 'Operating Margin' : 'Operating Margin'}
                </span>
                <span className="text-sm font-mono font-bold text-stone-900 mt-0.5">
                  {delta.operatingMarginDelta.previous}% → {delta.operatingMarginDelta.current}%
                </span>
                <span className={`text-[10px] font-mono font-bold mt-0.5 ${delta.operatingMarginDelta.deltaPctPoints >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {delta.operatingMarginDelta.deltaPctPoints >= 0 ? '+' : ''}{delta.operatingMarginDelta.deltaPctPoints.toFixed(2)}% pts
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detailed Chronological Timeline Steps */}
      {isExpanded && (
        <div className="flex flex-col gap-3 pt-2">
          <span className="text-xs font-bold text-stone-700 uppercase tracking-wider font-mono">
            {isThai ? 'ประวัติรายงานตามลำดับเวลา' : 'Chronological Analysis History'}
          </span>
          <div className="relative pl-6 border-l-2 border-stone-200 space-y-4 my-2">
            {timeline.map((entry, idx) => {
              const isCurrent = idx === 0;
              return (
                <div key={entry.id || idx} className="relative group">
                  {/* Timeline dot */}
                  <div className={`absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full border-2 bg-white ${
                    isCurrent ? 'border-[#0b5a4b] ring-4 ring-emerald-100' : 'border-stone-400'
                  }`} />

                  <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-stone-900">{entry.reportDate}</span>
                        {isCurrent && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-[#0b5a4b] uppercase font-mono">
                            {isThai ? 'ปัจจุบัน' : 'Current'}
                          </span>
                        )}
                        <span className="text-[10px] text-stone-500 font-sans">
                          {entry.analysisType}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-mono text-stone-700 mt-1">
                        {entry.marketPrice && (
                          <span>{isThai ? 'ราคา:' : 'Price:'} <strong>${entry.marketPrice.toFixed(2)}</strong></span>
                        )}
                        {entry.fairValue && (
                          <span>{isThai ? 'มูลค่าแท้จริง:' : 'Fair Value:'} <strong className="text-[#0b5a4b]">${entry.fairValue.toFixed(2)}</strong></span>
                        )}
                        {entry.marginOfSafetyPct !== null && entry.marginOfSafetyPct !== undefined && (
                          <span className={entry.marginOfSafetyPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                            MoS: {entry.marginOfSafetyPct > 0 ? '+' : ''}{entry.marginOfSafetyPct.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {typeof entry.convictionScore === 'number' && (
                      <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 font-mono">
                        <span className="text-[10px] text-stone-400 uppercase font-bold">Conviction:</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-stone-900 text-amber-300">
                          {entry.convictionScore}/100
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
