import { LandingView } from './LandingView';
import { HistoryModal } from './components/HistoryModal';
import { PortfolioModal } from './components/PortfolioModal';
import { AlertsModal } from './components/AlertsModal';
import { auth, db, firebaseDataAccessAllowed, googleProvider } from './lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import React, { useState, useRef, useEffect } from 'react';
import { CrossfadeVideo } from './components/CrossfadeVideo';
import { Search, Loader2, X, ChevronDown, History, LogOut, Hexagon, Crown, Sparkles, Printer, Copy, Check, ArrowUpRight, Briefcase, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReportTemplate from "./ReportTemplate";
import { ErrorBoundary } from './components/ErrorBoundary';
import { AgentTimeline, TimelineEvent } from './components/AgentTimeline';
import { MotionIntro } from './components/MotionIntro';
import { UserAvatar } from './components/UserAvatar';
import { CURRENT_GENERATED_BY_VERSION, CURRENT_REPORT_SCHEMA_VERSION, isLegacyHistoryReport, validateAndPrepareReport } from './utils/reportValidation';
import { fetchSecVerificationEnvelope } from './services/secVerificationService';
import { fetchLiveQuotes } from './services/marketDataService';
import { fetchDcfAssumptionProposal } from './services/dcfAssumptionService';
import { attachDcfAssumptionModel, hasValidDcfAssumptionModel } from './utils/valuation/dcfAssumptionProposal';
import { isSoftDeletedReportRecord, sanitizeUndefinedForPersistence } from './utils/firestorePersistence';
import { authenticatedFetch } from './services/authenticatedFetch';
import {
  loadMonitoringPreferences,
  saveMonitoringPreferences,
  loadReadAlertIds,
  saveReadAlertIds,
  evaluateAllAlerts
} from './utils/monitoringEngine';
import { loadLocalWatchlist, loadLocalPortfolio } from './utils/portfolioEngine';
import { SubscriptionModal } from './components/SubscriptionModal';
import {
  getActiveSubscriptionTier,
  setActiveSubscriptionTier,
  getStoredUserUsage,
  recordAnalysisUsage,
} from './services/subscriptionService';
import { evaluateAnalysisQuota } from './utils/entitlementEngine';
import type { SubscriptionTierId } from './domain/subscriptionTiers';

import { 
  DocumentFinding, 
  DeepInsight, 
  ComprehensiveAnalysis, 
  TechnicalAnalysis, 
  FinancialStatementsData,
  ValuationRatioItem,
  ValuationPercentileChart,
  IntrinsicValueData,
  EarningsAnalysisData,
  PeerComparisonData,
  CatalystsData,
  InsiderActivityData,
  AnalysisReport as ReportData 
} from './types';

export type { 
  DocumentFinding, 
  DeepInsight, 
  ComprehensiveAnalysis, 
  TechnicalAnalysis, 
  FinancialStatementsData,
  ValuationRatioItem,
  ValuationPercentileChart,
  IntrinsicValueData,
  EarningsAnalysisData,
  PeerComparisonData,
  CatalystsData,
  InsiderActivityData,
  ReportData 
};

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
  
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.8-flash');
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
  const [isSummaryCopied, setIsSummaryCopied] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  
  const [user, setUser] = useState<User | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isPortfolioOpen, setIsPortfolioOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [activeTier, setActiveTier] = useState<SubscriptionTierId>(() => getActiveSubscriptionTier());
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [historyReports, setHistoryReports] = useState<any[]>([]);
  const [monitoringPreferences, setMonitoringPreferences] = useState(() => loadMonitoringPreferences(user?.uid));
  const [readAlertIds, setReadAlertIds] = useState<Set<string>>(() => loadReadAlertIds(user?.uid));

  // Memoized ticker to latest report mapping for portfolio valuation intelligence
  const reportsByTicker = React.useMemo(() => {
    const map: Record<string, any> = {};
    for (const r of historyReports) {
      const t = (r.ticker || r.data?.ticker || '').toUpperCase().trim();
      if (t && !map[t]) {
        map[t] = r.data || r;
      }
    }
    if (currentReport?.ticker) {
      map[currentReport.ticker.toUpperCase().trim()] = currentReport;
    }
    return map;
  }, [historyReports, currentReport]);

  const alerts = React.useMemo(() => {
    const watchlist = loadLocalWatchlist(user?.uid);
    const portfolio = loadLocalPortfolio(user?.uid);
    const tracked = Array.from(new Set([
      ...watchlist,
      ...portfolio.map(h => h.ticker),
      ...historyReports.map(r => r.ticker || r.data?.ticker || ''),
      ...(ticker ? [ticker] : [])
    ])).filter(Boolean);

    return evaluateAllAlerts(
      tracked,
      reportsByTicker,
      {},
      historyReports,
      undefined,
      monitoringPreferences,
      readAlertIds
    );
  }, [user?.uid, reportsByTicker, historyReports, ticker, monitoringPreferences, readAlertIds]);

  const unreadAlertsCount = React.useMemo(() => alerts.filter(a => !a.isRead).length, [alerts]);

  const handleUpdatePreferences = (newPrefs: any) => {
    setMonitoringPreferences(newPrefs);
    saveMonitoringPreferences(newPrefs, user?.uid);
  };

  const handleMarkAlertAsRead = (alertId: string) => {
    setReadAlertIds(prev => {
      const next = new Set(prev);
      if (next.has(alertId)) next.delete(alertId);
      else next.add(alertId);
      saveReadAlertIds(next, user?.uid);
      return next;
    });
  };

  const handleMarkAllAlertsAsRead = () => {
    const allIds = new Set(alerts.map(a => a.id));
    setReadAlertIds(allIds);
    saveReadAlertIds(allIds, user?.uid);
  };

  // $100M Motion Intro State
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    try {
      return !sessionStorage.getItem('lumina_intro_seen');
    } catch (e) {
      return true;
    }
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setError(prev => (prev?.includes('เข้าสู่ระบบ') || prev?.includes('sign in') ? null : prev));
      }
      if (currentUser && firebaseDataAccessAllowed) {
        fetchHistory(currentUser.uid);
      } else {
        if (currentUser && !firebaseDataAccessAllowed) {
          console.warn('[firebase] Authenticated data access is blocked until this environment has its own Firebase configuration.');
        }
        setHistoryReports([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    if (!firebaseDataAccessAllowed) {
      setError('Firebase is not configured for this environment. Production Firebase access is blocked outside approved production hosts.');
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed", error);
      if (error?.code !== 'auth/popup-closed-by-user') {
        setError(error?.message || 'Login failed');
      }
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
    if (!firebaseDataAccessAllowed) return;
    try {
      console.log("Fetching history for user: ", userId);
      const q = query(
        collection(db, "reports"), 
        where("userId", "==", userId)
      );
      const querySnapshot = await getDocs(q);
      let reports = querySnapshot.docs
        .map(docSnap => {
          const record = { id: docSnap.id, ...docSnap.data() } as any;
          return { ...record, isLegacy: isLegacyHistoryReport(record) };
        })
        .filter(record => !isSoftDeletedReportRecord(record));
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
    if (!user || !firebaseDataAccessAllowed) return;
    const ids = Array.isArray(reportIds) ? reportIds : [reportIds];
    try {
      for (const id of ids) {
        await updateDoc(doc(db, "reports", id), {
          deletedAt: serverTimestamp(),
          deletedByUserId: user.uid,
          deletedByVersion: CURRENT_GENERATED_BY_VERSION,
        });
      }
      console.log("Reports soft-deleted successfully!");
      setHistoryReports(prev => prev.filter(r => !ids.includes(r.id)));
    } catch (error: any) {
      console.error("Error deleting reports: ", error);
      alert("Failed to delete reports: " + error.message);
    }
  };

  const saveReportToFirebase = async (reportData: ReportData) => {
    if (!user || !firebaseDataAccessAllowed) return;
    try {
      const persistedReport = sanitizeUndefinedForPersistence(reportData);
      console.log("Saving report to Firebase...", { ticker, userId: user.uid });
      await addDoc(collection(db, "reports"), {
        userId: user.uid,
        ticker: ticker.toUpperCase(),
        language: selectedLanguage,
        createdAt: serverTimestamp(),
        schemaVersion: reportData.schema_version ?? CURRENT_REPORT_SCHEMA_VERSION,
        generatedByVersion: reportData.generated_by_version ?? CURRENT_GENERATED_BY_VERSION,
        validationStatus: reportData.validation?.status ?? 'warning',
        data: persistedReport
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
    if (!firebaseDataAccessAllowed) {
      setErr('Firebase is not configured for this environment. Analysis is blocked to prevent production-account cross-environment access.');
      return;
    }
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
    const requestedTicker = ticker.trim().toUpperCase();
    const secVerificationPromise = aType === 'technical'
      ? Promise.resolve(null)
      : fetchSecVerificationEnvelope(requestedTicker, controller.signal);
    const marketSnapshotPromise = fetchLiveQuotes([requestedTicker]);
    const startTimestamp = Date.now();
    let currentToolRuns = 0;

    try {
      const resp = await authenticatedFetch('/api/analyze', {
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
                      authenticatedFetch(evt.jsonlLogUrl)
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
            if (foundData) {
              const prepared = validateAndPrepareReport(
                { ...foundData, analysis_type: aType, ticker: ticker.trim() },
                ticker.trim()
              );
              if (prepared.report) setRep(prepared.report);
            }
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
            const [secVerification, marketResponse] = await Promise.all([
              secVerificationPromise,
              marketSnapshotPromise,
            ]);
            let reportForValidation = finalData as ReportData;
            if (
              aType !== 'technical'
              && secVerification?.status === 'verified_eligible'
              && !hasValidDcfAssumptionModel(reportForValidation)
            ) {
              const proposal = await fetchDcfAssumptionProposal(
                requestedTicker,
                reportForValidation,
                secVerification,
                controller.signal,
              );
              if (proposal) {
                reportForValidation = attachDcfAssumptionModel(reportForValidation, proposal);
              }
            }

            const nowIso = new Date().toISOString();
            const prepared = validateAndPrepareReport(
              {
                ...reportForValidation,
                generated_at: reportForValidation.generated_at || nowIso,
                ...(secVerification ? { sec_verification: secVerification } : {}),
                analysis_type: aType,
                ticker: requestedTicker,
              },
              requestedTicker,
              {
                marketQuotes: marketResponse?.quotes,
                requireMarketSnapshot: aType !== 'technical',
              },
            );
            if (prepared.report) {
              setRep(prepared.report);
              recordAnalysisUsage(tokenCount || 0);
              if (prepared.canPersist) {
                await saveReportToFirebase(prepared.report);
              } else {
                console.warn('Report was rendered but not saved because critical validation failed.', prepared.validation.issues);
              }
            } else {
              setErr('The analysis response could not be validated as a report.');
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
    if (!user) {
      setError(selectedLanguage === 'Thai' ? 'กรุณาเข้าสู่ระบบก่อนเริ่มวิเคราะห์' : 'Please sign in before starting an analysis.');
      handleLogin();
      return;
    }

    const userUsage = getStoredUserUsage();
    const quotaCheck = evaluateAnalysisQuota(activeTier, userUsage, selectedLanguage === 'Thai');
    if (!quotaCheck.allowed) {
      setError(
        selectedLanguage === 'Thai'
          ? `โควตาการวิเคราะห์สำหรับแพ็กเกจ ${quotaCheck.tier} เต็มแล้ว (${quotaCheck.currentUsage}/${quotaCheck.limit}) กรุณาอัปเกรดเพื่อวิเคราะห์ต่อ`
          : `Monthly analysis quota reached for ${quotaCheck.tier} plan (${quotaCheck.currentUsage}/${quotaCheck.limit}). Please upgrade to continue.`
      );
      setIsSubscriptionOpen(true);
      return;
    }
    
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
      <div id="report-scroll-container" className="w-full h-[100dvh] overflow-y-auto bg-[#F6F4F0] text-stone-900 scrollbar-hide print:h-auto print:overflow-visible print:block print:bg-white">
        <div className="flex flex-col min-h-full print:min-h-0 print:block print:h-auto">
          {allReports.map((report, idx) => (
             <ErrorBoundary key={idx} name={`ReportTemplate-${report.ticker || ticker || idx}`} onReset={handleCloseReport}>
               <ReportTemplate 
                 data={report} 
                 ticker={report.ticker || ticker} 
                 onClose={handleCloseReport}
                 durationSecs={idx === allReports.length - 1 ? durationSecs : undefined}
                 toolRuns={idx === allReports.length - 1 ? toolRuns : undefined}
                 tokenCount={idx === allReports.length - 1 ? tokenCount : undefined}
                 documentCount={report.findings?.length || 0}
                 historyReports={historyReports}
                 language={selectedLanguage}
                 hideHeader={idx > 0}
                 model={selectedModel}
               />
             </ErrorBoundary>
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
              const historyData = { ...report.data, ticker: report.ticker } as ReportData;
              if (isLegacyHistoryReport(report) && !historyData.validation) {
                historyData.validation = {
                  status: 'warning',
                  schema_version: 0,
                  checked_at: new Date().toISOString(),
                  issues: [{
                    code: 'LEGACY_REPORT_UNVERIFIED',
                    severity: 'warning',
                    section: 'history',
                    message: 'Legacy report — generated before financial integrity validation. Re-analyze for verified data.',
                    path: 'history',
                  }],
                };
              }
              setCurrentReport(historyData);
              setPastReports([]);
              setIsHistoryModalOpen(false);
              setIsReportOpen(true);
            }} 
          />
        )}
      </AnimatePresence>

      {/* Portfolio & Watchlist Intelligence Modal */}
      <AnimatePresence>
        {isPortfolioOpen && (
          <PortfolioModal
            isOpen={isPortfolioOpen}
            onClose={() => setIsPortfolioOpen(false)}
            isThai={selectedLanguage === 'Thai'}
            user={user}
            onSelectTicker={(selectedTicker) => {
              setTicker(selectedTicker);
              setIsPortfolioOpen(false);
            }}
            latestReports={reportsByTicker}
          />
        )}
      </AnimatePresence>

      {/* Monitoring & Alerts Modal */}
      <AnimatePresence>
        {isAlertsOpen && (
          <AlertsModal
            isOpen={isAlertsOpen}
            onClose={() => setIsAlertsOpen(false)}
            isThai={selectedLanguage === 'Thai'}
            alerts={alerts}
            preferences={monitoringPreferences}
            onUpdatePreferences={handleUpdatePreferences}
            onMarkAsRead={handleMarkAlertAsRead}
            onMarkAllAsRead={handleMarkAllAlertsAsRead}
            onSelectTicker={(selectedTicker) => {
              setTicker(selectedTicker);
              setIsAlertsOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Subscription & Tier Entitlements Modal */}
      <AnimatePresence>
        {isSubscriptionOpen && (
          <SubscriptionModal
            isOpen={isSubscriptionOpen}
            onClose={() => setIsSubscriptionOpen(false)}
            isThai={selectedLanguage === 'Thai'}
            activeTier={activeTier}
            onSelectTier={(newTier) => {
              setActiveSubscriptionTier(newTier);
              setActiveTier(newTier);
            }}
          />
        )}
      </AnimatePresence>

      {/* Cinematic $100M Motion Intro */}
      <AnimatePresence>
        {showIntro && (
          <MotionIntro
            onComplete={() => {
              try {
                sessionStorage.setItem('lumina_intro_seen', 'true');
              } catch (e) {}
              setShowIntro(false);
            }}
            isThai={selectedLanguage === 'Thai'}
          />
        )}
      </AnimatePresence>

      {/* Global Background Video (New CloudFront Video) */}
      <div className="fixed inset-0 z-0 overflow-hidden bg-black pointer-events-none">
        <CrossfadeVideo
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ objectPosition: 'center 62%' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/45 pointer-events-none" />
      </div>
      
      {/* Header (shown during analysis or when viewing timeline) */}
      {!isLanding && (
        <header 
          className="relative w-full max-w-[1360px] mx-auto grid grid-cols-[1fr_auto_1fr] items-center px-3 sm:px-6 py-3 shrink-0 z-50 transition-all print:hidden gap-2"
          style={{
            animation: 'slideDown 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
          }}
        >
          {/* Column 1: Left Logo & Brand Title */}
          <div 
            onClick={resetAnalysis}
            className="flex items-center justify-start gap-2 sm:gap-2.5 shrink-0 cursor-pointer group z-10 min-w-0"
            title={selectedLanguage === 'Thai' ? 'กลับหน้าแรก' : 'Back to Home'}
          >
            <div
              className="rounded-full bg-white flex items-center justify-center shrink-0 shadow-[0_4px_14px_rgba(0,0,0,0.16)] transition-transform group-hover:scale-105 w-8 h-8 sm:w-9 sm:h-9"
            >
              <svg viewBox="0 0 24 24" className="w-[58%] h-[58%]" fill="#111111" stroke="none">
                <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
              </svg>
            </div>
            <span className="font-display font-bold text-sm sm:text-base md:text-lg tracking-wider uppercase text-white drop-shadow-md select-none hidden sm:inline-block whitespace-nowrap">
              COIN KING
            </span>
          </div>

          {/* Column 2: Center Floating White Nav Pill (EXACT 50% Mathematical True Center) */}
          <div className="flex items-center justify-center">
            <nav 
              className="hidden md:flex items-center bg-white rounded-full shadow-[0_4px_14px_rgba(0,0,0,0.16)] whitespace-nowrap z-0 scale-[0.85] lg:scale-95 xl:scale-100 transition-all origin-center shrink-0"
              style={{
                height: '38px',
                padding: '3px 8px',
                gap: '2px',
              }}
            >
              {[
                { id: 'combined', labelEn: 'All-in-One', labelTh: 'วิเคราะห์รวม' },
                { id: 'fundamental', labelEn: 'Fundamental', labelTh: 'ปัจจัยพื้นฐาน' },
                { id: 'technical', labelEn: 'Technical', labelTh: 'เทคนิคอล' },
              ].map((mode) => {
                const isActive = analysisType === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => !running && setAnalysisType(mode.id as any)}
                    disabled={running}
                    className={`relative px-3 py-1 font-medium transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 text-xs sm:text-[13px] ${
                      isActive 
                        ? 'text-[#2e2e2e] opacity-100 font-semibold' 
                        : 'text-[#2e2e2e] opacity-50 hover:opacity-75'
                    }`}
                  >
                    {selectedLanguage === 'Thai' ? mode.labelTh : mode.labelEn}
                    {isActive && (
                      <span 
                        className="absolute left-1/2 -translate-x-1/2 bottom-[3px] w-[2.5px] h-[2.5px] bg-black rounded-full shadow-[-4px_0_0_#000,4px_0_0_#000]" 
                      />
                    )}
                  </button>
                );
              })}

              {/* Deep Think toggle */}
              <div className="h-3.5 w-px bg-stone-300 mx-1 shrink-0" />
              <button
                onClick={() => !running && setUseSelfConsistency(!useSelfConsistency)}
                disabled={running}
                className={`px-2.5 py-0.5 font-medium transition-all duration-200 flex items-center gap-1 rounded-full cursor-pointer whitespace-nowrap shrink-0 text-xs ${
                  useSelfConsistency 
                    ? 'bg-black text-white shadow-sm font-semibold' 
                    : 'text-[#2e2e2e] opacity-60 hover:opacity-100 hover:bg-stone-100'
                }`}
                title="Deep Think Mode"
              >
                <Sparkles className={`w-3 h-3 shrink-0 ${useSelfConsistency ? 'text-yellow-300' : 'text-stone-600'}`} />
                <span>{selectedLanguage === 'Thai' ? 'คิดเชิงลึก' : 'Deep Think'}</span>
              </button>

              {/* Language Switch */}
              <div className="h-3.5 w-px bg-stone-300 mx-1 shrink-0" />
              <button
                onClick={() => !running && setSelectedLanguage(selectedLanguage === 'Thai' ? 'English' : 'Thai')}
                disabled={running}
                className="px-2 py-0.5 font-bold text-[#2e2e2e] opacity-75 hover:opacity-100 transition-opacity text-[11px] tracking-wider uppercase rounded-full cursor-pointer hover:bg-stone-100 shrink-0 whitespace-nowrap"
                title="Switch Language"
              >
                {selectedLanguage === 'Thai' ? 'EN' : 'ไทย'}
              </button>
            </nav>
          </div>

          {/* Column 3: Right Controls & User Profile (Aligned to the Right) */}
          <div className="flex items-center justify-end gap-2 sm:gap-3 shrink-0 z-10 min-w-0">
            {/* Model Pill (Visible on xl+ with strict whitespace-nowrap to prevent line breaks) */}
            <div className="hidden xl:inline-flex items-center gap-1.5 bg-[#28282a] text-white/90 text-xs px-3 py-1.5 rounded-full border border-white/10 shadow-sm whitespace-nowrap shrink-0">
              <img 
                src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg" 
                alt="Gemini" 
                className="w-3.5 h-3.5 shrink-0" 
              />
              <span className="font-medium text-[11px] whitespace-nowrap">Gemini 3.8 Flash</span>
            </div>

            {/* User Account / Sign In */}
            {user ? (
              <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                <button
                  onClick={() => setIsSubscriptionOpen(true)}
                  className="text-emerald-300 hover:text-emerald-200 flex items-center gap-1 cursor-pointer transition-colors text-[11px] font-mono font-bold tracking-wide p-1"
                  title={selectedLanguage === 'Thai' ? 'จัดการแพ็กเกจ & โควตา' : 'Subscription & Quotas'}
                >
                  <Crown className="w-[18px] h-[18px]" strokeWidth={2} />
                  <span className="hidden sm:inline capitalize">{activeTier}</span>
                </button>
                <button
                  onClick={() => setIsAlertsOpen(true)}
                  className="text-white/80 hover:text-white cursor-pointer transition-colors p-1 relative"
                  title={selectedLanguage === 'Thai' ? 'การแจ้งเตือน' : 'Alerts & Monitoring'}
                >
                  <Bell className="w-[18px] h-[18px]" strokeWidth={2} />
                  {unreadAlertsCount > 0 && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-0.5 right-0.5" />
                  )}
                </button>
                <button
                  onClick={() => setIsPortfolioOpen(true)}
                  className="text-white/80 hover:text-white cursor-pointer transition-colors p-1"
                  title={selectedLanguage === 'Thai' ? 'พอร์ตและรายการติดตาม' : 'Portfolio & Watchlist'}
                >
                  <Briefcase className="w-[18px] h-[18px]" strokeWidth={2} />
                </button>
                <button
                  onClick={() => setIsHistoryModalOpen(true)}
                  className="text-white/80 hover:text-white cursor-pointer transition-colors p-1"
                  title="History"
                >
                  <History className="w-[18px] h-[18px]" strokeWidth={2} />
                </button>
                <button
                  onClick={handleLogout}
                  className="text-white/80 hover:text-white cursor-pointer transition-colors p-1"
                  title="Logout"
                >
                  <LogOut className="w-[18px] h-[18px]" strokeWidth={2} />
                </button>
                <UserAvatar 
                  photoURL={user.photoURL} 
                  displayName={user.displayName} 
                  sizeClassName="w-[28px] h-[28px] sm:w-[32px] sm:h-[32px] text-[10px]" 
                />
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="bg-[#28282a] text-[#c8c8c8] hover:bg-[#323234] hover:text-white rounded-full font-medium transition-all duration-200 shadow-sm cursor-pointer text-xs px-3 py-1.5 shrink-0"
              >
                Sign In
              </button>
            )}

            {/* Close / Return to Landing button */}
            <button
              onClick={resetAnalysis}
              className="bg-[#28282a] hover:bg-white/20 text-white/80 hover:text-white rounded-full p-2 transition-all shadow-sm cursor-pointer shrink-0"
              title={selectedLanguage === 'Thai' ? 'กลับหน้าแรก' : 'Back to Home'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>
      )}

      <main className={`relative z-10 flex-1 flex flex-col min-h-0 print:hidden ${isLanding ? '' : 'pt-2 sm:pt-3'}`}>
        {isLanding ? (
           <LandingView 
             language={selectedLanguage}
             setLanguage={setSelectedLanguage}
             analysisType={analysisType}
             setAnalysisType={setAnalysisType}
             useSelfConsistency={useSelfConsistency}
             setUseSelfConsistency={setUseSelfConsistency}
             selectedModel={selectedModel}
             setSelectedModel={setSelectedModel}
             ticker={ticker}
             setTicker={setTicker}
             instruction={instruction}
             setInstruction={setInstruction}
             runAnalysis={runAnalysis}
             running={running}
             user={user}
             onLogin={handleLogin}
             onLogout={handleLogout}
             onOpenHistory={() => setIsHistoryModalOpen(true)}
             onOpenPortfolio={() => setIsPortfolioOpen(true)}
             onOpenAlerts={() => setIsAlertsOpen(true)}
             onOpenSubscription={() => setIsSubscriptionOpen(true)}
             activeTier={activeTier}
             unreadAlertsCount={unreadAlertsCount}
             onReplayIntro={() => setShowIntro(true)}
             error={error}
             onClearError={() => setError(null)}
           />
        ) : (
           <div className="flex-1 flex flex-col overflow-hidden pb-28 sm:pb-32 md:pb-36 gap-3 px-2.5 sm:px-4 min-h-0 max-w-2xl lg:max-w-3xl mx-auto w-full mt-0">
              <div className="flex-1 flex flex-col liquid-glass rounded-[1.5rem] overflow-hidden min-h-0 shadow-2xl border border-white/20">
                <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-white/[0.06] border-b border-white/10 font-bold text-white text-sm flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-2">
                    <img src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg" alt="Gemini Sparkle" className="w-5 h-5" />
                    <span>{selectedModel === 'gemini-3.8-flash' ? 'Gemini 3.8 Flash' : selectedModel === 'gemini-3.7-flash' ? 'Gemini 3.7 Flash' : selectedModel === 'gemini-3.6-flash' || selectedModel === 'perseus' ? 'Gemini 3.6 Flash' : 'Gemini 3.5 Flash'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {running && <Loader2 className="w-4 h-4 animate-spin text-white/60" />}
                    {!running && (
                      <button 
                        onClick={resetAnalysis}
                        className="text-white/60 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10 cursor-pointer"
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
                    hasReport={allReports.length > 0 && !isReportOpen && !running}
                    onViewReport={() => setIsReportOpen(true)}
                    metrics={currentReport ? { durationSecs, tokenCount, documentCount: currentReport.findings?.length || 0 } : undefined}
                  />
                </div>
              </div>
           </div>
        )}

        {/* Input area fixed at bottom (shown when not on landing) */}
        {!isLanding && (
          <div className="mt-auto px-4 md:px-6 pb-3.5 sm:pb-4 md:pb-5 pt-2 w-full fixed bottom-0 print:hidden z-50 bg-transparent pointer-events-none">
            <div className="max-w-[480px] mx-auto w-full pointer-events-auto flex flex-col items-center">
              {error && (
                <div className="mb-2.5 bg-red-500/10 border border-red-500/50 text-red-200 px-3.5 py-1.5 rounded-xl text-xs w-full text-center">
                  {error}
                </div>
              )}
            
              <div className="w-full liquid-glass border border-white/25 rounded-full p-1 sm:p-1.5 flex items-center shadow-xl backdrop-blur-xl focus-within:border-white/50 focus-within:ring-1 focus-within:ring-white/40 transition-all">
                <div className="flex items-center gap-1.5 pl-2.5 sm:pl-3 flex-1 min-w-0">
                  <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/70 shrink-0" />
                  <input 
                    type="text"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value)}
                    placeholder={selectedLanguage === 'Thai' ? "พิมพ์ชื่อย่อหุ้น (เช่น SOFI, NVDA)" : "US TICKER (e.g. SOFI, NVDA)"}
                    disabled={running}
                    className="bg-transparent border-none outline-none w-full font-mono uppercase text-xs sm:text-sm text-white placeholder-white/40 min-w-0"
                    onKeyDown={(e) => e.key === 'Enter' && runAnalysis()}
                  />
                </div>

                <button
                  onClick={runAnalysis}
                  disabled={!ticker.trim() || running}
                  className="bg-white text-black font-semibold rounded-full px-4 sm:px-5 py-1.5 sm:py-2 text-xs shrink-0 cursor-pointer hover:scale-102 hover:bg-white/95 disabled:bg-white/30 disabled:text-white/40 disabled:cursor-not-allowed transition-all shadow-[0_0_18px_rgba(255,255,255,0.28)]"
                >
                  {running ? (
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="text-xs">{selectedLanguage === 'Thai' ? 'กำลังวิเคราะห์...' : 'Analyzing...'}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-xs">{selectedLanguage === 'Thai' ? 'วิเคราะห์หุ้น' : 'Analyze'}</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </div>
                  )}
                </button>
              </div>

              <div className="text-center mt-2.5 sm:mt-3 px-2">
                <span className="text-[10px] sm:text-xs text-white/40 font-mono tracking-wider">
                  {selectedLanguage === 'Thai' ? 'Gemini อาจให้ข้อมูลผิดพลาดได้ โปรดตรวจสอบด้วยตนเองและไม่ควรใช้เป็นคำแนะนำทางการลงทุน' : 'Gemini can make mistakes, don’t rely on it for financial advice.'}
                </span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
