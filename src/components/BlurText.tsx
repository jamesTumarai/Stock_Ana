import React from 'react';
import { motion } from 'motion/react';

export function BlurText({ text, className }: { text: string, className?: string }) {
  const words = text.split(' ');

  return (
    <p className={className} style={{ display: 'flex', flexWrap: 'wrap', rowGap: '0.1em', justifyContent: 'center' }}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ filter: 'blur(10px)', opacity: 0, y: 50 }}
          whileInView={{
            filter: ['blur(10px)', 'blur(5px)', 'blur(0px)'],
            opacity: [0, 0.5, 1],
            y: [50, -5, 0],
          }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{
            duration: 0.7,
            times: [0, 0.5, 1],
            ease: "easeOut",
            delay: (i * 100) / 1000
          }}
          style={{ display: 'inline-block', marginRight: '0.28em' }}
        >
          {word}
        </motion.span>
      ))}
    </p>
  );
}
