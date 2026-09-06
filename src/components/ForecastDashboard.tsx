import React, { useState } from 'react';
import { 
  Target, Info, Star, FileText, ArrowUp, ArrowDown, 
  Minus, ShieldAlert, Sparkles, TrendingUp, ChevronRight 
} from 'lucide-react';
import { 
  ResponsiveContainer, ComposedChart, Area, Line, 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ReferenceDot 
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

  // Rating color badge helper matching Lumina report style
  const getRatingBadge = (rating: string) => {
    const r = rating.toLowerCase();
    if (r.includes('buy') || r.includes('overweight') || r.includes('outperform')) {
      return (
        <span className="px-2.5 py-0.5 rounded-md font-bold text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
          Buy
        </span>
      );
    }
    if (r.includes('sell') || r.includes('underweight') || r.includes('underperform')) {
      return (
        <span className="px-2.5 py-0.5 rounded-md font-bold text-xs bg-rose-50 text-rose-700 border border-rose-200">
          Sell
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-md font-bold text-xs bg-amber-50 text-amber-700 border border-amber-200">
        Hold
      </span>
    );
  };

  // Change type color helper
  const getChangeBadge = (change: string) => {
    const c = change.toLowerCase();
    if (c.includes('upgrade')) {
      return (
        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-xs font-mono">
          Upgrade <ArrowUp className="w-3 h-3" />
        </span>
      );
    }
    if (c.includes('downgrade')) {
      return (
        <span className="inline-flex items-center gap-1 text-rose-600 font-semibold text-xs font-mono">
          Downgrade <ArrowDown className="w-3 h-3" />
        </span>
      );
    }
    if (c.includes('new')) {
      return <span className="text-stone-700 font-semibold text-xs font-mono">New</span>;
    }
    return (
      <span className="inline-flex items-center gap-1 text-stone-500 font-medium text-xs font-mono">
        Maintained ◆
      </span>
    );
  };

  // Render Institution Logo / Avatar in Lumina light palette
  const renderInstitutionAvatar = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('bofa') || n.includes('bank of america')) {
      return (
        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center p-1 shrink-0 overflow-hidden border border-stone-200 shadow-2xs">
          <svg viewBox="0 0 32 32" className="w-full h-full">
            <rect width="32" height="32" fill="#ffffff" />
            <path d="M4 11h11v3H4zm0 6h11v3H4z" fill="#0061A8" />
            <path d="M17 11h11v3H17zm0 6h11v3H17z" fill="#E31837" />
            <path d="M10 6l6 10-6 10h5l6-10-6-10z" fill="#E31837" />
          </svg>
        </div>
      );
    }
    if (n.includes('scotiabank')) {
      return (
        <div className="w-8 h-8 rounded-full bg-[#ec111a] text-white flex items-center justify-center font-sans text-[8px] font-extrabold shrink-0 shadow-2xs">
          SCOTIA
        </div>
      );
    }
    if (n.includes('piper sandler')) {
      return (
        <div className="w-8 h-8 rounded-full bg-[#002f6c] text-white flex items-center justify-center font-sans text-[8px] font-bold text-center leading-tight shrink-0 shadow-2xs px-0.5">
          PIPER
        </div>
      );
    }
    if (n.includes('evercore')) {
      return (
        <div className="w-8 h-8 rounded-full bg-[#002f6c] text-white flex items-center justify-center font-serif text-[8px] font-extrabold shrink-0 shadow-2xs px-0.5">
          EVERCORE
        </div>
      );
    }
    if (n.includes('morgan stanley')) {
      return (
        <div className="w-8 h-8 rounded-full bg-[#002b49] text-white flex items-center justify-center font-sans text-[7.5px] font-bold text-center leading-tight shrink-0 shadow-2xs px-0.5">
          Morgan<br/>Stanley
        </div>
      );
    }
    if (n.includes('citi')) {
      return (
        <div className="w-8 h-8 rounded-full bg-[#003b70] text-white flex items-center justify-center font-sans font-bold shrink-0 relative overflow-hidden shadow-2xs">
          <span className="font-extrabold text-white text-[10px]">citi</span>
          <div className="absolute top-0.5 right-1 w-2.5 h-1.5 border-t-2 border-r-2 border-red-500 rounded-tr-full" />
        </div>
      );
    }
    if (n.includes('j.p. morgan') || n.includes('jpmorgan')) {
      return (
        <div className="w-8 h-8 rounded-full bg-[#0a1f44] text-white flex items-center justify-center font-serif text-[7.5px] font-bold text-center leading-tight shrink-0 shadow-2xs px-0.5">
          J.P.<br/>Morgan
        </div>
      );
    }
    if (n.includes('mizuho')) {
      return (
        <div className="w-8 h-8 rounded-full bg-[#00256c] text-white flex items-center justify-center font-sans text-[8px] font-bold shrink-0 shadow-2xs">
          MIZUHO
        </div>
      );
    }
    if (n.includes('truist')) {
      return (
        <div className="w-8 h-8 rounded-full bg-[#2a0e67] text-white flex items-center justify-center font-sans text-[8px] font-bold shrink-0 shadow-2xs">
          TRUIST
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-stone-100 text-stone-700 flex items-center justify-center font-mono text-xs font-bold shrink-0 border border-stone-300">
        {name.substring(0, 2).toUpperCase()}
      </div>
    );
  };

  // Colors for Analyst Circle Avatars
  const getAnalystAvatar = (name: string, index: number) => {
    const avatarStyles = [
      'bg-purple-100 text-purple-700 border border-purple-200',
      'bg-rose-100 text-rose-700 border border-rose-200',
      'bg-cyan-100 text-cyan-700 border border-cyan-200',
      'bg-pink-100 text-pink-700 border border-pink-200',
      'bg-emerald-100 text-emerald-700 border border-emerald-200',
      'bg-blue-100 text-blue-700 border border-blue-200',
    ];
    const styleClass = avatarStyles[index % avatarStyles.length];
    const initial = name.trim().charAt(0).toUpperCase();

    return (
      <div className={`w-8 h-8 rounded-full ${styleClass} flex items-center justify-center font-sans text-xs font-bold shrink-0 shadow-2xs`}>
        {initial}
      </div>
    );
  };

  // Find Current price point in chart data for ReferenceDot
  const currentPoint = target_price_chart_data?.find(p => p.date === 'Current');
  const curPrice = price_target.current_price || currentPoint?.price || 18.22;

  // Rating badge color for Center Circle
  const consensusLower = (data.consensus_rating || '').toLowerCase();
  
  // Circumference for Donut Meter (radius = 46, circumference ~289.03)
  const donutRadius = 46;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const totalBreakdownPct = (ratings_breakdown.buy_pct || 0) + (ratings_breakdown.hold_pct || 0) + (ratings_breakdown.sell_pct || 0);
  const safeBreakdownTotal = totalBreakdownPct > 0 ? totalBreakdownPct : 100;
  const buyPctNorm = ((ratings_breakdown.buy_pct || 0) / safeBreakdownTotal) * 100;
  const holdPctNorm = ((ratings_breakdown.hold_pct || 0) / safeBreakdownTotal) * 100;
  const sellPctNorm = ((ratings_breakdown.sell_pct || 0) / safeBreakdownTotal) * 100;

  const buyStrokeLen = (buyPctNorm / 100) * donutCircumference;
  const holdStrokeLen = (holdPctNorm / 100) * donutCircumference;
  const sellStrokeLen = (sellPctNorm / 100) * donutCircumference;

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-7 border border-stone-200 shadow-sm flex flex-col gap-6 w-full print:bg-white print:text-stone-900">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-stone-100 text-[#0b5a4b] flex items-center justify-center border border-stone-200 shadow-xs">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900 text-lg sm:text-xl font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight flex items-center gap-2">
              <span>{isThai ? 'ฉันทามตินักวิเคราะห์ & กรอบราคาเป้าหมาย' : 'Consensus Rating & 12M Target Forecast'}</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Wall Street
              </span>
            </h3>
            <span className="text-xs text-stone-500 font-sans">
              {isThai 
                ? `ฉันทามติคำแนะนำ, กรอบคาดการณ์ราคา 12 เดือนข้างหน้า (High / Avg / Low) และรายงานสถาบันการเงินสำหรับ ${ticker}` 
                : `Analyst recommendations, 12-month target price cone & detailed ratings breakdown for ${ticker}`}
            </span>
          </div>
        </div>

        {data.updated_at && (
          <span className="text-[11px] text-stone-500 font-mono self-start sm:self-auto bg-stone-50 px-3 py-1 rounded-full border border-stone-200">
            {data.updated_at}
          </span>
        )}
      </div>

      {/* Top Grid: Consensus Rating (4 cols) & Target Price Cone Chart (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Module 1: Consensus Rating */}
        <div className="lg:col-span-4 bg-stone-50/80 p-5 sm:p-6 rounded-2xl border border-stone-200 flex flex-col justify-between gap-5 shadow-2xs">
          <div>
            <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              {isThai ? 'ฉันทามติคำแนะนำ (Consensus Rating)' : 'Consensus Rating'}
            </h4>
            <span className="text-xs text-stone-500 font-sans block mt-0.5">
              {isThai 
                ? `อัปเดต: ${data.as_of_date || 'ล่าสุด'} (จาก ${data.total_analysts} นักวิเคราะห์)` 
                : `Updated: ${data.as_of_date || 'Latest'} (Based on ${data.total_analysts} analysts)`}
            </span>
          </div>

          {/* Center Donut Meter */}
          <div className="flex flex-col items-center justify-center py-2">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 120 120">
                {/* Background Track */}
                <circle
                  cx="60"
                  cy="60"
                  r={donutRadius}
                  fill="#fafaf9"
                  stroke="#e7e5e4"
                  strokeWidth="8"
                />
                {/* Buy Segment */}
                {buyStrokeLen > 0 && (
                  <circle
                    cx="60"
                    cy="60"
                    r={donutRadius}
                    fill="transparent"
                    stroke="#10b981"
                    strokeWidth="8"
                    strokeDasharray={`${buyStrokeLen} ${donutCircumference}`}
                    strokeDashoffset={0}
                    className="transition-all duration-500"
                  />
                )}
                {/* Hold Segment */}
                {holdStrokeLen > 0 && (
                  <circle
                    cx="60"
                    cy="60"
                    r={donutRadius}
                    fill="transparent"
                    stroke="#94a3b8"
                    strokeWidth="8"
                    strokeDasharray={`${holdStrokeLen} ${donutCircumference}`}
                    strokeDashoffset={-buyStrokeLen}
                    className="transition-all duration-500"
                  />
                )}
                {/* Sell Segment */}
                {sellStrokeLen > 0 && (
                  <circle
                    cx="60"
                    cy="60"
                    r={donutRadius}
                    fill="transparent"
                    stroke="#f43f5e"
                    strokeWidth="8"
                    strokeDasharray={`${sellStrokeLen} ${donutCircumference}`}
                    strokeDashoffset={-(buyStrokeLen + holdStrokeLen)}
                    className="transition-all duration-500"
                  />
                )}
              </svg>

              {/* Inner Content - Center Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
                <span className={`font-black font-sans tracking-tight text-center leading-tight ${
                  consensusLower.includes('buy')
                    ? 'text-emerald-700'
                    : consensusLower.includes('sell')
                    ? 'text-rose-700'
                    : 'text-amber-700'
                } ${
                  (data.consensus_rating || '').length > 8 ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'
                }`}>
                  {data.consensus_rating || 'Buy'}
                </span>
                {isThai && (
                  <span className="text-[11px] font-sans font-semibold text-stone-500 mt-0.5">
                    {consensusLower.includes('strong buy')
                      ? 'ซื้อทันที'
                      : consensusLower.includes('buy')
                      ? 'แนะนำซื้อ'
                      : consensusLower.includes('strong sell')
                      ? 'ขายทันที'
                      : consensusLower.includes('sell')
                      ? 'แนะนำขาย'
                      : 'แนะนำถือ'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Breakdown Progress Bars */}
          <div className="flex flex-col gap-2.5 font-sans text-xs">
            {/* Buy */}
            <div className="flex items-center justify-between gap-3">
              <span className="w-12 text-emerald-700 font-bold text-xs">
                {isThai ? 'ซื้อ (Buy)' : 'Buy'}
              </span>
              <div className="flex-1 bg-stone-200 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all" 
                  style={{ width: `${ratings_breakdown.buy_pct}%` }}
                />
              </div>
              <span className="w-14 text-right font-mono font-bold text-stone-800 text-xs">
                {ratings_breakdown.buy_pct.toFixed(2)}%
              </span>
            </div>

            {/* Hold */}
            <div className="flex items-center justify-between gap-3">
              <span className="w-12 text-stone-600 font-bold text-xs">
                {isThai ? 'ถือ (Hold)' : 'Hold'}
              </span>
              <div className="flex-1 bg-stone-200 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-slate-400 h-full rounded-full transition-all" 
                  style={{ width: `${ratings_breakdown.hold_pct}%` }}
                />
              </div>
              <span className="w-14 text-right font-mono font-bold text-stone-800 text-xs">
                {ratings_breakdown.hold_pct.toFixed(2)}%
              </span>
            </div>

            {/* Sell */}
            <div className="flex items-center justify-between gap-3">
              <span className="w-12 text-rose-700 font-bold text-xs">
                {isThai ? 'ขาย (Sell)' : 'Sell'}
              </span>
              <div className="flex-1 bg-stone-200 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-rose-500 h-full rounded-full transition-all" 
                  style={{ width: `${ratings_breakdown.sell_pct}%` }}
                />
              </div>
              <span className="w-14 text-right font-mono font-bold text-stone-800 text-xs">
                {ratings_breakdown.sell_pct.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Module 2: Target Price Cone Chart */}
        <div className="lg:col-span-8 bg-stone-50/80 p-5 sm:p-6 rounded-2xl border border-stone-200 flex flex-col justify-between gap-3 shadow-2xs">
          <div className="flex items-center justify-between border-b border-stone-200/80 pb-3">
            <div className="flex items-center gap-1.5 relative">
              <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                <span>{isThai ? 'เป้าหมายราคา 12 เดือนข้างหน้า (Target Price)' : 'Target Price'}</span>
                <button
                  type="button"
                  onClick={() => setShowInfoTooltip(!showInfoTooltip)}
                  className="text-stone-400 hover:text-stone-700 cursor-pointer transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </h4>

              {/* Info Tooltip Popup */}
              {showInfoTooltip && (
                <div className="absolute top-7 left-0 w-72 bg-[#1c1917] text-white p-3 rounded-xl border border-white/20 shadow-2xl text-[11px] z-30 font-sans leading-relaxed">
                  {isThai 
                    ? `รวบรวมจากนักวิเคราะห์ Wall Street จำนวน ${data.total_analysts} ราย ที่ให้เป้าหมายราคา 12 เดือนของ ${ticker} ในช่วง 3 เดือนที่ผ่านมา` 
                    : `Based on ${data.total_analysts} Wall Street analysts offering 12 months price targets for ${ticker} in the last 3 months.`}
                </div>
              )}
            </div>

            <span className="text-xs text-stone-500 font-sans">
              {isThai 
                ? `อัปเดต: ${data.as_of_date || 'ล่าสุด'}` 
                : `Updated: ${data.as_of_date || 'Latest'}`}
            </span>
          </div>

          {/* Chart Canvas with Side Badges */}
          <div className="relative h-60 w-full flex items-center">
            <div className="flex-1 h-full">
              <ResponsiveContainer width="100%" height={240} minHeight={240}>
                <ComposedChart data={target_price_chart_data} margin={{ top: 25, right: 10, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="priceAreaGradLight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.16} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="highConeGradLight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.14} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.01} />
                    </linearGradient>
                    <linearGradient id="lowConeGradLight" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#78716c' }} />
                  <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#78716c' }} />
                  <RechartsTooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const p = payload[0].payload;
                        return (
                          <div className="bg-[#1c1917] text-white p-3 rounded-xl border border-white/10 shadow-xl text-xs font-sans space-y-1.5 min-w-[160px]">
                            <div className="text-stone-400 font-mono text-[10px] border-b border-stone-700 pb-1 font-semibold">{label || p.date}</div>
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

                  {/* Cone Shaded Areas */}
                  <Area type="linear" dataKey="high_target" stroke="#10b981" strokeWidth={1.5} strokeDasharray="3 3" fill="url(#highConeGradLight)" isAnimationActive={false} />
                  <Area type="linear" dataKey="low_target" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3 3" fill="url(#lowConeGradLight)" isAnimationActive={false} />
                  <Line type="linear" dataKey="avg_target" stroke="#78716c" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />

                  {/* Historical Jagged Price Line with Gradient Underneath */}
                  <Area type="monotone" dataKey="price" stroke="#2563eb" strokeWidth={2.5} fill="url(#priceAreaGradLight)" dot={false} isAnimationActive={false} />

                  {/* Dot on Current Price */}
                  {currentPoint && (
                    <ReferenceDot 
                      x={currentPoint.date} 
                      y={currentPoint.price || curPrice} 
                      r={4} 
                      fill="#2563eb" 
                      stroke="#ffffff" 
                      strokeWidth={2} 
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Target Price Value Badges on the right edge */}
            <div className="flex flex-col justify-between h-[180px] shrink-0 pl-2">
              <div className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-xs font-bold text-center shadow-2xs">
                High {price_target.high.toFixed(2)}
              </div>
              <div className="px-2.5 py-1 rounded-md bg-stone-200 text-stone-800 border border-stone-300 font-mono text-xs font-bold text-center shadow-2xs">
                Avg {price_target.mean.toFixed(2)}
              </div>
              <div className="px-2.5 py-1 rounded-md bg-rose-100 text-rose-800 border border-rose-300 font-mono text-xs font-bold text-center shadow-2xs">
                Low {price_target.low.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Bottom Timeframe Markers */}
          <div className="flex items-center justify-between text-xs text-stone-500 font-sans pt-2 border-t border-stone-200/80 px-2">
            <span>Past 12 Months</span>
            <div className="flex items-center gap-1.5 font-mono text-xs text-blue-700 font-bold">
              <span>Current:</span>
              <span>${curPrice.toFixed(2)}</span>
            </div>
            <span>12 Months Forecast</span>
          </div>
        </div>
      </div>

      {/* Module 3: Detailed Ratings Table with Institutions & Analysts Tabs */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div className="flex items-center gap-4">
            <h4 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
              {isThai ? 'รายละเอียดคำแนะนำ (Detailed Ratings)' : 'Detailed Ratings'}
            </h4>
            <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl font-sans text-xs font-semibold border border-stone-200">
              <button
                type="button"
                onClick={() => setActiveTab('institutions')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'institutions'
                    ? 'bg-stone-900 text-white shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {isThai ? 'สถาบันการเงิน (Institutions)' : 'Institutions'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('analysts')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'analysts'
                    ? 'bg-stone-900 text-white shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {isThai ? 'นักวิเคราะห์ (Analysts)' : 'Analysts'}
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
                {data.institutions.map((item, idx) => (
                  <tr key={idx} className="hover:bg-stone-50/60 transition-colors">
                    <td className="py-3 px-3 flex items-center gap-3 font-bold text-stone-900">
                      {renderInstitutionAvatar(item.name)}
                      <span>{item.name}</span>
                    </td>
                    <td className="py-3 px-3">
                      {getRatingBadge(item.rating)}
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
                ))}
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
                {data.analysts.map((item, idx) => (
                  <tr key={idx} className="hover:bg-stone-50/60 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        {getAnalystAvatar(item.name, idx)}
                        <div>
                          <div className="font-bold text-stone-900 text-xs sm:text-sm">{item.name}</div>
                          <div className="flex items-center gap-0.5 mt-0.5">
                            {Array.from({ length: item.star_rating || 5 }).map((_, sIdx) => (
                              <Star key={sIdx} className="w-3 h-3 text-amber-500 fill-amber-500" />
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      {getRatingBadge(item.rating)}
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
                      <button 
                        type="button" 
                        aria-label="View Report"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="text-[11px] text-stone-400 font-sans flex items-center gap-1.5 pt-2 border-t border-stone-100">
        <span>Disclaimer</span>
        <Info className="w-3 h-3 text-stone-400" />
      </div>
    </div>
  );
};
