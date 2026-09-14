import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Loader2, BrainCircuit, History as HistoryIcon, ArrowUpRight, LogOut, AlertCircle, X, Briefcase, Bell } from 'lucide-react';
import { UserAvatar } from './components/UserAvatar';

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
  onOpenPortfolio?: () => void;
  onOpenAlerts?: () => void;
  unreadAlertsCount?: number;
  onReplayIntro?: () => void;
  error?: string | null;
  onClearError?: () => void;
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
  { glyph: '#', target: 3.8, suffix: ' Flash', decimals: 1, labelEn: 'Gemini AI Conviction Engine', labelTh: 'Gemini AI ประเมิน Conviction Score', delay: '0.74s' },
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
  onOpenPortfolio,
  onOpenAlerts,
  unreadAlertsCount = 0,
  onReplayIntro,
  error,
  onClearError,
}: LandingViewProps) {
  const isThai = language === 'Thai';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const quickTickers = ['SOFI', 'NVDA', 'AAPL', 'TSLA', 'PLTR'];

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
        
        {/* 1) Top Header (full navigation moves into the compact menu below xl) */}
        <header 
          className="relative w-full max-w-[1360px] grid grid-cols-[auto_1fr] xl:grid-cols-[1fr_auto_1fr] items-center shrink-0 z-50 transition-all px-2 md:px-4 gap-2"
          style={{
            animation: 'slideDown 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
          }}
        >
          {/* Top Left Logo & Brand Title */}
          <div 
            onClick={onReplayIntro}
            className="flex items-center justify-start gap-2 sm:gap-2.5 shrink-0 cursor-pointer group z-10 min-w-0"
            title={isThai ? "COIN KING (กดเพื่อเล่นแอนิเมชันเปิดตัว)" : "COIN KING (Click to replay intro motion)"}
          >
            <div
              className="rounded-full bg-white flex items-center justify-center shrink-0 shadow-[0_4px_14px_rgba(0,0,0,0.16)] transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.4)]"
              style={{
                width: 'clamp(28px, 3vw, 32px)',
                height: 'clamp(28px, 3vw, 32px)',
              }}
            >
              {/* Minimalist Crown Coin Emblem */}
              <svg viewBox="0 0 24 24" className="w-[58%] h-[58%]" fill="#111111" stroke="none">
                <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
              </svg>
            </div>
            <span className="font-display font-bold text-sm sm:text-base md:text-lg tracking-wider uppercase text-white drop-shadow-md select-none group-hover:text-amber-200 transition-colors whitespace-nowrap hidden sm:inline-block">
              COIN KING
            </span>
          </div>

          {/* Center Floating White Nav Pill */}
          <div className="hidden xl:flex items-center justify-center">
            <nav className="flex items-center gap-1.5 rounded-full border border-white/80 bg-white/95 p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.18)] backdrop-blur-xl whitespace-nowrap z-0 transition-all origin-center shrink-0">
              <div className="flex items-center gap-0.5 rounded-full bg-stone-100 p-1">
                {navModes.map((mode) => {
                const isActive = analysisType === mode.id;
                return (
                  <motion.button
                    key={mode.id}
                    onClick={() => setAnalysisType(mode.id)}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                    className={`relative px-3 py-1.5 font-semibold rounded-full transition-colors duration-200 cursor-pointer whitespace-nowrap shrink-0 text-xs sm:text-[13px] ${
                      isActive 
                        ? 'text-stone-900'
                        : 'text-stone-400 hover:text-stone-700'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="landing-analysis-mode-indicator"
                        className="absolute inset-0 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10">{isThai ? mode.labelTh : mode.labelEn}</span>
                  </motion.button>
                );
                })}
              </div>

              {/* Deep Think toggle inside the white nav pill */}
              <motion.button
                onClick={() => setUseSelfConsistency(!useSelfConsistency)}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                className={`min-h-[34px] px-3 font-semibold transition-all duration-200 flex items-center gap-1.5 rounded-full cursor-pointer whitespace-nowrap shrink-0 text-xs ${
                  useSelfConsistency 
                    ? 'bg-[#171717] text-white shadow-[0_3px_10px_rgba(0,0,0,0.22)]'
                    : 'bg-stone-100 text-stone-500 hover:text-stone-800'
                }`}
                title="Deep Think Mode"
              >
                <motion.span
                  animate={useSelfConsistency ? { rotate: [0, -8, 8, 0], scale: [1, 1.12, 1] } : { rotate: 0, scale: 1 }}
                  transition={{ duration: 0.34, ease: 'easeOut' }}
                  className="flex"
                >
                  <BrainCircuit className={`w-3.5 h-3.5 shrink-0 ${useSelfConsistency ? 'text-violet-300' : 'text-violet-500'}`} strokeWidth={2.2} />
                </motion.span>
                <span>{isThai ? 'คิดเชิงลึก' : 'Deep Think'}</span>
              </motion.button>

              {/* Language Switch */}
              <motion.button
                onClick={() => setLanguage(isThai ? 'English' : 'Thai')}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                className="min-w-[34px] min-h-[34px] px-2 font-bold text-stone-600 hover:text-stone-900 transition-colors text-[11px] tracking-wider uppercase rounded-full cursor-pointer bg-stone-100 hover:bg-stone-200 shrink-0 whitespace-nowrap"
                title="Switch Language"
              >
                {isThai ? 'EN' : 'ไทย'}
              </motion.button>
            </nav>
          </div>

          {/* Desktop account pill is replaced by the compact icon controls below. */}
          <div className="hidden">
            {user ? (
              <div className="flex items-center gap-2 bg-[#28282a] rounded-full pl-3 pr-1 py-1 border border-white/10 shadow-[0_4px_14px_rgba(0,0,0,0.16)] shrink-0">
                <button
                  onClick={onOpenAlerts}
                  className="text-white/70 hover:text-white flex items-center gap-1 cursor-pointer transition-colors text-[11px] font-medium tracking-wide relative"
                  title={isThai ? 'การตรวจสอบวิจัยและการแจ้งเตือน' : 'On-Open Research Checks & Alerts'}
                >
                  <Bell className="w-3.5 h-3.5" strokeWidth={2} />
                  {unreadAlertsCount > 0 && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 absolute -top-0.5 -right-0.5" />
                  )}
                  {isThai ? 'เตือน' : 'Alerts'}
                </button>
                <button
                  onClick={onOpenPortfolio}
                  className="text-white/70 hover:text-white flex items-center gap-1 cursor-pointer transition-colors text-[11px] font-medium tracking-wide"
                  title={isThai ? 'พอร์ตและรายการติดตาม' : 'Portfolio & Watchlist'}
                >
                  <Briefcase className="w-3.5 h-3.5" strokeWidth={2} />
                  {isThai ? 'พอร์ต' : 'Portfolio'}
                </button>
                <button
                  onClick={onOpenHistory}
                  className="text-white/70 hover:text-white flex items-center gap-1 cursor-pointer transition-colors text-[11px] font-medium tracking-wide"
                  title="History"
                >
                  <HistoryIcon className="w-3.5 h-3.5" strokeWidth={2} />
                  {isThai ? 'ประวัติ' : 'History'}
                </button>
                <button
                  onClick={onLogout}
                  className="text-white/70 hover:text-white flex items-center cursor-pointer transition-colors text-[11px] font-medium tracking-wide"
                  title="Logout"
                >
                  {isThai ? 'ออก' : 'Exit'}
                </button>
                <UserAvatar 
                  photoURL={user.photoURL} 
                  displayName={user.displayName} 
                  sizeClassName="w-7 h-7 text-[10px]" 
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenAlerts}
                  className="bg-[#28282a] text-[#c8c8c8] hover:bg-[#323234] hover:text-white rounded-full font-medium transition-all duration-200 hover:-translate-y-px shadow-[0_4px_14px_rgba(0,0,0,0.16)] cursor-pointer flex items-center gap-1.5 shrink-0 relative"
                  style={{
                    height: 'clamp(36px, 3.8vw, 40px)',
                    padding: '0 clamp(10px, 1.2vw, 14px)',
                    fontSize: 'clamp(11.5px, 1.2vw, 13px)',
                  }}
                  title={isThai ? 'การตรวจสอบวิจัยและการแจ้งเตือน' : 'On-Open Research Checks & Alerts'}
                >
                  <Bell className="w-3.5 h-3.5" strokeWidth={2} />
                  {unreadAlertsCount > 0 && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-2 right-2" />
                  )}
                  <span>{isThai ? 'เตือน' : 'Alerts'}</span>
                </button>
                <button
                  onClick={onOpenPortfolio}
                  className="bg-[#28282a] text-[#c8c8c8] hover:bg-[#323234] hover:text-white rounded-full font-medium transition-all duration-200 hover:-translate-y-px shadow-[0_4px_14px_rgba(0,0,0,0.16)] cursor-pointer flex items-center gap-1.5 shrink-0"
                  style={{
                    height: 'clamp(36px, 3.8vw, 40px)',
                    padding: '0 clamp(12px, 1.4vw, 16px)',
                    fontSize: 'clamp(11.5px, 1.2vw, 13px)',
                  }}
                  title={isThai ? 'พอร์ตและรายการติดตาม' : 'Portfolio & Watchlist'}
                >
                  <Briefcase className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>{isThai ? 'พอร์ต' : 'Portfolio'}</span>
                </button>
                <button
                  onClick={onLogin}
                  className="bg-[#28282a] text-[#c8c8c8] hover:bg-[#323234] hover:text-white rounded-full font-medium transition-all duration-200 hover:-translate-y-px shadow-[0_4px_14px_rgba(0,0,0,0.16)] cursor-pointer shrink-0"
                  style={{
                    height: 'clamp(36px, 3.8vw, 40px)',
                    padding: '0 clamp(14px, 1.6vw, 18px)',
                    fontSize: 'clamp(11.5px, 1.2vw, 13px)',
                  }}
                >
                  Sign In
                </button>
              </div>
            )}
          </div>

          {/* Compact controls on every viewport; analysis modes remain in the white navigation pill on wide screens. */}
          <div className="flex items-center justify-end gap-2 sm:gap-2.5 z-10 min-w-0">
            <button
              onClick={onOpenAlerts}
              className="text-white/80 hover:text-white cursor-pointer transition-colors p-1 relative"
              title={isThai ? 'การแจ้งเตือน' : 'Alerts'}
            >
              <Bell className="w-[18px] h-[18px] sm:w-[20px] sm:h-[20px]" strokeWidth={2} />
              {unreadAlertsCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-0.5 right-0.5" />
              )}
            </button>
            <button
              onClick={onOpenPortfolio}
              className="text-white/80 hover:text-white cursor-pointer transition-colors p-1"
              title={isThai ? 'พอร์ตและรายการติดตาม' : 'Portfolio & Watchlist'}
            >
              <Briefcase className="w-[18px] h-[18px] sm:w-[20px] sm:h-[20px]" strokeWidth={2} />
            </button>
            {user && (
              <div className="flex items-center gap-2.5 sm:gap-3">
                <button
                  onClick={onOpenHistory}
                  className="text-white/80 hover:text-white cursor-pointer transition-colors p-1"
                  title="History"
                >
                  <HistoryIcon className="w-[18px] h-[18px] sm:w-[20px] sm:h-[20px]" strokeWidth={2} />
                </button>
                <button
                  onClick={onLogout}
                  className="text-white/80 hover:text-white cursor-pointer transition-colors p-1"
                  title="Logout"
                >
                  <LogOut className="w-[18px] h-[18px] sm:w-[20px] sm:h-[20px]" strokeWidth={2} />
                </button>
                <UserAvatar 
                  photoURL={user.photoURL} 
                  displayName={user.displayName} 
                  sizeClassName="w-[30px] h-[30px] sm:w-[34px] sm:h-[34px] text-[11px]" 
                />
              </div>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`flex flex-col items-center justify-center rounded-full w-[36px] h-[36px] sm:w-[40px] sm:h-[40px] transition-all duration-300 shadow-[0_4px_14px_rgba(0,0,0,0.16)] cursor-pointer ${
                mobileMenuOpen ? 'bg-white' : 'bg-[#28282a]'
              }`}
              aria-label="Toggle menu"
            >
              <span className={`w-[16px] sm:w-[18px] h-[1.5px] rounded-full transition-transform duration-300 ${mobileMenuOpen ? 'bg-black translate-y-[5.5px] sm:translate-y-[6.5px] rotate-45' : 'bg-white mb-1'}`} />
              <span className={`w-[16px] sm:w-[18px] h-[1.5px] rounded-full transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-0' : 'bg-white mb-1'}`} />
              <span className={`w-[16px] sm:w-[18px] h-[1.5px] rounded-full transition-transform duration-300 ${mobileMenuOpen ? 'bg-black -translate-y-[5.5px] sm:-translate-y-[6.5px] -rotate-45' : 'bg-white'}`} />
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
                transition={{ duration: 0.24 }}
                onClick={() => setMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/55 backdrop-blur-sm z-40"
              />
              <motion.div
                initial={{ opacity: 0, y: -18, scale: 0.94, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -12, scale: 0.97, filter: 'blur(4px)' }}
                transition={{ type: 'spring', stiffness: 420, damping: 30, mass: 0.72 }}
                className="fixed top-20 left-4 right-4 md:left-auto md:right-6 md:w-[460px] bg-white/95 backdrop-blur-xl text-[#2e2e2e] rounded-[28px] md:rounded-[24px] p-5 md:p-4 shadow-[0_24px_70px_rgba(0,0,0,0.42)] border border-white/80 ring-1 ring-black/5 z-50 flex flex-col gap-2.5 md:gap-2 overflow-hidden"
              >
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08, duration: 0.2 }}
                  className="text-[11px] text-stone-500 font-bold uppercase tracking-[0.12em] px-2 pb-1.5"
                >
                  {isThai ? 'โหมดการวิเคราะห์' : 'Analysis Mode'}
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12, duration: 0.22 }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-1.5 rounded-2xl bg-stone-100/90 p-1"
                >
                  {navModes.map((mode) => (
                    <motion.button
                      key={mode.id}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.96 }}
                      transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                      onClick={() => {
                        setAnalysisType(mode.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full py-2.5 md:py-2 px-4 md:px-2 text-left md:text-center text-sm md:text-[13px] font-semibold rounded-xl transition-colors flex items-center justify-between md:justify-center gap-1.5 ${
                        analysisType === mode.id ? 'bg-stone-900 text-white shadow-[0_4px_12px_rgba(0,0,0,0.2)]' : 'text-stone-500 hover:bg-white hover:text-stone-800'
                      }`}
                    >
                      <span className="whitespace-nowrap">
                        {isThai && mode.id === 'fundamental' ? (
                          <><span className="md:hidden">{mode.labelTh}</span><span className="hidden md:inline">พื้นฐาน</span></>
                        ) : (isThai ? mode.labelTh : mode.labelEn)}
                      </span>
                      {analysisType === mode.id && <span className="shrink-0">✓</span>}
                    </motion.button>
                  ))}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.16, duration: 0.22 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-1.5 pt-2"
                >
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-stone-50 border border-stone-100">
                    <span className="text-xs font-semibold text-stone-600">{isThai ? 'คิดเชิงลึก' : 'Deep Think'}</span>
                    <motion.button
                      whileTap={{ scale: 0.93 }}
                      onClick={() => setUseSelfConsistency(!useSelfConsistency)}
                      className={`min-w-[112px] justify-center px-3 py-1.5 font-bold text-xs rounded-full flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                        useSelfConsistency ? 'bg-[#171717] text-white shadow-[0_3px_10px_rgba(0,0,0,0.2)]' : 'bg-white border border-stone-200 text-stone-600'
                      }`}
                      title="Deep Think"
                    >
                      <BrainCircuit className={`w-3.5 h-3.5 shrink-0 ${useSelfConsistency ? 'text-violet-300' : 'text-violet-500'}`} strokeWidth={2.2} />
                      <span className="whitespace-nowrap leading-none">{useSelfConsistency ? (isThai ? 'เปิดใช้งาน' : 'ON') : (isThai ? 'ปิด' : 'OFF')}</span>
                    </motion.button>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-stone-50 border border-stone-100">
                    <span className="text-xs font-semibold text-stone-600">{isThai ? 'ภาษา' : 'Language'}</span>
                    <motion.button
                      whileTap={{ scale: 0.93 }}
                      onClick={() => setLanguage(isThai ? 'English' : 'Thai')}
                      className="px-3 py-1.5 bg-white border border-stone-200 font-bold text-xs rounded-full shadow-sm whitespace-nowrap"
                    >
                      {isThai ? 'ไทย (TH)' : 'English (EN)'}
                    </motion.button>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.22 }}
                  className="pt-2 border-t border-stone-200 grid grid-cols-1 md:grid-cols-2 gap-2"
                >
                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenAlerts?.();
                    }}
                    className="w-full py-2.5 md:py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-full text-xs text-center transition-colors cursor-pointer flex items-center justify-center gap-2 relative"
                    title={isThai ? 'การตรวจสอบวิจัยและการแจ้งเตือน' : 'On-Open Research Checks & Alerts'}
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>{isThai ? 'การแจ้งเตือน' : 'Alerts'}</span>
                    {unreadAlertsCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                        {unreadAlertsCount}
                      </span>
                    )}
                  </motion.button>
                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenPortfolio?.();
                    }}
                    className="w-full py-2.5 md:py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-full text-xs text-center transition-colors cursor-pointer flex items-center justify-center gap-2"
                    title={isThai ? 'พอร์ตการลงทุนและ Watchlist' : 'Portfolio & Watchlist'}
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>{isThai ? 'พอร์ต & Watchlist' : 'Portfolio'}</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      if (user) onOpenHistory();
                      else onLogin();
                    }}
                    className="w-full py-2.5 md:py-2 bg-[#28282a] text-white hover:bg-black font-semibold rounded-full text-xs text-center transition-colors cursor-pointer"
                  >
                    {user ? (isThai ? 'ประวัติการวิเคราะห์' : 'View History') : 'Sign In'}
                  </motion.button>
                  {user && (
                    <motion.button
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full py-3 md:py-2 bg-red-50 text-red-600 hover:bg-red-100 font-semibold rounded-full text-sm md:text-xs text-center transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <LogOut className="w-4 h-4" />
                      {isThai ? 'ออกจากระบบ' : 'Log Out'}
                    </motion.button>
                  )}
                </motion.div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* 2) Hero Center Section */}
        <main className="relative w-full max-w-[860px] flex-1 flex flex-col items-center justify-center text-center my-auto z-10 px-2 pt-10 md:pt-16 pb-2 md:pb-4 mt-2 md:mt-4">
          <div aria-hidden="true" className="absolute inset-x-[-10%] inset-y-[8%] rounded-[48px] bg-black/10 blur-xl pointer-events-none" />
          
          {/* Trust Row / AI & Market Intelligence Badge */}
          <div 
            className="anim inline-flex items-center justify-center mb-4 md:mb-5 select-none"
            style={{ 
              ['--d' as any]: '0.05s',
              ['--trust-size' as any]: 'clamp(30px, 3.5vw, 36px)'
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
                  <i className="fa-brands fa-microsoft text-[12px] md:text-[14px]"></i>
                </div>
              </div>

              {/* Amazon */}
              <div 
                className="rounded-full bg-[#28282a] border border-white/40 p-[4px] flex items-center justify-center shadow-lg transition-transform duration-350 hover:-translate-y-[4px]"
                style={{ width: 'var(--trust-size)', height: 'var(--trust-size)', marginLeft: 'calc(var(--trust-size) * -0.42)', zIndex: 2 }}
              >
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-[#111]">
                  <i className="fa-brands fa-amazon text-[12px] md:text-[14px]"></i>
                </div>
              </div>

              {/* Google */}
              <div 
                className="rounded-full bg-[#28282a] border border-white/40 p-[4px] flex items-center justify-center shadow-lg transition-transform duration-350 hover:-translate-y-[2px]"
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
                paddingRight: 'clamp(14px, 1.8vw, 20px)',
                fontSize: 'clamp(12px, 1.3vw, 14px)',
                zIndex: 0,
              }}
            >
              {isThai ? "หุ้นชั้นนำระดับโลก" : "Global Stocks"}
            </div>
          </div>

          {/* Headline (Dot-Matrix Display Typography - Scaled for Elegant Proportion) */}
          <h1 
            className="headline relative font-normal text-white text-center leading-[0.85] md:leading-[0.85] whitespace-nowrap select-none px-2 flex flex-col items-center justify-center gap-1 md:gap-2 drop-shadow-[0_3px_16px_rgba(0,0,0,0.95)]"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(32px, 5.5vw, 56px)',
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
              className="line block"
              style={{ 
                animation: 'headlineFade 0.85s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both',
              }}
            >
              AI Stock Analysis
            </span>
          </h1>

          {/* Subhead */}
          <p 
            className="subhead anim relative text-white/90 font-medium leading-relaxed max-w-[min(580px,94%)] mt-3 md:mt-5 px-2 drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]"
            style={{
              ['--d' as any]: '0.28s',
              fontSize: 'clamp(12px, 1.2vw, 13px)',
            }}
          >
            {isThai ? (
              <>วิเคราะห์หุ้นสหรัฐฯ เจาะลึกงบการเงิน รายงาน 10-K/10-Q และวางแผนเทรดอย่างแม่นยำ<br className="hidden sm:block" /> ด้วยพลัง AI ระดับสถาบัน</>
            ) : (
              <>Analyze US stocks, deep financial 10-K/10-Q filings, and institutional technical setups<br className="hidden sm:block" /> with real-time AI.</>
            )}
          </p>

          {/* Integrated Search Bar in Hero */}
          <div className="mt-5 sm:mt-6 md:mt-8 w-full max-w-[500px] flex flex-col items-center px-1">
            
            <div className="w-full liquid-glass bg-black/40 border border-white/35 rounded-full p-1 sm:p-1.5 flex items-center shadow-[0_12px_32px_rgba(0,0,0,0.42)] backdrop-blur-xl focus-within:border-white/65 focus-within:ring-1 focus-within:ring-white/45 transition-all">
              <div className="flex items-center gap-1.5 pl-2.5 sm:pl-3 flex-1 min-w-0 pr-2">
                <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/70 shrink-0" />
                <input 
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  placeholder={isThai ? "ชื่อหุ้น (เช่น NVDA, SOFI)" : "TICKER (e.g. NVDA, SOFI)"}
                  disabled={running}
                  className="bg-transparent border-none outline-none w-full font-mono uppercase text-[13px] sm:text-sm text-white placeholder-white/60 min-w-0 truncate"
                  onKeyDown={(e) => e.key === 'Enter' && runAnalysis()}
                />
              </div>

              <button
                onClick={runAnalysis}
                disabled={!ticker.trim() || running}
                className="bg-white text-black font-semibold rounded-full px-4 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm shrink-0 cursor-pointer hover:scale-102 hover:bg-white/95 disabled:bg-white/30 disabled:text-white/40 disabled:cursor-not-allowed transition-all shadow-[0_0_18px_rgba(255,255,255,0.28)]"
              >
                {running ? (
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-xs sm:text-sm">{isThai ? 'กำลังวิเคราะห์...' : 'Analyzing...'}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-xs sm:text-sm">{isThai ? 'วิเคราะห์หุ้น' : 'Analyze'}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </div>
                )}
              </button>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="w-full max-w-[500px] mt-2.5 bg-red-500/15 border border-red-500/40 text-red-200 px-4 py-2 rounded-2xl text-xs flex items-center justify-between gap-2 shadow-lg backdrop-blur-md animate-in fade-in duration-200">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="truncate">{error}</span>
                </div>
                {onClearError && (
                  <button
                    onClick={onClearError}
                    className="text-red-400 hover:text-white p-0.5 rounded-full shrink-0 cursor-pointer transition-colors"
                    title={isThai ? 'ปิด' : 'Dismiss'}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Quick Ticker Chips */}
            <div className="flex flex-wrap items-center justify-center gap-1 mt-3 px-1">
              <span className="text-[10px] sm:text-[11px] text-white/70 mr-1 drop-shadow-md">{isThai ? 'ตัวอย่าง:' : 'Popular:'}</span>
              {quickTickers.map((sym) => (
                <button
                  key={sym}
                  onClick={() => handleSelectQuickTicker(sym)}
                  className={`px-2.5 py-1 rounded-full text-[10.5px] sm:text-[11px] font-mono transition-all cursor-pointer border ${
                    ticker.toUpperCase() === sym 
                      ? 'bg-white text-black border-white font-bold' 
                      : 'bg-black/30 text-white/90 border-white/20 hover:bg-white/15 hover:text-white backdrop-blur-sm'
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
