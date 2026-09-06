import React, { useState } from 'react';
import { 
  Briefcase, Globe, TrendingUp, Users, DollarSign, 
  Layers, ChevronDown, Calendar, ArrowUpRight, ArrowDownRight, 
  BarChart3, Award, Sparkles 
} from 'lucide-react';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend 
} from 'recharts';
import { BusinessAnalysisData, RevenueSegmentItem, OperationalEfficiencyItem } from '../types';

interface BusinessAnalysisCardProps {
  data?: BusinessAnalysisData;
  ticker: string;
  isThai: boolean;
}

const BUSINESS_COLORS = ['#0b5a4b', '#1e3a8a', '#334155', '#475569', '#d97706', '#78716c'];
const REGION_COLORS = ['#0b5a4b', '#1e3a8a', '#334155', '#64748b', '#d97706', '#a8a29e'];

function formatSegmentRevenue(rev?: string | number): string {
  if (!rev) return '-';
  if (typeof rev === 'number') {
    if (Math.abs(rev) >= 1000) return `$${(rev / 1000).toFixed(2).replace(/\.?0+$/, '')}B`;
    return `$${rev}M`;
  }
  const clean = rev.replace('$', '').replace('M', '').replace('B', '').trim();
  const num = parseFloat(clean);
  if (!isNaN(num)) {
    if (rev.endsWith('M') && num >= 1000) {
      return `$${(num / 1000).toFixed(2).replace(/\.?0+$/, '')}B`;
    }
  }
  return rev;
}

export const BusinessAnalysisCard: React.FC<BusinessAnalysisCardProps> = ({
  data,
  ticker,
  isThai
}) => {
  const [activeTab, setActiveTab] = useState<'breakdown' | 'efficiency'>('breakdown');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('Latest (2026/Q2)');
  const [isPeriodOpen, setIsPeriodOpen] = useState<boolean>(false);
  const [showYoY, setShowYoY] = useState<boolean>(true);

  // Active hover states for Donut charts
  const [activeBizIndex, setActiveBizIndex] = useState<number | null>(0);
  const [activeRegIndex, setActiveRegIndex] = useState<number | null>(0);

  if (!data) return null;

  const breakdown = data.revenue_breakdown || {};
  const byBusiness: RevenueSegmentItem[] = breakdown.by_business || [
    { name: 'Commercial - AIP / Foundry', revenue_usd: '$520M', ratio_pct: 52.0, growth_yoy_pct: 55.4 },
    { name: 'Government - Gotham Defense', revenue_usd: '$340M', ratio_pct: 34.0, growth_yoy_pct: 28.2 },
    { name: 'International Government', revenue_usd: '$85M', ratio_pct: 8.5, growth_yoy_pct: 12.0 },
    { name: 'International Commercial', revenue_usd: '$55M', ratio_pct: 5.5, growth_yoy_pct: 18.5 }
  ];

  const byRegion: RevenueSegmentItem[] = breakdown.by_region || [
    { name: 'United States (สหรัฐอเมริกา)', revenue_usd: '$860M', ratio_pct: 86.0, growth_yoy_pct: 44.0 },
    { name: 'United Kingdom & Europe', revenue_usd: '$95M', ratio_pct: 9.5, growth_yoy_pct: 15.2 },
    { name: 'Asia Pacific & Middle East', revenue_usd: '$45M', ratio_pct: 4.5, growth_yoy_pct: 32.0 }
  ];

  const efficiency: OperationalEfficiencyItem[] = data.operational_efficiency || [
    { period: '2021/FY', headcount: 2920, headcount_yoy_pct: 19.5, revenue_per_employee_k_usd: 527.4, revenue_per_employee_yoy_pct: 17.5, operating_profit_per_employee_k_usd: -140.2, op_profit_per_employee_yoy_pct: -35.2, net_income_per_employee_k_usd: -178.1, net_income_per_employee_yoy_pct: -52.0 },
    { period: '2022/FY', headcount: 3838, headcount_yoy_pct: 31.4, revenue_per_employee_k_usd: 496.6, revenue_per_employee_yoy_pct: -5.8, operating_profit_per_employee_k_usd: -42.0, op_profit_per_employee_yoy_pct: 70.0, net_income_per_employee_k_usd: -96.7, net_income_per_employee_yoy_pct: 45.7 },
    { period: '2023/FY', headcount: 3800, headcount_yoy_pct: -1.0, revenue_per_employee_k_usd: 585.5, revenue_per_employee_yoy_pct: 17.9, operating_profit_per_employee_k_usd: 31.6, op_profit_per_employee_yoy_pct: 175.2, net_income_per_employee_k_usd: 57.1, net_income_per_employee_yoy_pct: 159.0 },
    { period: '2024/FY', headcount: 3650, headcount_yoy_pct: -3.9, revenue_per_employee_k_usd: 780.8, revenue_per_employee_yoy_pct: 33.4, operating_profit_per_employee_k_usd: 145.2, op_profit_per_employee_yoy_pct: 359.5, net_income_per_employee_k_usd: 122.4, net_income_per_employee_yoy_pct: 114.4 },
    { period: '2025/FY', headcount: 3750, headcount_yoy_pct: 2.7, revenue_per_employee_k_usd: 945.0, revenue_per_employee_yoy_pct: 21.0, operating_profit_per_employee_k_usd: 215.0, op_profit_per_employee_yoy_pct: 48.1, net_income_per_employee_k_usd: 165.0, net_income_per_employee_yoy_pct: 34.8 },
    { period: '2026/LTM', headcount: 3850, headcount_yoy_pct: 2.7, revenue_per_employee_k_usd: 1050.4, revenue_per_employee_yoy_pct: 11.2, operating_profit_per_employee_k_usd: 260.5, op_profit_per_employee_yoy_pct: 21.2, net_income_per_employee_k_usd: 185.2, net_income_per_employee_yoy_pct: 12.2 }
  ];

  const availablePeriods = ['Latest (2026/Q2)', '2026/Q1', '2025/FY', '2024/FY'];

  const currentBiz = (activeBizIndex !== null && byBusiness[activeBizIndex]) ? byBusiness[activeBizIndex] : byBusiness[0];
  const currentReg = (activeRegIndex !== null && byRegion[activeRegIndex]) ? byRegion[activeRegIndex] : byRegion[0];

  const latestEff = efficiency[efficiency.length - 1];

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-7 border border-stone-200 shadow-sm flex flex-col gap-5 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-800 flex items-center justify-center border border-teal-200/60 shadow-xs">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900 text-lg sm:text-xl font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight">
              {isThai ? 'Business Analysis: โครงสร้างธุรกิจ & ประสิทธิภาพ' : 'Business Analysis & Operational Efficiency'}
            </h3>
            <span className="text-xs text-stone-500 font-sans">
              {isThai ? 'สัดส่วนรายได้แยกตามผลิตภัณฑ์/ภูมิภาค และผลิตภาพต่อพนักงาน (Revenue & Profit Per Employee)' : 'Revenue breakdown by product/region and operational productivity per employee'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Period Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsPeriodOpen(!isPeriodOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200/80 rounded-xl text-xs font-semibold text-stone-700 transition-colors cursor-pointer border border-stone-200/60 font-mono"
            >
              <span>{selectedPeriod}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>
            {isPeriodOpen && (
              <div className="absolute right-0 mt-1 w-36 bg-white border border-stone-200 rounded-xl shadow-lg z-20 py-1 font-mono text-xs">
                {availablePeriods.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setSelectedPeriod(p);
                      setIsPeriodOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 hover:bg-stone-50 transition-colors flex items-center justify-between ${
                      selectedPeriod === p ? 'text-[#0b5a4b] font-bold bg-emerald-50/50' : 'text-stone-700'
                    }`}
                  >
                    <span>{p}</span>
                    {selectedPeriod === p && <span className="w-1.5 h-1.5 rounded-full bg-[#0b5a4b]"></span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {data.as_of_date && (
            <span className="text-xs text-stone-400 font-mono hidden md:flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {data.as_of_date}
            </span>
          )}
        </div>
      </div>

      {/* Tabs - Responsive flex-wrap with zero scrollbars */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-stone-100/90 rounded-2xl border border-stone-200/60 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('breakdown')}
          className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'breakdown'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{isThai ? 'โครงสร้างรายได้ (Revenue Breakdown)' : 'Revenue Breakdown'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('efficiency')}
          className={`px-3.5 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'efficiency'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>{isThai ? 'ประสิทธิภาพต่อพนักงาน (Operational Efficiency)' : 'Operational Efficiency'}</span>
        </button>
      </div>

      {/* TAB 1: REVENUE BREAKDOWN (Business & Region) */}
      {activeTab === 'breakdown' && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Donut 1: By Business Segment */}
            <div className="bg-stone-50 p-4 sm:p-5 rounded-2xl border border-stone-200/80 flex flex-col avoid-page-break">
              <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-[#0b5a4b]" />
                <span>{isThai ? 'สัดส่วนตามสายธุรกิจ (Business / Product Lines)' : 'Business Segments'}</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-3">
                {/* Donut with Center Highlight Box */}
                <div className="relative h-48 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={192} minHeight={192}>
                    <PieChart>
                      <Pie
                        data={byBusiness}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={2}
                        dataKey="ratio_pct"
                        nameKey="name"
                        isAnimationActive={false}
                        onMouseEnter={(_, index) => setActiveBizIndex(index)}
                      >
                        {byBusiness.map((_, index) => (
                          <Cell 
                            key={`biz-${index}`} 
                            fill={BUSINESS_COLORS[index % BUSINESS_COLORS.length]} 
                            opacity={activeBizIndex === null || activeBizIndex === index ? 1 : 0.45}
                            stroke={activeBizIndex === index ? '#ffffff' : 'none'}
                            strokeWidth={2}
                            className="transition-opacity cursor-pointer"
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Center Text Box */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
                    {currentBiz ? (
                      <>
                        <span className="text-[10px] font-semibold text-stone-600 truncate max-w-[90px]">
                          {currentBiz.name.split(' - ')[0]}
                        </span>
                        <span className="text-base font-bold font-mono text-stone-900 leading-tight">
                          {currentBiz.ratio_pct}%
                        </span>
                        <span className="text-[10px] font-mono text-stone-500">
                          {formatSegmentRevenue(currentBiz.revenue_usd)}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs font-bold text-stone-500">Business</span>
                    )}
                  </div>
                </div>

                {/* Vertical Legend Table */}
                <div className="flex flex-col gap-1.5 text-xs font-sans">
                  {byBusiness.map((entry, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onMouseEnter={() => setActiveBizIndex(idx)}
                      className={`flex items-center justify-between p-1.5 rounded-lg transition-colors text-left cursor-pointer ${
                        activeBizIndex === idx ? 'bg-stone-200/80 font-semibold' : 'hover:bg-stone-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span 
                          className="w-2.5 h-2.5 rounded-xs shrink-0" 
                          style={{ backgroundColor: BUSINESS_COLORS[idx % BUSINESS_COLORS.length] }}
                        />
                        <span className="text-stone-700 truncate">{entry.name}</span>
                      </div>
                      <div className="text-right shrink-0 ml-2 font-mono">
                        <span className="text-stone-900 font-bold block">{entry.ratio_pct}%</span>
                        <span className="text-[10px] text-stone-500">{formatSegmentRevenue(entry.revenue_usd)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Donut 2: By Region Segment */}
            <div className="bg-stone-50 p-4 sm:p-5 rounded-2xl border border-stone-200/80 flex flex-col avoid-page-break">
              <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                <span>{isThai ? 'สัดส่วนตามภูมิภาค (Geographic / Regional)' : 'Regional Markets'}</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-3">
                {/* Donut with Center Highlight Box */}
                <div className="relative h-48 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={192} minHeight={192}>
                    <PieChart>
                      <Pie
                        data={byRegion}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={2}
                        dataKey="ratio_pct"
                        nameKey="name"
                        isAnimationActive={false}
                        onMouseEnter={(_, index) => setActiveRegIndex(index)}
                      >
                        {byRegion.map((_, index) => (
                          <Cell 
                            key={`reg-${index}`} 
                            fill={REGION_COLORS[index % REGION_COLORS.length]} 
                            opacity={activeRegIndex === null || activeRegIndex === index ? 1 : 0.45}
                            stroke={activeRegIndex === index ? '#ffffff' : 'none'}
                            strokeWidth={2}
                            className="transition-opacity cursor-pointer"
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Center Text Box */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
                    {currentReg ? (
                      <>
                        <span className="text-[10px] font-semibold text-stone-600 truncate max-w-[90px]">
                          {currentReg.name.split(' (')[0]}
                        </span>
                        <span className="text-base font-bold font-mono text-stone-900 leading-tight">
                          {currentReg.ratio_pct}%
                        </span>
                        <span className="text-[10px] font-mono text-stone-500">
                          {formatSegmentRevenue(currentReg.revenue_usd)}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs font-bold text-stone-500">Region</span>
                    )}
                  </div>
                </div>

                {/* Vertical Legend Table */}
                <div className="flex flex-col gap-1.5 text-xs font-sans">
                  {byRegion.map((entry, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onMouseEnter={() => setActiveRegIndex(idx)}
                      className={`flex items-center justify-between p-1.5 rounded-lg transition-colors text-left cursor-pointer ${
                        activeRegIndex === idx ? 'bg-stone-200/80 font-semibold' : 'hover:bg-stone-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span 
                          className="w-2.5 h-2.5 rounded-xs shrink-0" 
                          style={{ backgroundColor: REGION_COLORS[idx % REGION_COLORS.length] }}
                        />
                        <span className="text-stone-700 truncate">{entry.name}</span>
                      </div>
                      <div className="text-right shrink-0 ml-2 font-mono">
                        <span className="text-stone-900 font-bold block">{entry.ratio_pct}%</span>
                        <span className="text-[10px] text-stone-500">{formatSegmentRevenue(entry.revenue_usd)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: OPERATIONAL EFFICIENCY (Productivity per Employee) */}
      {activeTab === 'efficiency' && (
        <div className="flex flex-col gap-5">
          {/* 4 KPI Banner */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100 flex flex-col justify-between">
              <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
                {isThai ? 'จำนวนพนักงานรวม (Headcount)' : 'Headcount'}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl sm:text-2xl font-bold font-mono text-stone-900">
                  {typeof latestEff.headcount === 'number' ? latestEff.headcount.toLocaleString() : latestEff.headcount}
                </span>
                {latestEff.headcount_yoy_pct !== undefined && (
                  <span className="text-xs font-mono font-bold text-emerald-700">
                    +{latestEff.headcount_yoy_pct}% YoY
                  </span>
                )}
              </div>
            </div>

            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100 flex flex-col justify-between">
              <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
                {isThai ? 'รายได้ต่อพนักงาน (Revenue/Emp)' : 'Revenue / Employee'}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl sm:text-2xl font-bold font-mono text-[#0b5a4b]">
                  ${(latestEff.revenue_per_employee_k_usd / 1000).toFixed(2)}M
                </span>
                {latestEff.revenue_per_employee_yoy_pct !== undefined && (
                  <span className="text-xs font-mono font-bold text-emerald-700">
                    +{latestEff.revenue_per_employee_yoy_pct}%
                  </span>
                )}
              </div>
            </div>

            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100 flex flex-col justify-between">
              <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
                {isThai ? 'กำไรดำเนินงานต่อคน (Op Profit/Emp)' : 'Op Profit / Employee'}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl sm:text-2xl font-bold font-mono text-stone-900">
                  ${latestEff.operating_profit_per_employee_k_usd.toFixed(1)}K
                </span>
                {(latestEff.operating_profit_per_employee_yoy_pct ?? latestEff.op_profit_per_employee_yoy_pct) !== undefined && (
                  <span className="text-xs font-mono font-bold text-emerald-700">
                    +{latestEff.operating_profit_per_employee_yoy_pct ?? latestEff.op_profit_per_employee_yoy_pct}%
                  </span>
                )}
              </div>
            </div>

            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100 flex flex-col justify-between">
              <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
                {isThai ? 'กำไรสุทธิต่อคน (Net Income/Emp)' : 'Net Income / Employee'}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl sm:text-2xl font-bold font-mono text-stone-900">
                  ${latestEff.net_income_per_employee_k_usd.toFixed(1)}K
                </span>
                {latestEff.net_income_per_employee_yoy_pct !== undefined && (
                  <span className="text-xs font-mono font-bold text-emerald-700">
                    +{latestEff.net_income_per_employee_yoy_pct}%
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Multi-line Trend Chart */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col gap-2">
            <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-[#0b5a4b]" />
              <span>{isThai ? 'แนวโน้มประสิทธิภาพต่อพนักงานย้อนหลัง ($K ต่อคน)' : 'Operational Productivity Over Time ($K/Employee)'}</span>
            </h4>

            <div className="h-64 w-full mt-2">
              <ResponsiveContainer width="100%" height={256} minHeight={256}>
                <LineChart data={efficiency} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0eee9" />
                  <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#78716c' }} />
                  <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#78716c' }} />
                  <RechartsTooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-[#1c1917] text-white p-3 rounded-xl border border-white/15 shadow-2xl text-xs font-sans space-y-1.5 min-w-[220px]">
                            <div className="text-stone-300 font-mono text-[11px] border-b border-stone-800 pb-1 font-bold">{label}</div>
                            {payload.map((entry: any, i: number) => {
                              const key = entry.dataKey;
                              const nameLabel = key === 'revenue_per_employee_k_usd' ? (isThai ? 'รายได้ต่อพนักงาน' : 'Revenue/Emp') :
                                key === 'operating_profit_per_employee_k_usd' ? (isThai ? 'กำไรดำเนินงานต่อคน' : 'Op Profit/Emp') :
                                (isThai ? 'กำไรสุทธิต่อคน' : 'Net Income/Emp');
                              const colorDot = key === 'revenue_per_employee_k_usd' ? '#34d399' :
                                key === 'operating_profit_per_employee_k_usd' ? '#fbbf24' : '#94a3b8';
                              return (
                                <div key={i} className="flex items-center justify-between gap-3 text-xs">
                                  <div className="flex items-center gap-1.5 text-stone-300">
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colorDot }} />
                                    <span>{nameLabel}:</span>
                                  </div>
                                  <span className="font-mono font-bold text-white">${Number(entry.value).toFixed(1)}K</span>
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
                    height={30} 
                    formatter={(value) => 
                      value === 'revenue_per_employee_k_usd' ? (isThai ? '— รายได้ต่อพนักงาน' : '— Revenue/Emp') :
                      value === 'operating_profit_per_employee_k_usd' ? (isThai ? '— กำไรดำเนินงานต่อคน' : '— Op Profit/Emp') :
                      (isThai ? '— กำไรสุทธิต่อคน' : '— Net Income/Emp')
                    }
                  />
                  <Line type="monotone" dataKey="revenue_per_employee_k_usd" stroke="#0b5a4b" strokeWidth={2.5} dot={{ r: 4, fill: '#0b5a4b' }} activeDot={{ r: 6 }} name="revenue_per_employee_k_usd" isAnimationActive={false} />
                  <Line type="monotone" dataKey="operating_profit_per_employee_k_usd" stroke="#d97706" strokeWidth={2.5} dot={{ r: 4, fill: '#d97706' }} activeDot={{ r: 6 }} name="operating_profit_per_employee_k_usd" isAnimationActive={false} />
                  <Line type="monotone" dataKey="net_income_per_employee_k_usd" stroke="#334155" strokeWidth={2.5} dot={{ r: 4, fill: '#334155' }} activeDot={{ r: 6 }} name="net_income_per_employee_k_usd" isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Historical Table with YoY Switch */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                {isThai ? 'ตารางสถิติประสิทธิภาพการดำเนินงานย้อนหลัง' : 'Historical Operational Efficiency Data'}
              </span>
              <label className="flex items-center gap-1.5 text-xs text-stone-600 font-sans cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={showYoY} 
                  onChange={(e) => setShowYoY(e.target.checked)} 
                  className="rounded text-[#0b5a4b] focus:ring-[#0b5a4b]"
                />
                <span>{isThai ? 'แสดง % YoY' : 'Show YoY %'}</span>
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[620px]">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/70 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">{isThai ? 'ปีงบประมาณ' : 'Period'}</th>
                    <th className="py-2.5 px-3 text-right">{isThai ? 'พนักงาน (Headcount)' : 'Headcount'}</th>
                    <th className="py-2.5 px-3 text-right">{isThai ? 'รายได้ต่อพนักงาน' : 'Revenue/Emp'}</th>
                    <th className="py-2.5 px-3 text-right">{isThai ? 'กำไรดำเนินงาน/คน' : 'Op Profit/Emp'}</th>
                    <th className="py-2.5 px-3 text-right">{isThai ? 'กำไรสุทธิ/คน' : 'Net Income/Emp'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-xs sm:text-sm font-mono">
                  {efficiency.slice().reverse().map((row, idx) => (
                    <tr key={idx} className="hover:bg-stone-50/60 transition-colors">
                      <td className="py-3 px-3 font-semibold text-stone-900 font-sans">{row.period}</td>
                      <td className="py-3 px-3 text-right">
                        <span className="text-stone-900 font-bold block">
                          {typeof row.headcount === 'number' ? row.headcount.toLocaleString() : row.headcount}
                        </span>
                        {showYoY && row.headcount_yoy_pct !== undefined && (
                          <span className={`text-[10px] ${row.headcount_yoy_pct >= 0 ? 'text-emerald-700' : 'text-stone-500'}`}>
                            {row.headcount_yoy_pct >= 0 ? '+' : ''}{row.headcount_yoy_pct}%
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="text-[#0b5a4b] font-bold block">
                          ${(row.revenue_per_employee_k_usd / 1000).toFixed(2)}M
                        </span>
                        {showYoY && row.revenue_per_employee_yoy_pct !== undefined && (
                          <span className={`text-[10px] ${row.revenue_per_employee_yoy_pct >= 0 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}`}>
                            {row.revenue_per_employee_yoy_pct >= 0 ? '+' : ''}{row.revenue_per_employee_yoy_pct}%
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="text-stone-800 block font-bold">
                          ${row.operating_profit_per_employee_k_usd.toFixed(1)}K
                        </span>
                        {(() => {
                          const opYoY = row.op_profit_per_employee_yoy_pct ?? row.operating_profit_per_employee_yoy_pct;
                          return showYoY && opYoY !== undefined ? (
                            <span className={`text-[10px] ${opYoY >= 0 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}`}>
                              {opYoY >= 0 ? '+' : ''}{opYoY}%
                            </span>
                          ) : null;
                        })()}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="text-stone-800 block font-bold">
                          ${row.net_income_per_employee_k_usd.toFixed(1)}K
                        </span>
                        {showYoY && row.net_income_per_employee_yoy_pct !== undefined && (
                          <span className={`text-[10px] ${row.net_income_per_employee_yoy_pct >= 0 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}`}>
                            {row.net_income_per_employee_yoy_pct >= 0 ? '+' : ''}{row.net_income_per_employee_yoy_pct}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
