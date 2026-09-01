import React, { useState } from 'react';
import { 
  Target, Info, Star, FileText, ArrowUp, ArrowDown, 
  Minus, ShieldAlert, Sparkles, TrendingUp, ChevronRight 
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, LineChart, Line, 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ReferenceLine, ReferenceDot 
} from 'recharts';
import { ForecastDashboardData, InstitutionalRatingItem, AnalystRatingItem } from '../types';

interface ForecastDashboardProps {
  data?: ForecastDashboardData;
  ticker: string;
  isThai: boolean;
}

export const ForecastDashboard: React.FC<ForecastDashboardProps> = ({
  data,
  ticker,
  isThai
}) => {
  const [activeTab, setActiveTab] = useState<'institutions' | 'analysts'>('institutions');
  const [showInfoTooltip, setShowInfoTooltip] = useState<boolean>(false);

  if (!data) return null;

  const { ratings_breakdown, price_target, target_price_chart_data } = data;

  // Rating color helper
  const getRatingColor = (rating: string) => {
    const r = rating.toLowerCase();
    if (r.includes('buy') || r.includes('overweight') || r.includes('outperform')) {
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', circle: 'bg-emerald-600' };
    }
    if (r.includes('sell') || r.includes('underweight') || r.includes('underperform')) {
      return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', circle: 'bg-rose-600' };
    }
    return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', circle: 'bg-amber-600' };
  };

  // Change type color helper
  const getChangeBadge = (change: string) => {
    const c = change.toLowerCase();
    if (c.includes('upgrade')) {
      return <span className="inline-flex items-center gap-0.5 text-emerald-600 font-semibold font-mono text-xs"><ArrowUp className="w-3 h-3" /> Upgrade</span>;
    }
    if (c.includes('downgrade')) {
      return <span className="inline-flex items-center gap-0.5 text-rose-600 font-semibold font-mono text-xs"><ArrowDown className="w-3 h-3" /> Downgrade</span>;
    }
    if (c.includes('new')) {
      return <span className="inline-flex items-center gap-0.5 text-stone-700 font-semibold font-mono text-xs">New</span>;
    }
    return <span className="inline-flex items-center gap-0.5 text-stone-500 font-medium font-mono text-xs">Maintained</span>;
  };

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-7 border border-stone-200 shadow-sm flex flex-col gap-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-stone-100 text-[#0b5a4b] flex items-center justify-center border border-stone-200 shadow-xs">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900 text-lg sm:text-xl font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight">
              {isThai ? 'Forecast & Wall Street Consensus' : 'Forecast & Wall Street Consensus'}
            </h3>
            <span className="text-xs text-stone-500 font-sans">
              {isThai 
                ? 'ฉันทามติคำแนะนำ, กรอบเป้าหมายราคา 12 เดือนข้างหน้า (High / Avg / Low) และรายงานสถาบันการเงิน' 
                : 'Analyst recommendations, 12-month target price cone & institutional ratings breakdown'}
            </span>
          </div>
        </div>

        {data.updated_at && (
          <span className="text-[11px] text-stone-400 font-mono self-start sm:self-auto">
            {data.updated_at}
          </span>
        )}
      </div>

      {/* Top Grid: Consensus Rating & 12-Month Target Price Cone Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Module 1: Consensus Rating (4 cols) */}
        <div className="lg:col-span-4 bg-stone-50 p-5 rounded-2xl border border-stone-200 flex flex-col justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-stone-600 uppercase tracking-wider block">
              {isThai ? 'ฉันทามติคำแนะนำ (Consensus Rating)' : 'Consensus Rating'}
            </span>
            <span className="text-[11px] text-stone-500 font-sans block mt-0.5">
              {isThai ? `อัปเดต: ${data.as_of_date || 'ล่าสุด'} (จาก ${data.total_analysts} นักวิเคราะห์)` : `Based on ${data.total_analysts} analysts`}
            </span>
          </div>

          {/* Big Center Circle */}
          <div className="flex flex-col items-center justify-center py-3">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-md border-4 border-white ${
              data.consensus_rating.toLowerCase().includes('buy') ? 'bg-emerald-600 text-white' :
              data.consensus_rating.toLowerCase().includes('sell') ? 'bg-rose-600 text-white' :
              'bg-amber-600 text-white'
            }`}>
              <span className="text-lg font-extrabold font-sans tracking-tight text-center px-2">
                {data.consensus_rating}
              </span>
            </div>
          </div>

          {/* Breakdown Bars */}
          <div className="flex flex-col gap-2 font-sans text-xs">
            {/* Buy */}
            <div className="flex items-center justify-between gap-2">
              <span className="w-12 text-stone-700 font-bold">Buy</span>
              <div className="flex-1 bg-stone-200 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all" 
                  style={{ width: `${ratings_breakdown.buy_pct}%` }}
                />
              </div>
              <span className="w-14 text-right font-mono font-bold text-emerald-700">
                {ratings_breakdown.buy_pct.toFixed(2)}%
              </span>
            </div>

            {/* Hold */}
            <div className="flex items-center justify-between gap-2">
              <span className="w-12 text-stone-700 font-bold">Hold</span>
              <div className="flex-1 bg-stone-200 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-slate-400 h-full rounded-full transition-all" 
                  style={{ width: `${ratings_breakdown.hold_pct}%` }}
                />
              </div>
              <span className="w-14 text-right font-mono font-bold text-slate-700">
                {ratings_breakdown.hold_pct.toFixed(2)}%
              </span>
            </div>

            {/* Sell */}
            <div className="flex items-center justify-between gap-2">
              <span className="w-12 text-stone-700 font-bold">Sell</span>
              <div className="flex-1 bg-stone-200 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-rose-500 h-full rounded-full transition-all" 
                  style={{ width: `${ratings_breakdown.sell_pct}%` }}
                />
              </div>
              <span className="w-14 text-right font-mono font-bold text-rose-700">
                {ratings_breakdown.sell_pct.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Module 2: Target Price Chart (Past 12M + 12M Forecast Cone) (8 cols) */}
        <div className="lg:col-span-8 bg-stone-50 p-5 rounded-2xl border border-stone-200 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between border-b border-stone-200/60 pb-3">
            <div className="flex items-center gap-1.5 relative">
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                {isThai ? 'เป้าหมายราคา 12 เดือนข้างหน้า (Target Price)' : 'Target Price'}
              </span>
              <button
                type="button"
                onClick={() => setShowInfoTooltip(!showInfoTooltip)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <Info className="w-3.5 h-3.5" />
              </button>

              {/* Info Tooltip Popup */}
              {showInfoTooltip && (
                <div className="absolute top-6 left-0 w-64 bg-[#1c1917] text-white p-3 rounded-xl border border-white/10 shadow-2xl text-[11px] z-30 font-sans leading-relaxed">
                  {isThai 
                    ? `รวบรวมจากนักวิเคราะห์ Wall Street จำนวน ${data.total_analysts} ราย ที่ให้เป้าหมายราคา 12 เดือนของ ${ticker} ในช่วง 3 เดือนที่ผ่านมา` 
                    : `Based on ${data.total_analysts} Wall Street analysts offering 12 months price targets for ${ticker} in the last 3 months.`}
                </div>
              )}
            </div>

            {/* Target Price Badges */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                High ${price_target.high.toFixed(2)}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-stone-200 text-stone-800 font-bold">
                Avg ${price_target.mean.toFixed(2)}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold border border-rose-200">
                Low ${price_target.low.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Recharts Trajectory & Forecast Cone */}
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={target_price_chart_data} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#78716c' }} />
                <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#78716c' }} />
                <RechartsTooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const p = payload[0].payload;
                      return (
                        <div className="bg-[#1c1917] text-white p-2.5 rounded-xl border border-white/10 shadow-xl text-xs font-sans space-y-1 min-w-[150px]">
                          <div className="text-stone-400 font-mono text-[10px] border-b border-stone-800 pb-1 font-semibold">{label || p.date}</div>
                          {p.price !== undefined && (
                            <div className="flex justify-between text-blue-400 font-mono font-bold">
                              <span>Price:</span>
                              <span>${Number(p.price).toFixed(2)}</span>
                            </div>
                          )}
                          {p.high_target !== undefined && (
                            <div className="flex justify-between text-emerald-400 font-mono">
                              <span>High Target:</span>
                              <span>${Number(p.high_target).toFixed(2)}</span>
                            </div>
                          )}
                          {p.avg_target !== undefined && (
                            <div className="flex justify-between text-stone-300 font-mono">
                              <span>Avg Target:</span>
                              <span>${Number(p.avg_target).toFixed(2)}</span>
                            </div>
                          )}
                          {p.low_target !== undefined && (
                            <div className="flex justify-between text-rose-400 font-mono">
                              <span>Low Target:</span>
                              <span>${Number(p.low_target).toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                
                {/* Cone Shading */}
                <Area type="monotone" dataKey="high_target" stroke="none" fill="#10b981" fillOpacity={0.1} name="high_area" />
                <Area type="monotone" dataKey="low_target" stroke="none" fill="#ffffff" fillOpacity={1} name="low_area" />

                {/* Historical Price Line */}
                <Line type="monotone" dataKey="price" stroke="#2563eb" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} name="price" />

                {/* Forecast Lines */}
                <Line type="monotone" dataKey="high_target" stroke="#10b981" strokeWidth={2} strokeDasharray="3 3" dot={false} name="high_target" />
                <Line type="monotone" dataKey="avg_target" stroke="#78716c" strokeWidth={2} strokeDasharray="4 4" dot={false} name="avg_target" />
                <Line type="monotone" dataKey="low_target" stroke="#ef4444" strokeWidth={2} strokeDasharray="3 3" dot={false} name="low_target" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-stone-500 pt-2 border-t border-stone-200/60 px-2">
            <span>Past 12 Months</span>
            <span className="font-bold text-blue-600">Current: ${price_target.current_price?.toFixed(2)}</span>
            <span>12 Months Forecast</span>
          </div>
        </div>
      </div>

      {/* Module 3: Detailed Ratings Table with Institutions & Analysts Tabs */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              {isThai ? 'รายละเอียดคำแนะนำ (Detailed Ratings)' : 'Detailed Ratings'}
            </span>
            <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl font-sans text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('institutions')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'institutions'
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
                }`}
              >
                {isThai ? 'สถาบันการเงิน (Institutions)' : 'Institutions'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('analysts')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'analysts'
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
                }`}
              >
                {isThai ? 'นักวิเคราะห์เด่น (Analysts)' : 'Analysts'}
              </button>
            </div>
          </div>
        </div>

        {/* Tab 1: Institutions Table */}
        {activeTab === 'institutions' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[620px]">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/70 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Rating</th>
                  <th className="py-2.5 px-3">Price</th>
                  <th className="py-2.5 px-3">1Y Change</th>
                  <th className="py-2.5 px-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs sm:text-sm font-sans">
                {data.institutions.map((item, idx) => {
                  const rColor = getRatingColor(item.rating);
                  return (
                    <tr key={idx} className="hover:bg-stone-50/60 transition-colors">
                      <td className="py-3 px-3 flex items-center gap-2.5 font-bold text-stone-900">
                        <div className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center font-mono text-[11px] font-extrabold text-stone-700 shrink-0">
                          {item.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span>{item.name}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-0.5 rounded-md font-bold text-xs ${rColor.bg} ${rColor.text}`}>
                          {item.rating}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-stone-800">
                        {item.price_display || (item.target_price_prev ? `${item.target_price_prev}→${item.target_price_current}` : `$${item.target_price_current}`)}
                      </td>
                      <td className="py-3 px-3">
                        {getChangeBadge(item.change_type)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-stone-500 text-xs">
                        {item.date}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Analysts Table */}
        {activeTab === 'analysts' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[620px]">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/70 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Rating</th>
                  <th className="py-2.5 px-3">Price</th>
                  <th className="py-2.5 px-3">1Y Change</th>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3 text-right">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs sm:text-sm font-sans">
                {data.analysts.map((item, idx) => {
                  const rColor = getRatingColor(item.rating);
                  return (
                    <tr key={idx} className="hover:bg-stone-50/60 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-mono text-xs font-bold shrink-0">
                            {item.name.substring(0, 1)}
                          </div>
                          <div>
                            <div className="font-bold text-stone-900">{item.name}</div>
                            <div className="flex items-center gap-0.5 mt-0.5">
                              {Array.from({ length: item.star_rating || 5 }).map((_, sIdx) => (
                                <Star key={sIdx} className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                              ))}
                              {item.firm_name && (
                                <span className="text-stone-400 font-sans ml-1 text-[11px]">({item.firm_name})</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-0.5 rounded-md font-bold text-xs ${rColor.bg} ${rColor.text}`}>
                          {item.rating}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-stone-800">
                        {item.price_display || (item.target_price_prev ? `${item.target_price_prev}→${item.target_price_current}` : `$${item.target_price_current}`)}
                      </td>
                      <td className="py-3 px-3">
                        {getChangeBadge(item.change_type)}
                      </td>
                      <td className="py-3 px-3 font-mono text-stone-500 text-xs">
                        {item.date}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors cursor-pointer">
                          <FileText className="w-4 h-4" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      {data.disclaimer && (
        <div className="text-[11px] text-stone-400 font-sans flex items-start gap-1.5 pt-2 border-t border-stone-100">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{data.disclaimer}</span>
        </div>
      )}
    </div>
  );
};
