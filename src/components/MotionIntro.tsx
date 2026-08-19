import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface MotionIntroProps {
  onComplete: () => void;
  isThai?: boolean;
}

export const MotionIntro: React.FC<MotionIntroProps> = ({ onComplete }) => {
  // Timeline Stages:
  // 1. 'ignite' (0.0s): Pure dark space, subtle zoom-in
  // 2. 'emblem' (0.5s): Minimalist white coin springs in with sleek shimmer
  // 3. 'slide' (1.1s): 'COIN KING' slides out from emblem + divider expands
  // 4. 'lumina' (1.9s): 'LUMINA' glides up with dynamic zoom breathing
  // 5. 'glide' (2.7s): Entire logo glides smoothly upward & dissolves into landing page
  const [stage, setStage] = useState<'ignite' | 'emblem' | 'slide' | 'lumina' | 'glide' | 'exit'>('ignite');

  useEffect(() => {
    const t1 = setTimeout(() => setStage('emblem'), 450);
    const t2 = setTimeout(() => setStage('slide'), 1100);
    const t3 = setTimeout(() => setStage('lumina'), 1900);
    const t4 = setTimeout(() => setStage('glide'), 2700);
    const t5 = setTimeout(() => {
      setStage('exit');
      onComplete();
    }, 3400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ 
        opacity: stage === 'exit' ? 0 : 1,
      }}
      exit={{ opacity: 0, scale: 1.06, filter: 'blur(14px)', transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] } }}
      className="fixed inset-0 z-[9999] bg-[#050507] text-white flex flex-col items-center justify-center overflow-hidden select-none cursor-pointer"
      onClick={onComplete}
    >
      {/* Minimalist Ambient Radial Glow */}
      <motion.div
        animate={{
          scale: stage === 'lumina' || stage === 'glide' ? [1, 1.25, 1.05] : [0.85, 1.05, 0.85],
          opacity: stage === 'glide' ? [0.35, 0] : [0.15, 0.3, 0.15],
        }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute w-[500px] h-[500px] rounded-full bg-radial from-white/12 via-white/5 to-transparent blur-3xl pointer-events-none"
      />

      {/* Main Kinetic Motion Stage Container (with Dynamic Zoom In/Out Breathing) */}
      <motion.div
        animate={{
          scale: 
            stage === 'ignite' ? 0.9 : 
            stage === 'emblem' ? [0.9, 1.04, 1] : 
            stage === 'slide' ? [1, 0.97, 1.02] : 
            stage === 'lumina' ? [1.02, 0.96, 1.03] : 
            stage === 'glide' ? 0.9 : 1,
          y: stage === 'glide' ? -28 : 0,
        }}
        transition={{
          duration: 1.0,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="relative z-10 flex flex-col items-center justify-center px-4"
      >

        {/* 1) Brand Row (Minimalist White Emblem + 'COIN KING' Sliding In) */}
        <div className="flex items-center gap-3 sm:gap-4">
          
          {/* Pure Minimalist White Crown Coin Emblem */}
          <motion.div
            initial={{ scale: 0, rotate: -35, y: -20, opacity: 0 }}
            animate={{ 
              scale: stage === 'ignite' ? 0 : 1, 
              rotate: 0, 
              y: 0,
              opacity: stage === 'ignite' ? 0 : 1 
            }}
            transition={{
              type: 'spring',
              stiffness: 260,
              damping: 20,
              delay: 0.05,
            }}
            className="relative w-13 h-13 sm:w-15 sm:h-15 rounded-full bg-white flex items-center justify-center shrink-0 shadow-[0_0_35px_rgba(255,255,255,0.35)] overflow-hidden group"
          >
            {/* Shimmer Light Sweeping Across the Coin */}
            <motion.div
              animate={{
                x: ['-160%', '160%'],
              }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                repeatDelay: 1.2,
                ease: 'easeInOut',
              }}
              className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-black/15 to-transparent skew-x-12 pointer-events-none"
            />

            {/* Minimalist Crown SVG Icon */}
            <svg viewBox="0 0 24 24" className="w-[58%] h-[58%]" fill="#111111" stroke="none">
              <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
            </svg>
          </motion.div>

          {/* 'COIN KING' Typography (Smooth Horizontal Slide & Kinetic Reveal) */}
          <div className="overflow-hidden py-1">
            <motion.div
              initial={{ x: -45, opacity: 0, filter: 'blur(10px)', letterSpacing: '0.3em' }}
              animate={{ 
                x: stage === 'ignite' || stage === 'emblem' ? -45 : 0, 
                opacity: stage === 'ignite' || stage === 'emblem' ? 0 : 1,
                filter: stage === 'ignite' || stage === 'emblem' ? 'blur(10px)' : 'blur(0px)',
                letterSpacing: stage === 'ignite' || stage === 'emblem' ? '0.3em' : '0.18em',
              }}
              transition={{
                duration: 0.85,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="font-display font-black text-2xl sm:text-3xl md:text-4xl uppercase text-white select-none drop-shadow-[0_2px_20px_rgba(255,255,255,0.3)] whitespace-nowrap"
            >
              COIN KING
            </motion.div>
          </div>
        </div>

        {/* 2) Minimalist Dynamic Hairline Divider (Unfolds from center) */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ 
            scaleX: stage === 'slide' || stage === 'lumina' || stage === 'glide' ? 1 : 0,
            opacity: stage === 'slide' || stage === 'lumina' || stage === 'glide' ? 0.75 : 0,
          }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="w-32 sm:w-44 h-[1px] bg-gradient-to-r from-transparent via-white/60 to-transparent my-3 sm:my-3.5 relative"
        >
          <motion.div
            animate={{
              scale: [0.8, 1.4, 0.8],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute left-1/2 -top-[1.5px] -translate-x-1/2 w-1 h-1 rounded-full bg-white shadow-[0_0_8px_#ffffff]"
          />
        </motion.div>

        {/* 3) 'LUMINA' Typography (Vertical Elevation & Deep Letter-Spacing Breathing) */}
        <div className="overflow-hidden py-1">
          <motion.div
            initial={{ y: 35, opacity: 0, filter: 'blur(12px)', letterSpacing: '0.45em' }}
            animate={{ 
              y: stage === 'lumina' || stage === 'glide' ? 0 : 35,
              opacity: stage === 'lumina' || stage === 'glide' ? 0.95 : 0,
              filter: stage === 'lumina' || stage === 'glide' ? 'blur(0px)' : 'blur(12px)',
              letterSpacing: stage === 'lumina' || stage === 'glide' ? '0.32em' : '0.45em',
            }}
            transition={{
              duration: 0.9,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="font-display font-medium text-lg sm:text-xl md:text-2xl uppercase text-white/80 select-none drop-shadow-[0_0_15px_rgba(255,255,255,0.25)] whitespace-nowrap"
          >
            LUMINA
          </motion.div>
        </div>

      </motion.div>
    </motion.div>
  );
};
