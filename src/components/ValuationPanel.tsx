import React from 'react';
import { motion } from 'motion/react';
import { 
  Gauge, TrendingUp, TrendingDown, Scale, HelpCircle, 
  Info, BarChart3, AlertCircle, ArrowUpRight 
} from 'lucide-react';
import { ValuationRatioItem, ValuationPercentileChart } from '../types';

interface Props {
  ratios?: ValuationRatioItem[];
  percentileChart?: ValuationPercentileChart;
  isThai: boolean;
  ticker?: string;
}

export function ValuationPanel({ 
  ratios = [], 
  percentileChart, 
  isThai,
  ticker = 'STOCK' 
}: Props) {
  if (!ratios || ratios.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-stone-200 text-stone-500 text-center italic">
        {isThai ? 'ไม่มีข้อมูลอัตราส่วน Valuation' : 'No valuation ratio data available.'}
      </div>
    );
  }

  const getVerdictBadge = (ratio: ValuationRatioItem) => {
    let rawVerdict = (ratio.verdict || '').toLowerCase();
    const name = (ratio.name || '').toLowerCase();
    const val = ratio.value;

    // Intelligent standard threshold validation for PEG Ratio:
    // PEG > 3.0 = very_expensive, PEG > 2.0 = expensive, PEG 1.0 - 2.0 = fair, PEG < 1.0 = cheap
    if (name.includes('peg') && typeof val === 'number' && val > 0) {
      if (val > 3.0) {
        rawVerdict = 'very_expensive';
      } else if (val > 2.0) {
        rawVerdict = 'expensive';
      } else if (val >= 1.0) {
        rawVerdict = 'fair';
      } else if (val < 1.0) {
        rawVerdict = 'cheap';
      }
    }

    if (rawVerdict.includes('very_cheap') || rawVerdict.includes('ถูกมาก')) {
      return {
        label: isThai ? 'ถูกมาก' : 'Very Cheap',
        bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        dot: 'bg-emerald-600'
      };
    }
    if (rawVerdict.includes('cheap') || rawVerdict.includes('ถูก')) {
      return {
        label: isThai ? 'ถูก' : 'Cheap',
        bg: 'bg-teal-100 text-teal-800 border-teal-300',
        dot: 'bg-teal-600'
      };
    }
    if (rawVerdict.includes('very_expensive') || rawVerdict.includes('แพงมาก')) {
      return {
        label: isThai ? 'แพงมาก' : 'Very Expensive',
        bg: 'bg-red-100 text-red-800 border-red-300',
        dot: 'bg-red-600'
      };
    }
    if (rawVerdict.includes('expensive') || rawVerdict.includes('แพง')) {
      return {
        label: isThai ? 'ค่อนข้างแพง' : 'Expensive',
        bg: 'bg-orange-100 text-orange-800 border-orange-300',
        dot: 'bg-orange-600'
      };
    }
    if (rawVerdict.includes('fair') || rawVerdict.includes('เหมาะสม') || rawVerdict.includes('สมเหตุ')) {
      return {
        label: isThai ? 'ราคาสมเหตุผล' : 'Fair Value',
        bg: 'bg-amber-100 text-amber-800 border-amber-300',
        dot: 'bg-amber-600'
      };
    }
    return {
      label: ratio.verdict || (isThai ? 'ไม่ระบุ' : 'N/A'),
      bg: 'bg-stone-100 text-stone-800 border-stone-300',
      dot: 'bg-stone-500'
    };
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Hero 5-Year Historical Range Visualizer (if provided) */}
      {percentileChart && (
        <div 
          className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-sm flex flex-col gap-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#0b5a4b]" />
              <h3 className="font-bold text-stone-900 text-base sm:text-lg">
                {isThai ? 'ตำแหน่ง P/E เทียบกับกรอบประวัติศาสตร์ 5 ปี' : '5-Year Valuation Range (P/E Percentile)'}
              </h3>
            </div>
            <span className="text-xs text-stone-500 font-mono">
              {ticker.toUpperCase()} 5-Yr History
            </span>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <div className="flex justify-between items-center text-xs sm:text-sm font-mono text-stone-600">
              <div>
                <span className="text-stone-400 block text-[10px] uppercase font-bold">{isThai ? 'ต่ำสุด 5 ปี' : '5-Yr Min'}</span>
                <span className="font-bold text-stone-700">{percentileChart.min_5yr ? `${percentileChart.min_5yr}x` : 'N/A'}</span>
              </div>
              <div className="text-center">
                <span className="text-stone-400 block text-[10px] uppercase font-bold">{isThai ? 'ค่ามัธยฐาน 5 ปี' : '5-Yr Median'}</span>
                <span className="font-bold text-stone-800">{percentileChart.median_5yr ? `${percentileChart.median_5yr}x` : 'N/A'}</span>
              </div>
              <div className="text-right">
                <span className="text-stone-400 block text-[10px] uppercase font-bold">{isThai ? 'สูงสุด 5 ปี' : '5-Yr Max'}</span>
                <span className="font-bold text-stone-700">{percentileChart.max_5yr ? `${percentileChart.max_5yr}x` : 'N/A'}</span>
              </div>
            </div>

            {/* Horizontal Range Spectrum */}
            {percentileChart.min_5yr !== undefined && percentileChart.max_5yr !== undefined && percentileChart.current !== undefined && (
              <div className="relative pt-6 pb-2">
                <div className="h-3 rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500 w-full relative shadow-inner">
                  {/* Median marker */}
                  {percentileChart.median_5yr && (
                    <div 
                      className="absolute top-0 bottom-0 w-0.5 bg-stone-900/60 z-10"
                      style={{ 
                        left: `${Math.max(0, Math.min(100, ((percentileChart.median_5yr - percentileChart.min_5yr) / (percentileChart.max_5yr - percentileChart.min_5yr)) * 100))}%` 
                      }}
                      title={`Median: ${percentileChart.median_5yr}x`}
                    />
                  )}
                </div>

                {/* Current Value Pin */}
                {(() => {
                  const range = (percentileChart.max_5yr || 1) - (percentileChart.min_5yr || 0);
                  const pos = range > 0 ? Math.max(2, Math.min(98, (((percentileChart.current || 0) - (percentileChart.min_5yr || 0)) / range) * 100)) : 50;
                  return (
                    <div 
                      className="absolute -top-1 -translate-x-1/2 flex flex-col items-center z-20"
                      style={{ left: `${pos}%` }}
                    >
                      <div className="bg-stone-900 text-white text-[11px] font-mono font-bold px-2 py-0.5 rounded shadow-sm whitespace-nowrap mb-0.5">
                        {isThai ? 'ปัจจุบัน' : 'Current'}: {percentileChart.current}x
                      </div>
                      <div className="w-2.5 h-2.5 bg-stone-900 rotate-45 -mt-1 shadow-sm" />
                    </div>
                  );
                })()}

                {/* Legend labels */}
                <div className="flex justify-between text-[10px] text-stone-400 font-medium pt-3">
                  <span className="text-emerald-700 font-semibold">{isThai ? 'โซนถูก (Cheap)' : 'Cheap Zone'}</span>
                  <span className="text-amber-700 font-semibold">{isThai ? 'โซนสมเหตุผล (Fair)' : 'Fair Zone'}</span>
                  <span className="text-red-700 font-semibold">{isThai ? 'โซนแพง (Expensive)' : 'Expensive Zone'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grid of Valuation Ratio Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {ratios.map((ratio, idx) => {
          const badge = getVerdictBadge(ratio);
          const hasValue = ratio.value !== null && ratio.value !== undefined;

          return (
            <div
              key={idx}
              className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm flex flex-col justify-between hover:border-stone-300 transition-all gap-3"
            >
              {/* Card Header: Ratio Name & Verdict Badge */}
              <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-3">
                <div>
                  <h4 className="font-bold text-stone-900 text-base tracking-tight">{ratio.name}</h4>
                  {ratio.formula && (
                    <span className="text-[11px] text-stone-600 block mt-0.5 line-clamp-1 font-sans" title={ratio.formula}>
                      {ratio.formula}
                    </span>
                  )}
                </div>
                <div className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 shrink-0 ${badge.bg}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                  <span>{badge.label}</span>
                </div>
              </div>

              {/* Value & Comparison Metrics */}
              <div className="flex flex-col gap-2 my-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold font-mono text-stone-900 tracking-tight">
                    {hasValue ? `${ratio.value}${ratio.unit || 'x'}` : 'N/A'}
                  </span>
                  {ratio.peer_avg !== null && ratio.peer_avg !== undefined && (
                    <div className="text-right text-xs text-stone-500">
                      <span className="block text-[10px] text-stone-400 uppercase font-semibold">{isThai ? 'ค่าเฉลี่ยกลุ่ม' : 'Peer Avg'}</span>
                      <span className="font-mono font-bold text-stone-700">{ratio.peer_avg}{ratio.unit || 'x'}</span>
                    </div>
                  )}
                </div>

                {/* 5-Yr Percentile Bar */}
                {ratio.own_5yr_percentile !== null && ratio.own_5yr_percentile !== undefined && (
                  <div className="flex flex-col gap-1 mt-1">
                    <div className="flex justify-between text-[11px] text-stone-500 font-medium">
                      <span>{isThai ? 'เปอร์เซ็นไทล์ 5 ปี' : '5-Yr Percentile'}</span>
                      <span className="font-mono font-bold text-stone-700">{ratio.own_5yr_percentile}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden w-full">
                      <div 
                        className={`h-full rounded-full ${
                          ratio.own_5yr_percentile > 80 ? 'bg-red-500' :
                          ratio.own_5yr_percentile > 60 ? 'bg-orange-500' :
                          ratio.own_5yr_percentile > 40 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, ratio.own_5yr_percentile))}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Interpretation Note */}
              {ratio.interpretation && (
                <div className="pt-2.5 border-t border-stone-100 text-xs text-stone-600 leading-relaxed font-sans bg-stone-50/50 p-2.5 rounded-xl">
                  {ratio.interpretation}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

