import React from 'react';

export function AppLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={`${className} z-10 overflow-visible`}>
      <defs>
        <linearGradient id="spark-1" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#e879f9" />
        </linearGradient>
        <linearGradient id="spark-2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
        <filter id="spark-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g filter="url(#spark-glow)">
        {/* Main large spark */}
        <path d="M 50,5 C 50,30 70,50 95,50 C 70,50 50,70 50,95 C 50,70 30,50 5,50 C 30,50 50,30 50,5 Z" fill="url(#spark-1)" opacity="0.9" />
        
        {/* Secondary angled spark for density */}
        <path d="M 50,15 C 50,35 65,50 85,50 C 65,50 50,65 50,85 C 50,65 35,50 15,50 C 35,50 50,35 50,15 Z" fill="url(#spark-2)" opacity="0.8" transform="rotate(45, 50, 50)" style={{ mixBlendMode: "screen" }} />
      </g>

      {/* Crisp White Core Layers */}
      <path d="M 50,10 C 50,32 68,50 90,50 C 68,50 50,68 50,90 C 50,68 32,50 10,50 C 32,50 50,32 50,10 Z" fill="#ffffff" opacity="0.5" />
      <path d="M 50,20 C 50,38 62,50 80,50 C 62,50 50,62 50,80 C 50,62 38,50 20,50 C 38,50 50,38 50,20 Z" fill="#ffffff" opacity="0.9" />
      
      {/* Central bright spot */}
      <circle cx="50" cy="50" r="5" fill="#ffffff" className="animate-pulse" />
      <circle cx="50" cy="50" r="2" fill="#ffffff" />
    </svg>
  );
}
