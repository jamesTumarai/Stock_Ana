import React, { useState, useEffect } from 'react';
import { EnhancedMarkdown as Markdown } from './components/EnhancedMarkdown';
import { motion } from 'motion/react';
import { 
  X, FileText, CheckCircle2, ChevronRight, Link as LinkIcon, Calendar,
  TrendingUp, TrendingDown, Minus, Lightbulb, AlertTriangle, ArrowUp, Copy, Check, Printer, Sparkles
} from 'lucide-react';
import { Info } from 'lucide-react';
import { ReportData } from './App';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

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

const ConvictionGauge = ({ score, isThai }: { score: number | string, isThai: boolean }) => {
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
    <div className="relative flex items-center justify-center my-1">
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
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-3xl font-bold font-['Nunito',sans-serif] tabular-nums" style={{ color: strokeColor }}>
          {score || '-'}
        </span>
        <span className="text-[10px] text-stone-500 font-bold tracking-wider font-['Prompt','Nunito',sans-serif]">
          {isThai ? 'เต็ม 100' : '/ 100'}
        </span>
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
  ).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)); // oldest first

  if (pastReports.length < 2) return null; // Need at least some history

  let wins = 0;
  let totalEvaluated = 0;

  pastReports.forEach(report => {
    const status = (report.data.technical_analysis.signal_summary.status || '').toLowerCase();
    const pastPrice = parseFloat(report.data.technical_analysis.key_levels.current_price);
    
    if (isNaN(pastPrice)) return;
    
    // Evaluate if 'Buy' made money, or 'Sell/Avoid' saved money
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
      <span className="text-xl">🎯</span>
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
   
   // Try to match a number specifically for RSI/MACD or just the first number
   let match = null;
   if (type === 'RSI') {
      // Remove common period notations to avoid matching them
      const cleanText = text.replace(/RSI\s*(?:\(\s*14\s*\)|14\s*วัน)/gi, 'RSI');
      match = cleanText.match(/RSI.*?(\d+(\.\d+)?)/i);
      // Fallback if RSI is not mentioned directly before the value
      if (!match) {
          const numbers = Array.from(cleanText.matchAll(/(-?\d+(\.\d+)?)/g));
          if (numbers.length > 0) match = numbers[0];
      }
   } else if (type === 'MACD') {
      // Remove common MACD period notations like (12, 26, 9) or (12,26)
      const cleanText = text.replace(/MACD\s*\(\s*12\s*,\s*26\s*(?:,\s*9\s*)?\)/gi, 'MACD');
      match = cleanText.match(/MACD.*?(-?\d+(\.\d+)?)/i);
      if (!match) {
          const numbers = Array.from(cleanText.matchAll(/(-?\d+(\.\d+)?)/g)).filter(m => !['12', '26', '9'].includes(m[1]));
          if (numbers.length > 0) match = numbers[0];
      }
   }
   if (!match) {
      match = text.match(/(-?\d+(\.\d+)?)/);
   }
   
   const value = match ? parseFloat(match[1]) : null;
   if (value === null || isNaN(value)) return null;

   if (type === 'RSI') {
     const left = Math.max(0, Math.min(100, value));
     return (
       <div className="mt-4 mb-2 bg-stone-50 p-4 rounded-xl border border-stone-100">
         <div className="flex justify-between text-xs text-stone-500 mb-2 font-medium">
           <span>0 (Oversold)</span>
           <span className="font-bold text-stone-900 text-sm">RSI: {value}</span>
           <span>100 (Overbought)</span>
         </div>
         <div className="w-full h-2.5 bg-stone-200 rounded-full relative">
           <div className="absolute top-0 left-[30%] w-[40%] h-full bg-stone-300 border-x border-white/50" />
           <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[#0b5a4b] rounded-full shadow-sm border-2 border-white transition-all duration-700" style={{ left: `calc(${left}% - 8px)` }} />
         </div>
         <div className="flex justify-between text-[10px] text-stone-400 mt-1 px-1">
           <span className="w-1/3 text-left">{isThai ? 'โซนซื้อ' : 'Buy Zone'}</span>
           <span className="w-1/3 text-center">{isThai ? 'กลาง' : 'Neutral'}</span>
           <span className="w-1/3 text-right">{isThai ? 'โซนขาย' : 'Sell Zone'}</span>
         </div>
       </div>
     );
   }
   
   if (type === 'MACD') {
      const absMax = Math.max(1, Math.abs(value) * 1.5);
      const normalizedLeft = ((value + absMax) / (absMax * 2)) * 100;
      const left = Math.max(0, Math.min(100, normalizedLeft));
      
      return (
       <div className="mt-4 mb-2 bg-stone-50 p-4 rounded-xl border border-stone-100">
         <div className="flex justify-between text-xs text-stone-500 mb-2 font-medium">
           <span>Bearish</span>
           <span className="font-bold text-stone-900 text-sm">MACD: {value}</span>
           <span>Bullish</span>
         </div>
         <div className="w-full h-2.5 bg-stone-200 rounded-full relative">
           <div className="absolute top-0 left-1/2 w-px h-full bg-stone-400" />
           <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[#0b5a4b] rounded-full shadow-sm border-2 border-white transition-all duration-700" style={{ left: `calc(${left}% - 8px)` }} />
         </div>
         <div className="flex justify-between text-[10px] text-stone-400 mt-1 px-1">
           <span className="w-1/2 text-left">{isThai ? '< 0 (ขาลง)' : '< 0 (Downtrend)'}</span>
           <span className="w-1/2 text-right">{isThai ? '> 0 (ขาขึ้น)' : '> 0 (Uptrend)'}</span>
         </div>
       </div>
      );
   }
   return null;
}

const AnalysisCard = ({ title, action, subtext, children, className = "", titleClassName = "text-stone-900", delay = 0 }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }} 
    whileInView={{ opacity: 1, y: 0 }} 
    viewport={{ once: true }} 
    transition={{ duration: 0.4, delay }} 
    className={`bg-white rounded-2xl p-4 sm:p-6 md:p-8 shadow-sm border border-stone-200 flex flex-col ${className}`}
  >
    <div className="flex justify-between items-center mb-2 gap-2">
      <h3 className={`text-lg md:text-xl font-bold font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight ${titleClassName}`}>{title}</h3>
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
  </motion.div>
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
          <div key={`s-${i}`} className="absolute w-3 h-3 bg-[#0b5a4b]/100 rounded-full top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 border-2 border-white shadow-sm" style={{ left: getPos(s) }}>
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
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm whitespace-nowrap">
              {isThai ? 'ราคาปัจจุบัน ' : 'Current '}{currentPrice}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-600 rotate-45"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function ReportTemplate({ data, ticker, onClose, durationSecs = 0, toolRuns = 0, tokenCount = 0, documentCount = 0, language = 'English', hideHeader = false, historyReports = [] }: Props) {
  const isThai = language === 'Thai';
  const isTechnicalOnly = data.analysis_type === 'technical' || (data.technical_analysis && !data.comprehensive_analysis);

  const [activeNav, setActiveNav] = useState('section-summary');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isTradePlanCopied, setIsTradePlanCopied] = useState(false);

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
    const text = `🎯 ${ticker.toUpperCase()} Trade Plan:
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
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const findings = data.findings || [];

  const navItems = [
    { id: 'section-summary', label: isThai ? 'บทสรุป' : 'Summary' },
    ...(data.analysis_type !== 'technical' && data.comprehensive_analysis ? [
      { id: 'section-fundamentals', label: isThai ? 'ปัจจัยพื้นฐาน' : 'Fundamentals' },
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
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`min-h-full bg-[#F6F4F0] text-stone-900 report-cute-font w-full flex flex-col print:overflow-visible print:h-auto print:bg-white print:block ${hideHeader ? 'mb-8 border-b-4 border-stone-300 pb-8' : 'h-full overflow-y-auto'}`}>
      {!hideHeader && (
        <div className="w-full border-b border-stone-200/80 px-3 sm:px-6 md:px-8 py-2.5 sm:py-3 flex items-center justify-between sticky top-0 z-50 bg-[#F6F4F0]/95 backdrop-blur-md print:static print:bg-white shadow-xs gap-2 sm:gap-3">
          {/* Left Title */}
          <div className="font-bold text-stone-900 text-sm sm:text-base md:text-lg tracking-tight flex items-center gap-1.5 sm:gap-2 font-['Prompt','Mitr','Nunito',sans-serif] shrink-0">
            {isThai ? `วิเคราะห์ ${ticker}` : `${ticker} Analysis`}
          </div>

          {/* Center Navigation Pills (Centered & Smooth Mobile Touch Scrolling) */}
          <div className="flex-1 flex items-center justify-center overflow-x-auto no-scrollbar scroll-smooth touch-pan-x py-0.5 px-1 sm:px-2">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-max">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-xs md:text-sm font-semibold transition-all flex items-center justify-center cursor-pointer select-none whitespace-nowrap shrink-0 ${
                    activeNav === item.id 
                      ? 'bg-stone-900 text-white shadow-sm ring-1 ring-stone-900' 
                      : 'bg-white/80 hover:bg-white text-stone-700 border border-stone-200/80 hover:text-stone-900 hover:border-stone-300'
                  }`}
                >
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right Controls: Close Button */}
          <div className="flex items-center gap-2 print:hidden shrink-0">
            <button 
              onClick={onClose}
              className="text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 transition-all rounded-full p-1.5 sm:p-2 cursor-pointer flex items-center justify-center"
              title={isThai ? 'ปิด' : 'Close'}
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      )}

      <div id="report-content" className="flex-1 py-4 sm:py-8 px-2.5 sm:px-6 md:px-[40px] w-full max-w-[1200px] mx-auto flex flex-col gap-4 md:gap-6 bg-[#F6F4F0]">
        
        {/* Executive Summary */}
        <div id="section-summary" className="flex flex-col gap-4 md:gap-6 scroll-mt-14">
          <AnalysisCard title={isThai ? "บทสรุปผู้บริหาร" : "Executive Summary"} className="w-full">
            <div className="bg-stone-50 p-3 md:p-5 rounded-xl border border-stone-100 mb-6 text-stone-800 leading-relaxed font-medium text-lg w-full">
              "{data.verdict?.summary || (isThai ? 'ไม่มีบทสรุป' : 'No summary available.')}"
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-10 gap-8 w-full mt-2">
              <div className="md:col-span-7 flex flex-col">
                {data.verdict?.key_takeaways && (Array.isArray(data.verdict.key_takeaways) ? data.verdict.key_takeaways.length > 0 : true) && (
                  <div className="w-full text-left flex-1">
                     <div className="text-sm font-bold text-stone-700 uppercase tracking-wider mb-4 border-b border-stone-100 pb-2">{isThai ? "ประเด็นสำคัญ" : "Key Takeaways"}</div>
                     <div className="space-y-3">
                       {Array.isArray(data.verdict.key_takeaways) ? data.verdict.key_takeaways.map((takeaway, i) => (
                          <div key={i} className="flex gap-3 text-base">
                             <CheckCircle2 className="w-5 h-5 text-[#0b5a4b] shrink-0 mt-0.5" />
                             <div className="text-stone-700 leading-relaxed prose prose-base prose-stone max-w-none"><Markdown findings={data.findings}>{takeaway}</Markdown></div>
                          </div>
                       )) : (
                          <div className="flex gap-3 text-base">
                             <CheckCircle2 className="w-5 h-5 text-[#0b5a4b] shrink-0 mt-0.5" />
                             <div className="text-stone-700 leading-relaxed prose prose-base prose-stone max-w-none"><Markdown findings={data.findings}>{String(data.verdict.key_takeaways)}</Markdown></div>
                          </div>
                       )}
                     </div>
                  </div>
                )}
              </div>
              
              <div className="md:col-span-3 flex flex-col h-full text-center md:border-l md:border-stone-100 md:pl-8 items-center justify-between">
                 <div className="w-full">
                   <h4 className="text-sm font-bold text-stone-700 uppercase tracking-wider mb-1">{isThai ? "คะแนนความเชื่อมั่น" : "Conviction Score"}</h4>
                   <p className="text-xs text-stone-600 mb-2">{isThai ? "อ้างอิงจากเอกสารที่วิเคราะห์" : "Based on analyzed filings"}</p>
                   
                   <ConvictionGauge score={data.verdict?.conviction_score || '-'} isThai={isThai} />
                 </div>
                 
                 <div className="grid grid-cols-4 gap-1 border-t border-stone-100 pt-4 mt-auto w-full">
                   <div className="flex flex-col items-center">
                     <div className="text-[10px] text-stone-700 uppercase font-bold tracking-wider mb-1">{isThai ? "เอกสาร" : "Docs"}</div>
                     <div className="text-sm font-mono text-stone-800">{documentCount}</div>
                   </div>
                   <div className="flex flex-col items-center border-l border-stone-100">
                     <div className="text-[10px] text-stone-700 uppercase font-bold tracking-wider mb-1">{isThai ? "เวลา" : "Time"}</div>
                     <div className="text-sm font-mono text-stone-800">{durationSecs}s</div>
                   </div>
                   <div className="flex flex-col items-center border-l border-stone-100">
                     <div className="text-[10px] text-stone-700 uppercase font-bold tracking-wider mb-1">{isThai ? "การทำงาน" : "Runs"}</div>
                     <div className="text-sm font-mono text-stone-800">{toolRuns}</div>
                   </div>
                   <div className="flex flex-col items-center border-l border-stone-100">
                     <div className="text-[10px] text-stone-700 uppercase font-bold tracking-wider mb-1">{isThai ? "โทเค็น" : "Tokens"}</div>
                     <div className="text-sm font-mono text-stone-800">
                        {tokenCount > 0 ? (tokenCount / 1000).toFixed(1) + 'k' : '-'}
                     </div>
                   </div>
                 </div>
              </div>
            </div>
          </AnalysisCard>
        </div>

        {/* Comprehensive Analysis */}
        {data.analysis_type !== 'technical' && data.comprehensive_analysis && (
          <div id="section-fundamentals" className="flex flex-col gap-4 md:p-6 mt-2 scroll-mt-14">
            <h2 className="text-xl md:text-2xl font-bold text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight border-b border-stone-200 pb-2 mt-4">
              {isThai ? "การวิเคราะห์ปัจจัยพื้นฐานเชิงลึก" : "Comprehensive Fundamental Analysis"}
            </h2>
            
            <AnalysisCard title={isThai ? "ภาพรวมธุรกิจ (Business Overview)" : "Business Overview"}>
               <div className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown findings={data.findings}>{(data.comprehensive_analysis.business_overview || '')}</Markdown></div>
            </AnalysisCard>
             
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:p-6">
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
              <AnalysisCard title={isThai ? "สรุปสำหรับมือใหม่ (Beginner Summary)" : "Beginner Summary"} className="bg-white border-stone-200" titleClassName="text-stone-900">
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
              <AnalysisCard title={isThai ? "คะแนนประเมินปัจจัย (1-10)" : "Factor Scoring (1-10)"}>
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
                      <div key={key} className="flex flex-col p-3 border border-stone-100 rounded bg-stone-50">
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
              <AnalysisCard title={isThai ? "บทสรุปสุดท้าย (Final Verdict)" : "Final Verdict Summary"}>
                 <div className="space-y-4 text-[15px] text-stone-700 leading-relaxed">
                   <div><strong className="text-stone-900 block mb-1">{isThai ? "น่าศึกษาต่อไหม:" : "Worth Studying Further?"}</strong> <div className="prose prose-base prose-stone max-w-none"><Markdown findings={data.findings}>{(data.comprehensive_analysis.final_verdict_summary.worth_further_study || '')}</Markdown></div></div>
                   <div><strong className="text-stone-900 block mb-1">{isThai ? "พื้นฐานดีจริงไหม:" : "Strong Fundamentals?"}</strong> <div className="prose prose-base prose-stone max-w-none"><Markdown findings={data.findings}>{(data.comprehensive_analysis.final_verdict_summary.strong_fundamentals || '')}</Markdown></div></div>
                   <div><strong className="text-stone-900 block mb-1">{isThai ? "สิ่งที่ต้องดูเพิ่ม:" : "What to Look For?"}</strong> <div className="prose prose-base prose-stone max-w-none"><Markdown findings={data.findings}>{(data.comprehensive_analysis.final_verdict_summary.what_to_look_for || '')}</Markdown></div></div>
                 </div>
              </AnalysisCard>
            )}
          </div>
        )}

        {/* Financial Charts */}
        {data.financial_charts && (
          <div id="section-financials" className="grid grid-cols-1 md:grid-cols-2 gap-4 md:p-6 mt-8 scroll-mt-14">
            <AnalysisCard title={isThai ? "ราคาหุ้น" : "Stock Price"} subtext={isThai ? "แผนภูมินี้แสดงราคาปิดย้อนหลังรายสัปดาห์ในวันซื้อขายสุดท้าย" : "This chart shows the weekly closing price for the past few weeks."}>
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={(data.financial_charts.stock_price_history || data.financial_charts.stock_price_history) ? [...(data.financial_charts.stock_price_history || data.financial_charts.stock_price_history)] : []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e4" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#78716c' }} dy={10} />
                    <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#78716c' }} dx={-10} />
                    <RechartsTooltip 
                      contentStyle={{ 
                        backgroundColor: '#1c1917', 
                        borderRadius: '10px', 
                        border: '1px solid rgba(255,255,255,0.15)', 
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                        color: '#ffffff',
                        fontSize: '12px',
                        padding: '8px 12px'
                      }}
                      itemStyle={{ color: '#34d399', fontWeight: 600 }}
                      labelStyle={{ color: '#a8a29e', marginBottom: '4px', fontWeight: 500 }}
                      formatter={(value: number) => [`$${typeof value === 'number' ? value.toFixed(2) : value}`, isThai ? 'ราคาปิด' : 'Price']}
                    />
                    <Line type="monotone" dataKey="price" stroke="#0b5a4b" strokeWidth={2.5} dot={{ r: 4, fill: '#0b5a4b', strokeWidth: 2, stroke: '#ffffff' }} activeDot={{ r: 6, fill: '#0b5a4b' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </AnalysisCard>
            
            <AnalysisCard 
              title={isThai ? "ผลประกอบการทางการเงิน" : "Financial Performance"}
              subtext={data.financial_charts.financial_performance_4q && data.financial_charts.financial_performance_4q.length > 0 && data.financial_charts.financial_performance_4q[0].distributions !== undefined ? (isThai ? "แผนภูมินี้แสดงการจ่ายปันผลรายไตรมาส (เงินปันผล/ผลตอบแทนต่อหุ้น) สำหรับสี่ไตรมาสที่ผ่านมา" : "This chart shows the quarterly distributions (dividends/yield per share) for the past four completed quarters.") : (isThai ? "แผนภูมินี้แสดงรายได้และกำไรสุทธิสำหรับสี่ไตรมาสที่ผ่านมา" : "This chart shows the revenue and net income for the past four completed quarters.")}
            >
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.financial_charts.financial_performance_4q ? [...data.financial_charts.financial_performance_4q] : []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e4" />
                    <XAxis dataKey="quarter" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#78716c' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#78716c' }} dx={-10} tickFormatter={(value) => data.financial_charts?.financial_performance_4q?.[0]?.distributions !== undefined ? `$${value}` : `${value}B`} />
                    <RechartsTooltip 
                      contentStyle={{ 
                        backgroundColor: '#1c1917', 
                        borderRadius: '10px', 
                        border: '1px solid rgba(255,255,255,0.15)', 
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                        color: '#ffffff',
                        fontSize: '12px',
                        padding: '8px 12px'
                      }}
                      itemStyle={{ fontWeight: 600 }}
                      labelStyle={{ color: '#a8a29e', marginBottom: '4px', fontWeight: 500 }}
                      formatter={(value: number, name: string) => {
                        const isDist = name === (isThai ? 'เงินปันผล' : 'Distributions') || name === 'Distributions';
                        const isRev = name === 'Revenue' || name === 'รายได้' || name === (isThai ? 'รายได้' : 'Revenue');
                        const label = isDist ? (isThai ? 'เงินปันผล' : 'Distributions') : isRev ? (isThai ? 'รายได้' : 'Revenue') : (isThai ? 'กำไรสุทธิ' : 'Net Income');
                        const formattedVal = isDist ? `$${value}` : `$${value}B`;
                        return [formattedVal, label];
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

        {/* Technical Analysis */}
        {data.technical_analysis && (
          <div id="section-technical" className="flex flex-col gap-4 md:p-6 mt-2 scroll-mt-14">
            <h2 className="text-xl md:text-2xl font-bold text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight border-b border-stone-200 pb-2 mt-4">
              {isThai ? "การวิเคราะห์ทางเทคนิค (Technical Analysis)" : "Technical Analysis"}
            </h2>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <span>
                  <strong>{isThai ? "คำเตือน:" : "Disclaimer:"}</strong> {isThai ? "ข้อมูลนี้ไม่ใช่คำแนะนำการลงทุน (Not Investment Advice). การวิเคราะห์ทางเทคนิคมีความผันผวนสูงและล้าสมัยเร็ว" : "This is not investment advice. Technical analysis is highly volatile and becomes outdated quickly."}
                </span>
              </div>
              <div className="text-yellow-700 font-medium whitespace-nowrap ml-4">
                {isThai ? "ข้อมูล ณ" : "Data as of"} {new Date().toLocaleString(isThai ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <div className="w-full h-[360px] sm:h-[460px] md:h-[520px] bg-white rounded-xl shadow-sm border border-stone-100 overflow-hidden relative">
              <iframe 
                src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_1&symbol=${ticker}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=%5B%22MASimple%40tv-basicstudies%22%2C%22MACD%40tv-basicstudies%22%2C%22RSI%40tv-basicstudies%22%2C%22BollingerBands%40tv-basicstudies%22%5D&theme=light&style=1&timezone=Asia%2FBangkok&withdateranges=1&showpopupbutton=1&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=en&utm_source=&utm_medium=widget&utm_campaign=chart&utm_term=${ticker}`}
                width="100%" 
                height="100%" 
                frameBorder="0" 
                 
                scrolling="no" 
                allowFullScreen={true}
              ></iframe>
            </div>
            
            {/* 3. Signal Summary Card */}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:p-6">
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:p-6">
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
              <AnalysisCard title={isThai ? "สรุปสำหรับมือใหม่ (Beginner Summary)" : "Beginner Summary"} className="bg-white border-stone-200" titleClassName="text-stone-900">
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
                            A: Number(item.score),
                            fullMark: 10,
                          };
                        })
                      }>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#444', fontSize: 12 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: '#888' }} />
                        <Radar name="Score" dataKey="A" stroke="#0b5a4b" fill="#0b5a4b" fillOpacity={0.5} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full md:w-1/2 grid grid-cols-1 gap-4">
                    {Object.entries(data.technical_analysis.scoring).map(([key, item]) => {
                       if (!item) return null;
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
                             <span className={`text-sm font-bold ${scoreColor(Number(item.score) * 10)}`}>{item.score}/10</span>
                           </div>
                           <div className="text-sm text-stone-700 leading-snug prose prose-base prose-stone max-w-none"><Markdown findings={data.findings}>{item.reason}</Markdown></div>
                         </div>
                       );
                    })}
                  </div>
                </div>
              </AnalysisCard>
            )}

            {data.technical_analysis.final_verdict_summary && (
              <AnalysisCard title={isThai ? "บทสรุปสุดท้าย (Final Verdict)" : "Final Verdict Summary"}>
                 <div className="space-y-4 text-[15px] text-stone-700 leading-relaxed">
                   <div><strong className="text-stone-900 block mb-1">{isThai ? "จังหวะน่าเข้าไหม:" : "Good Timing?"}</strong> <div className="prose prose-base prose-stone max-w-none"><Markdown findings={data.findings}>{(data.technical_analysis.final_verdict_summary.is_good_timing || '')}</Markdown></div></div>
                   <div><strong className="text-stone-900 block mb-1">{isThai ? "ถ้ารอ ต้องรออะไร:" : "What to wait for?"}</strong> <div className="prose prose-base prose-stone max-w-none"><Markdown findings={data.findings}>{(data.technical_analysis.final_verdict_summary.what_to_wait_for || '')}</Markdown></div></div>
                   <div><strong className="text-stone-900 block mb-1">{isThai ? "แผนการเข้าสั้นๆ:" : "Trade Plan:"}</strong> <div className="prose prose-base prose-stone max-w-none"><Markdown findings={data.findings}>{(data.technical_analysis.final_verdict_summary.trade_plan || '')}</Markdown></div></div>
                 </div>
              </AnalysisCard>
            )}
          </div>
        )}



        {/* Deep Insights */}
        {!isTechnicalOnly && data.deep_insights && data.deep_insights.length > 0 && (
          <div id="section-insights" className="mt-8 scroll-mt-14">
            <h2 className="text-xl md:text-2xl font-bold text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight mb-6">
              {isThai ? "ข้อมูลเชิงลึก" : "Deep Insights"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:p-6">
              {data.deep_insights.slice(0, 3).map((insight, index) => (
                <div key={index} className="bg-white p-4 md:p-6 rounded-xl border border-stone-200 shadow-sm flex flex-col">
                   <div className="flex items-start justify-between mb-4 border-b border-stone-100 pb-4">
                     <div className="flex items-center gap-3">
                       <div>
                         <div className="text-xs text-stone-700 font-bold uppercase tracking-wider">{insight.category}</div>
                         <h4 className="font-bold text-stone-900 text-lg mt-0.5 leading-tight">{insight.title}</h4>
                       </div>
                     </div>
                   </div>
                   <div className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed flex-1"><Markdown findings={data.findings}>{insight.description}</Markdown></div>
                   <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between">
                     <span className="text-xs text-stone-700 font-bold uppercase tracking-wider">{isThai ? "คะแนนผลกระทบ" : "Impact Score"}</span>
                     <span className={`text-sm font-mono font-bold px-2 py-0.5 rounded ${insight.impact_score >= 8 ? 'bg-red-50 text-red-700' : insight.impact_score >= 5 ? 'bg-yellow-50 text-yellow-700' : 'bg-[#0b5a4b]/10 text-[#0b5a4b]'}`}>{insight.impact_score}/10</span>
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}

        

        {/* Detailed Findings */}
        <div id="section-citations" className="mt-8 scroll-mt-14">
           <h2 className="text-xl md:text-2xl font-bold text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight mb-6">
             {isThai ? "ผลการค้นพบในเอกสาร" : "Document Findings"}
           </h2>
           
           {findings.length === 0 ? (
             <div className="text-stone-700 italic p-8 bg-white rounded border border-stone-200 text-center">
               {isThai ? "ไม่พบข้อมูลจากเอกสารเฉพาะเจาะจง" : "No specific document findings returned."}
             </div>
           ) : (
             <div className="flex flex-col gap-4 md:p-6">
               {findings.map((finding, index) => (
                 <div key={index} className="bg-white p-4 md:p-6 rounded-xl border border-stone-200 shadow-sm flex flex-col">
                   <div className="flex items-start justify-between mb-4 border-b border-stone-100 pb-4">
                     <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded bg-stone-100 text-stone-600 flex items-center justify-center">
                         <FileText className="w-5 h-5" />
                       </div>
                       <div>
                         <h4 className="font-bold text-stone-900 text-lg">{finding.documentType || finding.document_type || (isThai ? "เอกสาร" : "Document")}</h4>
                         {finding.date && (
                           <div className="text-xs text-stone-700 font-mono flex items-center gap-1 mt-1">
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
                   
                   <ul className="space-y-3 mt-2 flex-1">
                     {Array.isArray(finding.keyInsights || finding.key_insights) ? (finding.keyInsights || finding.key_insights)?.map((insight, i) => (
                       <li key={i} className="flex gap-2 text-sm text-stone-700 leading-relaxed">
                         <ChevronRight className="w-4 h-4 text-stone-600 mt-0.5 shrink-0" />
                         <span className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown findings={data.findings}>{insight}</Markdown></span>
                       </li>
                     )) : (finding.keyInsights || finding.key_insights) ? (
                       <li className="flex gap-2 text-sm text-stone-700 leading-relaxed">
                         <ChevronRight className="w-4 h-4 text-stone-600 mt-0.5 shrink-0" />
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
    </motion.div>
  );
}
