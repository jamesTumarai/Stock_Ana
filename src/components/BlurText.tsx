import React from 'react';
import { motion } from 'motion/react';

export function BlurText({ text, className }: { text: string, className?: string }) {
  const lines = text.split('\n');
  let globalWordIndex = 0;

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {lines.map((line, lineIndex) => {
        const words = line.split(' ');
        return (
          <p key={lineIndex} style={{ display: 'flex', flexWrap: 'wrap', rowGap: '0.1em', justifyContent: 'center', margin: 0 }}>
            {words.map((word, i) => {
              const currentWordIndex = globalWordIndex++;
              return (
                <motion.span
                  key={`${lineIndex}-${i}`}
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
                    delay: (currentWordIndex * 100) / 1000
                  }}
                  style={{ display: 'inline-block', marginRight: '0.28em' }}
                >
                  {word}
                </motion.span>
              );
            })}
          </p>
        );
      })}
    </div>
  );
}
