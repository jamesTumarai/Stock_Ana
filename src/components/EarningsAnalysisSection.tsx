import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Calendar, Clock, Award, TrendingUp, TrendingDown, 
  ArrowUpRight, ArrowDownRight, Eye, Sparkles, CheckCircle2, XCircle, AlertCircle 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { EarningsAnalysisData } from '../types';

interface Props {
  data?: EarningsAnalysisData;
  isThai: boolean;
  ticker?: string;
}

function formatMillionsToBillion(valInMillions?: number | null): string {
  if (valInMillions === undefined || valInMillions === null) return '-';
  if (Math.abs(valInMillions) >= 1000) {
    const inBillion = valInMillions / 1000;
    return `$${inBillion.toFixed(2).replace(/\.?0+$/, '')}B`;
  }
  return `$${valInMillions}M`;
}

export function EarningsAnalysisSection({ 
  data, 
  isThai, 
  ticker = 'STOCK' 
}: Props) {
  const [metricTab, setMetricTab] = useState<'eps' | 'revenue'>('eps');

  if (!data) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-stone-200 text-stone-500 text-center italic">
        {isThai ? 'ไม่มีข้อมูลการวิเคราะห์ผลประกอบการ (Earnings Analysis)' : 'No earnings analysis data available.'}
      </div>
    );
  }

  const pastHistory = data.past_earnings_history || [];
  const streak = data.beat_streak;
  const currentSetup = data.current_quarter_setup;
  const revisions = data.estimate_revisions_trend;
  const guidance = data.full_year_guidance;

  // Format data for Recharts
  const chartData = pastHistory.map(item => ({
    period: item.period,
    report_date: item.report_date,
    eps_estimate: item.eps_estimate,
    eps_actual: item.eps_actual,
    eps_surprise_pct: item.eps_surprise_pct,
    revenue_estimate_musd: item.revenue_estimate_musd,
    revenue_actual_musd: item.revenue_actual_musd,
    revenue_surprise_pct: item.revenue_surprise_pct,
    stock_reaction_1d_pct: item.stock_reaction_1d_pct,
    beat_or_miss: item.beat_or_miss
  }));

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* 1. TOP ROW: COUNTDOWN CARD & BEAT STREAK HERO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Next Earnings Countdown Card (Clean Light Report Aesthetic) */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-stone-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between border-b border-stone-100 pb-4">
            <div className="flex items-center gap-2.5">
              <Calendar className="w-5 h-5 text-[#0b5a4b]" />
              <h3 className="font-bold text-stone-900 text-base sm:text-lg font-['Prompt','Mitr','Nunito',sans-serif]">
                {isThai ? 'วันประกาศงบไตรมาสถัดไป' : 'Next Earnings Report'}
              </h3>
            </div>
            {data.next_earnings_date_confirmed !== undefined && (
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border shadow-2xs ${
                data.next_earnings_date_confirmed 
                  ? 'bg-emerald-50 text-[#0b5a4b] border-emerald-200/80' 
                  : 'bg-amber-50 text-amber-800 border-amber-200/80'
              }`}>
                {data.next_earnings_date_confirmed 
                  ? (isThai ? 'ยืนยันวันที่แล้ว' : 'Confirmed Date') 
                  : (isThai ? 'คาดการณ์ (ยังไม่ยืนยัน)' : 'Estimated Date')}
              </span>
            )}
          </div>

          <div className="my-5 flex items-baseline justify-between">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-extrabold font-mono text-[#0b5a4b]">
                  {data.days_until_next_earnings !== undefined ? data.days_until_next_earnings : '--'}
                </span>
                <span className="text-lg text-stone-600 font-medium font-sans">
                  {isThai ? 'วันข้างหน้า' : 'days left'}
                </span>
              </div>
              <span className="text-xs text-stone-500 font-mono mt-1 block">
                {isThai ? 'วันที่คาดการณ์: ' : 'Expected: '}<strong className="text-stone-800">{data.next_earnings_date || 'TBA'}</strong>
              </span>
            </div>

            {data.average_earnings_day_move_pct !== undefined && (
              <div className="text-right bg-stone-50 p-3 rounded-2xl border border-stone-200 shadow-2xs">
                <span className="text-[10px] text-stone-500 uppercase font-bold block">
                  {isThai ? 'ความผันผวนเฉลี่ยวันประกาศ' : 'Avg Earnings Day Move'}
                </span>
                <span className="text-lg font-mono font-bold text-stone-900">
                  ±{data.average_earnings_day_move_pct}%
                </span>
              </div>
            )}
          </div>

          {currentSetup && (
            <div className="text-xs text-stone-700 bg-stone-50 p-3.5 rounded-2xl flex items-center justify-between font-mono border border-stone-200">
              <span>{isThai ? 'เป้า Consensus EPS:' : 'Consensus EPS:'} <strong className="text-stone-900">${currentSetup.consensus_estimate_eps || '-'}</strong></span>
              <span>{isThai ? 'เป้ารายได้:' : 'Consensus Rev:'} <strong className="text-stone-900">{formatMillionsToBillion(currentSetup.consensus_estimate_revenue_musd)}</strong></span>
            </div>
          )}
        </div>

        {/* Beat Streak Tracker */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-stone-200 shadow-sm flex flex-col justify-between gap-4">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-4">
            <Award className="w-5 h-5 text-[#0b5a4b]" />
            <h3 className="font-bold text-stone-900 text-base sm:text-lg">
              {isThai ? 'สถิติการทำผลงานชนะเป้า (Beat Streak Track Record)' : 'Earnings Beat Streak Record'}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4 my-2">
            <div className="bg-stone-50/90 p-4 rounded-2xl border border-stone-200/80 flex flex-col">
              <span className="text-xs text-stone-600 font-bold uppercase tracking-wider">
                {isThai ? 'ชนะเป้ากำไร (EPS Beat)' : 'EPS Beat Streak'}
              </span>
              <span className="text-3xl sm:text-4xl font-extrabold font-mono text-[#0b5a4b] mt-1">
                {streak?.eps_beat_streak_quarters || pastHistory.length} <span className="text-base font-sans font-normal text-stone-600">{isThai ? 'ไตรมาสติด' : 'Qs'}</span>
              </span>
            </div>

            <div className="bg-stone-50/90 p-4 rounded-2xl border border-stone-200/80 flex flex-col">
              <span className="text-xs text-stone-600 font-bold uppercase tracking-wider">
                {isThai ? 'ชนะเป้ารายได้ (Rev Beat)' : 'Revenue Beat'}
              </span>
              <span className="text-3xl sm:text-4xl font-extrabold font-mono text-[#0b5a4b] mt-1">
                {streak?.revenue_beat_streak_quarters || pastHistory.length} <span className="text-base font-sans font-normal text-stone-600">{isThai ? 'ไตรมาสติด' : 'Qs'}</span>
              </span>
            </div>
          </div>

          <p className="text-xs text-stone-600 leading-relaxed font-sans bg-stone-50 p-3 rounded-2xl border border-stone-100">
            {streak?.commentary || (isThai ? 'บริษัทมีประวัติการส่งมอบผลงานชนะความคาดหมายนักวิเคราะห์อย่างต่อเนื่อง สะท้อนการให้ Guidance ที่ Conservative และการบริหารจัดการที่มีประสิทธิภาพ' : 'Consistent execution exceeding guidance and consensus estimates.')}
          </p>
        </div>
      </div>

      {/* 2. HISTORICAL BEAT / MISS CHART & REACTION OVERLAY */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-stone-200 shadow-sm flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div>
            <h3 className="font-bold text-stone-900 text-lg sm:text-xl font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight">
              {isThai ? 'ประวัติผลประกอบการย้อนหลัง (Estimate vs Actual)' : 'Historical Earnings Performance'}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {isThai ? 'เปรียบเทียบประมาณการกับตัวเลขจริง พร้อมปฏิกิริยาราคาหุ้นในวันถัดไป (1-Day Stock Reaction)' : 'Quarterly actuals vs consensus estimates with 1-day post-earnings price reactions.'}
            </p>
          </div>

          {/* Metric Toggle */}
          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setMetricTab('eps')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                metricTab === 'eps' ? 'bg-stone-900 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              EPS ($)
            </button>
            <button
              type="button"
              onClick={() => setMetricTab('revenue')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                metricTab === 'revenue' ? 'bg-stone-900 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {isThai ? 'รายได้ (Revenue $M)' : 'Revenue ($M)'}
            </button>
          </div>
        </div>

        {/* Recharts Bar Chart */}
        {chartData.length > 0 ? (
          <div className="h-72 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0efed" />
                <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#78716c' }} dy={10} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#78716c' }} 
                  tickFormatter={(val) => metricTab === 'eps' ? `$${val}` : (Math.abs(val) >= 1000 ? `$${(val / 1000).toFixed(1)}B` : `$${val}M`)}
                />
                <RechartsTooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#1c1917] text-white p-3 rounded-xl border border-white/15 shadow-2xl text-xs font-sans space-y-1.5 min-w-[200px]">
                          <div className="text-stone-300 font-mono text-[11px] border-b border-stone-800 pb-1 font-bold">
                            {label}
                          </div>
                          {payload.map((entry: any, i: number) => {
                            const isEst = entry.dataKey?.includes('estimate') || entry.name?.includes('Estimate') || entry.name?.includes('คาดการณ์');
                            const nameLabel = isEst ? (isThai ? 'คาดการณ์ (Estimate)' : 'Estimate') : (isThai ? 'ผลจริง (Actual)' : 'Actual');
                            const valStr = metricTab === 'eps' ? `$${Number(entry.value).toFixed(2)}` : formatMillionsToBillion(entry.value);
                            const colorDot = isEst ? '#94a3b8' : '#34d399';
                            return (
                              <div key={i} className="flex items-center justify-between gap-3 text-xs">
                                <div className="flex items-center gap-1.5 text-stone-300">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colorDot }} />
                                  <span>{nameLabel}:</span>
                                </div>
                                <span className="font-mono font-bold text-white">{valStr}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '15px' }} />
                {metricTab === 'eps' ? (
                  <>
                    <Bar dataKey="eps_estimate" name={isThai ? "EPS คาดการณ์" : "EPS Estimate"} fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={28} />
                    <Bar dataKey="eps_actual" name={isThai ? "EPS ตัวเลขจริง" : "EPS Actual"} fill="#0b5a4b" radius={[4, 4, 0, 0]} barSize={28} />
                  </>
                ) : (
                  <>
                    <Bar dataKey="revenue_estimate_musd" name={isThai ? "รายได้คาดการณ์" : "Revenue Estimate"} fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={28} />
                    <Bar dataKey="revenue_actual_musd" name={isThai ? "รายได้จริง" : "Revenue Actual"} fill="#0b5a4b" radius={[4, 4, 0, 0]} barSize={28} />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-8 text-stone-400 italic">No historical charts available</div>
        )}

        {/* Quarter-by-Quarter Surprise & 1-Day Price Reaction Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {pastHistory.map((q, idx) => {
            const rx = q.stock_reaction_1d_pct || 0;
            const isBeat = q.beat_or_miss?.includes('beat') || (q.eps_actual >= q.eps_estimate);
            return (
              <div key={idx} className="bg-stone-50 p-3 rounded-2xl border border-stone-200 flex flex-col justify-between gap-1.5">
                <div className="flex justify-between items-center text-xs font-bold text-stone-700">
                  <span>{q.period}</span>
                  {isBeat ? (
                    <span className="text-[#0b5a4b] text-[10px] bg-emerald-100 px-1.5 py-0.5 rounded font-bold">BEAT</span>
                  ) : (
                    <span className="text-red-600 text-[10px] bg-red-100 px-1.5 py-0.5 rounded font-bold">MISS</span>
                  )}
                </div>
                <div className="text-xs text-stone-600 font-mono flex justify-between">
                  <span>EPS Surprise:</span>
                  <span className="font-bold text-stone-800">{q.eps_surprise_pct !== undefined ? `+${q.eps_surprise_pct}%` : '-'}</span>
                </div>
                <div className="text-xs text-stone-600 font-mono flex justify-between border-t border-stone-200/60 pt-1">
                  <span>1-Day Stock Move:</span>
                  <span className={`font-bold flex items-center ${rx >= 0 ? 'text-[#0b5a4b]' : 'text-red-600'}`}>
                    {rx >= 0 ? <ArrowUpRight className="w-3 h-3 inline" /> : <ArrowDownRight className="w-3 h-3 inline" />}
                    {rx > 0 ? `+${rx}%` : `${rx}%`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. ANALYST PRICE TARGET CONSENSUS & RATINGS BREAKDOWN */}
      {data.analyst_consensus && (
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-stone-200 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <div>
                <h4 className="font-bold text-stone-900 text-base sm:text-lg font-['Prompt','Mitr','Nunito',sans-serif]">
                  {isThai ? 'ฉันทามตินักวิเคราะห์ & เป้าหมายราคา (Wall St. Consensus)' : 'Wall Street Analyst Consensus & Price Targets'}
                </h4>
                <span className="text-xs text-stone-500">
                  {isThai ? `รวบรวมจากนักวิเคราะห์ทั้งหมด ${data.analyst_consensus.total_analysts || 24} ราย` : `Aggregated from ${data.analyst_consensus.total_analysts || 24} Wall St. analysts`}
                </span>
              </div>
            </div>

            {/* Consensus Rating Badge */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs text-stone-500 font-medium">{isThai ? 'คำแนะนำเฉลี่ย:' : 'Consensus:'}</span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-[#0b5a4b] border border-emerald-300 shadow-xs">
                {data.analyst_consensus.consensus_rating}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
            {/* Price Target Spectrum */}
            <div className="bg-stone-50 p-4 sm:p-5 rounded-2xl border border-stone-200/80 flex flex-col justify-between gap-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-stone-600 font-bold uppercase tracking-wider">
                  {isThai ? 'เป้าหมายราคาเฉลี่ย (Mean Target)' : 'Mean Price Target'}
                </span>
                <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full ${
                  (data.analyst_consensus.price_target.implied_upside_pct || 0) >= 0 
                    ? 'bg-emerald-100 text-[#0b5a4b]' 
                    : 'bg-red-100 text-red-600'
                }`}>
                  {(data.analyst_consensus.price_target.implied_upside_pct || 0) >= 0 ? '+' : ''}
                  {data.analyst_consensus.price_target.implied_upside_pct}% {isThai ? 'Upside' : 'Upside'}
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold font-mono text-stone-900">
                  ${data.analyst_consensus.price_target.mean?.toFixed(2)}
                </span>
                <span className="text-xs text-stone-500 font-sans">
                  {isThai ? 'เฉลี่ย 12 เดือนข้างหน้า' : '12-Month Target'}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs font-mono text-stone-600 pt-2 border-t border-stone-200">
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase font-bold">{isThai ? 'ต่ำสุด (Low)' : 'Low'}</span>
                  <span className="font-bold text-stone-700">${data.analyst_consensus.price_target.low?.toFixed(2)}</span>
                </div>
                <div className="text-center">
                  <span className="text-stone-400 block text-[10px] uppercase font-bold">{isThai ? 'เฉลี่ย (Mean)' : 'Mean'}</span>
                  <span className="font-bold text-[#0b5a4b]">${data.analyst_consensus.price_target.mean?.toFixed(2)}</span>
                </div>
                <div className="text-right">
                  <span className="text-stone-400 block text-[10px] uppercase font-bold">{isThai ? 'สูงสุด (High)' : 'High'}</span>
                  <span className="font-bold text-stone-700">${data.analyst_consensus.price_target.high?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Ratings Breakdown (Buy/Hold/Sell) */}
            {data.analyst_consensus.ratings_breakdown && (
              <div className="bg-stone-50 p-4 sm:p-5 rounded-2xl border border-stone-200/80 flex flex-col justify-between gap-3">
                <span className="text-xs text-stone-600 font-bold uppercase tracking-wider">
                  {isThai ? 'สัดส่วนคำแนะนำ (Ratings Breakdown)' : 'Analyst Recommendations'}
                </span>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-emerald-100/70 border border-emerald-200 p-2.5 rounded-xl">
                    <span className="text-[10px] font-bold text-[#0b5a4b] block uppercase">{isThai ? 'แนะนำซื้อ (BUY)' : 'BUY'}</span>
                    <span className="text-xl font-bold font-mono text-[#0b5a4b] mt-0.5 block">{data.analyst_consensus.ratings_breakdown.buy_count}</span>
                  </div>
                  <div className="bg-amber-100/70 border border-amber-200 p-2.5 rounded-xl">
                    <span className="text-[10px] font-bold text-amber-800 block uppercase">{isThai ? 'ถือ (HOLD)' : 'HOLD'}</span>
                    <span className="text-xl font-bold font-mono text-amber-800 mt-0.5 block">{data.analyst_consensus.ratings_breakdown.hold_count}</span>
                  </div>
                  <div className="bg-red-100/70 border border-red-200 p-2.5 rounded-xl">
                    <span className="text-[10px] font-bold text-red-700 block uppercase">{isThai ? 'ขาย (SELL)' : 'SELL'}</span>
                    <span className="text-xl font-bold font-mono text-red-700 mt-0.5 block">{data.analyst_consensus.ratings_breakdown.sell_count}</span>
                  </div>
                </div>

                {data.analyst_consensus.commentary && (
                  <p className="text-xs text-stone-600 italic font-sans">
                    "{data.analyst_consensus.commentary}"
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. BOTTOM ROW: ANALYST REVISIONS & GUIDANCE SETUP */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Estimate Revisions Trend */}
        {revisions && (
          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <h4 className="font-bold text-stone-900 text-base">
                    {isThai ? 'ทิศทางการปรับประมาณการ (Estimate Revisions)' : 'Analyst Estimate Revisions'}
                  </h4>
                </div>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  revisions.direction === 'upward' 
                    ? 'bg-emerald-100 text-[#0b5a4b]' 
                    : revisions.direction === 'downward' 
                    ? 'bg-red-100 text-red-700' 
                    : 'bg-stone-100 text-stone-700'
                }`}>
                  {revisions.direction === 'upward' ? (isThai ? '▲ ปรับเพิ่มขึ้น' : '▲ Upward') : (isThai ? '▼ ปรับลดลง' : '▼ Downward')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 my-4">
                <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 text-center">
                  <span className="text-[11px] text-emerald-800 font-bold block">{isThai ? 'นักวิเคราะห์ปรับเพิ่ม' : 'Analysts Raised'}</span>
                  <span className="text-2xl font-bold font-mono text-[#0b5a4b]">{revisions.num_analysts_raised || '-'}</span>
                </div>
                <div className="bg-red-50/50 p-3 rounded-xl border border-red-100 text-center">
                  <span className="text-[11px] text-red-800 font-bold block">{isThai ? 'นักวิเคราะห์ปรับลด' : 'Analysts Lowered'}</span>
                  <span className="text-2xl font-bold font-mono text-red-600">{revisions.num_analysts_lowered || '-'}</span>
                </div>
              </div>

              <p className="text-xs text-stone-600 leading-relaxed font-sans bg-stone-50 p-3 rounded-xl border border-stone-100">
                {revisions.commentary || revisions.description || (isThai ? 'การปรับประมาณการขึ้นต่อเนื่องเป็นสัญญาณ Momentum เชิงบวกก่อนการประกาศงบจริง' : 'Positive revision trajectory indicates building momentum.')}
              </p>
            </div>
          </div>
        )}

        {/* Current Quarter Setup & Things to Watch */}
        {currentSetup && (
          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                <Eye className="w-5 h-5 text-purple-600" />
                <h4 className="font-bold text-stone-900 text-base">
                  {isThai ? 'จุดสำคัญที่ต้องจับตาในไตรมาสนี้ (Key Things to Watch)' : 'Current Quarter Watchlist'}
                </h4>
              </div>

              {currentSetup.key_things_to_watch && currentSetup.key_things_to_watch.length > 0 && (
                <ul className="space-y-2 my-3">
                  {currentSetup.key_things_to_watch.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-stone-700 leading-relaxed bg-stone-50 p-2.5 rounded-xl border border-stone-100">
                      <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {guidance && (
              <div className="pt-2 border-t border-stone-100 text-xs text-stone-600 font-mono flex justify-between items-center">
                <span>{isThai ? 'เป้า Guidance ทั้งปี:' : 'Full Year Guidance:'} {guidance.company_guidance_revenue_musd ? `${formatMillionsToBillion(guidance.company_guidance_revenue_musd[0])} - ${formatMillionsToBillion(guidance.company_guidance_revenue_musd[1])}` : '-'}</span>
                <span className="font-bold text-[#0b5a4b]">+{guidance.implied_growth_pct || 0}% YoY</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary Verdict */}
      {data.summary_verdict && (
        <div className="bg-stone-50 p-4 sm:p-5 rounded-2xl border border-stone-200 text-sm text-stone-800 leading-relaxed font-sans">
          <strong>{isThai ? 'สรุปภาพรวม Earnings:' : 'Earnings Summary Verdict:'}</strong> {data.summary_verdict}
        </div>
      )}
    </div>
  );
}
