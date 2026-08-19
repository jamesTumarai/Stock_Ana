import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Sparkles, ArrowRight } from 'lucide-react';

interface MotionIntroProps {
  onComplete: () => void;
  isThai?: boolean;
}

export const MotionIntro: React.FC<MotionIntroProps> = ({ onComplete, isThai = true }) => {
  const [phase, setPhase] = useState<'awakening' | 'drawing' | 'shimmer' | 'unveil' | 'completed'>('awakening');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Background Star & Particle Cosmos Simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle nodes
    const particleCount = 65;
    const particles: Array<{
      x: number;
      y: number;
      radius: number;
      vx: number;
      vy: number;
      alpha: number;
      color: string;
    }> = [];

    const colors = ['#ffffff', '#fde047', '#93c5fd', '#c084fc'];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.6 + 0.4,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        alpha: Math.random() * 0.6 + 0.1,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Subtle center aurora spotlight
      const grad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        20,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.55
      );
      grad.addColorStop(0, 'rgba(234, 179, 8, 0.08)');
      grad.addColorStop(0.35, 'rgba(59, 130, 246, 0.05)');
      grad.addColorStop(0.7, 'rgba(147, 51, 234, 0.03)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Draw floating cosmic particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Motion Choreography Timeline
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('drawing'), 350);
    const t2 = setTimeout(() => setPhase('shimmer'), 1600);
    const t3 = setTimeout(() => setPhase('unveil'), 3200);
    const t4 = setTimeout(() => {
      setPhase('completed');
      onComplete();
    }, 4100);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: phase === 'unveil' || phase === 'completed' ? 0 : 1 }}
      exit={{ opacity: 0, scale: 1.08, filter: 'blur(12px)' }}
      transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[9999] bg-[#070709] text-white flex flex-col items-center justify-center overflow-hidden select-none cursor-pointer"
      onClick={onComplete}
    >
      {/* Background Particle Cosmos Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />

      {/* Ambient Pulsing Aura Spotlight */}
      <motion.div
        animate={{
          scale: [1, 1.25, 1],
          opacity: [0.35, 0.65, 0.35],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute w-[600px] h-[600px] rounded-full bg-radial from-amber-400/20 via-blue-500/10 to-transparent blur-3xl pointer-events-none z-0"
      />

      {/* Top Controls: Skip Button */}
      <div className="absolute top-6 right-6 z-20">
        <motion.button
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          onClick={(e) => {
            e.stopPropagation();
            onComplete();
          }}
          className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs text-white/80 hover:text-white backdrop-blur-md transition-all flex items-center gap-1.5 cursor-pointer shadow-lg group"
        >
          <span>{isThai ? 'เข้าสู่ระบบ / ข้าม' : 'Skip Intro'}</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </motion.button>
      </div>

      {/* Central Motion Stage */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-4">
        
        {/* Emblem & Rotating Sacred Geometry Rings */}
        <div className="relative w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center mb-6">
          
          {/* Outer Rotating HUD Orbit Ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-full border border-dashed border-amber-400/25 pointer-events-none"
          />

          {/* Precision Celestial Tick Marks */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 32, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-3 rounded-full border border-blue-400/20 pointer-events-none flex items-center justify-center"
          >
            <div className="absolute top-0 w-1.5 h-1.5 bg-amber-400/80 rounded-full shadow-[0_0_8px_#f59e0b]" />
            <div className="absolute bottom-0 w-1.5 h-1.5 bg-blue-400/80 rounded-full shadow-[0_0_8px_#3b82f6]" />
            <div className="absolute left-0 w-1.5 h-1.5 bg-purple-400/80 rounded-full shadow-[0_0_8px_#a855f7]" />
            <div className="absolute right-0 w-1.5 h-1.5 bg-emerald-400/80 rounded-full shadow-[0_0_8px_#10b981]" />
          </motion.div>

          {/* Inner Glowing Badge Container */}
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-b from-white/15 to-white/5 p-0.5 backdrop-blur-xl border border-white/30 shadow-[0_0_50px_rgba(255,255,255,0.15)] flex items-center justify-center group overflow-hidden"
          >
            {/* Shimmer Light Sweeping across the emblem */}
            <motion.div
              animate={{
                x: ['-140%', '140%'],
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                repeatDelay: 1.5,
                ease: 'easeInOut',
              }}
              className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/35 to-transparent skew-x-12 pointer-events-none"
            />

            {/* Central Crown Coin SVG with Animated Stroke & Fill */}
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="w-full h-full drop-shadow-[0_0_24px_rgba(255,215,0,0.6)]"
                fill="none"
              >
                {/* Animated Glowing Crown Path */}
                <motion.path
                  d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z"
                  stroke="#ffffff"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{
                    pathLength: 1,
                    opacity: 1,
                    fill: phase === 'shimmer' || phase === 'unveil' ? '#ffffff' : 'rgba(255, 255, 255, 0)',
                  }}
                  transition={{
                    pathLength: { duration: 1.2, ease: 'easeInOut' },
                    opacity: { duration: 0.4 },
                    fill: { duration: 0.8, delay: 1.1 },
                  }}
                />

                {/* Animated Glowing Base Bar Path */}
                <motion.path
                  d="M19 19c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"
                  stroke="#ffffff"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{
                    pathLength: 1,
                    opacity: 1,
                    fill: phase === 'shimmer' || phase === 'unveil' ? '#ffffff' : 'rgba(255, 255, 255, 0)',
                  }}
                  transition={{
                    pathLength: { duration: 0.9, delay: 0.4, ease: 'easeInOut' },
                    opacity: { duration: 0.4, delay: 0.4 },
                    fill: { duration: 0.8, delay: 1.2 },
                  }}
                />
              </svg>
            </div>
          </motion.div>
        </div>

        {/* Brand Name Typography Reveal with Optical Expansion */}
        <div className="overflow-hidden flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 25, letterSpacing: '0.45em' }}
            animate={{ opacity: 1, y: 0, letterSpacing: '0.22em' }}
            transition={{ duration: 1.1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="font-display font-black text-2xl sm:text-3xl md:text-4xl uppercase tracking-[0.22em] text-transparent bg-clip-text bg-gradient-to-r from-white via-stone-100 to-amber-200 drop-shadow-[0_4px_24px_rgba(255,255,255,0.4)]"
          >
            COIN KING
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 1.0, ease: 'easeOut' }}
            className="mt-1 font-display font-medium text-lg sm:text-xl md:text-2xl tracking-[0.3em] uppercase text-white/90"
          >
            LUMINA
          </motion.div>
        </div>

        {/* Dynamic Wave Frequency Divider */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 1.2, delay: 1.3, ease: 'easeInOut' }}
          className="w-48 sm:w-64 h-px bg-gradient-to-r from-transparent via-amber-400/80 to-transparent my-3.5 relative"
        >
          <motion.div
            animate={{
              scale: [0.8, 1.4, 0.8],
              opacity: [0.6, 1, 0.6],
            }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute left-1/2 -top-1 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-300 shadow-[0_0_12px_#fbbf24]"
          />
        </motion.div>

        {/* Tagline & Institutional AI Status */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.6 }}
          className="flex items-center gap-2 text-xs sm:text-sm font-mono tracking-widest text-stone-400 uppercase"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>{isThai ? "ระบบปัญญาประดิษฐ์วิเคราะห์หุ้นสถาบัน" : "INSTITUTIONAL AI STOCK INTELLIGENCE"}</span>
          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
        </motion.div>

        {/* Pulse Hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, delay: 2.2 }}
          className="mt-6 text-[11px] font-mono text-white/40 tracking-wider"
        >
          {isThai ? "แตะที่ใดก็ได้เพื่อเริ่มต้น" : "Tap anywhere to begin"}
        </motion.div>

      </div>
    </motion.div>
  );
};
