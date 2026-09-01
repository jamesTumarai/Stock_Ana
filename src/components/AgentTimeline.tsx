import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info, Brain, Code, CheckCircle, MessageSquare, AlertCircle, Loader2, ChevronDown, HelpCircle } from 'lucide-react';

export interface TimelineEvent {
  id: number;
  kind: 'info' | 'thinking' | 'tool_call' | 'tool_result' | 'text' | 'error';
  label: string;
  detail?: string;
  toolName?: string;
  startTime?: number;
  endTime?: number;
  callId?: string;
}

const ICONS = {
  info: Info,
  thinking: Brain,
  tool_call: Code,
  tool_result: CheckCircle,
  text: MessageSquare,
  error: AlertCircle,
} as const;

export function AgentTimeline({ events, running, paused, hasReport, onViewReport, onDecisionClick, metrics }: { events: TimelineEvent[]; running: boolean; paused?: boolean; hasReport?: boolean; onViewReport?: () => void; onDecisionClick?: () => void; metrics?: { durationSecs: number; tokenCount: number; documentCount: number } }) {
  const endRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    let timer: any;
    if (running) {
      timer = setInterval(() => {
        setTick(t => t + 1);
      }, 50); // 50ms for smooth 2 decimal places updates
    }
    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [events.length, running]);

  return (
    <div className="w-full flex flex-col items-center py-6 sm:py-12 relative px-3 sm:px-6">
      {events.length > 0 && (
         <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/15 -translate-x-1/2 z-0" />
      )}
      
      <div className="space-y-4 sm:space-y-6 w-full max-w-xl sm:max-w-2xl relative z-10">
        <AnimatePresence initial={false}>
          {events.map((e) => {
            const Icon = ICONS[e.kind];
            const now = Date.now();
            const durationMs = e.endTime ? (e.endTime - (e.startTime || e.endTime)) : (e.startTime && running ? Math.max(0, now - e.startTime) : 0);
            const durationSec = (durationMs / 1000).toFixed(2);

            return (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="bg-black/35 backdrop-blur-xl border border-white/15 rounded-2xl w-full flex flex-col overflow-hidden shadow-2xl transition-all"
              >
                <div className="p-4 sm:p-5 flex flex-col gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-bold text-white text-sm sm:text-base tracking-tight">{e.label}</h3>
                  </div>
                  
                  {e.detail && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-3.5 flex items-start gap-2.5">
                      <div className="shrink-0 mt-0.5">
                         {e.kind === 'tool_result' ? (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                         ) : (
                            <div className="w-3.5 h-3.5 border-2 border-white/40 border-dashed rounded-full" />
                         )}
                      </div>
                      <div className="text-[11px] sm:text-xs leading-relaxed text-white/80 font-mono overflow-x-auto whitespace-pre-wrap break-all sm:break-words max-h-48 overflow-y-auto scrollbar-hide w-full">
                        {e.detail}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="border-t border-white/10 bg-black/30 px-4 sm:px-5 py-2.5 flex items-center justify-between text-[11px] font-medium text-white/50">
                  <div className="flex items-center gap-1.5 hover:text-white transition-colors">
                    {e.toolName ? (
                      <>
                        <Code className="w-3 h-3 text-cyan-400" />
                        <span className="font-mono text-white/70">{e.toolName}</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3 h-3" />
                        <span className="cursor-pointer">Details</span>
                      </>
                    )}
                  </div>
                  <span className="tabular-nums text-white/70 font-mono">{durationSec}s</span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {running && !paused && (
           <motion.div
             initial={{ opacity: 0, scale: 0.98 }}
             animate={{ opacity: 1, scale: 1 }}
             className="bg-black/35 backdrop-blur-xl border border-white/20 rounded-2xl p-4 sm:p-5 w-full flex items-center gap-3 overflow-hidden shadow-2xl"
           >
             <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
               <Loader2 className="w-4 h-4 text-white animate-spin" />
             </div>
             <div className="flex flex-col">
               <span className="font-bold text-white text-sm sm:text-base tracking-tight">AI is analyzing stock...</span>
               <span className="text-[11px] text-white/60">Fetching 10-K, price feeds & computing multi-step metrics</span>
             </div>
           </motion.div>
        )}

        {paused && (
           <motion.div
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             className="bg-amber-950/40 backdrop-blur-xl border border-amber-400/50 rounded-2xl p-4 sm:p-5 w-full flex items-center justify-between cursor-pointer hover:bg-amber-950/60 transition-colors shadow-lg shadow-black/20"
             onClick={onDecisionClick}
           >
             <div className="flex items-center gap-3">
               <HelpCircle className="w-5 h-5 text-amber-400 shrink-0" />
               <div>
                  <h3 className="font-bold text-white text-sm sm:text-base tracking-tight">Strategic Decision Required</h3>
                  <p className="text-xs text-white/70 font-medium mt-0.5">Click to confirm assumptions or review conflicting data...</p>
               </div>
             </div>
             <ChevronDown className="w-4 h-4 text-white/50 -rotate-90 shrink-0" />
           </motion.div>
        )}

        {hasReport && (
           <motion.div
             initial={{ opacity: 0, y: 16, scale: 0.96 }}
             animate={{ opacity: 1, y: 0, scale: 1 }}
             whileHover={{ scale: 1.01 }}
             whileTap={{ scale: 0.99 }}
             className="bg-gradient-to-r from-white to-stone-100 text-black border border-white rounded-2xl w-full flex flex-col cursor-pointer shadow-[0_12px_32px_rgba(255,255,255,0.22)] transition-all"
             onClick={onViewReport}
           >
             <div className="p-4 sm:p-5 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center shrink-0">
                     <CheckCircle className="w-5 h-5" />
                   </div>
                   <div>
                      <h3 className="font-bold text-black text-base sm:text-lg tracking-tight">Report is Ready</h3>
                      <p className="text-xs text-stone-600 font-medium mt-0.5">Tap here to view the full institutional intelligence report</p>
                   </div>
                 </div>
                 <div className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center shrink-0 ml-2">
                   <ChevronDown className="w-4 h-4 text-black -rotate-90" />
                 </div>
             </div>
             {metrics && (
                 <div className="border-t border-black/10 bg-black/5 px-4 sm:px-5 py-2.5 flex flex-wrap items-center justify-between text-xs font-semibold text-stone-700">
                    <span className="flex items-center gap-1"><span className="text-stone-500">Docs:</span> {metrics.documentCount}</span>
                    <span className="flex items-center gap-1"><span className="text-stone-500">Time:</span> {metrics.durationSecs}s</span>
                    <span className="flex items-center gap-1"><span className="text-stone-500">Tokens:</span> {metrics.tokenCount.toLocaleString()}</span>
                 </div>
             )}
           </motion.div>
        )}

        <div ref={endRef} className="h-4 w-full" />
      </div>
    </div>
  );
}
