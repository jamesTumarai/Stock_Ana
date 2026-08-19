import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Loader2, Sparkles, History as HistoryIcon, ArrowUpRight } from 'lucide-react';

interface LandingViewProps {
  language: string;
  setLanguage: (lang: string) => void;
  analysisType: 'fundamental' | 'technical' | 'combined';
  setAnalysisType: (type: 'fundamental' | 'technical' | 'combined') => void;
  useSelfConsistency: boolean;
  setUseSelfConsistency: (val: boolean) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  ticker: string;
  setTicker: (t: string) => void;
  instruction: string;
  setInstruction: (i: string) => void;
  runAnalysis: () => void;
  running: boolean;
  user: any;
  onLogin: () => void;
  onLogout: () => void;
  onOpenHistory: () => void;
}

interface StatItem {
  glyph: string;
  target: number;
  suffix: string;
  decimals: number;
  labelEn: string;
  labelTh: string;
  delay: string;
}

const STATS: StatItem[] = [
  { glyph: '<', target: 100, suffix: '%', decimals: 0, labelEn: 'Audited SEC 10-K/10-Q Filings', labelTh: 'ข้อมูลจริงจากเอกสาร SEC 10-K/10-Q', delay: '0.5s' },
  { glyph: '%', target: 4, suffix: 'x', decimals: 0, labelEn: 'Parallel AI Agent Swarm', labelTh: '4x Multi-Agent AI วิเคราะห์เจาะลึก', delay: '0.58s' },
  { glyph: '*', target: 3, suffix: ' TF', decimals: 0, labelEn: 'Trade Plan & R:R Calculation', labelTh: 'คำนวณแผนเทรด & Risk/Reward', delay: '0.66s' },
  { glyph: '#', target: 3.7, suffix: ' Flash', decimals: 1, labelEn: 'Gemini AI Conviction Engine', labelTh: 'Gemini AI ประเมิน Conviction Score', delay: '0.74s' },
];

function StatCounter({ stat, isThai }: { stat: StatItem; isThai: boolean }) {
  const [currentValue, setCurrentValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const startTime = performance.now();
          const duration = 1600;

          const animate = (time: number) => {
            const elapsed = time - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // easeOutCubic
            const ease = 1 - Math.pow(1 - progress, 3);
            const val = ease * stat.target;
            setCurrentValue(val);

            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              setCurrentValue(stat.target);
            }
          };

          const timer = setTimeout(() => {
            requestAnimationFrame(animate);
          }, 450);

          return () => clearTimeout(timer);
        }
      },
      { threshold: 0.25 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [hasAnimated, stat.target]);

  const formattedValue = stat.decimals > 0 
    ? currentValue.toFixed(stat.decimals) 
    : Math.floor(currentValue).toString();

  return (
    <div 
      ref={ref} 
      className="anim flex flex-col items-center text-center select-none w-full min-w-0 px-1"
      style={{ ['--d' as any]: stat.delay }}
    >
      <div 
        className="text-white mb-1 leading-none transition-transform hover:scale-110 duration-300"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(18px, 2vw, 24px)',
        }}
      >
        {stat.glyph}
      </div>
      <div className="font-semibold text-white tracking-[-0.025em] tabular-nums leading-tight" style={{ fontSize: 'clamp(15px, 1.6vw, 21px)' }}>
        {formattedValue}
        <span className="text-white/90 ml-0.5">{stat.suffix}</span>
      </div>
      <div 
        className="text-[#8e8e8e] font-normal mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis w-full" 
        style={{ fontSize: 'clamp(9.5px, 0.95vw, 11px)' }}
        title={isThai ? stat.labelTh : stat.labelEn}
      >
        {isThai ? stat.labelTh : stat.labelEn}
      </div>
    </div>
  );
}

export function LandingView({
  language,
  setLanguage,
  analysisType,
  setAnalysisType,
  useSelfConsistency,
  setUseSelfConsistency,
  selectedModel,
  setSelectedModel,
  ticker,
  setTicker,
  instruction,
  setInstruction,
  runAnalysis,
  running,
  user,
  onLogin,
  onLogout,
  onOpenHistory,
}: LandingViewProps) {
  const isThai = language === 'Thai';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const quickTickers = ['SOFI', 'NVDA', 'AAPL', 'TSLA', 'PLTR', 'COIN'];

  const navModes: { id: 'fundamental' | 'technical' | 'combined'; labelEn: string; labelTh: string }[] = [
    { id: 'combined', labelEn: 'All-in-One', labelTh: 'วิเคราะห์รวม' },
    { id: 'fundamental', labelEn: 'Fundamental', labelTh: 'ปัจจัยพื้นฐาน' },
    { id: 'technical', labelEn: 'Technical', labelTh: 'เทคนิคอล' },
  ];

  const handleSelectQuickTicker = (sym: string) => {
    setTicker(sym);
  };

  return (
    <div className="relative w-full h-full min-h-[100vh] min-h-[100dvh] overflow-hidden bg-transparent text-white select-none">
      {/* Main Single-Viewport Page Layout (3 Regions: Header, Hero, Stats) */}
      <div 
        className="relative z-10 w-full h-full min-h-[100vh] min-h-[100dvh] flex flex-col justify-between items-center overflow-hidden"
        style={{
          padding: 'clamp(16px, 2.4vh, 28px) clamp(14px, 3vw, 32px)',
        }}
      >
        
        {/* 1) Top Header (Absolute Centering so Nav Pill Never Wraps) */}
        <header 
          className="relative w-full max-w-[1360px] flex items-center justify-between shrink-0 z-50 transition-all px-2 md:px-4"
          style={{
            animation: 'slideDown 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
          }}
        >
          {/* Top Left Logo & Brand Title (Minimalist Monochrome) */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 cursor-pointer group z-10">
            <div
              className="rounded-full bg-white flex items-center justify-center shrink-0 shadow-[0_4px_14px_rgba(0,0,0,0.16)] transition-transform group-hover:scale-105"
              style={{
                width: 'clamp(28px, 3vw, 32px)',
                height: 'clamp(28px, 3vw, 32px)',
              }}
              title="COIN KING"
            >
              {/* Minimalist Crown Coin Emblem */}
              <svg viewBox="0 0 24 24" className="w-[58%] h-[58%]" fill="#111111" stroke="none">
                <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
              </svg>
            </div>
            <span className="font-display font-bold text-sm sm:text-base md:text-lg tracking-wider uppercase text-white drop-shadow-md select-none">
              COIN KING
            </span>
          </div>

          {/* Center Floating White Nav Pill (Absolute 100% Center of Screen, Scaled for iPad & Desktop) */}
          <nav 
            className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center bg-white rounded-full shadow-[0_4px_14px_rgba(0,0,0,0.16)] whitespace-nowrap z-0 scale-90 lg:scale-95 transition-transform"
            style={{
              height: 'clamp(36px, 3.8vw, 40px)',
              padding: '3px 8px',
              gap: '3px',
            }}
          >
            {navModes.map((mode) => {
              const isActive = analysisType === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setAnalysisType(mode.id)}
                  className={`relative px-3.5 py-1 font-medium transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive 
                      ? 'text-[#2e2e2e] opacity-100 font-semibold' 
                      : 'text-[#2e2e2e] opacity-50 hover:opacity-75'
                  }`}
                  style={{
                    fontSize: 'clamp(11.5px, 1.15vw, 13px)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {isThai ? mode.labelTh : mode.labelEn}
                  {/* Active 3-dot indicator */}
                  {isActive && (
                    <span 
                      className="absolute left-1/2 -translate-x-1/2 bottom-[4px] w-[2.5px] h-[2.5px] bg-black rounded-full shadow-[-4px_0_0_#000,4px_0_0_#000]" 
                    />
                  )}
                </button>
              );
            })}

            {/* Deep Think toggle inside the white nav pill */}
            <div className="h-3.5 w-px bg-stone-300 mx-1 shrink-0" />
            <button
              onClick={() => setUseSelfConsistency(!useSelfConsistency)}
              className={`px-3 py-0.5 font-medium transition-all duration-200 flex items-center gap-1.5 rounded-full cursor-pointer whitespace-nowrap shrink-0 ${
                useSelfConsistency 
                  ? 'bg-black text-white shadow-sm font-semibold' 
                  : 'text-[#2e2e2e] opacity-60 hover:opacity-100 hover:bg-stone-100'
              }`}
              style={{
                fontSize: 'clamp(11px, 1.1vw, 12px)',
              }}
              title="Deep Think Mode"
            >
              <Sparkles className={`w-3 h-3 shrink-0 ${useSelfConsistency ? 'text-yellow-300' : 'text-stone-600'}`} />
              <span>{isThai ? 'คิดเชิงลึก' : 'Deep Think'}</span>
            </button>

            {/* Language Switch */}
            <div className="h-3.5 w-px bg-stone-300 mx-1 shrink-0" />
            <button
              onClick={() => setLanguage(isThai ? 'English' : 'Thai')}
              className="px-2 py-0.5 font-bold text-[#2e2e2e] opacity-75 hover:opacity-100 transition-opacity text-[11px] tracking-wider uppercase rounded-full cursor-pointer hover:bg-stone-100 shrink-0 whitespace-nowrap"
              title="Switch Language"
            >
              {isThai ? 'EN' : 'ไทย'}
            </button>
          </nav>

          {/* Right Controls: User Account / Sign In */}
          <div className="hidden md:flex items-center gap-2 z-10 scale-90 lg:scale-95 origin-right">
            {user ? (
              <div className="flex items-center gap-1 bg-[#28282a] rounded-full px-2 py-0.5 border border-white/10 shadow-[0_4px_14px_rgba(0,0,0,0.16)]">
                <button
                  onClick={onOpenHistory}
                  className="text-xs text-[#c8c8c8] hover:text-white px-2 py-0.5 flex items-center gap-1 cursor-pointer transition-colors"
                  title="History"
                >
                  <HistoryIcon className="w-3 h-3" />
                  <span>{isThai ? 'ประวัติ' : 'History'}</span>
                </button>
                <button
                  onClick={onLogout}
                  className="text-xs text-[#c8c8c8] hover:text-red-400 px-1.5 py-0.5 cursor-pointer transition-colors"
                  title="Logout"
                >
                  {isThai ? 'ออก' : 'Exit'}
                </button>
                {user.photoURL && (
                  <img src={user.photoURL} alt="avatar" className="w-6 h-6 rounded-full border border-white/20 ml-1" />
                )}
              </div>
            ) : (
              <button
                onClick={onLogin}
                className="bg-[#28282a] text-[#c8c8c8] hover:bg-[#323234] hover:text-white rounded-full font-medium transition-all duration-200 hover:-translate-y-px shadow-[0_4px_14px_rgba(0,0,0,0.16)] cursor-pointer"
                style={{
                  height: 'clamp(36px, 3.8vw, 40px)',
                  padding: '0 clamp(14px, 1.6vw, 18px)',
                  fontSize: 'clamp(11.5px, 1.2vw, 13px)',
                }}
              >
                Sign In
              </button>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`flex flex-col items-center justify-center rounded-full w-12 h-12 transition-all duration-300 shadow-[0_4px_14px_rgba(0,0,0,0.16)] cursor-pointer ${
                mobileMenuOpen ? 'bg-white' : 'bg-[#28282a]'
              }`}
              aria-label="Toggle menu"
            >
              <span className={`w-[18px] h-[1.5px] rounded-full transition-transform duration-300 ${mobileMenuOpen ? 'bg-black translate-y-[6.5px] rotate-45' : 'bg-white mb-1'}`} />
              <span className={`w-[18px] h-[1.5px] rounded-full transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-0' : 'bg-white mb-1'}`} />
              <span className={`w-[18px] h-[1.5px] rounded-full transition-transform duration-300 ${mobileMenuOpen ? 'bg-black -translate-y-[6.5px] -rotate-45' : 'bg-white'}`} />
            </button>
          </div>
        </header>

        {/* Mobile Dropdown Sheet Modal */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28 }}
                onClick={() => setMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/65 backdrop-blur-md z-40 md:hidden"
              />
              <motion.div
                initial={{ opacity: 0, y: -12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.97 }}
                transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                className="fixed top-20 left-4 right-4 bg-white text-[#2e2e2e] rounded-[28px] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] z-50 flex flex-col gap-2.5 md:hidden"
              >
                <div className="text-xs text-stone-700 font-bold uppercase tracking-wider px-2 pb-1 border-b border-stone-200">
                  {isThai ? 'โหมดการวิเคราะห์' : 'Analysis Mode'}
                </div>
                {navModes.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => {
                      setAnalysisType(mode.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full py-2.5 px-4 text-left font-medium rounded-xl transition-colors flex items-center justify-between ${
                      analysisType === mode.id ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    <span>{isThai ? mode.labelTh : mode.labelEn}</span>
                    {analysisType === mode.id && <span>✓</span>}
                  </button>
                ))}

                <div className="pt-2 border-t border-stone-200 flex items-center justify-between px-2">
                  <span className="text-xs font-medium text-stone-700">{isThai ? 'คิดเชิงลึก (Deep Think)' : 'Deep Think'}</span>
                  <button
                    onClick={() => setUseSelfConsistency(!useSelfConsistency)}
                    className={`px-3 py-1 font-bold text-xs rounded-full flex items-center gap-1 ${
                      useSelfConsistency ? 'bg-black text-white' : 'bg-stone-100 text-stone-700'
                    }`}
                  >
                    <Sparkles className={`w-3 h-3 ${useSelfConsistency ? 'text-yellow-300' : 'text-stone-500'}`} />
                    <span>{useSelfConsistency ? (isThai ? 'เปิดใช้งาน' : 'ON') : (isThai ? 'ปิด' : 'OFF')}</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-stone-200 flex items-center justify-between px-2">
                  <span className="text-xs font-medium text-stone-700">{isThai ? 'ภาษา (Language)' : 'Language'}</span>
                  <button
                    onClick={() => setLanguage(isThai ? 'English' : 'Thai')}
                    className="px-3 py-1 bg-stone-100 font-bold text-xs rounded-full"
                  >
                    {isThai ? 'ไทย (TH)' : 'English (EN)'}
                  </button>
                </div>

                <div className="pt-2 border-t border-stone-200">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      if (user) onOpenHistory();
                      else onLogin();
                    }}
                    className="w-full py-3 bg-[#28282a] text-white hover:bg-black font-medium rounded-full text-sm text-center transition-colors cursor-pointer"
                  >
                    {user ? (isThai ? 'ดูประวัติการวิเคราะห์' : 'View History') : 'Sign In'}
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* 2) Hero Center Section */}
        <main className="w-full max-w-[860px] flex-1 flex flex-col items-center justify-center text-center my-auto z-10 px-2 pt-4 md:pt-6">
          
          {/* Trust Row / AI & Market Intelligence Badge */}
          <div 
            className="anim inline-flex items-center justify-center mb-[clamp(10px,1.6vh,16px)] select-none"
            style={{ 
              ['--d' as any]: '0.05s',
              ['--trust-size' as any]: 'clamp(26px, 2.8vw, 32px)'
            }}
          >
            {/* 3 Overlapping Brand Logos (Microsoft, Amazon, Google) */}
            <div className="flex items-center">
              {/* Microsoft */}
              <div 
                className="rounded-full bg-[#28282a] border border-white/40 p-[4px] flex items-center justify-center shadow-lg transition-transform duration-350 hover:-translate-y-[2px]"
                style={{ width: 'var(--trust-size)', height: 'var(--trust-size)', zIndex: 1 }}
              >
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-[#111]">
                  <i className="fa-brands fa-microsoft text-[10px] md:text-[11.5px]"></i>
                </div>
              </div>

              {/* Amazon */}
              <div 
                className="rounded-full bg-[#28282a] border border-white/40 p-[4px] flex items-center justify-center shadow-lg transition-transform duration-350 hover:-translate-y-[4px]"
                style={{ width: 'var(--trust-size)', height: 'var(--trust-size)', marginLeft: 'calc(var(--trust-size) * -0.42)', zIndex: 2 }}
              >
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-[#111]">
                  <i className="fa-brands fa-amazon text-[10px] md:text-[11.5px]"></i>
                </div>
              </div>

              {/* Google */}
              <div 
                className="rounded-full bg-[#28282a] border border-white/40 p-[4px] flex items-center justify-center shadow-lg transition-transform duration-350 hover:-translate-y-[2px]"
                style={{ width: 'var(--trust-size)', height: 'var(--trust-size)', marginLeft: 'calc(var(--trust-size) * -0.42)', zIndex: 3 }}
              >
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-[#111]">
                  <i className="fa-brands fa-google text-[10px] md:text-[11.5px]"></i>
                </div>
              </div>
            </div>

            {/* Trust Pill */}
            <div 
              className="bg-[#28282a] border border-white/40 rounded-full flex items-center text-[#c4c2c3] font-medium"
              style={{
                height: 'var(--trust-size)',
                marginLeft: 'calc(var(--trust-size) * -0.42)',
                paddingLeft: 'calc(var(--trust-size) * 0.58)',
                paddingRight: 'clamp(10px, 1.2vw, 15px)',
                fontSize: 'clamp(10.5px, 1.1vw, 12px)',
                zIndex: 0,
              }}
            >
              {isThai ? "หุ้นชั้นนำระดับโลก" : "Global Stocks"}
            </div>
          </div>

          {/* Headline (Dot-Matrix Display Typography - Scaled for Elegant Proportion) */}
          <h1 
            className="headline font-normal text-white text-center leading-[1.12] whitespace-nowrap overflow-hidden select-none px-2"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(20px, 4.4vw, 56px)',
              letterSpacing: 'clamp(-0.06em, -0.04em, -0.04em)',
            }}
          >
            <span 
              className="line block"
              style={{ 
                animation: 'headlineFade 0.85s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both',
              }}
            >
              Lumina
            </span>
            <span 
              className="line block mt-1 md:mt-1.5"
              style={{ 
                animation: 'headlineFade 0.85s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both',
              }}
            >
              AI Stock Analysis
            </span>
          </h1>

          {/* Subhead */}
          <p 
            className="subhead anim text-[#c2c2c2] font-normal leading-relaxed max-w-[min(480px,90%)] mt-2 md:mt-2.5 opacity-80 px-2"
            style={{
              ['--d' as any]: '0.28s',
              fontSize: 'clamp(11px, 1.1vw, 13.5px)',
            }}
          >
            {isThai 
              ? "วิเคราะห์หุ้นสหรัฐฯ เจาะลึกงบการเงิน รายงาน 10-K/10-Q และวางแผนเทรดอย่างแม่นยำ ด้วยพลัง AI ระดับสถาบัน"
              : "Analyze US stocks, deep financial 10-K/10-Q filings, and institutional technical setups with real-time AI."}
          </p>

          {/* Integrated Search Bar in Hero */}
          <div className="mt-3.5 sm:mt-4 md:mt-5 w-full max-w-[480px] flex flex-col items-center px-1">
            
            <div className="w-full liquid-glass border border-white/25 rounded-full p-1 sm:p-1.5 flex items-center shadow-xl backdrop-blur-xl focus-within:border-white/50 focus-within:ring-1 focus-within:ring-white/40 transition-all">
              <div className="flex items-center gap-1.5 pl-2.5 sm:pl-3 flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/70 shrink-0" />
                <input 
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  placeholder={isThai ? "พิมพ์ชื่อย่อหุ้น (เช่น SOFI, NVDA)" : "US TICKER (e.g. SOFI, NVDA)"}
                  disabled={running}
                  className="bg-transparent border-none outline-none w-full font-mono uppercase text-xs sm:text-sm text-white placeholder-white/40 min-w-0"
                  onKeyDown={(e) => e.key === 'Enter' && runAnalysis()}
                />
              </div>

              <button
                onClick={runAnalysis}
                disabled={!ticker.trim() || running}
                className="bg-white text-black font-semibold rounded-full px-4 sm:px-5 py-1.5 sm:py-2 text-xs shrink-0 cursor-pointer hover:scale-102 hover:bg-white/95 disabled:bg-white/30 disabled:text-white/40 disabled:cursor-not-allowed transition-all shadow-[0_0_18px_rgba(255,255,255,0.28)]"
              >
                {running ? (
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="text-xs">{isThai ? 'กำลังวิเคราะห์...' : 'Analyzing...'}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-xs">{isThai ? 'วิเคราะห์หุ้น' : 'Analyze'}</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </div>
                )}
              </button>
            </div>

            {/* Quick Ticker Chips */}
            <div className="flex flex-wrap items-center justify-center gap-1 mt-2 px-1">
              <span className="text-[10px] text-white/50 mr-0.5">{isThai ? 'ตัวอย่าง:' : 'Popular:'}</span>
              {quickTickers.map((sym) => (
                <button
                  key={sym}
                  onClick={() => handleSelectQuickTicker(sym)}
                  className={`px-2 py-0.5 rounded-full text-[10.5px] sm:text-[11px] font-mono transition-all cursor-pointer border ${
                    ticker.toUpperCase() === sym 
                      ? 'bg-white text-black border-white font-bold' 
                      : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/15 hover:text-white'
                  }`}
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>
        </main>

        {/* 3) Killer Lumina Stats Footer (4 Impactful App Metrics - Scaled) */}
        <footer 
          className="w-full max-w-[880px] grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 pt-2 md:pt-3 pb-2 shrink-0 z-10 px-2"
        >
          {STATS.map((stat) => (
            <StatCounter key={stat.labelEn} stat={stat} isThai={isThai} />
          ))}
        </footer>

      </div>
    </div>
  );
}
