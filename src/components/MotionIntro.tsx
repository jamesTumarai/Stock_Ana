import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface MotionIntroProps {
  onComplete: () => void;
  isThai?: boolean;
}

export const MotionIntro: React.FC<MotionIntroProps> = ({ onComplete }) => {
  // Timeline Stages:
  // 1. 'dot' (0.0s): Singular glowing beacon & grid expansion
  // 2. 'emblem' (0.8s): Crown Coin assembly with radial shockwave
  // 3. 'coinKing' (1.4s): Staggered masked typographic extrusion of 'COIN KING'
  // 4. 'lumina' (2.2s): Horizon morph & deep-perspective emergence of 'LUMINA'
  // 5. 'dock' (3.0s): Spatial glide towards header/hero & seamless dissolve into landing page
  const [stage, setStage] = useState<'dot' | 'emblem' | 'coinKing' | 'lumina' | 'dock' | 'exit'>('dot');

  useEffect(() => {
    const t1 = setTimeout(() => setStage('emblem'), 600);
    const t2 = setTimeout(() => setStage('coinKing'), 1300);
    const t3 = setTimeout(() => setStage('lumina'), 2100);
    const t4 = setTimeout(() => setStage('dock'), 3000);
    const t5 = setTimeout(() => {
      setStage('exit');
      onComplete();
    }, 3700);

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
        scale: stage === 'dock' || stage === 'exit' ? 1.04 : 1,
      }}
      exit={{ opacity: 0, scale: 1.08, filter: 'blur(16px)' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[9999] bg-[#040406] text-white flex flex-col items-center justify-center overflow-hidden select-none cursor-pointer"
      onClick={onComplete}
    >
      {/* 1) Dynamic Grid Horizon Lines & Ambient Spotlight */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        
        {/* Ambient Breathing Corona Glow */}
        <motion.div
          animate={{
            scale: stage === 'lumina' || stage === 'dock' ? [1, 1.4, 1.1] : [0.8, 1.1, 0.8],
            opacity: stage === 'dock' ? [0.6, 0] : [0.15, 0.35, 0.15],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="w-[600px] h-[600px] rounded-full bg-radial from-amber-400/15 via-blue-500/10 to-transparent blur-3xl"
        />

        {/* Minimalist Horizontal Laser Horizon */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{
            scaleX: stage === 'dot' ? 0.1 : stage === 'emblem' ? 0.4 : stage === 'coinKing' ? 0.8 : 1.2,
            opacity: stage === 'dock' ? 0 : [0.2, 0.5, 0.2],
          }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="absolute w-[80vw] max-w-[800px] h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent"
        />
      </div>

      {/* 2) Interactive Kinetic Motion Core */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        
        {/* Top Region: Crown Emblem with Precision Optical Ticks */}
        <div className="relative flex items-center justify-center mb-4">
          
          {/* Outer Pulsing Geometry Ring */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: stage === 'dot' ? [0, 1.2, 0.8] : stage === 'emblem' ? [1, 1.35, 1] : 1,
              opacity: stage === 'dot' ? 0.8 : stage === 'dock' ? 0 : 0.35,
              rotate: 360,
            }}
            transition={{
              rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
              scale: { duration: 0.8, ease: 'easeOut' },
            }}
            className="absolute -inset-3.5 rounded-full border border-dashed border-amber-300/40 pointer-events-none"
          />

          {/* Crown Coin Emblem with Smooth Spring Physics */}
          <motion.div
            initial={{ scale: 0, rotate: -45, y: 15 }}
            animate={{
              scale: stage === 'dot' ? 0 : stage === 'lumina' ? 0.9 : stage === 'dock' ? 0.8 : 1,
              rotate: 0,
              y: stage === 'lumina' ? -6 : 0,
            }}
            transition={{
              type: 'spring',
              stiffness: 240,
              damping: 22,
            }}
            className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.4)] overflow-hidden group"
          >
            {/* Shimmer Light Sweeping Across Coin */}
            <motion.div
              animate={{
                x: ['-160%', '160%'],
              }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                repeatDelay: 1.0,
                ease: 'easeInOut',
              }}
              className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-black/20 to-transparent skew-x-12 pointer-events-none"
            />

            {/* Minimalist Crown SVG Icon */}
            <svg viewBox="0 0 24 24" className="w-[58%] h-[58%]" fill="#111111" stroke="none">
              <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
            </svg>
          </motion.div>
        </div>

        {/* 3) Staggered Masked Kinetic Typography: 'COIN KING' */}
        <div className="overflow-hidden py-1 flex items-center justify-center gap-1 sm:gap-1.5">
          {coinKingLetters.map((char, index) => (
            <motion.span
              key={index}
              initial={{ y: 45, opacity: 0, rotateX: -90, filter: 'blur(6px)' }}
              animate={{
                y: stage === 'coinKing' || stage === 'lumina' || stage === 'dock' ? 0 : 45,
                opacity: stage === 'coinKing' || stage === 'lumina' || stage === 'dock' ? 1 : 0,
                rotateX: stage === 'coinKing' || stage === 'lumina' || stage === 'dock' ? 0 : -90,
                filter: stage === 'coinKing' || stage === 'lumina' || stage === 'dock' ? 'blur(0px)' : 'blur(6px)',
                scale: stage === 'lumina' ? 0.95 : 1,
              }}
              transition={{
                duration: 0.7,
                delay: 0.04 * index,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="inline-block font-display font-black text-2xl sm:text-3xl md:text-4xl uppercase tracking-[0.16em] text-white drop-shadow-[0_2px_24px_rgba(255,255,255,0.35)]"
            >
              {char === " " ? "\u00A0" : char}
            </motion.span>
          ))}
        </div>

        {/* 4) Creative Morphing Light Portal: 'LUMINA' with Deep Perspective Zoom */}
        <div className="overflow-hidden mt-2 pt-1 flex items-center justify-center">
          <AnimatePresence>
            {(stage === 'lumina' || stage === 'dock') && (
              <motion.div
                initial={{ opacity: 0, scale: 1.5, y: 30, filter: 'blur(16px)', letterSpacing: '0.6em' }}
                animate={{ 
                  opacity: 1, 
                  scale: 1, 
                  y: 0, 
                  filter: 'blur(0px)', 
                  letterSpacing: '0.32em' 
                }}
                exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
                transition={{
                  duration: 1.0,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="font-display font-medium text-lg sm:text-2xl md:text-3xl uppercase tracking-[0.32em] text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-200 to-white drop-shadow-[0_0_25px_rgba(255,255,255,0.4)]"
              >
                {luminaLetters.map((l, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.06 * i }}
                    className="inline-block"
                  >
                    {l}
                  </motion.span>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 5) Minimalist Progress Ray */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{
            scaleX: stage === 'dock' ? 1 : stage === 'lumina' ? 0.75 : stage === 'coinKing' ? 0.45 : stage === 'emblem' ? 0.2 : 0,
          }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="w-36 sm:w-48 h-[1.5px] bg-gradient-to-r from-transparent via-amber-300 to-transparent mt-4 relative"
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

      </div>
    </motion.div>
  );
};
