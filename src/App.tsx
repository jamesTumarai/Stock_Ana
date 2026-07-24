import { LandingView } from './LandingView';
import React, { useState, useRef, useEffect } from 'react';
import { FadingVideo } from './components/FadingVideo';
import { Search, Loader2 } from 'lucide-react';
import ReportTemplate from "./ReportTemplate";
import { AgentTimeline, TimelineEvent } from './components/AgentTimeline';

export interface DocumentFinding {
  documentType?: string;
  document_type?: string;
  keyInsights?: string[];
  key_insights?: string[];
  date?: string;
  sourceUrl?: string;
  source_url?: string;
}

export interface DeepInsight {
  category: string;
  title: string;
  description: string;
  impact_score: number;
}

export interface ComprehensiveAnalysis {
  business_overview: string;
  target_customers: string;
  revenue_model: string;
  financial_overview: string;
  fundamentals_check: string;
  business_strengths: string;
  future_growth: string;
  key_risks: string;
  management: string;
  beginner_summary: {
    business_type_simple: string;
    top_3_strengths: string[];
    top_3_risks: string[];
    suitable_investor_type: string;
    further_reading: string;
  };
  scoring: {
    understandability: { score: number; reason: string };
    revenue_quality: { score: number; reason: string };
    financial_strength: { score: number; reason: string };
    growth_potential: { score: number; reason: string };
    risk_level: { score: number; reason: string };
    overall_attractiveness: { score: number; reason: string };
  };
  final_verdict_summary: {
    worth_further_study: string;
    strong_fundamentals: string;
    what_to_look_for: string;
  };
}

export interface ReportData {
  verdict?: {
    summary: string;
    conviction_score: number;
    key_takeaways: string[];
  };
  comprehensive_analysis?: ComprehensiveAnalysis;
  deep_insights?: DeepInsight[];
  findings?: DocumentFinding[];
  financial_charts?: {
    stock_price_4m: { date: string; price: number }[];
    financial_performance_4q: { quarter: string; revenue?: number; net_income?: number; distributions?: number }[];
  };
}

// Toggle this to true if you want the JSON logs to be downloaded automatically after a run.
const ENABLE_JSON_DOWNLOAD = false;

export default function App() {
  const [ticker, setTicker] = useState('');
  const [instruction, setInstruction] = useState('');
  
  const [selectedModel, setSelectedModel] = useState<string>('perseus');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('Thai');

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const eventIdRef = useRef(0);
  const [tokenCount, setTokenCount] = useState<number>(0);
  const [toolRuns, setToolRuns] = useState<number>(0);
  const [durationSecs, setDurationSecs] = useState<number>(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (running && startTime) {
      interval = setInterval(() => {
        setDurationSecs(Math.round((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [running, startTime]);

  const stopAgent = () => {
    if (abortRef.current) abortRef.current.abort();
    setRunning(false);
  };

  const pushEvent = (kind: TimelineEvent['kind'], label: string, detail?: string, toolName?: string, callId?: string) => {
    const now = Date.now();
    setEvents((prev: any) => {
      const newEvents = [...prev];
      if (newEvents.length > 0) {
        const lastIndex = newEvents.length - 1;
        if (!newEvents[lastIndex].endTime) {
          newEvents[lastIndex] = { ...newEvents[lastIndex], endTime: now };
        }
      }
      newEvents.push({ id: eventIdRef.current++, kind, label, detail, toolName, startTime: now, callId });
      return newEvents;
    });
  };


        const parseFinalText = (text: string) => {
            if (!text) return null;
            try {
                let foundData = null;
                const matches = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/g)];
                for (let i = matches.length - 1; i >= 0; i--) {
                    try {
                        const parsed = JSON.parse(matches[i][1]);
                        if (parsed && (parsed.verdict || parsed.findings || parsed.deep_insights)) {
                            foundData = parsed;
                            break;
                        }
                    } catch (e) {}
                }
                
                if (!foundData) {
                    const firstBrace = text.indexOf('{');
                    const lastBrace = text.lastIndexOf('}');
                    if (firstBrace !== -1 && lastBrace > firstBrace) {
                        try {
                            const possibleJson = text.slice(firstBrace, lastBrace + 1);
                            const parsed = JSON.parse(possibleJson);
                            if (parsed && (parsed.verdict || parsed.findings || parsed.deep_insights)) {
                                foundData = parsed;
                            }
                        } catch (e) {
                            const match = text.match(/\{\s*"verdict"[\s\S]*?\}\s*\}/);
                            if (match) {
                                try {
                                    const parsed = JSON.parse(match[0]);
                                    if (parsed && parsed.verdict) {
                                        foundData = parsed;
                                    }
                                } catch(e2) {}
                            }
                        }
                    }
                }
                return foundData;
            } catch (e) {
                return null;
            }
        };

  const startStream = async (
    model: string,
    setRun: any,
    setErr: any,
    setRep: any,
    setEvts: any,
    pushEvt: any,
    setTok: any,
    setTRuns: any,
    setDur: any,
    setStart: any,
    aRef: any,
    eIdRef: any
  ) => {
    setRun(true);
    setErr(null);
    setRep(null);
    setEvts([]);
    setTok(0);
    setTRuns(0);
    setDur(0);
    setStart(Date.now());
    eIdRef.current = 0;

    const controller = new AbortController();
    aRef.current = controller;
    const startTimestamp = Date.now();
    let currentToolRuns = 0;

    try {
      const resp = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: ticker.trim(),
          instruction: instruction.trim() || undefined,
          origin: window.location.origin,
          model: model,
          language: selectedLanguage
        }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        throw new Error(`Server responded ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        if (controller.signal.aborted) break;

        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') continue;
            try {
              const evt = JSON.parse(dataStr);
              if (evt.type === 'text' && evt.text) {
                  accumulatedText += evt.text;
              } else if (evt.type === 'tool_call') {
                  currentToolRuns += 1;
                  setTRuns(currentToolRuns);
                  let label = "Searching for documents...";
                  if (evt.name === "google_search") {
                    label = `Searching web: ${evt.arguments?.query || ''}`;
                  } else if (evt.name) {
                    label = `Using tool: ${evt.name}`;
                  }
                  pushEvt('tool_call', label, JSON.stringify(evt.arguments, null, 2), evt.name, evt.callId);
              } else if (evt.type === 'tool_result') {
                  pushEvt('tool_result', `Analysis retrieved`, evt.result, undefined, evt.callId);
              } else if (evt.type === 'thinking') {
                  pushEvt('thinking', `Analyzing...`, evt.text);
              } else if (evt.type === 'complete') {
                  if (evt.interaction) {
                      const interaction = evt.interaction;
                      const usage = interaction.usage || interaction.usage_metadata || (interaction.metadata && interaction.metadata.usage) || null;
                      if (usage) {
                          const tokens = usage.total_token_count || usage.totalTokenCount || usage.total_tokens || 0;
                          if (tokens > 0) {
                              setTok(tokens);
                          }
                      }
                  }
              } else if (evt.type === 'final_stats') {
                  if (evt.tokens > 0) setTok(evt.tokens);
                  if (evt.duration > 0) setDur(Math.round(evt.duration));
                  if (ENABLE_JSON_DOWNLOAD && evt.jsonlLogUrl) {
                      fetch(evt.jsonlLogUrl)
                        .then(res => res.blob())
                        .then(blob => {
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = evt.jsonlLogUrl.split('/').pop() || 'run_log.jsonl';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            window.URL.revokeObjectURL(url);
                        })
                        .catch(err => console.error('Failed to download log:', err));
                  }
              }
            } catch { /* skip malformed */ }
          }
        }
        
        if (accumulatedText) {
            const foundData = parseFinalText(accumulatedText);
            if (foundData) setRep(foundData);
        }
      }
      
      if (buffer) {
          try {
              const lines = buffer.split('\n\n');
              for (const line of lines) {
                  if (line.startsWith('data: ')) {
                      const dataStr = line.slice(6);
                      if (dataStr === '[DONE]') continue;
                      const evt = JSON.parse(dataStr);
                      if (evt.type === 'text' && evt.text) {
                          accumulatedText += evt.text;
                      }
                  }
              }
          } catch(e) {}
      }
      
      if (accumulatedText) {
          const finalData = parseFinalText(accumulatedText);
          if (finalData) setRep(finalData);
      }
      
      setDur(Math.round((Date.now() - startTimestamp) / 1000));
      setRun(false);
      
    } catch (e: any) {
      if (e.name === 'AbortError') {
         console.log('Aborted');
      } else {
         setErr(e.message || 'Unknown error');
      }
      setDur(Math.round((Date.now() - startTimestamp) / 1000));
      setRun(false);
    }
  };

  const runAnalysis = () => {
    if (!ticker.trim() || running) return;
    setIsReportOpen(false);
    
    startStream(selectedModel, setRunning, setError, setReportData, setEvents, pushEvent, setTokenCount, setToolRuns, setDurationSecs, setStartTime, abortRef, eventIdRef);
  };

  if (isReportOpen && reportData) {
    return (
      <div className="w-full h-screen print:h-auto">
         <ReportTemplate 
           data={reportData} 
           ticker={ticker} 
           onClose={() => setIsReportOpen(false)}
           durationSecs={durationSecs}
           toolRuns={toolRuns}
           tokenCount={tokenCount}
           documentCount={reportData.findings?.length || 0}
           language={selectedLanguage}
         />
      </div>
    );
  }

  const isLanding = !running && !reportData && events.length === 0;

  return (
    <div className="relative h-screen bg-black overflow-hidden font-sans text-stone-100 flex flex-col">
      <FadingVideo 
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_080021_d598092b-c4c2-4e53-8e46-94cf9064cd50.mp4" 
        className="absolute left-1/2 top-0 -translate-x-1/2 object-cover object-top z-0" 
        style={{ width: "120%", height: "120%" }} 
      />
      
      {/* Header */}
      <header className={`flex items-center justify-between px-6 py-4 print:hidden absolute top-0 w-full z-50 bg-transparent`}>
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-xl tracking-wider uppercase text-white">Coin King</span>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            disabled={running}
            className={`text-sm rounded px-3 py-1.5 outline-none cursor-pointer focus:ring-1 focus:ring-stone-500 disabled:opacity-50 bg-black/20 backdrop-blur-md border border-white/10 text-white`}
          >
            <option value="English">English</option>
            <option value="Thai">ภาษาไทย</option>
          </select>
          <select 
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={running}
            className={`text-sm rounded px-3 py-1.5 outline-none cursor-pointer focus:ring-1 focus:ring-stone-500 disabled:opacity-50 bg-black/20 backdrop-blur-md border border-white/10 text-white`}
          >
            <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
            <option value="perseus">Gemini 3.6 Flash</option>
          </select>
        </div>
      </header>

      <main className={`relative z-10 flex-1 flex flex-col min-h-0 print:hidden ${isLanding ? '' : 'pt-20'}`}>
        {isLanding ? (
           <LandingView language={selectedLanguage} />
        ) : (
           <div className="flex-1 flex flex-row overflow-hidden pb-32 gap-4 px-4 min-h-0 max-w-4xl mx-auto w-full mt-4">
              <div className="flex-1 flex flex-col liquid-glass rounded-[1.25rem] overflow-hidden min-h-0">
                <div className="p-4 bg-white/5 border-b border-white/10 font-bold text-white text-sm flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <img src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg" alt="Gemini Sparkle" className="w-5 h-5" />
                    <span>{selectedModel === 'gemini-3.5-flash' ? 'Gemini 3.5 Flash' : 'Gemini 3.6 Flash'}</span>
                  </div>
                  {running && <Loader2 className="w-4 h-4 animate-spin text-white/60" />}
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar relative z-10">
                  <AgentTimeline 
                    events={events} 
                    running={running} 
                    hasReport={!!reportData && !isReportOpen}
                    onViewReport={() => setIsReportOpen(true)}
                    metrics={reportData ? { durationSecs, tokenCount, documentCount: reportData.findings?.length || 0 } : undefined}
                  />
                </div>
              </div>
           </div>
        )}

        {/* Input area fixed at bottom */}
        <div className={`mt-auto px-6 pb-8 pt-4 w-full fixed bottom-0 print:hidden z-50 bg-transparent`}>
          <div className="max-w-4xl mx-auto w-full">
            {error && (
              <div className="mb-4 bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}
            
            <div className={`liquid-glass border-white/20 border rounded-xl shadow-2xl p-2 w-full flex items-center gap-2 relative z-30 transition-all focus-within:border-white/40 focus-within:ring-1 focus-within:ring-white/40`}>
              <div className={`pl-3 py-2 flex items-center gap-2 text-white/60 border-white/20 border-r pr-3`}>
                 <Search className="w-5 h-5" />
                 <input 
                   type="text" 
                   value={ticker}
                   onChange={(e) => setTicker(e.target.value)}
                   placeholder="US TICKER" 
                   disabled={running}
                   className={`bg-transparent border-none outline-none w-24 font-mono uppercase text-white placeholder-white/40`}
                   onKeyDown={(e) => e.key === 'Enter' && runAnalysis()}
                 />
              </div>
              <input 
                type="text" 
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                disabled={running}
                placeholder="Optional custom instructions..."
                className={`bg-transparent border-none outline-none flex-1 px-3 py-2 text-white placeholder-white/50`}
                onKeyDown={(e) => e.key === 'Enter' && runAnalysis()}
              />
              <button 
                onClick={runAnalysis}
                disabled={!ticker.trim() || running}
                className={`bg-white text-black hover:bg-white/90 disabled:bg-white/20 disabled:text-white/40 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-medium transition-colors ml-2 tracking-wide text-sm flex items-center justify-center min-w-[100px]`}
              >
                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : "Analyze"}
              </button>
            </div>
            
            <div className="text-center mt-4">
              <span className="text-xs text-white/40 font-mono tracking-wider">Gemini can make mistakes, don’t rely on it for financial advice.</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
