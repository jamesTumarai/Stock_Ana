const IndicatorVisualizer = ({ type, text, isThai }: { type: 'RSI' | 'MACD', text: string, isThai: boolean }) => {
   if (!text) return null;
   
   // Try to match a number
   const match = text.match(new RegExp(`${type}.*?(-?\\d+(\\.\\d+)?)`, 'i')) || text.match(/(-?\d+(\.\d+)?)/);
   const value = match ? parseFloat(match[1]) : null;
   
   if (value === null || isNaN(value)) return null;

   if (type === 'RSI') {
     // RSI scale 0 - 100
     const left = Math.max(0, Math.min(100, value));
     return `
       <div className="mt-4 mb-2 bg-stone-50 p-4 rounded-xl border border-stone-100">
         <div className="flex justify-between text-xs text-stone-500 mb-2 font-medium">
           <span>0 (Oversold)</span>
           <span className="font-bold text-stone-900 text-sm">RSI: {value}</span>
           <span>100 (Overbought)</span>
         </div>
         <div className="w-full h-2.5 bg-stone-200 rounded-full relative">
           <div className="absolute top-0 left-[30%] w-[40%] h-full bg-stone-300 border-x border-white/50" />
           <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[#0b5a4b] rounded-full shadow-sm border-2 border-white transition-all duration-700" style={{ left: \`calc(\${left}% - 8px)\` }} />
         </div>
         <div className="flex justify-between text-[10px] text-stone-400 mt-1 px-1">
           <span className="w-1/3 text-left">Buy Zone</span>
           <span className="w-1/3 text-center">Neutral</span>
           <span className="w-1/3 text-right">Sell Zone</span>
         </div>
       </div>
     `;
   }
   
   if (type === 'MACD') {
      // MACD usually oscillates around 0. We can just show a 0-center gauge
      // Let's assume a realistic max range of -10 to +10 for visual scaling, but we cap it
      const absMax = Math.max(1, Math.abs(value) * 1.5);
      const normalizedLeft = ((value + absMax) / (absMax * 2)) * 100;
      const left = Math.max(0, Math.min(100, normalizedLeft));
      
      return `
       <div className="mt-4 mb-2 bg-stone-50 p-4 rounded-xl border border-stone-100">
         <div className="flex justify-between text-xs text-stone-500 mb-2 font-medium">
           <span>Bearish</span>
           <span className="font-bold text-stone-900 text-sm">MACD: {value}</span>
           <span>Bullish</span>
         </div>
         <div className="w-full h-2.5 bg-stone-200 rounded-full relative">
           <div className="absolute top-0 left-1/2 w-px h-full bg-stone-400" />
           <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[#0b5a4b] rounded-full shadow-sm border-2 border-white transition-all duration-700" style={{ left: \`calc(\${left}% - 8px)\` }} />
         </div>
         <div className="flex justify-between text-[10px] text-stone-400 mt-1 px-1">
           <span className="w-1/2 text-left">&lt; 0 (Downtrend)</span>
           <span className="w-1/2 text-right">&gt; 0 (Uptrend)</span>
         </div>
       </div>
      `;
   }
   return null;
}
