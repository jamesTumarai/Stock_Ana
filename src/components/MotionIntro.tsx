import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface MotionIntroProps {
  onComplete: () => void;
  isThai?: boolean;
}

export const MotionIntro: React.FC<MotionIntroProps> = ({ onComplete }) => {
  // Timeline Stages:
  // 1. 'focus' (0.0s): Pure black, single light point + subtle zoom in
  // 2. 'emblem' (0.6s): Crown Coin emblem springs in with subtle light sweep
  // 3. 'typography' (1.3s): 'COIN KING' slides from left, 'LUMINA' glides up from bottom with zoom breathing
  // 4. 'glide' (2.5s): Creative spatial glide where the logo smoothly slides toward top-left and reveals the page
  // 5. 'exit' (3.3s): Completes and dissolves
  const [step, setStep] = useState<'focus' | 'emblem' | 'typography' | 'glide' | 'exit'>('focus');

  useEffect(() => {
    const t1 = setTimeout(() => setStep('emblem'), 500);
    const t2 = setTimeout(() => setStep('typography'), 1300);
    const t3 = setTimeout(() => setStep('glide'), 2500);
    const t4 = setTimeout(() => {
      setStep('exit');
      onComplete();
    }, 3300);

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
      animate={{ 
        opacity: step === 'exit' ? 0 : 1,
      }}
      exit={{ opacity: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }}
      className="fixed inset-0 z-[9999] bg-[#050507] text-white flex flex-col items-center justify-center overflow-hidden select-none cursor-pointer"
      onClick={onComplete}
    >
      {/* Background Minimalist Ambient Spotlight */}
      <motion.div
        animate={{
          scale: step === 'glide' ? [1, 1.4] : [0.9, 1.15, 0.95],
          opacity: step === 'glide' ? [0.35, 0] : [0.2, 0.45, 0.25],
        }}
        transition={{ 
          duration: step === 'glide' ? 0.8 : 4, 
          repeat: step === 'glide' ? 0 : Infinity, 
          ease: 'easeInOut' 
        }}
        className="absolute w-[500px] h-[500px] rounded-full bg-radial from-white/10 via-amber-400/5 to-transparent blur-3xl pointer-events-none"
      />

      {/* Main Kinetic Stage Container */}
      <motion.div
        animate={{
          scale: 
            step === 'focus' ? 0.92 : 
            step === 'emblem' ? 1 : 
            step === 'typography' ? [1, 0.96, 1.02] : 
            step === 'glide' ? 0.85 : 1,
          y: step === 'glide' ? -20 : 0,
        }}
        transition={{
          duration: step === 'typography' ? 1.2 : 0.8,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="relative z-10 flex flex-col items-center justify-center"
      >

        {/* 1) Top Brand Logo Row (Emblem + COIN KING Text Sliding In) */}
        <div className="flex items-center gap-3 sm:gap-4">
          
          {/* Minimalist White Crown Coin Emblem */}
          <motion.div
            initial={{ scale: 0, rotate: -30, opacity: 0 }}
            animate={{ 
              scale: step === 'focus' ? 0 : 1, 
              rotate: 0, 
              opacity: step === 'focus' ? 0 : 1 
            }}
            transition={{
              type: 'spring',
              stiffness: 220,
              damping: 20,
              delay: 0.1,
            }}
            className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white flex items-center justify-center shrink-0 shadow-[0_0_35px_rgba(255,255,255,0.35)] overflow-hidden group"
          >
            {/* Shimmer Light Sweeping Across the Coin */}
            <motion.div
              animate={{
                x: ['-150%', '150%'],
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

          {/* 'COIN KING' Typography (Smooth Horizontal Slide & Track Expansion) */}
          <div className="overflow-hidden py-1">
            <motion.div
              initial={{ x: -40, opacity: 0, filter: 'blur(8px)' }}
              animate={{ 
                x: step === 'focus' ? -40 : 0, 
                opacity: step === 'focus' ? 0 : 1,
                filter: 'blur(0px)',
              }}
              transition={{
                duration: 0.85,
                delay: 0.25,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="font-display font-black text-2xl sm:text-3xl md:text-4xl uppercase tracking-[0.2em] text-white select-none drop-shadow-[0_2px_20px_rgba(255,255,255,0.3)] whitespace-nowrap"
            >
              COIN KING
            </motion.div>
          </div>
        </div>

        {/* 2) Dynamic Morphing Divider (Grows from center out) */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ 
            scaleX: step === 'typography' || step === 'glide' ? 1 : 0,
            opacity: step === 'typography' || step === 'glide' ? 0.75 : 0,
          }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="w-32 sm:w-44 h-[1px] bg-gradient-to-r from-transparent via-white/70 to-transparent my-3 sm:my-3.5 relative"
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

        {/* 3) 'LUMINA' Typography (Vertical Elevation & Subtle Letter-Spacing Breathing) */}
        <div className="overflow-hidden py-1">
          <motion.div
            initial={{ y: 30, opacity: 0, filter: 'blur(12px)', letterSpacing: '0.45em' }}
            animate={{ 
              y: step === 'typography' || step === 'glide' ? 0 : 30,
              opacity: step === 'typography' || step === 'glide' ? 1 : 0,
              filter: step === 'typography' || step === 'glide' ? 'blur(0px)' : 'blur(12px)',
              letterSpacing: step === 'typography' || step === 'glide' ? '0.3em' : '0.45em',
            }}
            transition={{
              duration: 0.9,
              delay: 0.1,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="font-display font-medium text-lg sm:text-xl md:text-2xl uppercase tracking-[0.3em] text-white/80 select-none drop-shadow-[0_0_15px_rgba(255,255,255,0.25)] whitespace-nowrap"
          >
            LUMINA
          </motion.div>
        </div>

      </motion.div>
    </motion.div>
  );
};
