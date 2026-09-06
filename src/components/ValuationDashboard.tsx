import React, { useState } from 'react';
import { 
  Sparkles, TrendingUp, TrendingDown, Scale, 
  Info, BarChart3, AlertCircle, ArrowUpRight, ArrowDownRight, 
  ChevronDown, Layers, Target, PieChart as PieIcon, ShieldAlert 
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, LineChart, Line, 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, Legend, ReferenceLine, 
  PieChart as RechartsPieChart, Pie, Cell 
} from 'recharts';
import { ValuationDashboardData, RatioValuationDetail, IndustryDistributionItem } from '../types';

interface ValuationDashboardProps {
  data?: ValuationDashboardData;
  ticker: string;
  isThai: boolean;
}

const DIST_COLORS = ['#0b5a4b', '#1e3a8a', '#475569', '#d97706', '#991b1b'];

function formatMarketCapDisplay(marketCapB: number | string): string {
  if (typeof marketCapB === 'string') {
    if (marketCapB.startsWith('$')) return marketCapB;
    return `$${marketCapB}`;
  }
  if (marketCapB >= 1000) {
    return `$${(marketCapB / 1000).toFixed(2)}T`;
  }
  if (marketCapB >= 1) {
    return `$${marketCapB.toFixed(2)}B`;
  }
  if (marketCapB >= 0.001) {
    return `$${(marketCapB * 1000).toFixed(2)}M`;
  }
  return `$${(marketCapB * 1000000).toFixed(2)}K`;
}

export const ValuationDashboard: React.FC<ValuationDashboardProps> = ({
  data,
  ticker,
  isThai
}) => {
  const [activeRatio, setActiveRatio] = useState<'pe' | 'pb' | 'ps'>('pe');
  const [timeframe, setTimeframe] = useState<'5Y' | '3Y' | '1Y'>('5Y');
  const [isTimeframeOpen, setIsTimeframeOpen] = useState<boolean>(false);
  const [activeDistIndex, setActiveDistIndex] = useState<number | null>(0);

  if (!data) return null;

  const currentDetail: RatioValuationDetail | undefined = 
    activeRatio === 'pe' ? data.pe_ratio :
    activeRatio === 'pb' ? data.pb_ratio :
    data.ps_ratio;

  if (!currentDetail) return null;

  const earningsGrowth = data.earnings_growth;
  const revenueGrowth = data.revenue_growth;
  const ratioLabel = activeRatio === 'pe' ? 'P/E Ratio' : activeRatio === 'pb' ? 'P/B Ratio' : 'P/S Ratio';
  const ratioUnit = 'x';

  // Slices for Market Distribution Donut
  const marketDist = currentDetail.market_distribution || [
    { range_label: '0~10', count: 2075, ratio_pct: 13.63 },
    { range_label: '10~30', count: 4603, ratio_pct: 30.23 },
    { range_label: '30~50', count: 1038, ratio_pct: 6.82 },
    { range_label: 'Over 50', count: 986, ratio_pct: 6.47 },
    { range_label: 'Loss-Making (ขาดทุน)', count: 6526, ratio_pct: 42.86 }
  ];

  const currentDistSlice = (activeDistIndex !== null && marketDist[activeDistIndex]) ? marketDist[activeDistIndex] : marketDist[0];

  // Custom Tooltip for Band Chart
  const CustomBandTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload;
      return (
        <div className="bg-[#1c1917] text-white p-3 rounded-xl border border-white/15 shadow-2xl text-xs font-sans space-y-1.5 min-w-[210px]">
          <div className="text-stone-400 font-mono text-[11px] border-b border-stone-800 pb-1 font-semibold">{label || p.date}</div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-emerald-400 font-bold">— {ratioLabel}:</span>
            <span className="font-mono font-bold text-white">{p.ratio_value?.toFixed(2)}{ratioUnit}</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-stone-300">
            <span className="text-stone-300">Reasonable Range:</span>
            <span className="font-mono text-stone-200">{p.band_lower?.toFixed(2)} ~ {p.band_upper?.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-stone-300">
            <span className="text-stone-400">-- Historical Avg:</span>
            <span className="font-mono text-stone-200">{p.historical_avg?.toFixed(2)}{ratioUnit}</span>
          </div>
          {p.industry_avg !== undefined && (
            <div className="flex items-center justify-between gap-4 text-stone-300">
              <span className="text-amber-400">— Industry Avg:</span>
              <span className="font-mono text-stone-200">{p.industry_avg?.toFixed(2)}{ratioUnit}</span>
            </div>
          )}
          {p.benchmark_index !== undefined && (
            <div className="flex items-center justify-between gap-4 text-stone-300">
              <span className="text-slate-400">— S&P 500 / Index:</span>
              <span className="font-mono text-stone-200">{p.benchmark_index?.toFixed(2)}{ratioUnit}</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-7 border border-stone-200 shadow-sm flex flex-col gap-6 w-full">
      {/* Top Header with Ratio Switcher Tabs & Timestamp */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-stone-100 text-[#0b5a4b] flex items-center justify-center border border-stone-200 shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900 text-lg sm:text-xl font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight">
              {isThai ? 'Valuation Multiples & Distribution' : 'Valuation Multiples & Distribution'}
            </h3>
            <span className="text-xs text-stone-500 font-sans">
              {isThai ? 'กราฟแบนด์ประเมินมูลค่าย้อนหลัง, การเติบโตเทียบมูลค่าตลาด และการกระจายตัวในอุตสาหกรรม' : 'Historical valuation bands, growth vs market cap correlation & industry distribution'}
            </span>
          </div>
        </div>

        {/* Ratio Tabs (P/E, P/B, P/S) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl font-mono text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveRatio('pe')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeRatio === 'pe'
                  ? 'bg-[#0b5a4b] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              P/E
            </button>
            <button
              type="button"
              onClick={() => setActiveRatio('pb')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeRatio === 'pb'
                  ? 'bg-[#0b5a4b] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              P/B
            </button>
            <button
              type="button"
              onClick={() => setActiveRatio('ps')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeRatio === 'ps'
                  ? 'bg-[#0b5a4b] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              P/S
            </button>
          </div>

          {data.updated_at && (
            <span className="text-[11px] text-stone-400 font-mono hidden md:inline">
              {data.updated_at}
            </span>
          )}
        </div>
      </div>

      {/* Grid 1: Historical Valuation Band & Growth Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Module 1: Historical Valuation Band Chart */}
        <div className="bg-stone-50/80 p-4 sm:p-5 rounded-2xl border border-stone-200 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 border-b border-stone-200/60 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-stone-900 text-base sm:text-lg font-sans">
                  {ratioLabel}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-stone-200/80 text-stone-700 text-xs font-mono font-bold">
                  {currentDetail.current_value.toFixed(2)}{ratioUnit}
                </span>
                {currentDetail.percentile_5y !== undefined && (
                  <span className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold ${
                    currentDetail.percentile_5y >= 80 
                      ? 'bg-amber-100 text-amber-900' 
                      : currentDetail.percentile_5y <= 25 
                      ? 'bg-emerald-100 text-emerald-900' 
                      : 'bg-stone-200 text-stone-800'
                  }`}>
                    Percentile {currentDetail.percentile_5y}%
                  </span>
                )}
              </div>
              {currentDetail.forward_value !== undefined && (
                <span className="text-xs text-stone-500 font-sans block mt-0.5">
                  Forward {ratioLabel.split(' ')[0]}: <strong className="font-mono text-stone-800">{currentDetail.forward_value.toFixed(2)}{ratioUnit}</strong>
                </span>
              )}
            </div>

            {/* Timeframe Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsTimeframeOpen(!isTimeframeOpen)}
                className="flex items-center gap-1 px-2.5 py-1 bg-white border border-stone-200 rounded-lg text-xs font-mono font-semibold text-stone-700 cursor-pointer shadow-2xs"
              >
                <span>{timeframe}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
              {isTimeframeOpen && (
                <div className="absolute right-0 mt-1 w-24 bg-white border border-stone-200 rounded-lg shadow-lg z-20 py-1 font-mono text-xs">
                  {(['5Y', '3Y', '1Y'] as const).map(tf => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => {
                        setTimeframe(tf);
                        setIsTimeframeOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1 hover:bg-stone-50 ${timeframe === tf ? 'font-bold text-[#0b5a4b]' : 'text-stone-700'}`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recharts Area + Line Band Chart */}
          <div className="h-56 w-full mt-3">
            <ResponsiveContainer width="100%" height={224} minHeight={224}>
              <AreaChart data={currentDetail.band_chart_data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#78716c' }} />
                <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#78716c' }} />
                <RechartsTooltip content={<CustomBandTooltip />} />
                <Legend 
                  verticalAlign="bottom" 
                  height={26} 
                  formatter={(value) => 
                    value === 'ratio_value' ? (isThai ? `— ${ratioLabel}` : `— ${ratioLabel}`) :
                    value === 'historical_avg' ? (isThai ? '--- ค่าเฉลี่ยย้อนหลัง' : '--- Historical Avg') :
                    value === 'industry_avg' ? (isThai ? '— ค่าเฉลี่ยกลุ่ม' : '— Industry Avg') :
                    value === 'benchmark_index' ? (isThai ? '— S&P 500 / Index' : '— S&P 500 / Index') :
                    (isThai ? 'ช่วงที่สมเหตุผล' : 'Reasonable Range')
                  }
                />
                {/* Shaded Reasonable Range Band */}
                <Area type="monotone" dataKey="band_upper" stroke="none" fill="#0b5a4b" fillOpacity={0.08} name="reasonable_range" isAnimationActive={false} />
                <Area type="monotone" dataKey="band_lower" stroke="none" fill="#ffffff" fillOpacity={1} isAnimationActive={false} />
                
                {/* Lines */}
                <Line type="monotone" dataKey="ratio_value" stroke="#0b5a4b" strokeWidth={2.5} dot={{ r: 3, fill: '#0b5a4b' }} activeDot={{ r: 5 }} name="ratio_value" isAnimationActive={false} />
                <Line type="monotone" dataKey="historical_avg" stroke="#78716c" strokeWidth={1.8} strokeDasharray="4 4" dot={false} name="historical_avg" isAnimationActive={false} />
                {currentDetail.band_chart_data[0]?.industry_avg !== undefined && (
                  <Line type="monotone" dataKey="industry_avg" stroke="#d97706" strokeWidth={2} dot={false} name="industry_avg" isAnimationActive={false} />
                )}
                {currentDetail.band_chart_data[0]?.benchmark_index !== undefined && (
                  <Line type="monotone" dataKey="benchmark_index" stroke="#64748b" strokeWidth={1.8} dot={false} name="benchmark_index" isAnimationActive={false} />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Module 2: Earnings Growth (when P/E) or Revenue Growth (when P/S) or Industry Distribution (when P/B) */}
        {activeRatio === 'pe' ? (
          <div className="bg-stone-50 p-4 sm:p-5 rounded-2xl border border-stone-200 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 border-b border-stone-200/60 pb-3">
              <div>
                <span className="font-bold text-stone-900 text-base sm:text-lg font-sans">
                  {isThai ? 'การเติบโตของกำไร vs มูลค่าตลาด (Earnings Growth)' : 'Earnings Growth'}
                </span>
                <div className="flex items-center gap-3 mt-1 text-xs font-mono">
                  <span className="text-stone-700">
                    Net Income (5Y): <strong className="text-blue-600">{earningsGrowth?.net_income_5y_growth || '+1.36x'}</strong>
                  </span>
                  <span className="text-stone-700">
                    Market Cap (5Y): <strong className="text-amber-700">{earningsGrowth?.market_cap_5y_growth || '+1.75x'}</strong>
                  </span>
                </div>
              </div>
            </div>

            {earningsGrowth?.insight_note && (
              <div className="p-2.5 bg-amber-50/80 rounded-xl border border-amber-200/60 text-xs text-amber-900 font-sans my-2 leading-relaxed">
                {earningsGrowth.insight_note}
              </div>
            )}

            <div className="h-48 w-full mt-1">
              <ResponsiveContainer width="100%" height={192} minHeight={192}>
                <LineChart data={earningsGrowth?.chart_data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                  <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#78716c' }} />
                  <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#78716c' }} />
                  <RechartsTooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-[#1c1917] text-white p-2.5 rounded-xl border border-white/15 shadow-2xl text-xs font-sans space-y-1.5 min-w-[190px]">
                            <div className="text-stone-300 font-mono text-[11px] border-b border-stone-800 pb-1 font-bold">{label}</div>
                            {payload.map((entry: any, i: number) => {
                              const isNetIncome = entry.dataKey === 'net_income_multiple';
                              const nameLabel = isNetIncome ? (isThai ? 'กำไรสุทธิ TTM' : 'Net Income TTM') : (isThai ? 'มูลค่าตลาด' : 'Market Cap');
                              const colorDot = isNetIncome ? '#34d399' : '#fbbf24';
                              return (
                                <div key={i} className="flex items-center justify-between gap-3 text-xs">
                                  <div className="flex items-center gap-1.5 text-stone-300">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorDot }} />
                                    <span>{nameLabel}:</span>
                                  </div>
                                  <span className="font-mono font-bold text-white">{Number(entry.value).toFixed(2)}x</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={26} 
                    formatter={(value) => value === 'net_income_multiple' ? (isThai ? '— กำไรสุทธิ TTM' : '— Net Income TTM') : (isThai ? '— มูลค่าตลาด' : '— Market Cap')} 
                  />
                  <Line type="monotone" dataKey="net_income_multiple" stroke="#0b5a4b" strokeWidth={2.5} dot={{ r: 3, fill: '#0b5a4b' }} activeDot={{ r: 5 }} name="net_income_multiple" isAnimationActive={false} />
                  <Line type="monotone" dataKey="market_cap_multiple" stroke="#d97706" strokeWidth={2.5} dot={{ r: 3, fill: '#d97706' }} activeDot={{ r: 5 }} name="market_cap_multiple" isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : activeRatio === 'ps' ? (
          /* When P/S: show Revenue Growth vs Market Cap */
          <div className="bg-stone-50/80 p-4 sm:p-5 rounded-2xl border border-stone-200 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 border-b border-stone-200/60 pb-3">
              <div>
                <span className="font-bold text-stone-900 text-base sm:text-lg font-sans">
                  {isThai ? 'การเติบโตของรายได้ vs มูลค่าตลาด (Revenue Growth)' : 'Revenue Growth'}
                </span>
                <div className="flex items-center gap-3 mt-1 text-xs font-mono">
                  <span className="text-stone-700">
                    Revenue (5Y): <strong className="text-[#0b5a4b]">{revenueGrowth?.revenue_5y_growth || '+1.28x'}</strong>
                  </span>
                  <span className="text-stone-700">
                    Market Cap (5Y): <strong className="text-amber-700">{revenueGrowth?.market_cap_5y_growth || '+1.75x'}</strong>
                  </span>
                </div>
              </div>
            </div>

            {revenueGrowth?.insight_note && (
              <div className="p-2.5 bg-amber-50/80 rounded-xl border border-amber-200/60 text-xs text-amber-900 font-sans my-2 leading-relaxed">
                {revenueGrowth.insight_note}
              </div>
            )}

            <div className="h-48 w-full mt-1">
              <ResponsiveContainer width="100%" height={192} minHeight={192}>
                <LineChart data={revenueGrowth?.chart_data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                  <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#78716c' }} />
                  <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#78716c' }} />
                  <RechartsTooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-[#1c1917] text-white p-2.5 rounded-xl border border-white/15 shadow-2xl text-xs font-sans space-y-1.5 min-w-[190px]">
                            <div className="text-stone-300 font-mono text-[11px] border-b border-stone-800 pb-1 font-bold">{label}</div>
                            {payload.map((entry: any, i: number) => {
                              const isRev = entry.dataKey === 'revenue_multiple';
                              const nameLabel = isRev ? (isThai ? 'รายได้รวม TTM' : 'Revenue TTM') : (isThai ? 'มูลค่าตลาด' : 'Market Cap');
                              const colorDot = isRev ? '#34d399' : '#fbbf24';
                              return (
                                <div key={i} className="flex items-center justify-between gap-3 text-xs">
                                  <div className="flex items-center gap-1.5 text-stone-300">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorDot }} />
                                    <span>{nameLabel}:</span>
                                  </div>
                                  <span className="font-mono font-bold text-white">{Number(entry.value).toFixed(2)}x</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={26} 
                    formatter={(value) => value === 'revenue_multiple' ? (isThai ? '— รายได้รวม TTM' : '— Revenue TTM') : (isThai ? '— มูลค่าตลาด' : '— Market Cap')} 
                  />
                  <Line type="monotone" dataKey="revenue_multiple" stroke="#0b5a4b" strokeWidth={2.5} dot={{ r: 3, fill: '#0b5a4b' }} activeDot={{ r: 5 }} name="revenue_multiple" isAnimationActive={false} />
                  <Line type="monotone" dataKey="market_cap_multiple" stroke="#d97706" strokeWidth={2.5} dot={{ r: 3, fill: '#d97706' }} activeDot={{ r: 5 }} name="market_cap_multiple" isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          /* When P/B: show Industry Distribution on Top Right */
          <div className="bg-stone-50/80 p-4 sm:p-5 rounded-2xl border border-stone-200 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 border-b border-stone-200/60 pb-3">
              <div>
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">
                  {isThai ? 'การกระจายตัวในกลุ่มอุตสาหกรรม' : 'Industry Distribution'}
                </span>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="text-xs font-sans text-stone-600">
                    {isThai ? 'อันดับในกลุ่ม:' : 'Ranking:'} <strong className="font-mono text-stone-900">{currentDetail.industry_ranking}</strong>
                  </span>
                  <span className="text-xs font-sans text-stone-600">
                    {ratioLabel}: <strong className="font-mono text-[#0b5a4b]">{currentDetail.current_value.toFixed(2)}{ratioUnit}</strong>
                  </span>
                  <span className="text-xs font-sans text-stone-600">
                    {isThai ? 'ค่าเฉลี่ยกลุ่ม:' : 'Industry Avg:'} <strong className="font-mono text-amber-700">{currentDetail.industry_avg.toFixed(2)}{ratioUnit}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="h-56 w-full mt-3">
              <ResponsiveContainer width="100%" height={224} minHeight={224}>
                <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                  <XAxis type="number" dataKey="ratio_value" name={ratioLabel} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#78716c' }} />
                  <YAxis type="number" dataKey="market_cap_b" name="Market Cap ($B)" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#78716c' }} />
                  <ReferenceLine x={currentDetail.industry_avg} stroke="#d97706" strokeDasharray="3 3" label={{ value: 'Industry Avg', position: 'insideTopRight', fill: '#d97706', fontSize: 10 }} />
                  <RechartsTooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload as IndustryDistributionItem;
                        return (
                          <div className="bg-[#1c1917] text-white p-2.5 rounded-xl border border-white/15 shadow-xl text-xs font-sans">
                            <div className="font-bold text-emerald-400">{data.name} ({data.symbol})</div>
                            <div className="font-mono mt-1 text-stone-300">{ratioLabel}: <strong>{typeof data.ratio_value === 'number' ? data.ratio_value.toFixed(2) : data.ratio_value}{ratioUnit}</strong></div>
                            <div className="font-mono text-stone-300">Market Cap: <strong>{formatMarketCapDisplay(data.market_cap_b)}</strong></div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Scatter 
                    name="Companies" 
                    data={currentDetail.industry_distribution} 
                    fill="#94a3b8"
                    shape={(props: any) => {
                      const { cx, cy, payload } = props;
                      const isTarget = payload.is_target;
                      return (
                        <circle 
                          cx={cx} 
                          cy={cy} 
                          r={isTarget ? 9 : 6} 
                          fill={isTarget ? '#0b5a4b' : '#94a3b8'} 
                          stroke={isTarget ? '#ffffff' : 'none'}
                          strokeWidth={isTarget ? 2.5 : 0}
                          className="transition-all cursor-pointer shadow-md"
                        />
                      );
                    }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-center gap-4 text-xs font-sans mt-2 pt-2 border-t border-stone-200/60">
              <span className="flex items-center gap-1.5 font-bold text-[#0b5a4b]">
                <span className="w-3 h-3 rounded-full bg-[#0b5a4b] inline-block border-2 border-white shadow-2xs"></span> {ticker}
              </span>
              <span className="flex items-center gap-1.5 text-stone-600">
                <span className="w-2.5 h-2.5 rounded-full bg-[#94a3b8] inline-block"></span> {isThai ? 'หุ้นอื่นในกลุ่ม' : 'Other Peers'}
              </span>
              <span className="flex items-center gap-1.5 text-amber-800 font-mono">
                <span className="w-3 h-0.5 bg-[#d97706] inline-block"></span> {isThai ? 'ค่าเฉลี่ยกลุ่ม' : 'Industry Avg'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Grid 2: Industry Distribution (when P/E or P/S) + Market Distribution (Donut) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Module 3: Industry Distribution Scatter Plot (shown when P/E or P/S active) */}
        {activeRatio !== 'pb' && (
          <div className="bg-stone-50/80 p-4 sm:p-5 rounded-2xl border border-stone-200 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 border-b border-stone-200/60 pb-3">
              <div>
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">
                  {isThai ? 'การกระจายตัวในกลุ่มอุตสาหกรรม' : 'Industry Distribution'}
                </span>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="text-xs font-sans text-stone-600">
                    {isThai ? 'อันดับในกลุ่ม:' : 'Ranking:'} <strong className="font-mono text-stone-900">{currentDetail.industry_ranking}</strong>
                  </span>
                  <span className="text-xs font-sans text-stone-600">
                    {ratioLabel}: <strong className="font-mono text-[#0b5a4b]">{currentDetail.current_value.toFixed(2)}{ratioUnit}</strong>
                  </span>
                  <span className="text-xs font-sans text-stone-600">
                    {isThai ? 'ค่าเฉลี่ยกลุ่ม:' : 'Industry Avg:'} <strong className="font-mono text-amber-700">{currentDetail.industry_avg.toFixed(2)}{ratioUnit}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Scatter Plot / Bubble Distribution */}
            <div className="h-56 w-full mt-3">
              <ResponsiveContainer width="100%" height={224} minHeight={224}>
                <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                  <XAxis type="number" dataKey="ratio_value" name={ratioLabel} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#78716c' }} />
                  <YAxis type="number" dataKey="market_cap_b" name="Market Cap ($B)" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#78716c' }} />
                  <ReferenceLine x={currentDetail.industry_avg} stroke="#d97706" strokeDasharray="3 3" label={{ value: 'Industry Avg', position: 'insideTopRight', fill: '#d97706', fontSize: 10 }} />
                  <RechartsTooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload as IndustryDistributionItem;
                        return (
                          <div className="bg-[#1c1917] text-white p-2.5 rounded-xl border border-white/15 shadow-xl text-xs font-sans">
                            <div className="font-bold text-emerald-400">{data.name} ({data.symbol})</div>
                            <div className="font-mono mt-1 text-stone-300">{ratioLabel}: <strong>{typeof data.ratio_value === 'number' ? data.ratio_value.toFixed(2) : data.ratio_value}{ratioUnit}</strong></div>
                            <div className="font-mono text-stone-300">Market Cap: <strong>{formatMarketCapDisplay(data.market_cap_b)}</strong></div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Scatter 
                    name="Companies" 
                    data={currentDetail.industry_distribution} 
                    fill="#94a3b8"
                    isAnimationActive={false}
                    shape={(props: any) => {
                      const { cx, cy, payload } = props;
                      const isTarget = payload.is_target;
                      return (
                        <circle 
                          cx={cx} 
                          cy={cy} 
                          r={isTarget ? 9 : 6} 
                          fill={isTarget ? '#0b5a4b' : '#94a3b8'} 
                          stroke={isTarget ? '#ffffff' : 'none'}
                          strokeWidth={isTarget ? 2.5 : 0}
                          className="transition-all cursor-pointer shadow-md"
                        />
                      );
                    }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-center gap-4 text-xs font-sans mt-2 pt-2 border-t border-stone-200/60">
              <span className="flex items-center gap-1.5 font-bold text-[#0b5a4b]">
                <span className="w-3 h-3 rounded-full bg-[#0b5a4b] inline-block border-2 border-white shadow-2xs"></span> {ticker}
              </span>
              <span className="flex items-center gap-1.5 text-stone-600">
                <span className="w-2.5 h-2.5 rounded-full bg-[#94a3b8] inline-block"></span> {isThai ? 'หุ้นอื่นในกลุ่ม' : 'Other Peers'}
              </span>
              <span className="flex items-center gap-1.5 text-amber-800 font-mono">
                <span className="w-3 h-0.5 bg-[#d97706] inline-block"></span> {isThai ? 'ค่าเฉลี่ยกลุ่ม' : 'Industry Avg'}
              </span>
            </div>
          </div>
        )}

        {/* Module 4: Market Distribution (Donut Chart & Table) */}
        <div className={`bg-stone-50 p-4 sm:p-5 rounded-2xl border border-stone-200 flex flex-col justify-between ${activeRatio === 'pb' ? 'lg:col-span-2' : ''}`}>
          <div className="flex items-center justify-between gap-2 border-b border-stone-200/60 pb-3">
            <div>
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">
                {isThai ? 'การกระจายตัวทั้งตลาด (Market Distribution)' : 'Market Distribution'}
              </span>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-xs font-sans text-stone-600">
                  {isThai ? 'อันดับตลาด:' : 'Market Rank:'} <strong className="font-mono text-stone-900">{currentDetail.market_ranking}</strong>
                </span>
                <span className="text-xs font-sans text-stone-600">
                  {isThai ? 'ค่าเฉลี่ยตลาด:' : 'Market Avg:'} <strong className="font-mono text-stone-800">{currentDetail.market_avg.toFixed(2)}{ratioUnit}</strong>
                </span>
                <span className="text-xs font-sans text-stone-600">
                  {isThai ? 'มัธยฐาน:' : 'Median:'} <strong className="font-mono text-stone-800">{currentDetail.market_median.toFixed(2)}{ratioUnit}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-3 mt-3">
            {/* Donut Chart with Ticker Centered */}
            <div className="relative h-48 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height={192} minHeight={192}>
                <RechartsPieChart>
                  <Pie
                    data={marketDist}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={2}
                    dataKey="ratio_pct"
                    nameKey="range_label"
                    isAnimationActive={false}
                    onMouseEnter={(_, index) => setActiveDistIndex(index)}
                  >
                    {marketDist.map((_, index) => (
                      <Cell 
                        key={`cell-dist-${index}`} 
                        fill={DIST_COLORS[index % DIST_COLORS.length]} 
                        opacity={activeDistIndex === null || activeDistIndex === index ? 1 : 0.45}
                        stroke={activeDistIndex === index ? '#ffffff' : 'none'}
                        strokeWidth={2}
                        className="transition-opacity cursor-pointer"
                      />
                    ))}
                  </Pie>
                </RechartsPieChart>
              </ResponsiveContainer>

              {/* Center Text Box */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
                <span className="text-xs font-bold font-mono text-stone-900 bg-white/90 px-2 py-0.5 rounded-md shadow-2xs border border-stone-200">
                  {ticker}
                </span>
                {currentDistSlice && (
                  <span className="text-[10px] text-stone-500 font-mono mt-0.5 font-semibold">
                    {currentDistSlice.range_label} ({currentDistSlice.ratio_pct}%)
                  </span>
                )}
              </div>
            </div>

            {/* Distribution Legend Table */}
            <div className="flex flex-col gap-1 text-xs font-sans">
              {marketDist.map((entry, idx) => (
                <button
                  key={idx}
                  type="button"
                  onMouseEnter={() => setActiveDistIndex(idx)}
                  className={`flex items-center justify-between p-1.5 rounded-lg transition-colors text-left cursor-pointer ${
                    activeDistIndex === idx ? 'bg-stone-200/80 font-semibold' : 'hover:bg-stone-100'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span 
                      className="w-2.5 h-2.5 rounded-xs shrink-0" 
                      style={{ backgroundColor: DIST_COLORS[idx % DIST_COLORS.length] }}
                    />
                    <span className="text-stone-700 truncate">{entry.range_label}</span>
                  </div>
                  <div className="text-right shrink-0 ml-2 font-mono text-stone-600">
                    <span>{entry.count.toLocaleString()} ({entry.ratio_pct}%)</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Module 5: Peer Companies Table */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
          {isThai ? 'ตารางเปรียบเทียบอัตราส่วนกับหุ้นร่วมกลุ่ม (Peer Companies Table)' : 'Peer Companies Valuation Table'}
        </span>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[620px]">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/70 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                <th className="py-2.5 px-3">No.</th>
                <th className="py-2.5 px-3">{isThai ? 'สัญลักษณ์ (Symbol)' : 'Symbol'}</th>
                <th className="py-2.5 px-3">{isThai ? 'ชื่อบริษัท (Company Name)' : 'Name'}</th>
                <th className="py-2.5 px-3 text-right">{isThai ? 'มูลค่าตลาด (Mkt Cap)' : 'Mkt Cap'}</th>
                <th className="py-2.5 px-3 text-right">{ratioLabel} TTM</th>
                {activeRatio === 'pe' && (
                  <th className="py-2.5 px-3 text-right">{isThai ? 'Forward P/E คาดการณ์' : 'Forward P/E'}</th>
                )}
                <th className="py-2.5 px-3 text-right">{isThai ? 'เปอร์เซ็นไทล์ 5 ปี (5Y %tile)' : '5Y Percentile'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs sm:text-sm font-sans">
              {currentDetail.peer_comparison_list.map((peer, idx) => (
                <tr 
                  key={idx} 
                  className={`transition-colors ${
                    peer.is_target 
                      ? 'bg-emerald-50/60 font-semibold text-emerald-950' 
                      : 'hover:bg-stone-50/60 text-stone-800'
                  }`}
                >
                  <td className="py-3 px-3 font-mono text-stone-500">{idx + 1}</td>
                  <td className="py-3 px-3 font-mono font-bold">{peer.symbol}</td>
                  <td className="py-3 px-3">{peer.name}</td>
                  <td className="py-3 px-3 text-right font-mono">{formatMarketCapDisplay(peer.market_cap_b)}</td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-[#0b5a4b]">
                    {typeof peer.ratio_value === 'number' ? `${peer.ratio_value.toFixed(2)}x` : peer.ratio_value}
                  </td>
                  {activeRatio === 'pe' && (
                    <td className="py-3 px-3 text-right font-mono text-stone-600">
                      {peer.forward_ratio ? (typeof peer.forward_ratio === 'number' ? `${peer.forward_ratio.toFixed(2)}x` : peer.forward_ratio) : '-'}
                    </td>
                  )}
                  <td className="py-3 px-3 text-right font-mono">
                    {peer.percentile_5y !== undefined ? (
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        peer.percentile_5y >= 80 ? 'text-rose-700 bg-rose-50' : 'text-stone-700 bg-stone-100'
                      }`}>
                        {peer.percentile_5y}%
                      </span>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
