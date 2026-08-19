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
        className="text-white mb-1.5 leading-none transition-transform hover:scale-110 duration-300"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(22px, 3vw, 33px)',
        }}
      >
        {stat.glyph}
      </div>
      <div className="font-semibold text-white tracking-[-0.025em] tabular-nums leading-tight" style={{ fontSize: 'clamp(18px, 2.2vw, 26px)' }}>
        {formattedValue}
        <span className="text-white/90 ml-0.5">{stat.suffix}</span>
      </div>
      <div 
        className="text-[#8e8e8e] font-normal mt-1 whitespace-nowrap overflow-hidden text-ellipsis w-full" 
        style={{ fontSize: 'clamp(10px, 1.15vw, 12px)' }}
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
        
        {/* 1) Top Header */}
        <header 
          className="w-full max-w-[1240px] flex items-center justify-between shrink-0 z-50 transition-all px-1 md:px-3"
          style={{
            gap: 'clamp(14px, 2.4vw, 24px)',
            animation: 'slideDown 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
          }}
        >
          {/* Top Left Logo & Brand Title */}
          <div className="flex items-center gap-2.5 shrink-0 cursor-pointer group">
            <div
              className="rounded-full bg-white flex items-center justify-center shrink-0 shadow-[0_4px_14px_rgba(0,0,0,0.16)] transition-transform group-hover:scale-105"
              style={{
                width: 'clamp(38px, 4.2vw, 44px)',
                height: 'clamp(38px, 4.2vw, 44px)',
              }}
              title="COIN KING"
            >
              <svg viewBox="0 0 100 100" className="w-[72%] h-[72%] object-contain" fill="#111111">
                <path d="M50 14 A36 36 0 0 1 86 50 L70 50 A20 20 0 0 0 50 30 Z" />
                <path d="M86 50 A36 36 0 0 1 50 86 L50 70 A20 20 0 0 0 70 50 Z" />
                <path d="M50 86 A36 36 0 0 1 14 50 L30 50 A20 20 0 0 0 50 70 Z" />
                <path d="M14 50 A36 36 0 0 1 50 14 L50 30 A20 20 0 0 0 30 50 Z" />
                <circle cx="50" cy="50" r="7" fill="#111111" />
              </svg>
            </div>
            <span className="font-display font-bold text-lg md:text-xl tracking-wider uppercase text-white drop-shadow-md select-none">
              COIN KING
            </span>
          </div>

          {/* Center Floating White Nav Pill */}
          <nav 
            className="hidden md:flex items-center justify-between bg-white rounded-full shadow-[0_4px_14px_rgba(0,0,0,0.16)]"
            style={{
              height: 'clamp(44px, 5.2vw, 48px)',
              padding: '4px 10px',
              gap: '4px',
            }}
          >
            {navModes.map((mode) => {
              const isActive = analysisType === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setAnalysisType(mode.id)}
                  className={`relative px-4 py-1.5 font-medium transition-all duration-200 cursor-pointer ${
                    isActive 
                      ? 'text-[#2e2e2e] opacity-100 font-semibold' 
                      : 'text-[#2e2e2e] opacity-50 hover:opacity-75'
                  }`}
                  style={{
                    fontSize: 'clamp(13px, 1.4vw, 14.5px)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {isThai ? mode.labelTh : mode.labelEn}
                  {/* Active 3-dot indicator */}
                  {isActive && (
                    <span 
                      className="absolute left-1/2 -translate-x-1/2 bottom-[5px] w-[3px] h-[3px] bg-black rounded-full shadow-[-5px_0_0_#000,5px_0_0_#000]" 
                    />
                  )}
                </button>
              );
            })}

            {/* Language Switch */}
            <div className="h-4 w-px bg-stone-300 mx-1" />
            <button
              onClick={() => setLanguage(isThai ? 'English' : 'Thai')}
              className="px-3 py-1 font-bold text-[#2e2e2e] opacity-75 hover:opacity-100 transition-opacity text-xs tracking-wider uppercase rounded-full cursor-pointer hover:bg-stone-100"
              title="Switch Language"
            >
              {isThai ? 'EN' : 'ไทย'}
            </button>
          </nav>

          {/* Right Controls: Deep Think & User Account */}
          <div className="hidden md:flex items-center gap-2">
            {/* Deep Think Pill */}
            <button
              onClick={() => setUseSelfConsistency(!useSelfConsistency)}
              className={`rounded-full font-medium transition-all duration-200 flex items-center gap-1.5 shadow-[0_4px_14px_rgba(0,0,0,0.16)] cursor-pointer ${
                useSelfConsistency 
                  ? 'bg-[#28282a] text-white border border-white/30' 
                  : 'bg-[#28282a]/80 text-[#8e8e8e] hover:text-white'
              }`}
              style={{
                height: 'clamp(44px, 5.2vw, 48px)',
                padding: '0 clamp(14px, 1.8vw, 18px)',
                fontSize: 'clamp(12px, 1.3vw, 13.5px)',
              }}
              title="Deep Think Mode"
            >
              <Sparkles className={`w-3.5 h-3.5 ${useSelfConsistency ? 'text-yellow-300' : 'text-[#8e8e8e]'}`} />
              <span>{isThai ? 'คิดเชิงลึก' : 'Deep Think'}</span>
            </button>

            {/* User Account / Sign In */}
            {user ? (
              <div className="flex items-center gap-1 bg-[#28282a] rounded-full px-2 py-1 border border-white/10 shadow-[0_4px_14px_rgba(0,0,0,0.16)]">
                <button
                  onClick={onOpenHistory}
                  className="text-xs text-[#c8c8c8] hover:text-white px-2.5 py-1 flex items-center gap-1 cursor-pointer transition-colors"
                  title="History"
                >
                  <HistoryIcon className="w-3.5 h-3.5" />
                  <span>{isThai ? 'ประวัติ' : 'History'}</span>
                </button>
                <button
                  onClick={onLogout}
                  className="text-xs text-[#c8c8c8] hover:text-red-400 px-2 py-1 cursor-pointer transition-colors"
                  title="Logout"
                >
                  {isThai ? 'ออก' : 'Exit'}
                </button>
                {user.photoURL && (
                  <img src={user.photoURL} alt="avatar" className="w-7 h-7 rounded-full border border-white/20 ml-1" />
                )}
              </div>
            ) : (
              <button
                onClick={onLogin}
                className="bg-[#28282a] text-[#c8c8c8] hover:bg-[#323234] hover:text-white rounded-full font-medium transition-all duration-200 hover:-translate-y-px shadow-[0_4px_14px_rgba(0,0,0,0.16)] cursor-pointer"
                style={{
                  height: 'clamp(44px, 5.2vw, 48px)',
                  padding: '0 clamp(18px, 2.2vw, 24px)',
                  fontSize: 'clamp(13px, 1.4vw, 14.5px)',
                }}
              >
                Sign In
              </button>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`md:hidden flex flex-col items-center justify-center rounded-full w-12 h-12 transition-all duration-300 shadow-[0_4px_14px_rgba(0,0,0,0.16)] cursor-pointer ${
              mobileMenuOpen ? 'bg-white' : 'bg-[#28282a]'
            }`}
            aria-label="Toggle menu"
          >
            <span className={`w-[18px] h-[1.5px] rounded-full transition-transform duration-300 ${mobileMenuOpen ? 'bg-black translate-y-[6.5px] rotate-45' : 'bg-white mb-1'}`} />
            <span className={`w-[18px] h-[1.5px] rounded-full transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-0' : 'bg-white mb-1'}`} />
            <span className={`w-[18px] h-[1.5px] rounded-full transition-transform duration-300 ${mobileMenuOpen ? 'bg-black -translate-y-[6.5px] -rotate-45' : 'bg-white'}`} />
          </button>
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
        <main className="w-full max-w-[900px] flex-1 flex flex-col items-center justify-center text-center my-auto z-10 px-2">
          
          {/* Trust Row / AI & Market Intelligence Badge */}
          <div 
            className="anim inline-flex items-center justify-center mb-[clamp(14px,2.2vh,22px)] select-none"
            style={{ 
              ['--d' as any]: '0.05s',
              ['--trust-size' as any]: 'clamp(36px, 4.5vw, 42px)'
            }}
          >
            {/* 3 Overlapping Brand Logos (Microsoft, Amazon, Google) */}
            <div className="flex items-center">
              {/* Microsoft */}
              <div 
                className="rounded-full bg-[#28282a] border border-white/40 p-[5px] flex items-center justify-center shadow-lg transition-transform duration-350 hover:-translate-y-[2px]"
                style={{ width: 'var(--trust-size)', height: 'var(--trust-size)', zIndex: 1 }}
              >
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-[#111]">
                  <i className="fa-brands fa-microsoft text-[12px] md:text-[14px]"></i>
                </div>
              </div>

              {/* Amazon */}
              <div 
                className="rounded-full bg-[#28282a] border border-white/40 p-[5px] flex items-center justify-center shadow-lg transition-transform duration-350 hover:-translate-y-[4px]"
                style={{ width: 'var(--trust-size)', height: 'var(--trust-size)', marginLeft: 'calc(var(--trust-size) * -0.42)', zIndex: 2 }}
              >
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-[#111]">
                  <i className="fa-brands fa-amazon text-[12px] md:text-[14px]"></i>
                </div>
              </div>

              {/* Google */}
              <div 
                className="rounded-full bg-[#28282a] border border-white/40 p-[5px] flex items-center justify-center shadow-lg transition-transform duration-350 hover:-translate-y-[2px]"
                style={{ width: 'var(--trust-size)', height: 'var(--trust-size)', marginLeft: 'calc(var(--trust-size) * -0.42)', zIndex: 3 }}
              >
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-[#111]">
                  <i className="fa-brands fa-google text-[12px] md:text-[14px]"></i>
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
                paddingRight: 'clamp(12px, 1.6vw, 18px)',
                fontSize: 'clamp(12px, 1.4vw, 13.5px)',
                zIndex: 0,
              }}
            >
              {isThai ? "Trusted by 2000+ Enterprises" : "Trusted by 2000+ Enterprises"}
            </div>
          </div>

          {/* Headline (Dot-Matrix Display Typography) */}
          <h1 
            className="headline font-normal text-white text-center leading-[1.12] whitespace-nowrap overflow-hidden select-none"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(32px, 6.8vw, 84px)',
              letterSpacing: 'clamp(-0.08em, -0.04em, -0.04em)',
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
              className="line block mt-1 md:mt-2"
              style={{ 
                animation: 'headlineFade 0.85s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both',
              }}
            >
              AI Stock Analysis
            </span>
          </h1>

          {/* Subhead */}
          <p 
            className="subhead anim text-[#d0d0d0] font-normal leading-[1.55] max-w-[min(540px,94%)] mt-3 md:mt-4 opacity-80"
            style={{
              ['--d' as any]: '0.28s',
              fontSize: 'clamp(calc(13px + 2pt), calc(1.4vw + 2pt), calc(16px + 2pt))',
            }}
          >
            {isThai 
              ? "วิเคราะห์หุ้นสหรัฐฯ เจาะลึกงบการเงิน รายงาน 10-K/10-Q และวางแผนเทรดอย่างแม่นยำ ด้วยพลัง AI ระดับสถาบัน"
              : "Analyze US stocks, deep financial 10-K/10-Q filings, and institutional technical setups with real-time AI."}
          </p>

          {/* Integrated Search Bar in Hero */}
          <div className="mt-5 md:mt-6 w-full max-w-xl flex flex-col items-center">
            
            <div className="w-full liquid-glass border border-white/25 rounded-full p-1.5 md:p-2 flex items-center shadow-2xl backdrop-blur-xl focus-within:border-white/50 focus-within:ring-1 focus-within:ring-white/40 transition-all">
              <div className="flex items-center gap-2 pl-3 flex-1 min-w-0">
                <Search className="w-4 h-4 md:w-5 md:h-5 text-white/70 shrink-0" />
                <input 
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  placeholder={isThai ? "พิมพ์ชื่อย่อหุ้น (เช่น SOFI, NVDA, TSLA)" : "US TICKER (e.g. SOFI, NVDA, TSLA)"}
                  disabled={running}
                  className="bg-transparent border-none outline-none w-full font-mono uppercase text-sm md:text-base text-white placeholder-white/40"
                  onKeyDown={(e) => e.key === 'Enter' && runAnalysis()}
                />
              </div>

              <button
                onClick={runAnalysis}
                disabled={!ticker.trim() || running}
                className="bg-white text-black font-semibold rounded-full px-5 md:px-7 py-2 md:py-2.5 text-xs md:text-sm shrink-0 cursor-pointer hover:scale-102 hover:bg-white/95 disabled:bg-white/30 disabled:text-white/40 disabled:cursor-not-allowed transition-all shadow-[0_0_22px_rgba(255,255,255,0.32)]"
              >
                {running ? (
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{isThai ? 'กำลังวิเคราะห์...' : 'Analyzing...'}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span>{isThai ? 'วิเคราะห์หุ้น' : 'Analyze'}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </div>
                )}
              </button>
            </div>

            {/* Quick Ticker Chips */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2.5">
              <span className="text-[11px] text-white/50 mr-1">{isThai ? 'ตัวอย่าง:' : 'Popular:'}</span>
              {quickTickers.map((sym) => (
                <button
                  key={sym}
                  onClick={() => handleSelectQuickTicker(sym)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-mono transition-all cursor-pointer border ${
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

        {/* 3) Killer Lumina Stats Footer (4 Impactful App Metrics) */}
        <footer 
          className="w-full max-w-[1080px] grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 pt-4 pb-2 shrink-0 z-10"
        >
          {STATS.map((stat) => (
            <StatCounter key={stat.labelEn} stat={stat} isThai={isThai} />
          ))}
        </footer>

      </div>
    </div>
  );
}
