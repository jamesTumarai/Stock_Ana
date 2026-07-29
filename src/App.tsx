import { LandingView } from './LandingView';
import { HistoryModal } from './components/HistoryModal';
import { auth, db, googleProvider } from './lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import React, { useState, useRef, useEffect } from 'react';
import { FadingVideo } from './components/FadingVideo';
import { Search, Loader2, X, ChevronDown, History, LogOut, Hexagon, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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

export interface TechnicalAnalysis {
  signal_summary: {
    status: string;
    trend_weekly: string;
    trend_daily: string;
    trend_4h: string;
    confluence_score: string;
  };
  key_levels: {
    current_price?: number;
    support: string[];
    resistance: string[];
  };
  trade_plan: {
    entry_zone: string;
    stop_loss: string;
    target_1: string;
    target_2: string;
    risk_reward_ratio: string;
  };
  overall_trend: string;
  price_structure: string;
  volume_analysis: string;
  trend_indicators: string;
  momentum_indicators: string;
  volatility_indicators: string;
  chart_patterns: string;
  relative_strength: string;
  technical_risks: string;
  beginner_summary: {
    technical_overview: string;
    top_3_points: string[];
    top_3_cautions: string[];
    suitable_trade_style: string;
  };
  scoring: {
    trend_clarity: { score: number; reason: string };
    momentum_strength: { score: number; reason: string };
    risk_reward: { score: number; reason: string };
    signal_confluence: { score: number; reason: string };
    false_signal_risk: { score: number; reason: string };
    overall_attractiveness: { score: number; reason: string };
  };
  final_verdict_summary: {
    is_good_timing: string;
    what_to_wait_for: string;
    trade_plan: string;
  };
}

export interface ReportData {
  ticker?: string;
  verdict?: {
    summary: string;
    conviction_score: number;
    key_takeaways: string[];
  };
  analysis_type?: 'fundamental' | 'technical';
  comprehensive_analysis?: ComprehensiveAnalysis;
  technical_analysis?: TechnicalAnalysis;
  deep_insights?: DeepInsight[];
  findings?: DocumentFinding[];
  financial_charts?: {
    stock_price_history: { date: string; price: number }[];
    financial_performance_4q: { quarter: string; revenue?: number; net_income?: number; distributions?: number }[];
  };
}

// Toggle this to true if you want the JSON logs to be downloaded automatically after a run.
const ENABLE_JSON_DOWNLOAD = false;


function CustomSelect({ 
  value, 
  onChange, 
  options, 
  disabled, 
  className,
  direction = 'down'
}: { 
  value: string, 
  onChange: (v: string) => void, 
  options: {value: string, label: string}[], 
  disabled: boolean, 
  className?: string,
  direction?: 'up' | 'down'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const selectedOption = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className?.includes('flex-1') ? 'flex-1 min-w-0' : ''}`} ref={containerRef}>
      <button 
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-1 text-sm rounded px-2 py-1.5 outline-none cursor-pointer focus:ring-1 focus:ring-stone-500 disabled:opacity-50 bg-black/20 backdrop-blur-md border border-white/10 text-white transition-colors hover:bg-black/40 w-full ${className || ''}`}
      >
        <span className="truncate min-w-0">{selectedOption.label}</span>
        <ChevronDown className={`w-3 h-3 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: direction === 'up' ? 5 : -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: direction === 'up' ? 5 : -5, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={`absolute ${direction === 'up' ? 'bottom-full mb-1.5 right-0' : 'top-full mt-1.5 left-0'} min-w-[140px] bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl z-50 p-1 flex flex-col`}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors ${value === opt.value ? 'bg-white/10 text-white font-medium' : 'text-stone-300 hover:bg-white/5 hover:text-white'}`}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const [ticker, setTicker] = useState('');
  const [instruction, setInstruction] = useState('');
  const [analysisType, setAnalysisType] = useState<'fundamental' | 'technical' | 'combined'>('combined');
  
  const [selectedModel, setSelectedModel] = useState<string>('perseus');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('Thai');
  const [useSelfConsistency, setUseSelfConsistency] = useState<boolean>(true);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentReport, setCurrentReport] = useState<ReportData | null>(null);
  const [pastReports, setPastReports] = useState<ReportData[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const eventIdRef = useRef(0);
  const [tokenCount, setTokenCount] = useState<number>(0);
  const [toolRuns, setToolRuns] = useState<number>(0);
  const [durationSecs, setDurationSecs] = useState<number>(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  
  const [user, setUser] = useState<User | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyReports, setHistoryReports] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchHistory(currentUser.uid);
      } else {
        setHistoryReports([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const fetchHistory = async (userId: string) => {
    try {
      console.log("Fetching history for user: ", userId);
      const q = query(
        collection(db, "reports"), 
        where("userId", "==", userId)
      );
      const querySnapshot = await getDocs(q);
      let reports = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      // Sort client-side to avoid requiring composite index
      reports.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt?.toMillis?.() || new Date(a.createdAt).getTime() || 0);
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt?.toMillis?.() || new Date(b.createdAt).getTime() || 0);
        return timeB - timeA;
      });
      console.log("Fetched history count: ", reports.length);
      setHistoryReports(reports);
    } catch (error: any) {
      console.error("Error fetching history: ", error);
      alert("Failed to fetch history: " + error.message);
    }
  };

  const deleteReports = async (reportIds: string | string[]) => {
    if (!user) return;
    const ids = Array.isArray(reportIds) ? reportIds : [reportIds];
    try {
      for (const id of ids) {
        await deleteDoc(doc(db, "reports", id));
      }
      console.log("Reports deleted successfully!");
      setHistoryReports(prev => prev.filter(r => !ids.includes(r.id)));
    } catch (error: any) {
      console.error("Error deleting reports: ", error);
      alert("Failed to delete reports: " + error.message);
    }
  };

  const saveReportToFirebase = async (reportData: ReportData) => {
    if (!user) return;
    try {
      console.log("Saving report to Firebase...", { ticker, userId: user.uid });
      await addDoc(collection(db, "reports"), {
        userId: user.uid,
        ticker: ticker.toUpperCase(),
        language: selectedLanguage,
        createdAt: serverTimestamp(),
        data: reportData
      });
      console.log("Report saved successfully!");
      fetchHistory(user.uid);
    } catch (error) {
      console.error("Error saving report: ", error);
      alert("Failed to save report: " + error.message);
    }
  };


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
    aType: string,
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
          language: selectedLanguage,
          analysisType: aType,
          useSelfConsistency: useSelfConsistency
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
              } else if (evt.type === 'error') {
                  setErr(evt.message);
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
            if (foundData) setRep({ ...foundData, analysis_type: aType, ticker: ticker.trim() });
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
          if (finalData) {
            const finalRep = { ...finalData, analysis_type: aType, ticker: ticker.trim() };
            setRep(finalRep);
            if (finalRep) {
               saveReportToFirebase(finalRep);
            }
          }
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

  const resetAnalysis = () => {
    if (running && abortRef.current) {
      abortRef.current.abort();
    }
    setRunning(false);
    setTicker('');
    setEvents([]);
    setPastReports([]);
    setCurrentReport(undefined);
    setIsReportOpen(false);
    window.scrollTo(0, 0);
  };

  const runAnalysis = () => {
    if (!ticker.trim() || running) return;
    
    // Reset old data when running a new analysis
    setPastReports([]);
    setCurrentReport(null);
    
    setIsReportOpen(false);
    window.scrollTo(0, 0);
    
    startStream(selectedModel, analysisType, setRunning, setError, setCurrentReport, setEvents, pushEvent, setTokenCount, setToolRuns, setDurationSecs, setStartTime, abortRef, eventIdRef);
  };

  const handleCloseReport = () => {
    const reportContainer = document.getElementById('report-scroll-container');
    if (reportContainer && reportContainer.scrollTop > 0) {
      reportContainer.scrollTo({ top: 0, behavior: 'smooth' });
      
      const checkScroll = setInterval(() => {
        if (reportContainer.scrollTop <= 5) {
          clearInterval(checkScroll);
          setIsReportOpen(false);
          setTimeout(() => window.scrollTo(0, 0), 10);
        }
      }, 50);

      // Fallback timeout in case the scroll takes too long or gets stuck
      setTimeout(() => {
        clearInterval(checkScroll);
        setIsReportOpen(false);
        setTimeout(() => window.scrollTo(0, 0), 10);
      }, 1500);
      
    } else {
      setIsReportOpen(false);
      setTimeout(() => window.scrollTo(0, 0), 10);
    }
  };

  const allReports = [...pastReports, ...(currentReport ? [currentReport] : [])];

  if (isReportOpen && allReports.length > 0) {
    return (
      <div id="report-scroll-container" className="w-full h-full overflow-y-auto bg-[#F6F4F0] text-stone-900 font-sans print:h-auto print:overflow-visible print:block">
        <div className="w-full border-b border-stone-200 px-4 md:px-[40px] py-4 flex flex-col sm:flex-row items-center justify-between sticky top-0 z-50 bg-[#F6F4F0] print:static print:bg-white shadow-sm gap-4 sm:gap-0">
          <div className="font-display uppercase font-bold text-stone-900 text-lg tracking-wider flex items-center gap-2">
            {selectedLanguage === 'Thai' ? `การวิเคราะห์เอกสาร ${ticker}` : `${ticker} Document Analysis`}
          </div>
          <div className="flex items-center gap-4 print:hidden">
            <button 
              onClick={handleCloseReport}
              className="text-stone-700 hover:text-stone-900 transition-colors flex items-center justify-center p-2"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <div className="flex flex-col">
          {allReports.map((report, idx) => (
             <ReportTemplate 
               key={idx}
               data={report} 
               ticker={ticker} 
               onClose={handleCloseReport}
               durationSecs={idx === allReports.length - 1 ? durationSecs : undefined}
               toolRuns={idx === allReports.length - 1 ? toolRuns : undefined}
               tokenCount={idx === allReports.length - 1 ? tokenCount : undefined}
               documentCount={report.findings?.length || 0}
               historyReports={historyReports}
               language={selectedLanguage}
               hideHeader={true}
             />
          ))}
        </div>
      </div>
    );
  }

  const isLanding = !running && allReports.length === 0 && events.length === 0;

  return (
    <div className="relative h-full w-full bg-black overflow-hidden font-sans text-stone-100 flex flex-col">
      <AnimatePresence>
        {isHistoryModalOpen && (
          <HistoryModal 
            onClose={() => setIsHistoryModalOpen(false)} 
            reports={historyReports}
            onDelete={deleteReports}
            onSelect={(report) => {
              setTicker(report.ticker);
              setSelectedLanguage(report.language || 'English');
              setCurrentReport({ ...report.data, ticker: report.ticker });
              setPastReports([]);
              setIsHistoryModalOpen(false);
              setIsReportOpen(true);
            }} 
          />
        )}
      </AnimatePresence>



      <FadingVideo 
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_080021_d598092b-c4c2-4e53-8e46-94cf9064cd50.mp4" 
        className="absolute left-1/2 top-0 -translate-x-1/2 object-cover object-top z-0" 
        style={{ width: "120%", height: "120%" }} 
      />
      
      {/* Header */}
      <header className={`flex items-center justify-between px-4 md:px-6 py-4 print:hidden absolute top-0 w-full z-50 bg-transparent`}>
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-xl tracking-wider uppercase text-white drop-shadow-md">COIN KING</span>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          {user ? (
            <div className="flex items-center gap-1 md:gap-4">
              <button 
                onClick={() => setIsHistoryModalOpen(true)}
                className="text-xs md:text-sm font-medium text-white/80 hover:text-white p-2 md:px-2 md:py-1.5 flex items-center gap-1"
                title="History"
              >
                <History className="w-5 h-5 md:hidden" />
                <span className="hidden md:inline">History</span>
              </button>
              <button 
                onClick={handleLogout}
                className="text-xs md:text-sm font-medium text-white/80 hover:text-white p-2 md:px-2 md:py-1.5 flex items-center gap-1"
                title="Logout"
              >
                <LogOut className="w-5 h-5 md:hidden" />
                <span className="hidden md:inline">Logout</span>
              </button>
              <img src={user.photoURL || ''} alt="avatar" className="w-7 h-7 md:w-8 md:h-8 rounded-full border border-white/20 ml-1" />
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="text-xs md:text-sm font-medium text-white/80 hover:text-white px-3 py-1.5 border border-white/20 rounded-full hover:bg-white/10 transition-colors"
            >
              Sign In
            </button>
          )}
          <div className="hidden md:flex items-center gap-2 md:gap-3">
            <CustomSelect
              value={analysisType}
              onChange={(v) => setAnalysisType(v as any)}
              disabled={running}
              options={[
                { value: 'fundamental', label: 'Fundamental Analysis' },
                { value: 'technical', label: 'Technical Analysis' },
                { value: 'combined', label: 'Fundamental + Technical' },
              ]}
            />
            <CustomSelect
              value={selectedLanguage}
              onChange={setSelectedLanguage}
              disabled={running}
              options={[
                { value: 'English', label: 'English' },
                { value: 'Thai', label: 'ภาษาไทย' },
              ]}
            />
            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 shadow-sm cursor-pointer hover:bg-white/10 transition-colors" onClick={() => !running && setUseSelfConsistency(!useSelfConsistency)}>
              <div className={`w-4 h-4 rounded border flex items-center justify-center ${useSelfConsistency ? 'bg-white border-white' : 'border-white/30'}`}>
                {useSelfConsistency && <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
              </div>
              <span className="text-[11px] md:text-xs text-white/90 font-medium whitespace-nowrap select-none">
                {selectedLanguage === 'Thai' ? 'คิดเชิงลึก' : 'Deep Think'}
              </span>
            </div>
            <CustomSelect
              value={selectedModel}
              onChange={setSelectedModel}
              disabled={running}
              options={[
                { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
                { value: 'perseus', label: 'Gemini 3.6 Flash' },
              ]}
            />
          </div>
        </div>
      </header>

      <main className={`relative z-10 flex-1 flex flex-col min-h-0 print:hidden ${isLanding ? '' : 'pt-20'}`}>
        {isLanding ? (
           <LandingView language={selectedLanguage} />
        ) : (
           <div className="flex-1 flex flex-row overflow-hidden pb-64 md:pb-40 gap-4 px-4 min-h-0 max-w-4xl mx-auto w-full mt-4">
              <div className="flex-1 flex flex-col liquid-glass rounded-[1.25rem] overflow-hidden min-h-0">
                <div className="p-4 bg-white/5 border-b border-white/10 font-bold text-white text-sm flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <img src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg" alt="Gemini Sparkle" className="w-5 h-5" />
                    <span>{selectedModel === 'gemini-3.5-flash' ? 'Gemini 3.5 Flash' : 'Gemini 3.6 Flash'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {running && <Loader2 className="w-4 h-4 animate-spin text-white/60" />}
                    {!running && (
                      <button 
                        onClick={resetAnalysis}
                        className="text-white/60 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                        title={selectedLanguage === 'Thai' ? 'ปิดและเริ่มใหม่' : 'Close and Reset'}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar relative z-10">
                  <AgentTimeline 
                    events={events} 
                    running={running} 
                    hasReport={allReports.length > 0 && !isReportOpen}
                    onViewReport={() => setIsReportOpen(true)}
                    metrics={currentReport ? { durationSecs, tokenCount, documentCount: currentReport.findings?.length || 0 } : undefined}
                  />
                </div>
              </div>
           </div>
        )}

        {/* Input area fixed at bottom */}
        <div className={`mt-auto px-4 md:px-6 pb-6 md:pb-8 pt-4 w-full fixed bottom-0 print:hidden z-50 bg-transparent pointer-events-none`}>
          <div className="max-w-4xl mx-auto w-full pointer-events-auto">
            {error && (
              <div className="mb-4 bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}
            
            <div className={`liquid-glass !overflow-visible border-white/20 border rounded-xl shadow-2xl p-1.5 md:p-2 w-full flex flex-col md:flex-row md:items-center gap-1 md:gap-2 relative z-30 transition-all focus-within:border-white/40 focus-within:ring-1 focus-within:ring-white/40`}>
              
              {/* Row 1 on mobile: Ticker & Analyze button */}
              <div className="flex items-center gap-2 md:w-auto w-full border-b border-white/20 md:border-b-0 md:border-r pb-1.5 md:pb-0 pr-0 md:pr-3 pl-2 py-1 md:py-2">
                 <div className="flex items-center gap-2 flex-1">
                   <Search className="w-4 h-4 md:w-5 md:h-5 shrink-0 text-white/60" />
                   <input 
                     type="text"
                     value={ticker}
                     onChange={(e) => setTicker(e.target.value)}
                     placeholder="US TICKER" 
                     disabled={running}
                     className={`bg-transparent border-none outline-none w-full md:w-28 font-mono uppercase text-sm md:text-base text-white placeholder-white/40`}
                     onKeyDown={(e) => e.key === 'Enter' && runAnalysis()} onBlur={() => window.scrollTo(0, 0)}
                   />
                 </div>
                 {/* Analyze button on mobile */}
                 <button 
                  onClick={runAnalysis}
                  disabled={!ticker.trim() || running}
                  className={`md:hidden bg-white text-black hover:bg-white/90 disabled:bg-white/20 disabled:text-white/40 disabled:cursor-not-allowed px-4 py-1.5 rounded-lg font-medium transition-colors text-xs flex items-center justify-center w-24`}
                 >
                  {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Analyze"}
                 </button>
              </div>
              
              {/* Row 2 on mobile: Instructions */}
              <input 
                type="text"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                disabled={running}
                placeholder="Optional custom instructions..."
                className={`bg-transparent border-none outline-none flex-1 px-2 py-1.5 md:py-0 text-sm md:text-base text-white placeholder-white/50 border-b border-white/20 md:border-none`}
                onKeyDown={(e) => e.key === 'Enter' && runAnalysis()} onBlur={() => window.scrollTo(0, 0)}
              />

              {/* Mobile Controls */}
              <div className="md:hidden flex items-center gap-1.5 shrink-0 justify-between py-1 px-1">
                   <CustomSelect
                     direction="up"
                     value={analysisType}
                     onChange={(v) => setAnalysisType(v as any)}
                     disabled={running}
                     className="text-[11px] px-2 py-1.5 bg-white/10 border-white/20 text-white flex-1"
                     options={[
                       { value: 'fundamental', label: 'Fund' },
                       { value: 'technical', label: 'Tech' },
                       { value: 'combined', label: 'Both' },
                     ]}
                   />
                   <CustomSelect
                     direction="up"
                     value={selectedLanguage}
                     onChange={setSelectedLanguage}
                     disabled={running}
                     className="text-[11px] px-2 py-1.5 bg-white/10 border-white/20 text-white flex-1"
                     options={[
                       { value: 'English', label: 'EN' },
                       { value: 'Thai', label: 'TH' },
                     ]}
                   />
                   <CustomSelect
                     direction="up"
                     value={selectedModel}
                     onChange={setSelectedModel}
                     disabled={running}
                     className="text-[11px] px-2 py-1.5 bg-white/10 border-white/20 text-white flex-1"
                     options={[
                       { value: 'gemini-3.5-flash', label: '3.5' },
                       { value: 'perseus', label: '3.6' },
                     ]}
                   />
                   <div className="flex items-center gap-1.5 bg-white/10 px-2 py-1.5 rounded border border-white/20 cursor-pointer flex-1 justify-center" onClick={() => !running && setUseSelfConsistency(!useSelfConsistency)}>
                     <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${useSelfConsistency ? 'bg-white border-white' : 'border-white/30'}`}>
                       {useSelfConsistency && <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                     </div>
                     <span className="text-[10px] md:text-[11px] text-white/90 font-medium whitespace-nowrap">{selectedLanguage === 'Thai' ? 'คิดเชิงลึก' : 'Deep Think'}</span>
                   </div>
              </div>

              {/* Analyze button on desktop */}
              <button 
                onClick={runAnalysis}
                disabled={!ticker.trim() || running}
                className={`hidden md:flex bg-white text-black hover:bg-white/90 disabled:bg-white/20 disabled:text-white/40 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-medium transition-colors md:ml-2 tracking-wide text-sm items-center justify-center min-w-[100px] w-auto mt-0`}
              >
                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : "Analyze"}
              </button>
            </div>
            <div className="text-center mt-4">
              <span className="text-xs text-white/40 font-mono tracking-wider">{selectedLanguage === 'Thai' ? 'Gemini อาจให้ข้อมูลผิดพลาดได้ โปรดตรวจสอบด้วยตนเองและไม่ควรใช้เป็นคำแนะนำทางการลงทุน' : 'Gemini can make mistakes, don’t rely on it for financial advice.'}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
