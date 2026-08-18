import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface LandingViewProps {
  onStart?: () => void;
  onLogin?: () => void;
  user?: any;
  onOpenHistory?: () => void;
}

interface StatItem {
  glyph: string;
  target: number;
  suffix: string;
  decimals: number;
  label: string;
  delay: string;
}

const STATS: StatItem[] = [
  { glyph: '<', target: 120, suffix: 'ms', decimals: 0, label: 'Inference Time', delay: '0.5s' },
  { glyph: '%', target: 99.99, suffix: '%', decimals: 2, label: 'Platform Uptime', delay: '0.58s' },
  { glyph: '*', target: 24, suffix: '/7', decimals: 0, label: 'Autonomous Runtime', delay: '0.66s' },
  { glyph: '#', target: 2.4, suffix: 'M', decimals: 1, label: 'Context Windows', delay: '0.74s' },
];

function StatCounter({ stat }: { stat: StatItem }) {
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
      className="anim flex flex-col items-center text-center select-none"
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
      <div className="text-[#8e8e8e] font-normal mt-0.5" style={{ fontSize: 'clamp(11px, 1.2vw, 12.5px)' }}>
        {stat.label}
      </div>
    </div>
  );
}

export function LandingView({ onStart, onLogin, user, onOpenHistory }: LandingViewProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState('Home');

  const navItems = ['Home', 'Product', 'Case Studies', 'Contact'];

  const handleCtaClick = () => {
    if (onStart) {
      onStart();
    } else {
      const input = document.querySelector('input[placeholder="US TICKER"]') as HTMLInputElement;
      if (input) {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  return (
    <div className="relative w-full h-full min-h-[100vh] min-h-[100dvh] overflow-hidden bg-black text-white select-none">
      {/* Background Video */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-black pointer-events-none">
        <video
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          autoPlay
          muted
          loop
          playsInline
        >
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4"
            type="video/mp4"
          />
        </video>
        {/* Subtle dark ambient gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />
      </div>

      {/* Main Single-Viewport Page Layout */}
      <div 
        className="relative z-10 w-full h-full min-h-[100vh] min-h-[100dvh] flex flex-col justify-between items-center overflow-hidden"
        style={{
          padding: 'clamp(16px, 2.4vh, 28px) clamp(14px, 3vw, 32px)',
        }}
      >
        {/* 1) Header */}
        <header 
          className="w-full max-w-[720px] flex items-center justify-between md:justify-center shrink-0 z-50 transition-all"
          style={{
            gap: 'clamp(18px, 2.8vw, 28px)',
            animation: 'slideDown 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
          }}
        >
          {/* Logo */}
          <button
            onClick={() => setActiveNav('Home')}
            className="rounded-full bg-white flex items-center justify-center shrink-0 cursor-pointer transition-transform duration-300 hover:scale-104 shadow-[0_4px_14px_rgba(0,0,0,0.16)]"
            style={{
              width: 'clamp(40px, 4.4vw, 46px)',
              height: 'clamp(40px, 4.4vw, 46px)',
            }}
            title="Home"
          >
            {/* Aperture Logo Icon */}
            <svg 
              viewBox="0 0 100 100" 
              className="w-[72%] h-[72%] object-contain" 
              fill="#111111"
            >
              <path d="M50 14 A36 36 0 0 1 86 50 L70 50 A20 20 0 0 0 50 30 Z" />
              <path d="M86 50 A36 36 0 0 1 50 86 L50 70 A20 20 0 0 0 70 50 Z" />
              <path d="M50 86 A36 36 0 0 1 14 50 L30 50 A20 20 0 0 0 50 70 Z" />
              <path d="M14 50 A36 36 0 0 1 50 14 L50 30 A20 20 0 0 0 30 50 Z" />
              <circle cx="50" cy="50" r="7" fill="#111111" />
            </svg>
          </button>

          {/* Desktop Nav Pill (White) */}
          <nav 
            className="hidden md:flex items-center justify-between flex-1 max-w-[430px] bg-white rounded-full px-2 shadow-[0_4px_14px_rgba(0,0,0,0.16)]"
            style={{
              height: 'clamp(44px, 5.2vw, 48px)',
              padding: '4px 10px',
            }}
          >
            {navItems.map((item) => {
              const isActive = activeNav === item;
              return (
                <button
                  key={item}
                  onClick={() => {
                    setActiveNav(item);
                    if (item === 'Product' || item === 'Home') handleCtaClick();
                  }}
                  className={`relative px-3.5 py-1.5 font-medium transition-all duration-200 cursor-pointer ${
                    isActive 
                      ? 'text-[#2e2e2e] opacity-100' 
                      : 'text-[#2e2e2e] opacity-50 hover:opacity-75'
                  }`}
                  style={{
                    fontSize: 'clamp(13px, 1.4vw, 15px)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {item}
                  {/* Active 3-dot indicator */}
                  {isActive && (
                    <span 
                      className="absolute left-1/2 -translate-x-1/2 bottom-[5px] w-[3px] h-[3px] bg-black rounded-full shadow-[-5px_0_0_#000,5px_0_0_#000]" 
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Desktop Sign In / User */}
          <div className="hidden md:block">
            {user ? (
              <button
                onClick={onOpenHistory}
                className="bg-[#28282a] text-[#c8c8c8] hover:bg-[#323234] hover:text-white rounded-full font-medium transition-all duration-200 hover:-translate-y-px shadow-[0_4px_14px_rgba(0,0,0,0.16)] flex items-center gap-2 cursor-pointer"
                style={{
                  height: 'clamp(44px, 5.2vw, 48px)',
                  padding: '0 clamp(16px, 2vw, 22px)',
                  fontSize: 'clamp(13px, 1.4vw, 14.5px)',
                }}
              >
                {user.photoURL && (
                  <img src={user.photoURL} alt="User" className="w-5 h-5 rounded-full border border-white/20" />
                )}
                <span>History</span>
              </button>
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

          {/* Mobile Burger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`md:hidden flex flex-col items-center justify-center rounded-full w-12 h-12 transition-all duration-300 shadow-[0_4px_14px_rgba(0,0,0,0.16)] cursor-pointer ${
              mobileMenuOpen ? 'bg-white' : 'bg-[#28282a]'
            }`}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            <span
              className={`w-[18px] h-[1.5px] rounded-full transition-transform duration-300 ${
                mobileMenuOpen 
                  ? 'bg-black translate-y-[6.5px] rotate-45' 
                  : 'bg-white mb-1'
              }`}
            />
            <span
              className={`w-[18px] h-[1.5px] rounded-full transition-opacity duration-300 ${
                mobileMenuOpen ? 'opacity-0' : 'bg-white mb-1'
              }`}
            />
            <span
              className={`w-[18px] h-[1.5px] rounded-full transition-transform duration-300 ${
                mobileMenuOpen 
                  ? 'bg-black -translate-y-[6.5px] -rotate-45' 
                  : 'bg-white'
              }`}
            />
          </button>
        </header>

        {/* Mobile Menu Sheet Modal */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              {/* Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28 }}
                onClick={() => setMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/62 backdrop-blur-md z-40 md:hidden"
              />

              {/* Sheet */}
              <motion.div
                initial={{ opacity: 0, y: -12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.97 }}
                transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                className="fixed top-20 left-4 right-4 bg-white text-[#2e2e2e] rounded-[28px] p-[22px_18px_20px] shadow-[0_20px_60px_rgba(0,0,0,0.45)] z-50 flex flex-col gap-2 md:hidden"
              >
                {navItems.map((item, idx) => {
                  const isActive = activeNav === item;
                  return (
                    <button
                      key={item}
                      onClick={() => {
                        setActiveNav(item);
                        setMobileMenuOpen(false);
                        if (item === 'Product' || item === 'Home') handleCtaClick();
                      }}
                      className={`w-full py-2.5 px-4 text-center font-medium rounded-xl relative transition-colors ${
                        isActive ? 'text-black font-semibold bg-stone-100' : 'text-stone-600 hover:text-black'
                      }`}
                      style={{ animation: `linkIn 0.3s cubic-bezier(0.22,1,0.36,1) ${idx * 0.05}s both` }}
                    >
                      {item}
                      {isActive && (
                        <span className="absolute left-1/2 -translate-x-1/2 bottom-2 w-[3px] h-[3px] bg-black rounded-full shadow-[-5px_0_0_#000,5px_0_0_#000]" />
                      )}
                    </button>
                  );
                })}

                <div className="pt-2 mt-1 border-t border-stone-200">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      if (user && onOpenHistory) onOpenHistory();
                      else if (onLogin) onLogin();
                    }}
                    className="w-full py-3 bg-[#28282a] text-white hover:bg-black font-medium rounded-full text-sm transition-colors cursor-pointer"
                  >
                    {user ? 'View History' : 'Sign In'}
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* 2) Hero Section */}
        <main className="w-full max-w-[900px] flex-1 flex flex-col items-center justify-center text-center my-auto z-10 px-2">
          {/* Trust Row */}
          <div 
            className="anim inline-flex items-center justify-center mb-[clamp(16px,2.5vh,26px)] select-none"
            style={{ 
              ['--d' as any]: '0.05s',
              ['--trust-size' as any]: 'clamp(36px, 4.5vw, 42px)'
            }}
          >
            {/* Avatars Container */}
            <div className="flex items-center">
              {/* Microsoft Avatar */}
              <div 
                className="rounded-full bg-[#28282a] border border-white/40 p-[5px] flex items-center justify-center shadow-lg transition-transform duration-350 hover:-translate-y-[2px]"
                style={{
                  width: 'var(--trust-size)',
                  height: 'var(--trust-size)',
                  zIndex: 1,
                }}
              >
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-[#111]">
                  <i 
                    className="fa-brands fa-microsoft" 
                    style={{ fontSize: 'calc(var(--trust-size) * 0.36)' }}
                  />
                </div>
              </div>

              {/* Amazon Avatar */}
              <div 
                className="rounded-full bg-[#28282a] border border-white/40 p-[5px] flex items-center justify-center shadow-lg transition-transform duration-350 hover:-translate-y-[4px]"
                style={{
                  width: 'var(--trust-size)',
                  height: 'var(--trust-size)',
                  marginLeft: 'calc(var(--trust-size) * -0.42)',
                  zIndex: 2,
                }}
              >
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-[#111]">
                  <i 
                    className="fa-brands fa-amazon" 
                    style={{ fontSize: 'calc(var(--trust-size) * 0.36)' }}
                  />
                </div>
              </div>

              {/* Google Avatar */}
              <div 
                className="rounded-full bg-[#28282a] border border-white/40 p-[5px] flex items-center justify-center shadow-lg transition-transform duration-350 hover:-translate-y-[2px]"
                style={{
                  width: 'var(--trust-size)',
                  height: 'var(--trust-size)',
                  marginLeft: 'calc(var(--trust-size) * -0.42)',
                  zIndex: 3,
                }}
              >
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-[#111]">
                  <i 
                    className="fa-brands fa-google" 
                    style={{ fontSize: 'calc(var(--trust-size) * 0.36)' }}
                  />
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
              Trusted by 2000+ Enterprises
            </div>
          </div>

          {/* Headline (Dot-Matrix Typography) */}
          <h1 
            className="headline font-normal text-white text-center leading-[1.12] whitespace-nowrap overflow-hidden select-none"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(28px, 6.2vw, 80px)',
              letterSpacing: 'clamp(-0.08em, -0.04em, -0.04em)',
            }}
          >
            <span 
              className="line block"
              style={{ 
                animation: 'headlineFade 0.85s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both',
              }}
            >
              Intelligence
            </span>
            <span 
              className="line block mt-1 md:mt-2"
              style={{ 
                animation: 'headlineFade 0.85s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both',
              }}
            >
              Designed To Evolve
            </span>
          </h1>

          {/* Subhead */}
          <p 
            className="subhead anim text-[#d0d0d0] font-normal leading-[1.55] max-w-[min(500px,92%)] mt-4 md:mt-5 opacity-80"
            style={{
              ['--d' as any]: '0.28s',
              fontSize: 'clamp(calc(13.5px + 2pt), calc(1.55vw + 2pt), calc(16.5px + 2pt))',
            }}
          >
            Build applications that reason, adapt and collaborate using a modular AI platform designed for production.
          </p>

          {/* CTA Button */}
          <div className="mt-6 md:mt-7">
            <button
              onClick={handleCtaClick}
              className="cta-btn anim-pulse bg-white text-black font-semibold rounded-full cursor-pointer transition-all duration-300 hover:scale-102 hover:-translate-y-0.5 active:scale-98"
              style={{
                ['--d' as any]: '0.4s',
                fontSize: 'clamp(13.5px, 1.5vw, 14.5px)',
                padding: 'clamp(11px, 1.6vh, 13px) clamp(22px, 3vw, 28px)',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.15), 0 0 22px rgba(255,255,255,0.32), 0 0 44px rgba(255,255,255,0.12)',
              }}
            >
              Get Started
            </button>
          </div>
        </main>

        {/* 3) Stats Footer (Exact 4 Metrics) */}
        <footer 
          className="w-full max-w-[920px] grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 pt-4 pb-2 shrink-0 z-10"
        >
          {STATS.map((stat) => (
            <StatCounter key={stat.label} stat={stat} />
          ))}
        </footer>
      </div>
    </div>
  );
}
