import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface MotionIntroProps {
  onComplete: () => void;
  isThai?: boolean;
}

export const MotionIntro: React.FC<MotionIntroProps> = ({ onComplete }) => {
  const [stage, setStage] = useState<'converge' | 'ignite' | 'reveal' | 'climax' | 'exit'>('converge');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // High-End Particle Cosmos & Radiant Volumetric Beams Simulation
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

    const cx = width / 2;
    const cy = height / 2 - 40;

    // Create 90 ethereal energy particles
    const particles: Array<{
      x: number;
      y: number;
      radius: number;
      angle: number;
      dist: number;
      speed: number;
      alpha: number;
      color: string;
    }> = [];

    const colors = ['#ffffff', '#fde047', '#f59e0b', '#60a5fa', '#c084fc'];

    for (let i = 0; i < 90; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * Math.min(width, height) * 0.45 + 50;
      particles.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        radius: Math.random() * 2 + 0.5,
        angle,
        dist,
        speed: (Math.random() * 0.4 + 0.15) * (Math.random() > 0.5 ? 1 : -1),
        alpha: Math.random() * 0.7 + 0.3,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    let time = 0;

    const render = () => {
      time += 0.015;
      ctx.clearRect(0, 0, width, height);

      // Deep celestial radial spotlight
      const radialGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(width, height) * 0.65);
      radialGrad.addColorStop(0, 'rgba(245, 158, 11, 0.12)');
      radialGrad.addColorStop(0.3, 'rgba(59, 130, 246, 0.08)');
      radialGrad.addColorStop(0.65, 'rgba(147, 51, 234, 0.04)');
      radialGrad.addColorStop(1, 'rgba(3, 3, 5, 0)');
      ctx.fillStyle = radialGrad;
      ctx.fillRect(0, 0, width, height);

      // Volumetric rotating light rays behind emblem
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(time * 0.12);
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const rayAngle1 = (i * Math.PI) / 3 - 0.15;
        const rayAngle2 = (i * Math.PI) / 3 + 0.15;
        const rayLength = Math.max(width, height) * 0.5;
        ctx.arc(0, 0, rayLength, rayAngle1, rayAngle2);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 230, 150, 0.015)';
        ctx.fill();
      }
      ctx.restore();

      // Draw and update orbiting energy particles
      particles.forEach((p) => {
        p.angle += p.speed * 0.015;
        p.dist += Math.sin(time + p.angle) * 0.25;
        p.x = cx + Math.cos(p.angle) * p.dist;
        p.y = cy + Math.sin(p.angle) * p.dist;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.shadowBlur = 10;
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

  // Cinematic Timeline Sequence
  useEffect(() => {
    const t1 = setTimeout(() => setStage('ignite'), 600);
    const t2 = setTimeout(() => setStage('reveal'), 1300);
    const t3 = setTimeout(() => setStage('climax'), 2700);
    const t4 = setTimeout(() => {
      setStage('exit');
      onComplete();
    }, 3500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onComplete]);

  // Letters for 3D staggered typography
  const coinKingLetters = "COIN KING".split("");
  const luminaLetters = "LUMINA".split("");

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ 
        opacity: stage === 'exit' ? 0 : 1,
        scale: stage === 'climax' || stage === 'exit' ? 1.06 : 1,
        filter: stage === 'exit' ? 'blur(16px)' : 'blur(0px)',
      }}
      exit={{ opacity: 0, scale: 1.15, filter: 'blur(24px)' }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[9999] bg-[#050508] text-white flex flex-col items-center justify-center overflow-hidden select-none"
    >
      {/* Background Particle Cosmos & Volumetric Atmosphere */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />

      {/* Radiant Corona Aura Core */}
      <motion.div
        animate={{
          scale: stage === 'climax' ? [1, 2.4] : [1, 1.35, 1],
          opacity: stage === 'climax' ? [0.6, 0.95, 0] : [0.35, 0.7, 0.35],
        }}
        transition={{ 
          duration: stage === 'climax' ? 0.8 : 3.5, 
          repeat: stage === 'climax' ? 0 : Infinity, 
          ease: 'easeInOut' 
        }}
        className="absolute w-[520px] h-[520px] rounded-full bg-radial from-amber-300/30 via-yellow-500/15 to-transparent blur-3xl pointer-events-none z-0"
      />

      {/* Central Motion Stage */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-4">
        
        {/* Emblem Assembly Box */}
        <div className="relative w-40 h-40 sm:w-48 sm:h-48 flex items-center justify-center mb-6">
          
          {/* Orbital Radar Ring 1 (Clockwise) */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-full border border-dashed border-amber-400/30 pointer-events-none shadow-[0_0_15px_rgba(245,158,11,0.2)]"
          />

          {/* Orbital Celestial Ring 2 (Counter-Clockwise) */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-2.5 rounded-full border border-blue-400/25 pointer-events-none"
          >
            {/* 4 Quantum Energy Nodes on Orbit */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-amber-300 rounded-full shadow-[0_0_12px_#fde047]" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-300 rounded-full shadow-[0_0_12px_#60a5fa]" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-purple-300 rounded-full shadow-[0_0_10px_#c084fc]" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-emerald-300 rounded-full shadow-[0_0_10px_#34d399]" />
          </motion.div>

          {/* Shockwave Energy Pulse Ring on Impact */}
          <AnimatePresence>
            {(stage === 'ignite' || stage === 'reveal' || stage === 'climax') && (
              <motion.div
                initial={{ scale: 0.6, opacity: 0.9 }}
                animate={{ scale: [0.7, 1.8, 2.2], opacity: [0.9, 0.4, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 0.8, ease: 'easeOut' }}
                className="absolute inset-0 rounded-full border border-amber-300/60 pointer-events-none"
              />
            )}
          </AnimatePresence>

          {/* Inner Glowing Glassmorphic Emblem Medallion */}
          <motion.div
            initial={{ scale: 0, rotate: -45, opacity: 0 }}
            animate={{ 
              scale: stage === 'climax' ? 1.12 : 1, 
              rotate: 0, 
              opacity: 1 
            }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-b from-white/20 via-white/10 to-amber-500/10 p-0.5 backdrop-blur-2xl border border-white/40 shadow-[0_0_60px_rgba(255,215,0,0.25)] flex items-center justify-center overflow-hidden"
          >
            {/* Prismatic Shimmer Sweep */}
            <motion.div
              animate={{
                x: ['-160%', '160%'],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 1.2,
                ease: 'easeInOut',
              }}
              className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/50 to-transparent skew-x-12 pointer-events-none"
            />

            {/* Central Crown Coin Emblem with SVG Path Laser Assembly & Fill */}
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="w-full h-full drop-shadow-[0_0_24px_rgba(255,215,0,0.7)]"
                fill="none"
              >
                {/* Crown Laser Path Draw */}
                <motion.path
                  d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z"
                  stroke="#ffffff"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{
                    pathLength: 1,
                    opacity: 1,
                    fill: stage === 'ignite' || stage === 'reveal' || stage === 'climax' ? '#ffffff' : 'rgba(255,255,255,0)',
                  }}
                  transition={{
                    pathLength: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
                    opacity: { duration: 0.3 },
                    fill: { duration: 0.7, delay: 0.7 },
                  }}
                />

                {/* Base Bar Laser Path Draw */}
                <motion.path
                  d="M19 19c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"
                  stroke="#ffffff"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{
                    pathLength: 1,
                    opacity: 1,
                    fill: stage === 'ignite' || stage === 'reveal' || stage === 'climax' ? '#ffffff' : 'rgba(255,255,255,0)',
                  }}
                  transition={{
                    pathLength: { duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] },
                    opacity: { duration: 0.3, delay: 0.25 },
                    fill: { duration: 0.7, delay: 0.75 },
                  }}
                />
              </svg>
            </div>
          </motion.div>
        </div>

        {/* 3D Staggered Typography: COIN KING */}
        <div className="flex items-center justify-center gap-1 sm:gap-1.5 overflow-hidden">
          {coinKingLetters.map((char, index) => (
            <motion.span
              key={index}
              initial={{ opacity: 0, y: 35, rotateX: -90, scale: 0.6 }}
              animate={{ 
                opacity: 1, 
                y: 0, 
                rotateX: 0, 
                scale: stage === 'climax' ? 1.05 : 1 
              }}
              transition={{
                duration: 0.8,
                delay: 0.5 + index * 0.05,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="inline-block font-display font-black text-2xl sm:text-3xl md:text-4xl uppercase text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-amber-200 drop-shadow-[0_4px_30px_rgba(255,255,255,0.4)]"
            >
              {char === " " ? "\u00A0" : char}
            </motion.span>
          ))}
        </div>

        {/* 3D Staggered Typography: LUMINA */}
        <div className="flex items-center justify-center gap-2 sm:gap-2.5 mt-1.5 overflow-hidden">
          {luminaLetters.map((char, index) => (
            <motion.span
              key={index}
              initial={{ opacity: 0, y: 25, filter: 'blur(8px)' }}
              animate={{ 
                opacity: 0.95, 
                y: 0, 
                filter: 'blur(0px)',
                scale: stage === 'climax' ? 1.06 : 1
              }}
              transition={{
                duration: 0.9,
                delay: 1.0 + index * 0.06,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="inline-block font-display font-medium text-lg sm:text-xl md:text-2xl uppercase tracking-[0.35em] text-transparent bg-clip-text bg-gradient-to-r from-blue-100 via-amber-200 to-white drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]"
            >
              {char}
            </motion.span>
          ))}
        </div>

        {/* Sleek Golden Frequency Flare Line */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ 
            scaleX: stage === 'climax' ? 1.4 : 1, 
            opacity: stage === 'climax' ? 1 : 0.8 
          }}
          transition={{ duration: 1.2, delay: 1.4, ease: 'easeInOut' }}
          className="w-40 sm:w-56 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400 to-transparent mt-4 relative"
        >
          <motion.div
            animate={{
              scale: [0.8, 1.6, 0.8],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute left-1/2 -top-[3px] -translate-x-1/2 w-2 h-2 rounded-full bg-amber-300 shadow-[0_0_14px_#fde047]"
          />
        </motion.div>

      </div>
    </motion.div>
  );
};
