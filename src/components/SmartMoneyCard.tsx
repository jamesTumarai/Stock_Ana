import React, { useState } from 'react';
import { 
  Landmark, Users, TrendingUp, TrendingDown, Activity, 
  ShieldCheck, ArrowUpRight, ArrowDownRight, Filter, Calendar, 
  PieChart as PieIcon, ChevronDown, BarChart2, Layers, CheckCircle2
} from 'lucide-react';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ReferenceLine 
} from 'recharts';
import { SmartMoneyData, InsiderActivityData, CompanyProfileData, MajorHolderItem } from '../types';

interface SmartMoneyCardProps {
  data?: SmartMoneyData;
  legacyInsiderData?: InsiderActivityData;
  companyProfile?: CompanyProfileData;
  ticker: string;
  isThai: boolean;
}

const HOLDER_COLORS = ['#0b5a4b', '#1e3a8a', '#334155', '#475569', '#d97706', '#a8a29e'];
const TYPE_COLORS = ['#0b5a4b', '#1e3a8a', '#334155', '#64748b', '#d97706', '#78716c'];

const parseSharesToMillions = (value?: number | string): number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value > 100_000 ? value / 1_000_000 : value;
  }
  if (typeof value !== 'string') return null;
  const parsed = Number.parseFloat(value.replace(/,/g, ''));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  if (/\bB\b/i.test(value)) return parsed * 1_000;
  if (/\bM\b/i.test(value)) return parsed;
  return parsed > 100_000 ? parsed / 1_000_000 : parsed;
};

export const SmartMoneyCard: React.FC<SmartMoneyCardProps> = ({
  data,
  legacyInsiderData,
  companyProfile,
  ticker,
  isThai
}) => {
  const [activeTab, setActiveTab] = useState<'holders' | 'trend' | 'insiders' | 'activity'>('holders');
  const [activityFilter, setActivityFilter] = useState<'all' | 'increase' | 'decrease'>('all');
  const [insiderFilter, setInsiderFilter] = useState<'all' | 'sales' | 'buys'>('all');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('Latest');
  const [isQuarterDropdownOpen, setIsQuarterDropdownOpen] = useState<boolean>(false);

  // Active hover states for Donut charts
  const [activeHolderIndex, setActiveHolderIndex] = useState<number | null>(0);
  const [activeTypeIndex, setActiveTypeIndex] = useState<number | null>(0);

  const totalSharesM = parseSharesToMillions(companyProfile?.shares_outstanding);
  const unavailable = isThai ? 'ไม่มีข้อมูล (Data unavailable)' : 'Data unavailable';

  // Helper to format share counts cleanly (e.g. 2.98B, 661.7M)
  const calcHolderShares = (pct: number): string | null => {
    if (totalSharesM === null || !Number.isFinite(pct)) return null;
    const sM = totalSharesM * (pct / 100);
    return sM >= 1000 ? `${(sM / 1000).toFixed(2)}B` : `${sM.toFixed(1)}M`;
  };

  // Single Source of Truth for Institutional Ownership %
  const instPct = typeof data?.institution_overview?.pct_owned === 'number'
    ? data.institution_overview.pct_owned
    : (legacyInsiderData?.institutional_ownership_pct ?? null);

  // Derive total institutional shares only when both disclosed inputs are present.
  const formattedTotalInstShares = data?.institution_overview?.total_shares_held
    ?? (instPct !== null ? calcHolderShares(instPct) : null);

  const instOverview = {
    pct_owned: instPct,
    pct_owned_change_qoq: data?.institution_overview?.pct_owned_change_qoq ?? legacyInsiderData?.institutional_qoq_change_pct ?? null,
    total_institutions_count: data?.institution_overview?.total_institutions_count ?? null,
    institutions_count_change_qoq: data?.institution_overview?.institutions_count_change_qoq ?? null,
    total_shares_held: formattedTotalInstShares,
    shares_held_change_qoq: data?.institution_overview?.shares_held_change_qoq ?? null
  };

  const insiderPct = data?.insiders_overview?.insider_ownership_pct ?? legacyInsiderData?.insider_ownership_pct ?? null;
  const hasMeaningfulText = (value: string) => {
    const normalized = value.trim().toLowerCase();
    return normalized.length > 0
      && !['-', 'n/a', 'na', 'none', 'null', 'undefined', 'data unavailable', 'ไม่มีข้อมูล'].includes(normalized);
  };
  const rawMajorHolders = (Array.isArray(data?.major_holders) ? data.major_holders : []).filter(holder =>
    typeof holder?.name === 'string'
    && hasMeaningfulText(holder.name)
    && (
      (typeof holder.pct_owned === 'number' && Number.isFinite(holder.pct_owned))
      || (typeof holder.shares_held === 'number' && Number.isFinite(holder.shares_held))
      || (typeof holder.shares_held === 'string' && hasMeaningfulText(holder.shares_held))
    )
  );
  
  // Sanitize Major Holders to ensure shares_held is in shares, NEVER % strings!
  const majorHolders = rawMajorHolders.map(h => {
    const pctOwned = typeof h?.pct_owned === 'number' && Number.isFinite(h.pct_owned)
      ? h.pct_owned
      : null;
    let cleanShares = h.shares_held;
    if (typeof cleanShares === 'string' && cleanShares.endsWith('%')) {
      cleanShares = pctOwned !== null ? (calcHolderShares(pctOwned) ?? unavailable) : unavailable;
    } else if (typeof cleanShares === 'number') {
      cleanShares = cleanShares >= 1_000_000_000 
        ? `${(cleanShares / 1_000_000_000).toFixed(2)}B` 
        : `${(cleanShares / 1_000_000).toFixed(1)}M`;
    }
    return {
      ...h,
      name: typeof h?.name === 'string' && h.name.trim() ? h.name : unavailable,
      pct_owned: pctOwned,
      shares_held: cleanShares
    };
  });

  const rawActivity = data?.shareholder_activity ?? [];

  const recentTransactions = (data?.recent_transactions && data.recent_transactions.length > 0) 
    ? data.recent_transactions 
    : ((legacyInsiderData?.recent_transactions && legacyInsiderData.recent_transactions.length > 0) ? legacyInsiderData.recent_transactions : []);
    
  const keyInsiders = data?.insiders_overview?.key_insiders ?? [];

  const bullishTransactions = recentTransactions.filter(t => !t.transaction_type?.toLowerCase().includes('sell'));
  const bearishTransactions = recentTransactions.filter(t => t.transaction_type?.toLowerCase().includes('sell'));
  const bullishCount = data?.insiders_overview?.bullish_insiders_count ?? (recentTransactions.length > 0 ? bullishTransactions.length : null);
  const bearishCount = data?.insiders_overview?.bearish_insiders_count ?? (recentTransactions.length > 0 ? bearishTransactions.length : null);

  // Donut chart data: Major Holders
  const topHoldersChartData = majorHolders.filter(h => h.pct_owned !== null).slice(0, 5).map(h => ({
    name: h.name.replace(', Inc.', '').replace(' The ', '').replace(' Group', '').replace(' Management', ''),
    fullName: h.name,
    value: Number(h.pct_owned!.toFixed(2)),
    shares: h.shares_held
  }));
  const topSum = topHoldersChartData.reduce((acc, curr) => acc + curr.value, 0);
  if (topHoldersChartData.length > 0 && topSum < 100) {
    const otherPct = 100 - topSum;
    topHoldersChartData.push({
      name: isThai ? 'ผู้ถือหุ้นอื่น ๆ (Other)' : 'Other',
      fullName: isThai ? 'ผู้ถือหุ้นรายย่อยและสถาบันอื่น ๆ' : 'Other Holders',
      value: Number(otherPct.toFixed(2)),
      shares: calcHolderShares(otherPct) ?? unavailable
    });
  }

  // Donut chart data: Holder Types
  const typeChartData = (data?.holder_type_breakdown ?? []).filter(
    entry => typeof entry?.type === 'string' && entry.type.trim().length > 0 && typeof entry.pct === 'number' && Number.isFinite(entry.pct)
  );

  // Quarterly Trend History Data (Harmonized with instPct Single Source of Truth and true share scaling)
  const quarterlyHistory = data?.quarterly_history ?? [];
  const validQuarterlyOwnership = quarterlyHistory
    .map(item => item?.pct_owned)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const averageQuarterlyOwnership = validQuarterlyOwnership.length > 0
    ? validQuarterlyOwnership.reduce((sum, value) => sum + value, 0) / validQuarterlyOwnership.length
    : null;
  const availableQuarters = ['Latest', ...Array.from(new Set(rawActivity.map(item => item.date).filter((date): date is string => Boolean(date))))];

  const filteredActivity = rawActivity.filter(item => {
    if (activityFilter === 'increase') return item.change_type === 'increase' || item.change_type === 'new';
    if (activityFilter === 'decrease') return item.change_type === 'decrease' || item.change_type === 'sold_out';
    return true;
  });

  const filteredInsiders = recentTransactions.filter(tx => {
    const isSell = tx.transaction_type?.toLowerCase().includes('sell') || tx.transaction_type?.toLowerCase().includes('disposition');
    if (insiderFilter === 'sales') return isSell;
    if (insiderFilter === 'buys') return !isSell;
    return true;
  });

  // Current active slice for Major Holders
  const currentHolder = (activeHolderIndex !== null && topHoldersChartData[activeHolderIndex]) 
    ? topHoldersChartData[activeHolderIndex] 
    : topHoldersChartData[0];

  // Current active slice for Types
  const currentType = (activeTypeIndex !== null && typeChartData[activeTypeIndex])
    ? typeChartData[activeTypeIndex]
    : typeChartData[0];

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-7 border border-stone-200 shadow-sm flex flex-col gap-5 w-full">
      {/* Header with Quarter Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center border border-amber-200/60 shadow-xs">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900 text-lg sm:text-xl font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight">
              {isThai ? 'Smart Money: โครงสร้างผู้ถือหุ้น & กองทุนสถาบัน' : 'Smart Money & Institutional Ownership'}
            </h3>
            <span className="text-xs text-stone-500 font-sans">
              {isThai ? 'สัดส่วนกองทุนสถาบัน (13F), ผู้ถือหุ้นรายใหญ่ และธุรกรรมซื้อขายของผู้บริหาร' : 'Institutional holdings (13F filings), major funds & executive insider transactions'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Quarter Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsQuarterDropdownOpen(!isQuarterDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200/80 rounded-xl text-xs font-semibold text-stone-700 transition-colors cursor-pointer border border-stone-200/60 font-mono"
            >
              <span>{selectedQuarter}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>
            {isQuarterDropdownOpen && (
              <div className="absolute right-0 mt-1 w-32 bg-white border border-stone-200 rounded-xl shadow-lg z-20 py-1 font-mono text-xs">
                {availableQuarters.map(q => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setSelectedQuarter(q);
                      setIsQuarterDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 hover:bg-stone-50 transition-colors flex items-center justify-between ${
                      selectedQuarter === q ? 'text-[#0b5a4b] font-bold bg-emerald-50/50' : 'text-stone-700'
                    }`}
                  >
                    <span>{q}</span>
                    {selectedQuarter === q && <span className="w-1.5 h-1.5 rounded-full bg-[#0b5a4b]"></span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {data?.as_of_date && (
            <span className="text-xs text-stone-400 font-mono hidden md:flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {data.as_of_date}
            </span>
          )}
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100 flex flex-col justify-between">
          <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
            {isThai ? 'กองทุนสถาบันถือครอง' : 'Institutional Ownership'}
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl sm:text-2xl font-bold font-mono text-[#0b5a4b]">
              {instOverview.pct_owned !== null ? `${instOverview.pct_owned.toFixed(2)}%` : unavailable}
            </span>
            {instOverview.pct_owned_change_qoq !== null && (
              <span className={`text-xs font-mono font-bold flex items-center ${
                instOverview.pct_owned_change_qoq >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                {instOverview.pct_owned_change_qoq >= 0 ? '+' : ''}{instOverview.pct_owned_change_qoq.toFixed(2)}%
              </span>
            )}
          </div>
        </div>

        <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100 flex flex-col justify-between">
          <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
            {isThai ? 'จำนวนสถาบันทั้งหมด' : 'Total Institutions'}
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl sm:text-2xl font-bold font-mono text-stone-900">
              {instOverview.total_institutions_count !== null ? instOverview.total_institutions_count.toLocaleString() : unavailable}
            </span>
            {instOverview.institutions_count_change_qoq !== null && (
              <span className="text-xs font-mono font-bold text-emerald-700">
                +{instOverview.institutions_count_change_qoq} QoQ
              </span>
            )}
          </div>
        </div>

        <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100 flex flex-col justify-between">
          <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
            {isThai ? 'ผู้บริหาร & คนวงในถือ' : 'Insider Ownership'}
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl sm:text-2xl font-bold font-mono text-stone-900">
              {insiderPct !== null ? `${insiderPct.toFixed(2)}%` : unavailable}
            </span>
            <span className="text-xs text-stone-400 font-sans">
              {isThai ? 'ผู้ก่อตั้ง/บอร์ด' : 'founders/execs'}
            </span>
          </div>
        </div>

        <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100 flex flex-col justify-between">
          <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
            {isThai ? 'หุ้นที่สถาบันถือครองรวม' : 'Total Shares Held'}
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl sm:text-2xl font-bold font-mono text-stone-800">
              {instOverview.total_shares_held ?? unavailable}
            </span>
            {instOverview.shares_held_change_qoq && (
              <span className="text-xs font-mono font-bold text-emerald-700">
                {instOverview.shares_held_change_qoq}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs - Symmetrical 4-Column Responsive Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 p-1.5 bg-stone-100/90 rounded-2xl border border-stone-200/60 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('holders')}
          className={`py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center ${
            activeTab === 'holders'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
          }`}
        >
          <PieIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{isThai ? 'ผู้ถือหุ้นใหญ่' : 'Major Holders'}</span>
          {majorHolders.length > 0 && (
            <span className="text-[10px] bg-stone-200 text-stone-700 px-1.5 py-0.5 rounded-full font-mono font-bold">
              {majorHolders.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('trend')}
          className={`py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center ${
            activeTab === 'trend'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{isThai ? 'สถิติสถาบัน' : 'Inst. Trend'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('insiders')}
          className={`py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center ${
            activeTab === 'insiders'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
          }`}
        >
          <Users className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{isThai ? 'คนวงใน & ผู้บริหาร' : 'Insiders'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('activity')}
          className={`py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center ${
            activeTab === 'activity'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
          }`}
        >
          <Activity className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{isThai ? 'การเคลื่อนไหว 13F' : '13F Activity'}</span>
        </button>
      </div>

      {/* TAB 1: MAJOR HOLDERS & DONUT CHARTS (With Interactive Center Summary & Side Legend) */}
      {activeTab === 'holders' && (
        <div className="flex flex-col gap-5">
          {/* Dual Donut Charts with Side-by-Side Legends */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Donut 1: Major Holders Breakdown */}
            <div className="bg-stone-50 p-4 sm:p-5 rounded-2xl border border-stone-200/80 flex flex-col avoid-page-break">
              <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <PieIcon className="w-3.5 h-3.5 text-[#0b5a4b]" />
                <span>{isThai ? 'สัดส่วนผู้ถือหุ้นสถาบัน (Major Holders)' : 'Major Holders'}</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-3">
                {/* Donut with Center Highlight Box */}
                <div className="relative h-48 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={192} minHeight={192}>
                    <PieChart>
                      <Pie
                        data={topHoldersChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={2}
                        dataKey="value"
                        isAnimationActive={false}
                        onMouseEnter={(_, index) => setActiveHolderIndex(index)}
                      >
                        {topHoldersChartData.map((_, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={HOLDER_COLORS[index % HOLDER_COLORS.length]}
                            opacity={activeHolderIndex === null || activeHolderIndex === index ? 1 : 0.45}
                            stroke={activeHolderIndex === index ? '#ffffff' : 'none'}
                            strokeWidth={2}
                            className="transition-opacity cursor-pointer"
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Center Text Box inside Donut */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
                    {currentHolder ? (
                      <>
                        <span className="text-[11px] font-semibold text-stone-600 truncate max-w-[90px]">
                          {currentHolder.name}
                        </span>
                        <span className="text-base font-bold font-mono text-stone-900 leading-tight">
                          {currentHolder.value}%
                        </span>
                      </>
                    ) : (
                      <span className="text-xs font-bold text-stone-500">{unavailable}</span>
                    )}
                  </div>
                </div>

                {/* Vertical Legend List */}
                <div className="flex flex-col gap-1.5 text-xs font-sans">
                  {topHoldersChartData.map((entry, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onMouseEnter={() => setActiveHolderIndex(idx)}
                      className={`flex items-center justify-between p-1.5 rounded-lg transition-colors text-left cursor-pointer ${
                        activeHolderIndex === idx ? 'bg-stone-200/80 font-semibold' : 'hover:bg-stone-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span 
                          className="w-2.5 h-2.5 rounded-xs shrink-0" 
                          style={{ backgroundColor: HOLDER_COLORS[idx % HOLDER_COLORS.length] }}
                        />
                        <span className="text-stone-700 truncate">{entry.name}</span>
                      </div>
                      <span className="font-mono text-stone-900 shrink-0 ml-2 font-bold">{entry.value}%</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Donut 2: Holder Type Breakdown */}
            <div className="bg-stone-50 p-4 sm:p-5 rounded-2xl border border-stone-200/80 flex flex-col avoid-page-break">
              <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>{isThai ? 'สัดส่วนประเภทผู้ลงทุน (Holder Types)' : 'Type'}</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-3">
                {/* Donut with Center Highlight Box */}
                <div className="relative h-48 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={192} minHeight={192}>
                    <PieChart>
                      <Pie
                        data={typeChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={2}
                        dataKey="pct"
                        nameKey="type"
                        isAnimationActive={false}
                        onMouseEnter={(_, index) => setActiveTypeIndex(index)}
                      >
                        {typeChartData.map((_, index) => (
                          <Cell 
                            key={`cell-type-${index}`} 
                            fill={TYPE_COLORS[index % TYPE_COLORS.length]} 
                            opacity={activeTypeIndex === null || activeTypeIndex === index ? 1 : 0.45}
                            stroke={activeTypeIndex === index ? '#ffffff' : 'none'}
                            strokeWidth={2}
                            className="transition-opacity cursor-pointer"
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Center Text Box inside Donut */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
                    {currentType ? (
                      <>
                        <span className="text-[10px] font-semibold text-stone-600 truncate max-w-[90px]">
                          {currentType.type.split(' ')[0]}
                        </span>
                        <span className="text-base font-bold font-mono text-stone-900 leading-tight">
                          {currentType.pct}%
                        </span>
                      </>
                    ) : (
                      <span className="text-xs font-bold text-stone-500">{unavailable}</span>
                    )}
                  </div>
                </div>

                {/* Vertical Legend List */}
                <div className="flex flex-col gap-1.5 text-xs font-sans">
                  {typeChartData.map((entry, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onMouseEnter={() => setActiveTypeIndex(idx)}
                      className={`flex items-center justify-between p-1.5 rounded-lg transition-colors text-left cursor-pointer ${
                        activeTypeIndex === idx ? 'bg-stone-200/80 font-semibold' : 'hover:bg-stone-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span 
                          className="w-2.5 h-2.5 rounded-xs shrink-0" 
                          style={{ backgroundColor: TYPE_COLORS[idx % TYPE_COLORS.length] }}
                        />
                        <span className="text-stone-700 truncate">{entry.type.split(' ')[0]}</span>
                      </div>
                      <span className="font-mono text-stone-900 shrink-0 ml-2 font-bold">{entry.pct}%</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Major Holders Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[620px]">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/70 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">{isThai ? 'ชื่อผู้ถือหุ้นสถาบัน' : 'Institution / Holder'}</th>
                  <th className="py-2.5 px-3 text-right">{isThai ? 'จำนวนหุ้น' : 'Shares Held'}</th>
                  <th className="py-2.5 px-3 text-right">{isThai ? 'สัดส่วน %' : '% Owned'}</th>
                  <th className="py-2.5 px-3 text-right">{isThai ? 'การเปลี่ยนแปลง (QoQ)' : 'QoQ Change'}</th>
                  <th className="py-2.5 px-3 text-center">{isThai ? 'ประเภท' : 'Type'}</th>
                  <th className="py-2.5 px-3 text-right">{isThai ? 'รายงาน (13F)' : 'Disclosure'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs sm:text-sm">
                {majorHolders.length > 0 ? (
                  majorHolders.map((holder, idx) => {
                    const isPositive = typeof holder.change_pct === 'number' ? holder.change_pct > 0 : String(holder.change_shares || '').startsWith('+');
                    const isZero = holder.change_pct === 0 || holder.change_shares === '0' || holder.change_shares === 0;

                    return (
                      <tr key={idx} className="hover:bg-stone-50/60 transition-colors">
                        <td className="py-3 px-3 font-semibold text-stone-900 font-sans">
                          {holder.name}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-stone-700">
                          {holder.shares_held ?? unavailable}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-[#0b5a4b]">
                          {holder.pct_owned !== null ? `${holder.pct_owned.toFixed(2)}%` : unavailable}
                        </td>
                        <td className="py-3 px-3 text-right font-mono">
                          {isZero ? (
                            <span className="text-stone-400">0.00%</span>
                          ) : (
                            <span className={`inline-flex items-center gap-0.5 font-bold ${
                              isPositive ? 'text-emerald-700' : 'text-rose-700'
                            }`}>
                              {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                              {holder.change_shares || (typeof holder.change_pct === 'number' ? `${holder.change_pct.toFixed(2)}%` : '-')}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="text-[10px] font-sans font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                          {holder.holder_type || unavailable}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-stone-400 text-xs">
                          {holder.disclosure || unavailable}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-xs text-stone-400 font-sans">
                      {isThai ? 'ไม่มีข้อมูลผู้ถือหุ้นรายใหญ่' : 'No major holders data available.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: INSTITUTIONAL TREND & DUAL-AXIS CHART (Price vs % Owned) */}
      {activeTab === 'trend' && (
        <div className="flex flex-col gap-5">
          {/* Top KPI Header above Chart */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-stone-50 rounded-2xl border border-stone-200">
            <div>
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                {isThai ? 'จำนวนสถาบัน (No. of Institutions)' : 'No. of Institutions'}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-lg sm:text-xl font-bold font-mono text-stone-900">
                  {instOverview.total_institutions_count !== null ? instOverview.total_institutions_count.toLocaleString() : unavailable}
                </span>
                <span className="text-xs font-mono font-bold text-emerald-700">
                  {instOverview.institutions_count_change_qoq !== null ? `${instOverview.institutions_count_change_qoq > 0 ? '+' : ''}${instOverview.institutions_count_change_qoq} QoQ` : unavailable}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                {isThai ? 'จำนวนหุ้นที่สถาบันถือรวม' : 'Total Shares Held'}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-lg sm:text-xl font-bold font-mono text-stone-900">
                  {instOverview.total_shares_held ?? unavailable}
                </span>
                <span className="text-xs font-mono font-bold text-emerald-700">
                  {instOverview.shares_held_change_qoq ?? unavailable}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                {isThai ? 'สัดส่วนสถาบันถือครอง (% Owned)' : '% Owned'}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-lg sm:text-xl font-bold font-mono text-[#0b5a4b]">
                  {instOverview.pct_owned !== null ? `${instOverview.pct_owned.toFixed(2)}%` : unavailable}
                </span>
                <span className="text-xs font-mono font-bold text-emerald-700">
                  {instOverview.pct_owned_change_qoq !== null ? `${instOverview.pct_owned_change_qoq > 0 ? '+' : ''}${instOverview.pct_owned_change_qoq}%` : unavailable}
                </span>
              </div>
            </div>
          </div>

          {/* Dual-Axis Trend Chart: Price vs % Owned */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#0b5a4b]" />
                <span>{isThai ? 'กราฟเปรียบเทียบ: ราคาหุ้น ($) vs สัดส่วนสถาบันถือครอง (%)' : 'Price vs % Owned Over Time'}</span>
              </h4>
            </div>

            <div className="h-64 w-full mt-2">
              <ResponsiveContainer width="100%" height={256} minHeight={256}>
                <LineChart data={quarterlyHistory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0eee9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#78716c' }} />
                  <YAxis yAxisId="left" domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#0b5a4b' }} />
                  {averageQuarterlyOwnership !== null && (
                    <ReferenceLine yAxisId="right" y={averageQuarterlyOwnership} stroke="#d6d3d1" strokeDasharray="4 4" label={{ value: 'Avg % Owned', position: 'insideTopLeft', fill: '#a8a29e', fontSize: 10 }} />
                  )}
                  <RechartsTooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-[#1c1917] text-white p-3 rounded-xl border border-white/15 shadow-2xl text-xs font-sans space-y-1.5 min-w-[200px]">
                            <div className="text-stone-300 font-mono text-[11px] border-b border-stone-800 pb-1 font-bold">
                              {label}
                            </div>
                            {payload.map((entry: any, i: number) => {
                              const isPrice = entry.dataKey === 'stock_price';
                              const nameLabel = isPrice ? (isThai ? 'ราคาหุ้น' : 'Stock Price') : (isThai ? 'สัดส่วนสถาบันถือ' : 'Institutional Ownership');
                              const valStr = isPrice ? `$${Number(entry.value).toFixed(2)}` : `${Number(entry.value).toFixed(2)}%`;
                              const colorDot = isPrice ? '#94a3b8' : '#34d399';
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
                  <Legend 
                    verticalAlign="bottom" 
                    height={30} 
                    formatter={(value) => value === 'stock_price' ? (isThai ? '— ราคาหุ้น ($)' : '— Price ($)') : (isThai ? '— สถาบันถือครอง (%)' : '— % Owned')} 
                  />
                  <Line yAxisId="left" type="monotone" dataKey="stock_price" stroke="#334155" strokeWidth={2.5} dot={{ r: 4, fill: '#334155' }} activeDot={{ r: 6 }} name="stock_price" isAnimationActive={false} />
                  <Line yAxisId="right" type="monotone" dataKey="pct_owned" stroke="#0b5a4b" strokeWidth={2.5} dot={{ r: 4, fill: '#0b5a4b' }} activeDot={{ r: 6 }} name="pct_owned" isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quarterly Stats Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[580px]">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/70 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">{isThai ? 'ไตรมาส / วันที่' : 'Date'}</th>
                  <th className="py-2.5 px-3 text-right">{isThai ? 'จำนวนสถาบัน (แห่ง)' : 'No. of Institutions'}</th>
                  <th className="py-2.5 px-3 text-right">{isThai ? 'จำนวนหุ้นที่ถือรวม' : 'Shares Held'}</th>
                  <th className="py-2.5 px-3 text-right">{isThai ? 'สัดส่วนที่ถือ (%)' : '% Owned'}</th>
                  <th className="py-2.5 px-3 text-right">{isThai ? 'การเปลี่ยนแปลง (QoQ)' : 'Chg (Shares)'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs sm:text-sm font-mono">
                {quarterlyHistory.map((item, idx) => (
                  <tr key={idx} className="hover:bg-stone-50/60 transition-colors">
                    <td className="py-3 px-3 font-semibold text-stone-900 font-sans">{item.date}</td>
                    <td className="py-3 px-3 text-right text-stone-700">{typeof item.no_of_institutions === 'number' ? item.no_of_institutions.toLocaleString() : unavailable}</td>
                    <td className="py-3 px-3 text-right text-stone-700">{item.shares_held ?? unavailable}</td>
                    <td className="py-3 px-3 text-right font-bold text-[#0b5a4b]">{typeof item.pct_owned === 'number' ? `${item.pct_owned.toFixed(2)}%` : unavailable}</td>
                    <td className="py-3 px-3 text-right">
                      <span className={item.change_shares?.startsWith('+') ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                        {item.change_shares || '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: INSIDERS & DETAILED TRANSACTIONS (Form 4, 144, 10b5-1, RSUs) */}
      {activeTab === 'insiders' && (
        <div className="flex flex-col gap-5">
          {/* Sentiment Bar */}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-stone-600 uppercase tracking-wider block">
                {isThai ? 'มุมมองและพฤติกรรมคนวงใน (Insider Sentiment: 6M)' : 'Insider Sentiment (Past 6 Months)'}
              </span>
              <p className="text-xs text-stone-500 font-sans mt-0.5">
                {isThai 
                  ? 'รายการขายส่วนใหญ่เป็นแผนขายอัตโนมัติตามกฎ SEC Rule 10b5-1 เพื่อชำระภาษีหุ้นพนักงาน (SBC)'
                  : 'Most sales are pre-scheduled under SEC Rule 10b5-1 plans for tax obligation mitigation'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold font-mono flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> {bullishCount ?? unavailable} Bullish
              </span>
              <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-xl text-xs font-bold font-mono flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" /> {bearishCount ?? unavailable} Bearish / Planned
              </span>
            </div>
          </div>

          {/* Key Insiders Holdings */}
          {keyInsiders.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                {isThai ? 'การถือครองของผู้บริหารระดับสูง (Key Insiders Holdings)' : 'Key Insiders Holdings'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {keyInsiders.map((insider, idx) => (
                  <div key={idx} className="p-3 bg-stone-50 rounded-xl border border-stone-100 flex flex-col">
                    <span className="font-bold text-stone-900 text-xs sm:text-sm font-sans">{insider.name}</span>
                    <span className="text-[11px] text-stone-500 font-sans truncate">{insider.title}</span>
                    <div className="flex items-baseline justify-between mt-2 pt-1 border-t border-stone-200/60 font-mono text-xs">
                      <span className="text-stone-700 font-bold">{typeof insider.shares_held === 'number' ? insider.shares_held.toLocaleString() : insider.shares_held} หุ้น</span>
                      {typeof insider.pct_owned === 'number' && Number.isFinite(insider.pct_owned) && (
                        <span className="text-[#0b5a4b] font-bold">{insider.pct_owned.toFixed(2)}%</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subfilter for Insider Trades */}
          <div className="flex items-center justify-between gap-2 pt-2">
            <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              {isThai ? 'ประวัติธุรกรรมคนวงในล่าสุด (Insider Activity Table)' : 'Insider Activity Table'}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setInsiderFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  insiderFilter === 'all' ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {isThai ? 'ทั้งหมด' : 'All'}
              </button>
              <button
                type="button"
                onClick={() => setInsiderFilter('sales')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  insiderFilter === 'sales' ? 'bg-amber-800 text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                {isThai ? 'การขาย (Sales/10b5-1)' : 'Sales'}
              </button>
              <button
                type="button"
                onClick={() => setInsiderFilter('buys')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  insiderFilter === 'buys' ? 'bg-emerald-800 text-white' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                {isThai ? 'การซื้อ / RSU' : 'Buys / Grants'}
              </button>
            </div>
          </div>

          {/* Recent Insider Transactions Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[620px]">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/70 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">{isThai ? 'ผู้บริหาร / ตำแหน่ง' : 'Insider / Relation'}</th>
                  <th className="py-2.5 px-3 text-center">{isThai ? 'วันที่' : 'Date'}</th>
                  <th className="py-2.5 px-3 text-center">{isThai ? 'ประเภทธุรกรรม' : 'Transaction'}</th>
                  <th className="py-2.5 px-3 text-right">{isThai ? 'จำนวนหุ้น' : 'Shares Traded'}</th>
                  <th className="py-2.5 px-3 text-right">{isThai ? 'ราคาต่อหุ้น' : 'Price'}</th>
                  <th className="py-2.5 px-3 text-center">{isThai ? 'ประเภทหลักทรัพย์' : 'Security Type'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs sm:text-sm">
                {filteredInsiders.length > 0 ? (
                  filteredInsiders.map((tx, idx) => {
                    const isSell = tx.transaction_type?.toLowerCase().includes('sell') || tx.transaction_type?.toLowerCase().includes('disposition');
                    const isBuy = !isSell;
                    const formattedShares = tx.shares_count 
                      ? (isSell ? `-${tx.shares_count.toLocaleString()}` : `+${tx.shares_count.toLocaleString()}`)
                      : '0';

                    return (
                      <tr key={idx} className="hover:bg-stone-50/60 transition-colors">
                        <td className="py-3 px-3 font-sans">
                          <span className="font-bold text-stone-900 block">{tx.insider_name}</span>
                          <span className="text-[11px] text-stone-500">{tx.title}</span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-stone-600 text-xs">
                          {tx.date}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isBuy 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-stone-100 text-stone-700'
                          }`}>
                            {isBuy ? (
                              <><TrendingUp className="w-3 h-3" /> {tx.transaction_type || 'Acquisition / RSU'}</>
                            ) : (
                              <><ShieldCheck className="w-3 h-3 text-blue-600" /> {tx.transaction_type?.includes('10b5-1') ? '10b5-1 Plan Sale' : 'Disposition'}</>
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          <span className={isBuy ? 'text-emerald-700' : 'text-rose-700'}>
                            {formattedShares}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-stone-700">
                          {tx.price_per_share && tx.price_per_share > 0 ? `$${tx.price_per_share.toFixed(2)}` : 'Undisclosed'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="text-[10px] font-sans px-2 py-0.5 rounded bg-stone-100 text-stone-600">
                            {tx.security_type || 'Common Stock'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-xs text-stone-400 font-sans">
                      {isThai ? 'ไม่มีข้อมูลธุรกรรมตามตัวกรองนี้' : 'No insider transactions found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SHAREHOLDER ACTIVITY (13F FLOWS) */}
      {activeTab === 'activity' && (
        <div className="flex flex-col gap-4">
          {/* Subfilter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500 font-sans flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> {isThai ? 'กรองตามสถานะ:' : 'Filter:'}
            </span>
            <button
              type="button"
              onClick={() => setActivityFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                activityFilter === 'all' ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {isThai ? 'ทั้งหมด' : 'All'}
            </button>
            <button
              type="button"
              onClick={() => setActivityFilter('increase')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                activityFilter === 'increase' ? 'bg-emerald-800 text-white' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              {isThai ? 'ซื้อเพิ่ม (Increase)' : 'Increase'}
            </button>
            <button
              type="button"
              onClick={() => setActivityFilter('decrease')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                activityFilter === 'decrease' ? 'bg-rose-800 text-white' : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
              }`}
            >
              {isThai ? 'ขายลด (Decrease)' : 'Decrease'}
            </button>
          </div>

          {/* 13F Pricing Methodology Note */}
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600 flex items-start gap-2">
            <span className="shrink-0 font-bold text-stone-700">💡 {isThai ? 'หมายเหตุการประเมินมูลค่า:' : 'Valuation Basis:'}</span>
            <span>
              {isThai 
                ? 'มูลค่า USD ในการปรับพอร์ต 13F คำนวณจากราคาปิดของหุ้น ณ วันสิ้นสุดไตรมาสที่ยื่นแบบรายงานต่อ SEC (เช่น 30 มิ.ย.) ตามเกณฑ์การเปิดเผยข้อมูลทางการ มิใช่ราคาตลาด ณ วันปัจจุบัน' 
                : 'USD transaction amounts in 13F disclosures are evaluated using the quarter-end closing price on the filing date per SEC disclosure requirements, not the current live market price.'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[620px]">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/70 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">{isThai ? 'ชื่อกองทุน / สถาบัน' : 'Institution / Fund'}</th>
                  <th className="py-2.5 px-3 text-center">{isThai ? 'วันที่ทำรายการ' : 'Position Date'}</th>
                  <th className="py-2.5 px-3 text-right">{isThai ? 'ปรับพอร์ต (หุ้น)' : 'Chg (Shares)'}</th>
                  <th className="py-2.5 px-3 text-right">{isThai ? 'มูลค่า (USD)' : 'Chg (Amount)'}</th>
                  <th className="py-2.5 px-3 text-right">{isThai ? 'สัดส่วนที่ถือ' : 'Total % Held'}</th>
                  <th className="py-2.5 px-3 text-center">{isThai ? 'ประเภท' : 'Fund Type'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs sm:text-sm">
                {filteredActivity.length > 0 ? (
                  filteredActivity.map((act, idx) => {
                    const isIncrease = act.change_type === 'increase' || act.change_type === 'new';
                    return (
                      <tr key={idx} className="hover:bg-stone-50/60 transition-colors">
                        <td className="py-3 px-3 font-semibold text-stone-900 font-sans">
                          {act.holder_name}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-stone-500 text-xs">
                          {act.date || unavailable}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          <span className={isIncrease ? 'text-emerald-700' : 'text-rose-700'}>
                            {act.change_shares}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono">
                          <span className={isIncrease ? 'text-emerald-700' : 'text-rose-700'}>
                            {act.change_amount_usd || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-stone-700">
                          {act.total_pct_held !== undefined ? `${act.total_pct_held.toFixed(2)}%` : '-'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="text-[10px] font-sans font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                            {act.holder_type || unavailable}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-xs text-stone-400 font-sans">
                      {isThai ? 'ไม่มีข้อมูลการเคลื่อนไหวตามตัวกรองนี้' : 'No activity records match this filter.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
