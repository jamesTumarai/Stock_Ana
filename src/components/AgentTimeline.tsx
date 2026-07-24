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
    <div className="w-full flex flex-col items-center py-12 relative px-6">
      {events.length > 0 && (
         <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/20 -translate-x-1/2 z-0" />
      )}
      
      <div className="space-y-6 w-full max-w-lg relative z-10">
        <AnimatePresence initial={false}>
          {events.map((e) => {
            const Icon = ICONS[e.kind];
            const now = Date.now();
            const durationMs = e.endTime ? (e.endTime - (e.startTime || e.endTime)) : (e.startTime && running ? Math.max(0, now - e.startTime) : 0);
            const durationSec = (durationMs / 1000).toFixed(2);

            return (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="bg-black/20 backdrop-blur-md border border-white/10 rounded-none w-full flex flex-col overflow-hidden shadow-2xl"
              >
                <div className="p-6 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-white shrink-0" />
                    <h3 className="font-bold text-white text-base tracking-tight">{e.label}</h3>
                  </div>
                  
                  {e.detail && (
                    <div className="bg-white/5 rounded-none p-4 flex items-start gap-3">
                      <div className="shrink-0 mt-0.5">
                         {e.kind === 'tool_result' ? (
                            <CheckCircle className="w-4 h-4 text-white/50" />
                         ) : (
                            <div className="w-4 h-4 border-2 border-white/30 border-dashed rounded-full" />
                         )}
                      </div>
                      <div className="text-[12px] leading-relaxed text-white/80 font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-40 overflow-y-auto w-full">
                        {e.detail}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="border-t border-white/10 bg-black/20 px-6 py-3 flex items-center justify-between text-[11px] font-medium text-white/50">
                  <div className="flex items-center gap-1.5 hover:text-white transition-colors">
                    {e.toolName ? (
                      <>
                        <Code className="w-3 h-3" />
                        <span className="font-mono">{e.toolName}</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        <span className="cursor-pointer">View Results</span>
                      </>
                    )}
                  </div>
                  <span className="tabular-nums text-white/70">{durationSec} sec</span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {running && !paused && (
           <motion.div
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             className="bg-black/20 backdrop-blur-md border border-white/10 rounded-none p-6 w-full flex flex-col gap-4 overflow-hidden shadow-2xl"
           >
             <div className="flex items-center gap-3">
               <div className="w-5 h-5 border-2 border-white rounded-full animate-pulse shrink-0" />
               <span className="font-bold text-white text-base tracking-tight">Skill is working...</span>
             </div>
           </motion.div>
        )}

        {paused && (
           <motion.div
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             className="bg-black/40 backdrop-blur-md border border-yellow-500/50 rounded-none p-6 w-full flex items-center justify-between cursor-pointer hover:bg-black/60 transition-colors shadow-lg shadow-black/10 animate-pulse"
             onClick={onDecisionClick}
           >
             <div className="flex items-center gap-3">
               <HelpCircle className="w-5 h-5 text-yellow-500 shrink-0" />
               <div>
                  <h3 className="font-bold text-white text-base tracking-tight">Strategic Decision Required</h3>
                  <p className="text-sm text-white/70 font-medium mt-0.5">I found conflicting reports on their new EV timeline...</p>               </div>
             </div>
             <ChevronDown className="w-5 h-5 text-white/50 -rotate-90" />
           </motion.div>
        )}

        {hasReport && (
           <motion.div
             initial={{ opacity: 0, y: 16 }}
             animate={{ opacity: 1, y: 0 }}
             className="bg-black/20 backdrop-blur-md border border-white/10 rounded-none w-full flex flex-col cursor-pointer hover:bg-black/30 transition-colors shadow-2xl"
             onClick={onViewReport}
           >
             <div className="p-6 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <CheckCircle className="w-5 h-5 text-white shrink-0" />
                   <div>
                      <h3 className="font-bold text-white text-base tracking-tight">Your report is now ready</h3>
                      <p className="text-sm text-white/70 font-medium mt-0.5">Click to see the final intelligence report.</p>
                   </div>
                 </div>
                 <ChevronDown className="w-5 h-5 text-white/50 -rotate-90" />
             </div>
             {metrics && (
                 <div className="border-t border-white/10 bg-black/20 px-6 py-3 flex flex-wrap gap-4 text-[11px] font-medium text-white/50">
                    <span className="flex items-center gap-1.5"><span className="text-white/70">Docs:</span> {metrics.documentCount}</span>
                    <span className="flex items-center gap-1.5"><span className="text-white/70">Time:</span> {metrics.durationSecs}s</span>
                    <span className="flex items-center gap-1.5"><span className="text-white/70">Tokens:</span> {metrics.tokenCount.toLocaleString()}</span>
                 </div>
             )}
           </motion.div>
        )}

        <div ref={endRef} className="h-4 w-full" />
      </div>
    </div>
  );
}
