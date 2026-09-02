import React, { useState, useEffect } from 'react';
import { EnhancedMarkdown as Markdown } from './components/EnhancedMarkdown';
import { motion } from 'motion/react';
import { 
  X, FileText, CheckCircle2, ChevronRight, Link as LinkIcon, Calendar,
  TrendingUp, TrendingDown, Minus, Lightbulb, AlertTriangle, ArrowUp, Copy, Check, 
  Printer, Sparkles, HelpCircle, DollarSign, Layers, ShieldCheck, Clock, ArrowRight, Target 
} from 'lucide-react';
import { ReportData } from './types';
import { harmonizeReportData, extractCleanRsi } from './utils/metricsHarmonizer';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

import { FinancialStatementsTable } from './components/FinancialStatementsTable';
import { ValuationPanel } from './components/ValuationPanel';
import { IntrinsicValueEngine } from './components/IntrinsicValueEngine';
import { EarningsAnalysisSection } from './components/EarningsAnalysisSection';
import { PeerComparisonTable } from './components/PeerComparisonTable';
import { CatalystCalendar } from './components/CatalystCalendar';
import { CorporateActionsCard } from './components/CorporateActionsCard';
import { CompanyProfileCard } from './components/CompanyProfileCard';
import { BusinessAnalysisCard } from './components/BusinessAnalysisCard';
import { ValuationDashboard } from './components/ValuationDashboard';
import { FivePillarsAnalysis } from './components/FivePillarsAnalysis';
import { ForecastDashboard } from './components/ForecastDashboard';
import { SmartMoneyCard } from './components/SmartMoneyCard';
import { ScoreMethodologyModal } from './components/ScoreMethodologyModal';

interface Props {
  data: ReportData;
  ticker: string;
  onClose: () => void;
  durationSecs?: number;
  toolRuns?: number;
  tokenCount?: number;
  documentCount?: number;
  language?: string;
  hideHeader?: boolean;
  historyReports?: any[];
}

const ConvictionGauge = ({ score, isThai, onOpenMethodology }: { score: number | string, isThai: boolean, onOpenMethodology?: () => void }) => {
  const numScore = typeof score === 'number' ? score : parseInt(String(score), 10) || 0;
  const radius = 38;
  const strokeWidth = 7;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, numScore));
  const offset = circumference - (progress / 100) * circumference;

  let strokeColor = '#0b5a4b';
  let glowColor = 'rgba(11, 90, 75, 0.25)';
  if (numScore < 50) {
    strokeColor = '#dc2626';
    glowColor = 'rgba(220, 38, 38, 0.25)';
  } else if (numScore < 70) {
    strokeColor = '#d97706';
    glowColor = 'rgba(217, 119, 6, 0.25)';
  }

  return (
    <div 
      onClick={onOpenMethodology}
      className="flex flex-col items-center justify-center my-1 cursor-pointer group w-full"
      title={isThai ? 'คลิกเพื่อดูวิธีคำนวณคะแนน' : 'Click to view scoring methodology'}
    >
      <div className="relative flex items-center justify-center w-28 h-28">
        <svg className="w-28 h-28 transform -rotate-90">
          <circle
            cx="56"
            cy="56"
            r={radius}
            stroke="#e7e5e4"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx="56"
            cy="56"
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 6px ${glowColor})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold font-['Nunito',sans-serif] tabular-nums group-hover:scale-105 transition-transform" style={{ color: strokeColor }}>
            {score || '-'}
          </span>
          <span className="text-[10px] text-stone-500 font-bold tracking-wider font-['Prompt','Nunito',sans-serif]">
            {isThai ? 'เต็ม 100' : '/ 100'}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 mt-2 text-[10px] text-stone-500 font-sans">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>{isThai ? '<50 ต่ำ' : '<50 Low'}</span>
        <span className="text-stone-300">•</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>{isThai ? '50-69 กลาง' : '50-69 Med'}</span>
        <span className="text-stone-300">•</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>{isThai ? '70+ สูง' : '70+ High'}</span>
      </div>
    </div>
  );
};

const TrackRecordBadge = ({ ticker, currentPrice, historyReports = [], isThai }: { ticker: string, currentPrice?: number, historyReports: any[], isThai: boolean }) => {
  if (!historyReports.length || !currentPrice) return null;
  
  const pastReports = historyReports.filter(r => 
    r.ticker?.toUpperCase() === ticker?.toUpperCase() && 
    r.data?.technical_analysis?.signal_summary?.status &&
    r.data?.technical_analysis?.key_levels?.current_price
  ).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));

  if (pastReports.length < 2) return null;

  let wins = 0;
  let totalEvaluated = 0;

  pastReports.forEach(report => {
    const status = (report.data.technical_analysis.signal_summary.status || '').toLowerCase();
    const pastPrice = parseFloat(report.data.technical_analysis.key_levels.current_price);
    
    if (isNaN(pastPrice)) return;
    
    if (status.includes('buy')) {
       totalEvaluated++;
       if (currentPrice > pastPrice) wins++;
    } else if (status.includes('sell') || status.includes('avoid')) {
       totalEvaluated++;
       if (currentPrice < pastPrice) wins++;
    }
  });

  if (totalEvaluated === 0) return null;
  
  const winRate = Math.round((wins / totalEvaluated) * 100);
  
  return (
    <div className="flex items-center gap-2 mt-4 bg-white/50 border border-stone-200 px-4 py-2 rounded-lg inline-flex">
      <Target className="w-5 h-5 text-[#0b5a4b] shrink-0" />
      <div className="flex flex-col">
        <span className="text-xs text-stone-500 font-medium uppercase tracking-wider">{isThai ? 'สถิติความแม่นยำ (Track Record)' : 'Signal Track Record'}</span>
        <span className="text-sm font-bold text-stone-900">
          {winRate}% {isThai ? 'ชนะ' : 'Win Rate'} <span className="text-stone-400 font-normal">({wins}/{totalEvaluated} {isThai ? 'ครั้งที่ให้สัญญาณถูก' : 'correct calls'})</span>
        </span>
      </div>
    </div>
  );
};

const IndicatorVisualizer = ({ type, text, isThai }: { type: 'RSI' | 'MACD', text: string, isThai: boolean }) => {
   if (!text) return null;
   
   if (type === 'RSI') {
      const rsi = extractCleanRsi(text);
      if (!rsi) return null;
      
      const isOverbought = rsi.value >= 70;
      const isOversold = rsi.value <= 30;
      const color = isOverbought 
        ? 'text-red-600 bg-red-50 border-red-200' 
        : isOversold 
        ? 'text-[#0b5a4b] bg-emerald-50 border-emerald-200' 
        : 'text-stone-700 bg-stone-100 border-stone-200';
      
      return (
         <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${color}`}>
               RSI: {rsi.value.toFixed(1)} ({isThai ? rsi.statusTh : rsi.statusEn})
            </span>
         </div>
      );
   } else if (type === 'MACD') {
      const cleanText = text
        .replace(/MACD\s*\(\s*12\s*,\s*26(?:\s*,\s*9)?\s*\)/gi, 'MACD')
        .replace(/\b(?:12|26|9)\b/g, '');
      const match = cleanText.match(/MACD\s*(?:is|at|=|:|อยู่ที่|คือ|เท่ากับ|ระดับ)?\s*(-?[0-9]+(?:\.[0-9]+)?)/i);
      if (match && match[1]) {
        const val = parseFloat(match[1]);
        if (!isNaN(val)) {
          const isBull = val > 0;
          const color = isBull ? 'text-[#0b5a4b] bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200';
          return (
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${color}`}>
                MACD: {val.toFixed(2)} ({isBull ? (isThai ? 'โซนบวก / ขาขึ้น' : 'Bullish') : (isThai ? 'โซนลบ / ขาลง' : 'Bearish')})
              </span>
            </div>
          );
        }
      }
   }
   return null;
};

const AnalysisCard = ({ title, action, subtext, children, className = "", titleClassName = "text-stone-900" }: any) => (
  <div 
    className={`bg-white rounded-2xl p-4 sm:p-6 md:p-8 shadow-sm border border-stone-200 flex flex-col ${className}`}
  >
    <div className="flex justify-between items-center mb-2 gap-2">
      <div className="flex items-center gap-2">
        <h3 className={`text-lg md:text-xl font-bold font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight ${titleClassName}`}>{title}</h3>
      </div>
      {action && <div>{action}</div>}
    </div>
    {subtext && (
      <div className="text-stone-700 text-[15px] mb-6">
        {subtext}
      </div>
    )}
    <div className="flex-1 w-full flex flex-col">
      {children}
    </div>
  </div>
);

const parsePrice = (str: string) => {
  const match = str.match(/[\d,]+(\.\d+)?/);
  return match ? parseFloat(match[0].replace(/,/g, '')) : 0;
};

const KeyLevelsVisualizer = ({ currentPrice, support, resistance, isThai }: { currentPrice?: number, support: string[], resistance: string[], isThai: boolean }) => {
  const supports = support.map(parsePrice).filter(v => v > 0).sort((a, b) => a - b);
  const resistances = resistance.map(parsePrice).filter(v => v > 0).sort((a, b) => a - b);
  
  const allValues = [...supports, ...resistances];
  if (currentPrice) allValues.push(currentPrice);
  
  if (allValues.length < 2) return null;
  
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;
  const padding = range * 0.1;
  
  const renderMin = min - padding;
  const renderMax = max + padding;
  const renderRange = renderMax - renderMin;
  
  const getPos = (val: number) => `${((val - renderMin) / renderRange) * 100}%`;

  return (
    <div className="w-full mt-6 mb-2">
      <div className="relative h-2 bg-stone-200 rounded-full w-full">
        {supports.map((s, i) => (
          <div key={`s-${i}`} className="absolute w-3 h-3 bg-[#0b5a4b] rounded-full top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 border-2 border-white shadow-sm" style={{ left: getPos(s) }}>
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] font-bold text-[#0b5a4b]">S{supports.length - i}</div>
          </div>
        ))}
        {resistances.map((r, i) => (
          <div key={`r-${i}`} className="absolute w-3 h-3 bg-red-500 rounded-full top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 border-2 border-white shadow-sm" style={{ left: getPos(r) }}>
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] font-bold text-red-700">R{i + 1}</div>
          </div>
        ))}
        {currentPrice && (
          <div className="absolute w-4 h-4 bg-blue-600 rounded-full top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 border-2 border-white shadow-md" style={{ left: getPos(currentPrice) }}>
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm whitespace-nowrap">
              {isThai ? 'ราคาปัจจุบัน ' : 'Current '}{currentPrice}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-stone-900 rotate-45"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function ReportTemplate({ 
  data: rawData, 
  ticker, 
  onClose, 
  durationSecs = 0, 
  toolRuns = 0, 
  tokenCount = 0, 
  documentCount = 0, 
  language = 'English', 
  hideHeader = false, 
  historyReports = [] 
}: Props) {
  const isThai = language === 'Thai';
  const data = React.useMemo(() => harmonizeReportData(rawData, ticker), [rawData, ticker]);
  const isTechnicalOnly = data.analysis_type === 'technical' || (data.technical_analysis && !data.comprehensive_analysis);
  const findings = data.findings || [];
  const reportDate = data.as_of_date || new Date().toISOString().split('T')[0];

  const [activeNav, setActiveNav] = useState('section-summary');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isTradePlanCopied, setIsTradePlanCopied] = useState(false);
  const [currencyMode, setCurrencyMode] = useState<'USD' | 'THB'>('USD');
  const [showScoreModal, setShowScoreModal] = useState(false);

  // Default USD to THB rate
  const currencyRate = 35.5;

  useEffect(() => {
    const container = document.getElementById('report-scroll-container');
    if (!container) return;

    const handleScroll = () => {
      setShowBackToTop(container.scrollTop > 300);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setActiveNav(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToTop = () => {
    const container = document.getElementById('report-scroll-container');
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCopyTradePlan = () => {
    const tp = data.technical_analysis?.trade_plan;
    if (!tp) return;
    const text = `${ticker.toUpperCase()} Trade Plan:
- Entry: ${tp.entry_zone || '-'}
- Stop-Loss: ${tp.stop_loss || '-'}
- Target 1: ${tp.target_1 || '-'}
- Target 2: ${tp.target_2 || '-'}
- Risk/Reward: ${tp.risk_reward_ratio || '-'}`;
    navigator.clipboard.writeText(text);
    setIsTradePlanCopied(true);
    setTimeout(() => setIsTradePlanCopied(false), 2000);
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-[#0b5a4b]';
    if (score >= 60) return 'text-amber-700';
    return 'text-red-600';
  };

  const navItems = [
    { id: 'section-summary', label: isThai ? 'บทสรุป' : 'Summary' },
    ...(data.financial_statements ? [
      { id: 'section-financial-tables', label: isThai ? 'ดัชนี & งบการเงิน' : 'Financials & Indicators' },
    ] : []),
    ...(data.valuation_ratios || data.intrinsic_value || data.valuation_dashboard ? [
      { id: 'section-valuation', label: isThai ? 'Valuation & Intrinsic Value' : 'Valuation' },
    ] : []),
    ...(data.earnings_analysis || data.forecast_dashboard ? [
      { id: 'section-earnings', label: isThai ? 'Earnings & Forecast' : 'Earnings & Forecast' },
    ] : []),
    ...(data.analysis_type !== 'technical' && (data.comprehensive_analysis || data.company_profile || data.business_analysis) ? [
      { id: 'section-fundamentals', label: isThai ? 'ปัจจัยพื้นฐาน & โครงสร้างธุรกิจ' : 'Fundamentals & Business' },
    ] : []),
    ...(data.peer_comparison || data.catalysts_and_events || data.smart_money || data.insider_activity || data.corporate_actions ? [
      { id: 'section-peers-catalysts', label: isThai ? 'คู่แข่ง, Smart Money & ปันผล' : 'Peers, Smart Money & Actions' },
    ] : []),
    ...(data.financial_charts ? [
      { id: 'section-financials', label: isThai ? 'กราฟการเงิน' : 'Charts' },
    ] : []),
    ...(data.technical_analysis ? [
      { id: 'section-technical', label: isThai ? 'เทคนิคอล & แผนเทรด' : 'Technical' },
    ] : []),
    ...(!isTechnicalOnly && data.deep_insights && data.deep_insights.length > 0 ? [
      { id: 'section-insights', label: isThai ? 'ข้อมูลเชิงลึก' : 'Insights' },
    ] : []),
    ...(findings.length > 0 ? [
      { id: 'section-citations', label: isThai ? 'เอกสารอ้างอิง' : 'SEC Filings' },
    ] : []),
  ];
  
  return (
    <div 
      className={`min-h-full bg-[#F6F4F0] text-stone-900 w-full flex flex-col report-cute-font print:overflow-visible print:h-auto print:bg-white print:block scrollbar-hide ${hideHeader ? 'mb-8 border-b-4 border-stone-300 pb-8' : 'h-full overflow-y-auto'}`}>
      
      {!hideHeader && (
        <div className="w-full border-b border-stone-200/80 px-3 sm:px-6 md:px-8 py-2.5 sm:py-3 sticky top-0 z-50 bg-[#F6F4F0]/95 backdrop-blur-md print:static print:bg-white shadow-xs flex flex-col gap-2 sm:gap-2.5">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2.5 sm:gap-4">
              <div className="font-bold text-stone-900 text-sm sm:text-base md:text-lg tracking-tight flex items-center gap-1.5 sm:gap-2 font-['Prompt','Mitr','Nunito',sans-serif]">
                {isThai ? `วิเคราะห์ ${ticker}` : `${ticker} Analysis`}
              </div>
              <div className="flex items-center bg-stone-200/80 p-0.5 rounded-full border border-stone-300 text-xs font-mono">
                <button type="button" onClick={() => setCurrencyMode('USD')} className={`px-2.5 py-0.5 rounded-full font-bold transition-all ${currencyMode === 'USD' ? 'bg-stone-900 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'}`}>USD ($)</button>
                <button type="button" onClick={() => setCurrencyMode('THB')} className={`px-2.5 py-0.5 rounded-full font-bold transition-all ${currencyMode === 'THB' ? 'bg-[#0b5a4b] text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'}`}>THB (฿)</button>
              </div>
            </div>
            <div className="flex items-center gap-2 print:hidden shrink-0">
              <button 
                type="button" 
                onClick={() => window.print()} 
                className="text-stone-700 hover:text-stone-900 bg-white hover:bg-stone-50 transition-all rounded-full px-3 py-1.5 border border-stone-200 shadow-xs flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                title={isThai ? 'พิมพ์หรือบันทึกรายงานเป็น PDF เต็มหน้า' : 'Print or Save Report as PDF'}
              >
                <Printer className="w-3.5 h-3.5 text-[#0b5a4b]" />
                <span className="hidden sm:inline">{isThai ? 'บันทึก PDF' : 'Save PDF'}</span>
              </button>
              <button onClick={onClose} className="text-stone-600 hover:text-stone-900 bg-white hover:bg-stone-100 transition-all rounded-full p-1.5 sm:p-2 border border-stone-200 shadow-xs flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
            </div>
          </div>
          <div className="w-full overflow-x-auto no-scrollbar scroll-smooth touch-pan-x py-0.5">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-max px-0.5 pr-6">
              {navItems.map((item) => (
                <button key={item.id} onClick={() => scrollToSection(item.id)} className={`px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center justify-center select-none whitespace-nowrap shrink-0 ${activeNav === item.id ? 'bg-stone-900 text-white shadow-sm ring-1 ring-stone-900' : 'bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 shadow-xs hover:text-stone-900 hover:border-stone-300'}`}>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div id="report-content" className="flex-1 py-4 sm:py-8 px-2.5 sm:px-6 md:px-[40px] w-full max-w-[1200px] mx-auto flex flex-col gap-6 md:gap-8 bg-[#F6F4F0] print:max-w-full print:p-0 print:gap-6 print:bg-white">
        
        <div className="bg-stone-100/90 border border-stone-200 rounded-2xl p-3 sm:p-4 text-xs text-stone-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#0b5a4b] shrink-0" />
            <span><strong>{isThai ? 'ข้อสงวนสิทธิ์:' : 'Disclaimer:'}</strong> {isThai ? 'รายงานนี้จัดทำขึ้นเพื่อการศึกษาและการวิเคราะห์ข้อมูล ไม่ใช่คำแนะนำการลงทุน' : 'This report is for educational & analytical purposes only, not investment advice.'}</span>
          </div>
          <div className="font-mono text-stone-500 text-[11px] self-start sm:self-auto shrink-0 flex items-center gap-1">
            <Clock className="w-3 h-3 text-stone-400" />
            {isThai ? 'ข้อมูล ณ ' : 'As of '}{reportDate}
          </div>
        </div>

        {/* SECTION 1: EXECUTIVE SUMMARY */}
        <div id="section-summary" className="flex flex-col gap-4 scroll-mt-14">
          <AnalysisCard title={isThai ? "บทสรุปผู้บริหาร (Executive Summary)" : "Executive Summary"} className="w-full">
            <div className="bg-stone-50 p-4 md:p-5 rounded-2xl border border-stone-200 mb-6 text-stone-800 leading-relaxed font-medium text-base sm:text-lg w-full">
              "{data.verdict?.summary || (isThai ? 'ไม่มีบทสรุป' : 'No summary available.')}"
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-10 gap-6 md:gap-8 w-full mt-2">
              <div className="md:col-span-7 flex flex-col order-last md:order-first mt-2 md:mt-0">
                {data.verdict?.key_takeaways && (Array.isArray(data.verdict.key_takeaways) ? data.verdict.key_takeaways.length > 0 : true) && (
                  <div className="w-full text-left flex-1">
                     <div className="text-sm font-bold text-stone-700 uppercase tracking-wider mb-4 border-b border-stone-100 pb-2">
                       {isThai ? "ประเด็นสำคัญ (Key Takeaways)" : "Key Takeaways"}
                     </div>
                     <div className="space-y-3">
                       {Array.isArray(data.verdict.key_takeaways) ? data.verdict.key_takeaways.map((takeaway, i) => (
                          <div key={i} className="flex gap-3 text-[15px] sm:text-base">
                             <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#0b5a4b] shrink-0 mt-0.5" />
                             <div className="text-stone-700 leading-relaxed prose prose-sm sm:prose-base prose-stone max-w-none"><Markdown findings={data.findings}>{takeaway}</Markdown></div>
                          </div>
                       )) : (
                          <div className="flex gap-3 text-[15px] sm:text-base">
                             <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#0b5a4b] shrink-0 mt-0.5" />
                             <div className="text-stone-700 leading-relaxed prose prose-sm sm:prose-base prose-stone max-w-none"><Markdown findings={data.findings}>{String(data.verdict.key_takeaways)}</Markdown></div>
                          </div>
                       )}
                     </div>
                  </div>
                )}
              </div>
              
              <div className="md:col-span-3 flex flex-col md:h-full text-center md:border-l md:border-stone-100 md:pl-8 items-center justify-between order-first md:order-last bg-stone-50 md:bg-transparent p-4 md:p-0 rounded-2xl md:rounded-none border border-stone-100 md:border-none">
                 <div className="w-full">
                   <div className="flex items-center justify-center gap-1 mb-1">
                     <h4 className="text-sm font-bold text-stone-700 uppercase tracking-wider">{isThai ? "คะแนนความเชื่อมั่น" : "Conviction Score"}</h4>
                     <button
                       type="button"
                       onClick={() => setShowScoreModal(true)}
                       className="text-stone-400 hover:text-stone-700 cursor-pointer"
                       title={isThai ? 'วิธีคิดคะแนน' : 'Scoring methodology'}
                     >
                       <HelpCircle className="w-3.5 h-3.5" />
                     </button>
                   </div>
                   <p className="text-xs text-stone-500 mb-2">{isThai ? "อ้างอิงจากงบและเอกสารที่วิเคราะห์" : "Based on filings & model"}</p>
                   
                   <ConvictionGauge 
                     score={data.verdict?.conviction_score || '-'} 
                     isThai={isThai} 
                     onOpenMethodology={() => setShowScoreModal(true)}
                   />
                 </div>
                 
                 <div className="grid grid-cols-4 gap-1 border-t border-stone-200 pt-4 mt-auto w-full">
                   <div className="flex flex-col items-center">
                     <div className="text-[10px] text-stone-600 uppercase font-bold tracking-wider mb-1">{isThai ? "เอกสาร" : "Docs"}</div>
                     <div className="text-sm font-mono text-stone-800">{documentCount}</div>
                   </div>
                   <div className="flex flex-col items-center border-l border-stone-200">
                     <div className="text-[10px] text-stone-600 uppercase font-bold tracking-wider mb-1">{isThai ? "เวลา" : "Time"}</div>
                     <div className="text-sm font-mono text-stone-800">{durationSecs}s</div>
                   </div>
                   <div className="flex flex-col items-center border-l border-stone-200">
                     <div className="text-[10px] text-stone-600 uppercase font-bold tracking-wider mb-1">{isThai ? "ทำงาน" : "Runs"}</div>
                     <div className="text-sm font-mono text-stone-800">{toolRuns}</div>
                   </div>
                   <div className="flex flex-col items-center border-l border-stone-200">
                     <div className="text-[10px] text-stone-600 uppercase font-bold tracking-wider mb-1">{isThai ? "โทเค็น" : "Tokens"}</div>
                     <div className="text-sm font-mono text-stone-800">
                        {tokenCount > 0 ? (tokenCount / 1000).toFixed(1) + 'k' : '-'}
                     </div>
                   </div>
                 </div>
              </div>
            </div>
          </AnalysisCard>
        </div>

        {/* SECTION 2: FINANCIAL STATEMENT TABLES (INCOME, BALANCE, CASH FLOW) */}
        {data.financial_statements && (
          <div id="section-financial-tables" className="flex flex-col gap-4 scroll-mt-14">
            <h2 className="text-xl md:text-2xl font-bold text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight border-b border-stone-200 pb-2 flex items-center gap-2">
              <Layers className="w-6 h-6 text-[#0b5a4b]" />
              <span>{isThai ? "ดัชนีชี้วัดทางการเงิน & งบการเงิน 3 งบ (Key Indicators & Statements)" : "Key Financial Indicators & Statements"}</span>
            </h2>
            <FinancialStatementsTable 
              data={data.financial_statements} 
              isThai={isThai}
              currencyMode={currencyMode}
              currencyRate={currencyRate}
            />
          </div>
        )}

        {/* SECTION 3: VALUATION RATIOS, MULTIPLES DASHBOARD, 5 PILLARS & INTRINSIC VALUE (DCF) */}
        {(data.valuation_ratios || data.intrinsic_value || data.valuation_dashboard || data.five_pillars) && (
          <div id="section-valuation" className="flex flex-col gap-6 scroll-mt-14">
            <h2 className="text-xl md:text-2xl font-bold text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight border-b border-stone-200 pb-2 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-[#0b5a4b]" />
              <span>{isThai ? "การประเมินมูลค่า & 5 เสาหลักพื้นฐาน (Valuation & 5 Fundamental Pillars)" : "Valuation & 5 Fundamental Pillars"}</span>
            </h2>

            {/* 5 Core Valuation & Fundamental Pillars (Growth, ROIC, Balance Sheet, Yields, Peers) */}
            <FivePillarsAnalysis 
              data={data.five_pillars}
              ticker={ticker}
              isThai={isThai}
            />

            {data.intrinsic_value && (
              <IntrinsicValueEngine 
                data={data.intrinsic_value} 
                isThai={isThai}
                currencyMode={currencyMode}
                currencyRate={currencyRate}
              />
            )}

            {data.valuation_dashboard && (
              <ValuationDashboard 
                data={data.valuation_dashboard}
                ticker={ticker}
                isThai={isThai}
              />
            )}

            {data.valuation_ratios && (
              <ValuationPanel 
                ratios={data.valuation_ratios} 
                percentileChart={data.valuation_percentile_chart}
                isThai={isThai}
                ticker={ticker}
              />
            )}
          </div>
        )}

        {/* SECTION 4: EARNINGS & FORECAST ANALYSIS */}
        {(data.earnings_analysis || data.forecast_dashboard) && (
          <div id="section-earnings" className="flex flex-col gap-6 scroll-mt-14">
            <h2 className="text-xl md:text-2xl font-bold text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight border-b border-stone-200 pb-2 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-[#0b5a4b]" />
              <span>{isThai ? "การวิเคราะห์ Earnings & Forecast ฉันทามตินักวิเคราะห์" : "Earnings Performance & Wall Street Forecast"}</span>
            </h2>

            {data.forecast_dashboard && (
              <ForecastDashboard 
                data={data.forecast_dashboard}
                ticker={ticker}
                isThai={isThai}
              />
            )}

            {data.earnings_analysis && (
              <EarningsAnalysisSection 
                data={data.earnings_analysis} 
                isThai={isThai}
                ticker={ticker}
              />
            )}
          </div>
        )}

        {/* SECTION 5: COMPREHENSIVE FUNDAMENTAL ANALYSIS, PROFILE & BUSINESS STRUCTURE */}
        {data.analysis_type !== 'technical' && (data.comprehensive_analysis || data.company_profile || data.business_analysis) && (
          <div id="section-fundamentals" className="flex flex-col gap-6 scroll-mt-14">
            <h2 className="text-xl md:text-2xl font-bold text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight border-b border-stone-200 pb-2 flex items-center gap-2">
              <Lightbulb className="w-6 h-6 text-[#0b5a4b]" />
              <span>{isThai ? "การวิเคราะห์ปัจจัยพื้นฐาน & โครงสร้างธุรกิจ (Fundamentals & Business)" : "Fundamental & Business Analysis"}</span>
            </h2>

            {data.company_profile && (
              <CompanyProfileCard
                data={data.company_profile}
                ticker={ticker}
                isThai={isThai}
              />
            )}

            {data.business_analysis && (
              <BusinessAnalysisCard
                data={data.business_analysis}
                ticker={ticker}
                isThai={isThai}
              />
            )}
            
            {data.comprehensive_analysis?.business_overview && (
              <AnalysisCard title={isThai ? "ภาพรวมธุรกิจ (Business Overview)" : "Business Overview"}>
                 <div className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown findings={data.findings}>{(data.comprehensive_analysis.business_overview || '')}</Markdown></div>
              </AnalysisCard>
            )}
             
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <AnalysisCard title={isThai ? "กลุ่มลูกค้า (Target Customers)" : "Target Customers"}>
                 <div className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown findings={data.findings}>{(data.comprehensive_analysis.target_customers || '')}</Markdown></div>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "โมเดลรายได้ (Revenue Model)" : "Revenue Model & Quality"}>
                 <div className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown findings={data.findings}>{(data.comprehensive_analysis.revenue_model || '')}</Markdown></div>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "ภาพรวมงบการเงิน (Financials)" : "Financial Overview"}>
                 <div className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown findings={data.findings}>{(data.comprehensive_analysis.financial_overview || '')}</Markdown></div>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "ความแข็งแกร่ง (Strengths/Moat)" : "Business Strengths"}>
                 <div className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown findings={data.findings}>{(data.comprehensive_analysis.business_strengths || '')}</Markdown></div>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "โอกาสเติบโต (Future Growth)" : "Future Growth"}>
                 <div className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown findings={data.findings}>{(data.comprehensive_analysis.future_growth || '')}</Markdown></div>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "ความเสี่ยง (Key Risks)" : "Key Risks"}>
                 <div className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown findings={data.findings}>{(data.comprehensive_analysis.key_risks || '')}</Markdown></div>
              </AnalysisCard>
            </div>
            
            <AnalysisCard title={isThai ? "ผู้บริหาร (Management)" : "Management"}>
               <div className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown findings={data.findings}>{(data.comprehensive_analysis.management || '')}</Markdown></div>
            </AnalysisCard>
            <AnalysisCard title={isThai ? "คุณภาพพื้นฐาน (Fundamentals Check)" : "Fundamentals Check"} className="bg-stone-50 border-stone-200">
               <div className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown findings={data.findings}>{(data.comprehensive_analysis.fundamentals_check || '')}</Markdown></div>
            </AnalysisCard>

            {data.comprehensive_analysis.beginner_summary && (
              <AnalysisCard title={isThai ? "สรุปปัจจัยพื้นฐานสำหรับมือใหม่ (Fundamental Beginner Summary)" : "Fundamental Beginner Summary"} className="bg-white border-stone-200" titleClassName="text-stone-900">
                <div className="text-stone-700 leading-relaxed text-[15px] mb-6 border-b border-stone-200 pb-4 prose prose-base prose-stone max-w-none"><Markdown findings={data.findings}>{data.comprehensive_analysis.beginner_summary.business_type_simple || ''}</Markdown></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                  <div>
                    <h4 className="text-sm font-bold text-[#0b5a4b] uppercase tracking-wider mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4"/> {isThai ? "จุดเด่นหลัก" : "Top 3 Strengths"}</h4>
                    <ul className="space-y-2">
                      {(data.comprehensive_analysis.beginner_summary.top_3_strengths || []).map((s, i) => (
                        <li key={i} className="flex gap-2 text-sm text-stone-700">
                          <CheckCircle2 className="w-4 h-4 text-[#0b5a4b] shrink-0 mt-0.5" /> <span className="prose prose-base prose-stone max-w-none"><Markdown findings={data.findings}>{s}</Markdown></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> {isThai ? "ความเสี่ยงหลัก" : "Top 3 Risks"}</h4>
                    <ul className="space-y-2">
                      {(data.comprehensive_analysis.beginner_summary.top_3_risks || []).map((r, i) => (
                        <li key={i} className="flex gap-2 text-sm text-stone-700">
                          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /> <span className="prose prose-base prose-stone max-w-none"><Markdown findings={data.findings}>{r}</Markdown></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-stone-200 text-sm text-stone-700">
                   <div><strong className="text-stone-900">{isThai ? "เหมาะกับใคร:" : "Suitable For:"}</strong> {data.comprehensive_analysis.beginner_summary.suitable_investor_type || ''}</div>
                   <div><strong className="text-stone-900">{isThai ? "อ่านเพิ่มเติม:" : "Further Reading:"}</strong> {data.comprehensive_analysis.beginner_summary.further_reading || ''}</div>
                </div>
              </AnalysisCard>
            )}

            {data.comprehensive_analysis.scoring && (
              <AnalysisCard 
                title={isThai ? "คะแนนประเมินปัจจัย (Factor Scoring 1-10)" : "Factor Scoring (1-10)"}
                subtext={isThai ? "ประเมินคุณภาพ 6 มิติหลัก (สเกล 1-10 โดย 10 คือดีเยี่ยม)" : "Assessment across 6 core dimensions (1-10 scale, 10 being best)"}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(data.comprehensive_analysis.scoring).map(([key, item]) => {
                     if (!item) return null;
                     const labels: Record<string, string> = {
                        understandability: isThai ? 'ความเข้าใจง่าย' : 'Understandability',
                        revenue_quality: isThai ? 'คุณภาพรายได้' : 'Revenue Quality',
                        financial_strength: isThai ? 'ความแข็งแรงทางการเงิน' : 'Financial Strength',
                        growth_potential: isThai ? 'โอกาสเติบโต' : 'Growth Potential',
                        risk_level: isThai ? 'ความเสี่ยง (น้อย=ดี)' : 'Risk Level',
                        overall_attractiveness: isThai ? 'ความน่าสนใจโดยรวม' : 'Overall Attractiveness'
                     };
                     const scoreData = item as {score: number, reason: string};
                     return (
                      <div key={key} className="flex flex-col p-3.5 border border-stone-100 rounded-xl bg-stone-50">
                         <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-sm text-stone-700">{labels[key] || key}</span>
                            <span className={`font-mono font-bold ${scoreColor((scoreData.score || 0) * 10)}`}>{scoreData.score || '-'}/10</span>
                         </div>
                         <div className="text-xs text-stone-700 prose prose-base prose-stone max-w-none"><Markdown findings={data.findings}>{scoreData.reason || ''}</Markdown></div>
                      </div>
                     );
                  })}
                </div>
              </AnalysisCard>
            )}

            {data.comprehensive_analysis.final_verdict_summary && (
              <AnalysisCard title={isThai ? "บทสรุปการประเมินมูลค่า & พื้นฐาน (Fundamental & Valuation Verdict)" : "Fundamental & Valuation Verdict"}>
                 <div className="space-y-4 text-[15px] text-stone-700 leading-relaxed">
                   <div><strong className="text-stone-900 block mb-1">{isThai ? "น่าศึกษาต่อไหม:" : "Worth Studying Further?"}</strong> <div className="prose prose-base prose-stone max-w-none"><Markdown findings={data.findings}>{(data.comprehensive_analysis.final_verdict_summary.worth_further_study || '')}</Markdown></div></div>
                   <div><strong className="text-stone-900 block mb-1">{isThai ? "พื้นฐานดีจริงไหม:" : "Strong Fundamentals?"}</strong> <div className="prose prose-base prose-stone max-w-none"><Markdown findings={data.findings}>{(data.comprehensive_analysis.final_verdict_summary.strong_fundamentals || '')}</Markdown></div></div>
                   <div><strong className="text-stone-900 block mb-1">{isThai ? "สิ่งที่ต้องดูเพิ่ม:" : "What to Look For?"}</strong> <div className="prose prose-base prose-stone max-w-none"><Markdown findings={data.findings}>{(data.comprehensive_analysis.final_verdict_summary.what_to_look_for || '')}</Markdown></div></div>
                 </div>
              </AnalysisCard>
            )}
          </div>
        )}

        {/* SECTION 6: PEER COMPARISON, SMART MONEY & CORPORATE ACTIONS */}
        {(data.peer_comparison || data.catalysts_and_events || data.insider_activity || data.smart_money || data.corporate_actions) && (
          <div id="section-peers-catalysts" className="flex flex-col gap-6 scroll-mt-14">
            {data.peer_comparison && (
              <PeerComparisonTable 
                data={data.peer_comparison} 
                isThai={isThai} 
                targetTicker={ticker} 
              />
            )}

            {(data.smart_money || data.insider_activity) && (
              <SmartMoneyCard
                data={data.smart_money}
                legacyInsiderData={data.insider_activity}
                companyProfile={data.company_profile}
                ticker={ticker}
                isThai={isThai}
              />
            )}

            {data.catalysts_and_events && (
              <CatalystCalendar 
                catalysts={data.catalysts_and_events} 
                isThai={isThai} 
                ticker={ticker} 
              />
            )}

            {data.corporate_actions && (
              <CorporateActionsCard
                data={data.corporate_actions}
                ticker={ticker}
                isThai={isThai}
                currencyMode={currencyMode}
                currencyRate={currencyRate}
              />
            )}
          </div>
        )}

        {/* SECTION 7: HISTORICAL CHARTS */}
        {data.financial_charts && (
          <div id="section-financials" className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 scroll-mt-14">
            <AnalysisCard title={isThai ? "ราคาหุ้นย้อนหลัง" : "Stock Price History"} subtext={isThai ? "แผนภูมินี้แสดงราคาปิดย้อนหลังรายสัปดาห์ในวันซื้อขายสุดท้าย" : "This chart shows the weekly closing price for the past few weeks."}>
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={(data.financial_charts.stock_price_history || [])}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e4" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#78716c' }} dy={10} />
                    <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#78716c' }} dx={-10} />
                    <RechartsTooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const p = payload[0];
                          return (
                            <div className="bg-[#1c1917] text-white p-2.5 rounded-xl border border-white/15 shadow-2xl text-xs font-sans space-y-1 min-w-[160px]">
                              <div className="text-stone-300 font-mono text-[11px] border-b border-stone-800 pb-1 font-bold">{label || p.payload?.date}</div>
                              <div className="flex items-center justify-between gap-3 text-xs">
                                <div className="flex items-center gap-1.5 text-stone-300">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-emerald-400" />
                                  <span>{isThai ? 'ราคาปิด' : 'Price'}:</span>
                                </div>
                                <span className="font-mono font-bold text-white">${typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line type="monotone" dataKey="price" stroke="#0b5a4b" strokeWidth={2.5} dot={{ r: 4, fill: '#0b5a4b', strokeWidth: 2, stroke: '#ffffff' }} activeDot={{ r: 6, fill: '#0b5a4b' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </AnalysisCard>
            
            <AnalysisCard 
              title={isThai ? "ผลประกอบการทางการเงิน (Revenue & Net Income)" : "Financial Performance"}
              subtext={data.financial_charts.financial_performance_4q && data.financial_charts.financial_performance_4q.length > 0 && data.financial_charts.financial_performance_4q[0].distributions !== undefined ? (isThai ? "แผนภูมินี้แสดงการจ่ายปันผลรายไตรมาส (เงินปันผล/ผลตอบแทนต่อหุ้น) สำหรับสี่ไตรมาสที่ผ่านมา" : "This chart shows the quarterly distributions for the past four completed quarters.") : (isThai ? "แผนภูมินี้แสดงรายได้และกำไรสุทธิสำหรับสี่ไตรมาสที่ผ่านมา" : "This chart shows the revenue and net income for the past four completed quarters.")}
            >
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.financial_charts.financial_performance_4q ? [...data.financial_charts.financial_performance_4q] : []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e4" />
                    <XAxis dataKey="quarter" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#78716c' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#78716c' }} dx={-10} tickFormatter={(value) => data.financial_charts?.financial_performance_4q?.[0]?.distributions !== undefined ? `$${value}` : `${value}B`} />
                    <RechartsTooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-[#1c1917] text-white p-3 rounded-xl border border-white/15 shadow-2xl text-xs font-sans space-y-1.5 min-w-[200px]">
                              <div className="text-stone-300 font-mono text-[11px] border-b border-stone-800 pb-1 font-bold">{label}</div>
                              {payload.map((entry: any, i: number) => {
                                const key = entry.dataKey;
                                const isDist = key === 'distributions';
                                const isRev = key === 'revenue';
                                const nameLabel = isDist ? (isThai ? 'เงินปันผล' : 'Distributions') : isRev ? (isThai ? 'รายได้' : 'Revenue') : (isThai ? 'กำไรสุทธิ' : 'Net Income');
                                const valStr = isDist ? `$${entry.value}` : `$${entry.value}B`;
                                const colorDot = isDist ? '#34d399' : isRev ? '#60a5fa' : '#38bdf8';
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
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                    {data.financial_charts.financial_performance_4q && data.financial_charts.financial_performance_4q.length > 0 && data.financial_charts.financial_performance_4q[0].distributions !== undefined ? (
                      <Bar dataKey="distributions" name={isThai ? "เงินปันผล" : "Distributions"} fill="#10b981" radius={[4, 4, 0, 0]} barSize={48} />
                    ) : (
                      <>
                        <Bar dataKey="revenue" name={isThai ? "รายได้" : "Revenue"} fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
                        <Bar dataKey="net_income" name={isThai ? "กำไรสุทธิ" : "Net Income"} fill="#1e3a8a" radius={[4, 4, 0, 0]} barSize={32} />
                      </>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </AnalysisCard>
          </div>
        )}

        {/* SECTION 8: TECHNICAL ANALYSIS & TRADE PLAN */}
        {data.technical_analysis && (
          <div id="section-technical" className="flex flex-col gap-6 scroll-mt-14">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-200 pb-2 gap-2">
              <h2 className="text-xl md:text-2xl font-bold text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-stone-900" />
                <span>{isThai ? "การวิเคราะห์ทางเทคนิค (Technical Analysis)" : "Technical Analysis"}</span>
              </h2>
              {data.technical_analysis.signal_summary?.status && (
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-xs text-stone-500 font-semibold">{isThai ? 'สัญญาณหลัก:' : 'Primary Signal:'}</span>
                  <span className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider font-mono shadow-xs ${
                    data.technical_analysis.signal_summary.status.toLowerCase().includes('buy')
                      ? 'bg-[#0b5a4b] text-white'
                      : data.technical_analysis.signal_summary.status.toLowerCase().includes('sell') || data.technical_analysis.signal_summary.status.toLowerCase().includes('avoid')
                      ? 'bg-red-600 text-white'
                      : 'bg-amber-600 text-white'
                  }`}>
                    {data.technical_analysis.signal_summary.status}
                  </span>
                </div>
              )}
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3 text-sm text-yellow-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <span>
                  <strong>{isThai ? "คำเตือน:" : "Disclaimer:"}</strong> {isThai ? "การวิเคราะห์ทางเทคนิคมีความผันผวนสูงและล้าสมัยเร็ว ไม่ใช่คำแนะนำการลงทุน" : "Technical analysis is highly volatile and becomes outdated quickly."}
                </span>
              </div>
              <div className="text-yellow-700 font-medium whitespace-nowrap ml-4">
                {isThai ? "ข้อมูล ณ" : "Data as of"} {reportDate}
              </div>
            </div>

            <div className="w-full h-[360px] sm:h-[460px] md:h-[520px] bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden relative">
              <iframe 
                src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_1&symbol=${ticker}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=%5B%22MASimple%40tv-basicstudies%22%2C%22MACD%40tv-basicstudies%22%2C%22RSI%40tv-basicstudies%22%2C%22BollingerBands%40tv-basicstudies%22%5D&theme=light&style=1&timezone=Asia%2FBangkok&withdateranges=1&showpopupbutton=1&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=en&utm_source=&utm_medium=widget&utm_campaign=chart&utm_term=${ticker}`}
                width="100%" 
                height="100%" 
                frameBorder="0" 
                scrolling="no" 
                allowFullScreen={true}
              ></iframe>
            </div>
            
            {/* Signal Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <AnalysisCard title={isThai ? "สถานะปัจจุบัน" : "Signal Status"} className="bg-stone-50">
                 <div className="flex items-center justify-center py-4">
                   <div className={`px-6 py-2 rounded-full font-bold text-lg text-white ${data.technical_analysis.signal_summary?.status?.toLowerCase().includes('buy') ? 'bg-[#0b5a4b]' : data.technical_analysis.signal_summary?.status?.toLowerCase().includes('avoid') || data.technical_analysis.signal_summary?.status?.toLowerCase().includes('sell') ? 'bg-red-600' : 'bg-yellow-600'}`}>
                     {data.technical_analysis.signal_summary?.status || 'Wait'}
                   </div>
                 </div>
                 <div className="flex justify-center">
                   <TrackRecordBadge ticker={ticker} currentPrice={parseFloat(String(data.technical_analysis.key_levels?.current_price || "0"))} historyReports={historyReports} isThai={isThai} />
                 </div>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "แนวโน้ม (Trend)" : "Trend Badges"} className="bg-stone-50">
                 <div className="flex flex-col gap-2 mt-2">
                   <div className="flex justify-between items-center text-sm font-medium">
                     <span className="text-stone-500">Weekly</span>
                     <span className="text-stone-900">{data.technical_analysis.signal_summary?.trend_weekly || '-'}</span>
                   </div>
                   <div className="flex justify-between items-center text-sm font-medium">
                     <span className="text-stone-500">Daily</span>
                     <span className="text-stone-900">{data.technical_analysis.signal_summary?.trend_daily || '-'}</span>
                   </div>
                   <div className="flex justify-between items-center text-sm font-medium">
                     <span className="text-stone-500">4H</span>
                     <span className="text-stone-900">{data.technical_analysis.signal_summary?.trend_4h || '-'}</span>
                   </div>
                 </div>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "ความสอดคล้องสัญญาณ" : "Confluence Meter"} className="bg-stone-50 overflow-y-auto max-h-64">
                <div className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown findings={data.findings}>{(data.technical_analysis.signal_summary?.confluence_score || '-')}</Markdown></div>
              </AnalysisCard>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <AnalysisCard 
                title={isThai ? "แผนการเทรด (Trade Plan)" : "Trade Plan"}
                action={
                  <button
                    type="button"
                    onClick={handleCopyTradePlan}
                    className="text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 border border-stone-200 cursor-pointer shadow-xs active:scale-95"
                    title={isThai ? 'คัดลอกแผนการเทรด' : 'Copy Trade Plan'}
                  >
                    {isTradePlanCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#0b5a4b]" />
                        <span className="text-[#0b5a4b] font-semibold">{isThai ? 'คัดลอกแล้ว!' : 'Copied!'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{isThai ? 'คัดลอกแผน' : 'Copy Plan'}</span>
                      </>
                    )}
                  </button>
                }
              >
                 <div className="flex flex-col gap-3">
                   <div className="flex flex-col md:flex-row md:justify-between border-b border-stone-100 pb-2 gap-1 md:gap-4">
                     <span className="text-stone-500 text-sm font-medium whitespace-nowrap shrink-0">{isThai ? "จุดเข้า (Entry)" : "Entry"}</span>
                     <span className="text-stone-900 font-bold md:text-right">{data.technical_analysis.trade_plan?.entry_zone || '-'}</span>
                   </div>
                   <div className="flex flex-col md:flex-row md:justify-between border-b border-stone-100 pb-2 gap-1 md:gap-4">
                     <span className="text-stone-500 text-sm font-medium whitespace-nowrap shrink-0">{isThai ? "จุดตัดขาดทุน (Stop-Loss)" : "Stop-Loss"}</span>
                     <span className="text-red-600 font-bold md:text-right">{data.technical_analysis.trade_plan?.stop_loss || '-'}</span>
                   </div>
                   <div className="flex flex-col md:flex-row md:justify-between border-b border-stone-100 pb-2 gap-1 md:gap-4">
                     <span className="text-stone-500 text-sm font-medium whitespace-nowrap shrink-0">{isThai ? "เป้าหมาย 1 (Target 1)" : "Target 1"}</span>
                     <span className="text-[#0b5a4b] font-bold md:text-right">{data.technical_analysis.trade_plan?.target_1 || '-'}</span>
                   </div>
                   <div className="flex flex-col md:flex-row md:justify-between border-b border-stone-100 pb-2 gap-1 md:gap-4">
                     <span className="text-stone-500 text-sm font-medium whitespace-nowrap shrink-0">{isThai ? "เป้าหมาย 2 (Target 2)" : "Target 2"}</span>
                     <span className="text-[#0b5a4b] font-bold md:text-right">{data.technical_analysis.trade_plan?.target_2 || '-'}</span>
                   </div>
                   <div className="flex flex-col pt-3 gap-2 mt-2 border-t border-stone-100">
                     <span className="text-stone-500 text-sm font-medium">{isThai ? "ความคุ้มค่า (Risk/Reward)" : "Risk/Reward"}</span>
                     <div className="text-stone-700 text-sm bg-stone-50 p-3 rounded-lg border border-stone-100 prose prose-sm prose-stone max-w-none prose-p:my-0 leading-relaxed"><Markdown findings={data.findings}>{data.technical_analysis.trade_plan?.risk_reward_ratio || '-'}</Markdown></div>
                   </div>
                 </div>
              </AnalysisCard>
              
              <AnalysisCard title={isThai ? "แนวรับ-แนวต้าน (Key Levels)" : "Key Levels"}>
                 <KeyLevelsVisualizer currentPrice={data.technical_analysis.key_levels?.current_price} support={data.technical_analysis.key_levels?.support || []} resistance={data.technical_analysis.key_levels?.resistance || []} isThai={isThai} />
                 <div className="grid grid-cols-2 gap-4 mt-8">
                    <div>
                      <h4 className="text-xs font-bold text-red-600 uppercase mb-2">{isThai ? "แนวต้าน (Resistance)" : "Resistance"}</h4>
                      <ul className="space-y-2">
                        {[...(data.technical_analysis.key_levels?.resistance || [])].sort((a, b) => parsePrice(a) - parsePrice(b)).map((r, i) => (
                          <li key={i} className="text-sm font-medium text-stone-700 bg-red-50 px-2 py-1 rounded">R{i+1}: {r}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#0b5a4b] uppercase mb-2">{isThai ? "แนวรับ (Support)" : "Support"}</h4>
                      <ul className="space-y-2">
                        {[...(data.technical_analysis.key_levels?.support || [])].sort((a, b) => parsePrice(b) - parsePrice(a)).map((s, i) => (
                          <li key={i} className="text-sm font-medium text-stone-700 bg-[#0b5a4b]/10 px-2 py-1 rounded">S{i+1}: {s}</li>
                        ))}
                      </ul>
                    </div>
                 </div>
              </AnalysisCard>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <AnalysisCard title={isThai ? "ภาพรวมแนวโน้มหลัก (Overall Trend)" : "Overall Trend"}>
                 <div className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown findings={data.findings}>{(data.technical_analysis.overall_trend || '')}</Markdown></div>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "โครงสร้างราคา (Price Structure)" : "Price Structure"}>
                 <div className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown findings={data.findings}>{(data.technical_analysis.price_structure || '')}</Markdown></div>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "ปริมาณการซื้อขาย (Volume Analysis)" : "Volume Analysis"} tooltip={isThai ? "ปริมาณหุ้นที่ถูกซื้อขายในแต่ละช่วงเวลา ใช้ยืนยันความแข็งแกร่งของเทรนด์" : "Amount of shares traded, used to confirm trend strength"}>
                 <div className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown findings={data.findings}>{(data.technical_analysis.volume_analysis || '')}</Markdown></div>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "กลุ่มเทรนด์ (Trend Indicators)" : "Trend Indicators"} tooltip={isThai ? "บ่งบอกทิศทางของราคา เช่น MA, MACD" : "Indicates price direction e.g. MA, MACD"}>
                 <IndicatorVisualizer type="MACD" text={data.technical_analysis.trend_indicators || ''} isThai={isThai} />
                 <div className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown findings={data.findings}>{(data.technical_analysis.trend_indicators || '')}</Markdown></div>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "กลุ่มโมเมนตัม (Momentum Indicators)" : "Momentum Indicators"} tooltip={isThai ? "วัดความแรงและอ่อนของราคา เช่น RSI, Stochastic" : "Measures strength of price movement e.g. RSI, Stochastic"}>
                 <IndicatorVisualizer type="RSI" text={data.technical_analysis.momentum_indicators || ''} isThai={isThai} />
                 <div className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown findings={data.findings}>{(data.technical_analysis.momentum_indicators || '')}</Markdown></div>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "กลุ่มความผันผวน (Volatility Indicators)" : "Volatility Indicators"} tooltip={isThai ? "วัดความแกว่งตัวของราคา เช่น Bollinger Bands, ATR" : "Measures price variance e.g. Bollinger Bands, ATR"}>
                 <div className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown findings={data.findings}>{(data.technical_analysis.volatility_indicators || '')}</Markdown></div>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "รูปแบบราคาและแท่งเทียน (Chart Patterns)" : "Chart Patterns"} tooltip={isThai ? "รูปแบบที่มักจะเกิดซ้ำเพื่อคาดเดาทิศทาง เช่น Head and Shoulders, Doji" : "Recurring formations to predict direction e.g. Head and Shoulders, Doji"}>
                 <div className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown findings={data.findings}>{(data.technical_analysis.chart_patterns || '')}</Markdown></div>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "เปรียบเทียบกับตลาด (Relative Strength)" : "Relative Strength"}>
                 <div className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown findings={data.findings}>{(data.technical_analysis.relative_strength || '')}</Markdown></div>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "ความเสี่ยงเชิงเทคนิค (Technical Risks)" : "Technical Risks"}>
                 <div className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown findings={data.findings}>{(data.technical_analysis.technical_risks || '')}</Markdown></div>
              </AnalysisCard>
            </div>

            {data.technical_analysis.beginner_summary && (
              <AnalysisCard title={isThai ? "สรุปกลยุทธ์ & จังหวะเทรดสำหรับมือใหม่ (Technical & Trading Setup Summary)" : "Technical & Trading Setup Summary"} className="bg-white border-stone-200" titleClassName="text-stone-900">
                <div className="text-stone-700 leading-relaxed text-[15px] mb-6 border-b border-stone-200 pb-4 prose prose-base prose-stone max-w-none"><Markdown findings={data.findings}>{data.technical_analysis.beginner_summary.technical_overview || ''}</Markdown></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                  <div>
                    <h4 className="text-sm font-bold text-[#0b5a4b] uppercase tracking-wider mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4"/> {isThai ? "จุดที่น่าสนใจ 3 ข้อ" : "Top 3 Points"}</h4>
                    <ul className="space-y-2">
                      {(data.technical_analysis.beginner_summary.top_3_points || []).map((s, i) => (
                        <li key={i} className="flex gap-2 text-sm text-stone-700">
                          <CheckCircle2 className="w-4 h-4 text-[#0b5a4b] shrink-0 mt-0.5" /> <span className="prose prose-base prose-stone max-w-none"><Markdown findings={data.findings}>{s}</Markdown></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> {isThai ? "จุดที่ต้องระวัง 3 ข้อ" : "Top 3 Cautions"}</h4>
                    <ul className="space-y-2">
                      {(data.technical_analysis.beginner_summary.top_3_cautions || []).map((r, i) => (
                        <li key={i} className="flex gap-2 text-sm text-stone-700">
                          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /> <span className="prose prose-base prose-stone max-w-none"><Markdown findings={data.findings}>{r}</Markdown></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="pt-4 border-t border-stone-200 text-sm text-stone-700">
                   <div><strong className="text-stone-900">{isThai ? "เหมาะกับสไตล์การเทรดแบบไหน:" : "Suitable Trade Style:"}</strong> {data.technical_analysis.beginner_summary.suitable_trade_style || ''}</div>
                </div>
              </AnalysisCard>
            )}

            {data.technical_analysis.scoring && (
              <AnalysisCard title={isThai ? "คะแนนประเมิน (1-10)" : "Scoring (1-10)"} className="col-span-1 md:col-span-2">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="w-full md:w-1/2 h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={
                        Object.entries(data.technical_analysis.scoring).map(([key, item]) => {
                          const scoreItem = item as { score: number; reason: string };
                          const labels: Record<string, string> = {
                            trend_clarity: isThai ? 'เทรนด์' : 'Trend Clarity',
                            momentum_strength: isThai ? 'โมเมนตัม' : 'Momentum Strength',
                            risk_reward: isThai ? 'Risk/Reward' : 'Risk/Reward',
                            signal_confluence: isThai ? 'ความสอดคล้อง' : 'Signal Confluence',
                            false_signal_risk: isThai ? 'ความเสี่ยงหลอก' : 'False Signal Risk',
                            overall_attractiveness: isThai ? 'ภาพรวม' : 'Overall'
                          };
                          return {
                            subject: labels[key] || key,
                            A: Number(scoreItem?.score || 0),
                            fullMark: 10,
                          };
                        })
                      }>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#444', fontSize: 12 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: '#888' }} />
                        <RechartsTooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const p = payload[0].payload;
                              return (
                                <div className="bg-[#1c1917] text-white p-2.5 rounded-xl border border-white/15 shadow-2xl text-xs font-sans space-y-1 min-w-[140px]">
                                  <div className="text-stone-300 font-mono text-[11px] border-b border-stone-800 pb-1 font-bold">{p.subject}</div>
                                  <div className="flex items-center justify-between gap-3 text-xs">
                                    <div className="flex items-center gap-1.5 text-stone-300">
                                      <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-emerald-400" />
                                      <span>{isThai ? 'คะแนน' : 'Score'}:</span>
                                    </div>
                                    <span className="font-mono font-bold text-white">{p.A} / 10</span>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Radar name="Score" dataKey="A" stroke="#0b5a4b" fill="#0b5a4b" fillOpacity={0.5} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full md:w-1/2 grid grid-cols-1 gap-4">
                    {Object.entries(data.technical_analysis.scoring).map(([key, item]) => {
                       if (!item) return null;
                       const scoreItem = item as { score: number; reason: string };
                       const labels: Record<string, string> = {
                          trend_clarity: isThai ? 'ความชัดเจนของเทรนด์' : 'Trend Clarity',
                          momentum_strength: isThai ? 'ความแข็งแรงของโมเมนตัม' : 'Momentum Strength',
                          risk_reward: isThai ? 'คุณภาพ Risk/Reward' : 'Risk/Reward Quality',
                          signal_confluence: isThai ? 'ความสอดคล้องของสัญญาณ' : 'Signal Confluence',
                          false_signal_risk: isThai ? 'ความเสี่ยงสัญญาณหลอก (ยิ่งเสี่ยงมาก คะแนนยิ่งต่ำ)' : 'False Signal Risk',
                          overall_attractiveness: isThai ? 'ความน่าสนใจโดยรวม' : 'Overall Attractiveness'
                       };
                       return (
                         <div key={key} className="flex flex-col p-3 rounded-lg border border-stone-100 bg-stone-50">
                           <div className="flex items-center justify-between mb-1">
                             <span className="text-xs font-bold text-stone-500 uppercase">{labels[key] || key}</span>
                             <span className={`text-sm font-bold ${scoreColor(Number(scoreItem.score) * 10)}`}>{scoreItem.score}/10</span>
                           </div>
                           <div className="text-sm text-stone-700 leading-snug prose prose-base prose-stone max-w-none"><Markdown findings={data.findings}>{scoreItem.reason}</Markdown></div>
                         </div>
                       );
                    })}
                  </div>
                </div>
              </AnalysisCard>
            )}

            {data.technical_analysis.final_verdict_summary && (
              <AnalysisCard title={isThai ? "บทสรุปแผนการเทรด & กลยุทธ์เทคนิคอล (Technical Execution Verdict)" : "Technical Execution Verdict"}>
                 <div className="space-y-4 text-[15px] text-stone-700 leading-relaxed">
                   <div><strong className="text-stone-900 block mb-1">{isThai ? "จังหวะน่าเข้าไหม:" : "Good Timing?"}</strong> <div className="prose prose-base prose-stone max-w-none"><Markdown findings={data.findings}>{(data.technical_analysis.final_verdict_summary.is_good_timing || '')}</Markdown></div></div>
                   <div><strong className="text-stone-900 block mb-1">{isThai ? "ถ้ารอ ต้องรออะไร:" : "What to wait for?"}</strong> <div className="prose prose-base prose-stone max-w-none"><Markdown findings={data.findings}>{(data.technical_analysis.final_verdict_summary.what_to_wait_for || '')}</Markdown></div></div>
                   <div><strong className="text-stone-900 block mb-1">{isThai ? "แผนการเข้าสั้นๆ:" : "Trade Plan:"}</strong> <div className="prose prose-base prose-stone max-w-none"><Markdown findings={data.findings}>{(data.technical_analysis.final_verdict_summary.trade_plan || '')}</Markdown></div></div>
                 </div>
              </AnalysisCard>
            )}
          </div>
        )}

        {/* SECTION 9: DEEP INSIGHTS */}
        {!isTechnicalOnly && data.deep_insights && data.deep_insights.length > 0 && (
          <div id="section-insights" className="flex flex-col gap-4 scroll-mt-14">
            <h2 className="text-xl md:text-2xl font-bold text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight border-b border-stone-200 pb-2">
              {isThai ? "ข้อมูลเชิงลึก (Deep Insights)" : "Deep Insights"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {data.deep_insights.slice(0, 3).map((insight, index) => (
                <div key={index} className="bg-white p-5 md:p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col justify-between">
                   <div className="flex items-start justify-between mb-4 border-b border-stone-100 pb-4">
                     <div>
                       <div className="text-xs text-stone-500 font-bold uppercase tracking-wider">{insight.category}</div>
                       <h4 className="font-bold text-stone-900 text-lg mt-0.5 leading-tight">{insight.title}</h4>
                     </div>
                   </div>
                   <div className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed flex-1"><Markdown findings={data.findings}>{insight.description}</Markdown></div>
                   <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between">
                     <span className="text-xs text-stone-600 font-bold uppercase tracking-wider">{isThai ? "คะแนนผลกระทบ" : "Impact Score"}</span>
                     <span className={`text-sm font-mono font-bold px-2 py-0.5 rounded ${insight.impact_score >= 8 ? 'bg-red-50 text-red-700' : insight.impact_score >= 5 ? 'bg-yellow-50 text-yellow-700' : 'bg-[#0b5a4b]/10 text-[#0b5a4b]'}`}>{insight.impact_score}/10</span>
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 10: CITATIONS & SEC FILINGS */}
        <div id="section-citations" className="flex flex-col gap-4 scroll-mt-14">
           <h2 className="text-xl md:text-2xl font-bold text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight border-b border-stone-200 pb-2">
             {isThai ? "เอกสารอ้างอิงและผลการค้นพบ (Document Findings)" : "Document Findings & SEC Filings"}
           </h2>
           
           {findings.length === 0 ? (
             <div className="text-stone-500 italic p-8 bg-white rounded-2xl border border-stone-200 text-center">
               {isThai ? "ไม่พบข้อมูลจากเอกสารเฉพาะเจาะจง" : "No specific document findings returned."}
             </div>
           ) : (
             <div className="flex flex-col gap-4">
               {findings.map((finding, index) => (
                 <div key={index} className="bg-white p-5 md:p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col">
                   <div className="flex items-start justify-between mb-4 border-b border-stone-100 pb-4">
                     <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-2xl bg-stone-100 text-stone-600 flex items-center justify-center">
                         <FileText className="w-5 h-5" />
                       </div>
                       <div>
                         <h4 className="font-bold text-stone-900 text-lg">{finding.documentType || finding.document_type || (isThai ? "เอกสาร" : "Document")}</h4>
                         {finding.date && (
                           <div className="text-xs text-stone-500 font-mono flex items-center gap-1 mt-1">
                             <Calendar className="w-3 h-3" /> {finding.date}
                           </div>
                         )}
                       </div>
                     </div>
                     {(finding.sourceUrl || finding.source_url) && (
                       <a href={finding.sourceUrl || finding.source_url} target="_blank" rel="noreferrer" className="hover:opacity-80 transition-opacity flex items-center justify-center p-1" title="View Source">
                         <img src="https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg" alt="PDF" className="w-8 h-8" />
                       </a>
                     )}
                   </div>
                   
                   <ul className="space-y-2.5 mt-2 flex-1">
                     {Array.isArray(finding.keyInsights || finding.key_insights) ? (finding.keyInsights || finding.key_insights)?.map((insight, i) => (
                       <li key={i} className="flex gap-2 text-sm text-stone-700 leading-relaxed">
                         <ChevronRight className="w-4 h-4 text-stone-500 mt-0.5 shrink-0" />
                         <span className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown findings={data.findings}>{insight}</Markdown></span>
                       </li>
                     )) : (finding.keyInsights || finding.key_insights) ? (
                       <li className="flex gap-2 text-sm text-stone-700 leading-relaxed">
                         <ChevronRight className="w-4 h-4 text-stone-500 mt-0.5 shrink-0" />
                         <span className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown findings={data.findings}>{String(finding.keyInsights || finding.key_insights)}</Markdown></span>
                       </li>
                     ) : null}
                   </ul>
                 </div>
               ))}
             </div>
           )}
        </div>
      </div>

      {/* Floating Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 p-3 bg-stone-900 text-white rounded-full shadow-2xl hover:bg-black hover:scale-110 active:scale-95 transition-all print:hidden flex items-center justify-center border border-white/20 cursor-pointer"
          title={isThai ? 'กลับขึ้นบนสุด' : 'Back to top'}
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}

      {/* Score Methodology Modal */}
      <ScoreMethodologyModal 
        isOpen={showScoreModal}
        onClose={() => setShowScoreModal(false)}
        isThai={isThai}
        convictionScore={data.verdict?.conviction_score}
      />
    </div>
  );
}
