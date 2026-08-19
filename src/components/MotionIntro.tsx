import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface MotionIntroProps {
  onComplete: () => void;
  isThai?: boolean;
}

export const MotionIntro: React.FC<MotionIntroProps> = ({ onComplete }) => {
  // Stages:
  // 1. 'ignite' (0.0s): Particle cosmos awakens & SVG stroke laser paths start drawing
  // 2. 'assemble' (0.8s): Crown snaps into solid glass medallion with shockwave pulse
  // 3. 'coinKing' (1.4s): 3D staggered kinetic typography extrudes 'COIN KING'
  // 4. 'lumina' (2.2s): Deep-perspective zoom-in of 'LUMINA' with glowing aurora flare
  // 5. 'dock' (3.0s): Seamless spatial glide & dissolve to landing page
  const [stage, setStage] = useState<'ignite' | 'assemble' | 'coinKing' | 'lumina' | 'dock' | 'exit'>('ignite');
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

    // 80 ethereal cosmic energy particles
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

    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * Math.min(width, height) * 0.45 + 40;
      particles.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        radius: Math.random() * 1.8 + 0.4,
        angle,
        dist,
        speed: (Math.random() * 0.35 + 0.12) * (Math.random() > 0.5 ? 1 : -1),
        alpha: Math.random() * 0.6 + 0.25,
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
      radialGrad.addColorStop(0.35, 'rgba(59, 130, 246, 0.06)');
      radialGrad.addColorStop(0.7, 'rgba(147, 51, 234, 0.03)');
      radialGrad.addColorStop(1, 'rgba(4, 4, 6, 0)');
      ctx.fillStyle = radialGrad;
      ctx.fillRect(0, 0, width, height);

      // Volumetric rotating light rays behind emblem
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(time * 0.1);
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const rayAngle1 = (i * Math.PI) / 3 - 0.14;
        const rayAngle2 = (i * Math.PI) / 3 + 0.14;
        const rayLength = Math.max(width, height) * 0.5;
        ctx.arc(0, 0, rayLength, rayAngle1, rayAngle2);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 230, 150, 0.012)';
        ctx.fill();
      }
      ctx.restore();

      // Draw and update orbiting particles
      particles.forEach((p) => {
        p.angle += p.speed * 0.015;
        p.dist += Math.sin(time + p.angle) * 0.25;
        p.x = cx + Math.cos(p.angle) * p.dist;
        p.y = cy + Math.sin(p.angle) * p.dist;

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

  // Choreography Sequence Timeline
  useEffect(() => {
    const t1 = setTimeout(() => setStage('assemble'), 700);
    const t2 = setTimeout(() => setStage('coinKing'), 1350);
    const t3 = setTimeout(() => setStage('lumina'), 2150);
    const t4 = setTimeout(() => setStage('dock'), 2950);
    const t5 = setTimeout(() => {
      setStage('exit');
      onComplete();
    }, 3650);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [onComplete]);

  const coinKingLetters = "COIN KING".split("");
  const luminaLetters = "LUMINA".split("");

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ 
        opacity: stage === 'exit' ? 0 : 1,
        scale: stage === 'dock' || stage === 'exit' ? 1.05 : 1,
      }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(16px)' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[9999] bg-[#050508] text-white flex flex-col items-center justify-center overflow-hidden select-none cursor-pointer"
      onClick={onComplete}
    >
      {/* Background Particle Cosmos & Volumetric Atmosphere */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />

      {/* Radiant Corona Aura Core with Breathing Zoom */}
      <motion.div
        animate={{
          scale: stage === 'lumina' || stage === 'dock' ? [1, 1.4, 1.1] : [0.85, 1.15, 0.85],
          opacity: stage === 'dock' ? [0.6, 0] : [0.2, 0.45, 0.2],
        }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute w-[560px] h-[560px] rounded-full bg-radial from-amber-300/25 via-yellow-500/10 to-transparent blur-3xl pointer-events-none z-0"
      />

      {/* Main Kinetic Stage Container with Dynamic Zoom Breathing */}
      <motion.div
        animate={{
          scale: 
            stage === 'ignite' ? 0.94 :
            stage === 'assemble' ? [0.94, 1.05, 1] :
            stage === 'coinKing' ? [1, 0.97, 1.02] :
            stage === 'lumina' ? [1.02, 0.98, 1.03] :
            stage === 'dock' ? 0.92 : 1,
          y: stage === 'dock' ? -15 : 0,
        }}
        transition={{
          duration: 1.1,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="relative z-10 flex flex-col items-center justify-center text-center px-4"
      >
        
        {/* Emblem Box with Sacred Geometry & Orbital Rings */}
        <div className="relative w-40 h-40 sm:w-48 sm:h-48 flex items-center justify-center mb-5">
          
          {/* Orbital Dashed Radar Ring 1 (Clockwise) */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-full border border-dashed border-amber-400/30 pointer-events-none shadow-[0_0_15px_rgba(245,158,11,0.15)]"
          />

          {/* Orbital Celestial Ring 2 with 4 Quantum Nodes (Counter-Clockwise) */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-2.5 rounded-full border border-blue-400/20 pointer-events-none"
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-amber-300 rounded-full shadow-[0_0_10px_#fde047]" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-blue-300 rounded-full shadow-[0_0_10px_#60a5fa]" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-purple-300 rounded-full shadow-[0_0_10px_#c084fc]" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-emerald-300 rounded-full shadow-[0_0_10px_#34d399]" />
          </motion.div>

          {/* Radial Shockwave Pulse Ring on Assembly Impact */}
          <AnimatePresence>
            {(stage === 'assemble' || stage === 'coinKing' || stage === 'lumina') && (
              <motion.div
                initial={{ scale: 0.6, opacity: 0.9 }}
                animate={{ scale: [0.7, 1.8, 2.3], opacity: [0.9, 0.35, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.9, ease: 'easeOut' }}
                className="absolute inset-0 rounded-full border border-amber-300/50 pointer-events-none"
              />
            )}
          </AnimatePresence>

          {/* Inner Glowing Glassmorphic Emblem Medallion */}
          <motion.div
            initial={{ scale: 0, rotate: -40, opacity: 0 }}
            animate={{ 
              scale: 1, 
              rotate: 0, 
              opacity: 1 
            }}
            transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-b from-white/20 via-white/10 to-amber-500/10 p-0.5 backdrop-blur-2xl border border-white/40 shadow-[0_0_50px_rgba(255,215,0,0.22)] flex items-center justify-center overflow-hidden"
          >
            {/* Prismatic Shimmer Light Sweep */}
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
              className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/45 to-transparent skew-x-12 pointer-events-none"
            />

            {/* Central Crown Coin SVG with Animated Stroke Path Laser Drawing & Glow Fill */}
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
                    fill: stage !== 'ignite' ? '#ffffff' : 'rgba(255,255,255,0)',
                  }}
                  transition={{
                    pathLength: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
                    opacity: { duration: 0.3 },
                    fill: { duration: 0.6, delay: 0.65 },
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
                    fill: stage !== 'ignite' ? '#ffffff' : 'rgba(255,255,255,0)',
                  }}
                  transition={{
                    pathLength: { duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] },
                    opacity: { duration: 0.3, delay: 0.25 },
                    fill: { duration: 0.6, delay: 0.7 },
                  }}
                />
              </svg>
            </div>
          </motion.div>
        </div>

        {/* 3D Staggered Masked Kinetic Typography: 'COIN KING' */}
        <div className="overflow-hidden py-1 flex items-center justify-center gap-1 sm:gap-1.5">
          {coinKingLetters.map((char, index) => (
            <motion.span
              key={index}
              initial={{ y: 45, opacity: 0, rotateX: -90, filter: 'blur(6px)' }}
              animate={{
                y: stage === 'ignite' ? 45 : 0,
                opacity: stage === 'ignite' ? 0 : 1,
                rotateX: stage === 'ignite' ? -90 : 0,
                filter: stage === 'ignite' ? 'blur(6px)' : 'blur(0px)',
                scale: stage === 'lumina' ? 0.96 : 1,
              }}
              transition={{
                duration: 0.75,
                delay: 0.4 + 0.04 * index,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="inline-block font-display font-black text-2xl sm:text-3xl md:text-4xl uppercase tracking-[0.16em] text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-amber-200 drop-shadow-[0_4px_30px_rgba(255,255,255,0.35)]"
            >
              {char === " " ? "\u00A0" : char}
            </motion.span>
          ))}
        </div>

        {/* Deep Perspective Kinetic Zoom-in: 'LUMINA' */}
        <div className="overflow-hidden mt-1.5 pt-1 flex items-center justify-center">
          <AnimatePresence>
            {(stage === 'lumina' || stage === 'dock') && (
              <motion.div
                initial={{ opacity: 0, scale: 1.45, y: 25, filter: 'blur(16px)', letterSpacing: '0.55em' }}
                animate={{ 
                  opacity: 0.95, 
                  scale: 1, 
                  y: 0, 
                  filter: 'blur(0px)', 
                  letterSpacing: '0.34em' 
                }}
                exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
                transition={{
                  duration: 0.95,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="font-display font-medium text-lg sm:text-xl md:text-2xl uppercase tracking-[0.34em] text-transparent bg-clip-text bg-gradient-to-r from-blue-100 via-amber-200 to-white drop-shadow-[0_0_22px_rgba(251,191,36,0.45)]"
              >
                {luminaLetters.map((l, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.05 * i }}
                    className="inline-block"
                  >
                    {l}
                  </motion.span>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Dynamic Golden Horizon Flare Line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{
            scaleX: stage === 'dock' ? 1 : stage === 'lumina' ? 0.75 : stage === 'coinKing' ? 0.45 : stage === 'assemble' ? 0.2 : 0,
          }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="w-36 sm:w-48 h-[1.5px] bg-gradient-to-r from-transparent via-amber-300 to-transparent mt-3.5 relative"
        >
          <motion.div
            animate={{
              scale: [0.8, 1.5, 0.8],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute left-1/2 -top-[2px] -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-300 shadow-[0_0_10px_#fde047]"
          />
        </motion.div>

      </motion.div>
    </motion.div>
  );
};
