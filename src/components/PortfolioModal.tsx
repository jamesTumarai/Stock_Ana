import React, { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  X, Plus, Trash2, Briefcase, Star, AlertTriangle, ShieldCheck, PieChart,
  Layers, ArrowRight, Check, ChevronDown,
  Bell, Clock3, FileText, Pencil, Target, SlidersHorizontal, FolderPlus,
  WalletCards, CircleGauge, Info, ChevronRight, Newspaper, TrendingUp, TrendingDown
} from 'lucide-react';
import {
  AggregateTickerExposure,
  MonitoringAlert,
  MultiPortfolioConfig,
  PortfolioComputedHolding,
  PortfolioHolding,
  UserPortfolio
} from '../types';
import {
  calculatePortfolioSummary,
  loadLocalPortfolio,
  saveLocalPortfolio,
  loadLocalMultiPortfolioConfig,
  saveLocalMultiPortfolioConfig,
  loadLocalWatchlist,
  saveLocalWatchlist,
  SUGGESTED_WATCHLIST_TICKERS,
  PORTFOLIO_UPDATED_EVENT
} from '../utils/portfolioEngine';
import {
  computeMultiPortfolioAllocation,
  deleteUserPortfolioSafely,
  findDuplicatePosition,
  normalizeOptionalPct,
  upsertUserPortfolio,
  validatePositionConfiguration
} from '../utils/multiPortfolioEngine';
import { ProvenanceBadge } from './ProvenanceBadge';
import { CompanyLogo } from './CompanyLogo';
import { fetchLiveQuotes } from '../services/marketDataService';
import { extractMemorySnapshot } from '../domain/investmentMemory';
import { computeWatchlistIntelligence, rankWatchlistByPriority } from '../domain/watchlistIntelligence';
import { getPreviousReport, unwrapHistoryRecord } from '../utils/researchTimeline';
import { computeWhatChanged } from '../domain/whatChangedEngine';
import { InvestmentThesisRecord, TrackedExpectation, evaluateExpectations } from '../domain/thesisExpectations';
import { loadUserThesis, loadExpectations } from '../services/thesisExpectationsService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isThai: boolean;
  user?: any;
  onSelectTicker?: (ticker: string) => void;
  quotes?: Record<string, any>;
  latestReports?: Record<string, any>;
  historyReports?: any[];
  alerts?: MonitoringAlert[];
  onOpenNewsForTicker?: (ticker: string, scope: 'watchlist' | 'portfolio') => void;
}

const SECTOR_OPTIONS = [
  'Technology',
  'Financial Services',
  'Healthcare',
  'Consumer Cyclical',
  'Consumer Defensive',
  'Communication Services',
  'Industrials',
  'Energy',
  'Basic Materials',
  'Real Estate',
  'Utilities',
  'Other'
];

const resolveSectorOption = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.trim().toLowerCase();
  const exact = SECTOR_OPTIONS.find(option => option.toLowerCase() === normalized);
  if (exact) return exact;
  if (normalized === 'communication') return 'Communication Services';
  if (normalized === 'consumer defensive' || normalized === 'consumer staples') return 'Consumer Defensive';
  if (normalized === 'materials') return 'Basic Materials';
  return null;
};

const SECTOR_COLORS = [
  '#0b5a4b', '#14b8a6', '#0ea5e9', '#6366f1', '#8b5cf6', '#d946ef',
  '#f59e0b', '#f97316', '#ef4444', '#84cc16', '#64748b', '#a8a29e'
];

const createLocalId = (prefix: string): string => {
  const randomId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
  return `${prefix}-${randomId}`;
};

type PortfolioResearchRow = {
  ticker: string;
  thesis: InvestmentThesisRecord | null;
  thesisLabel: string;
  thesisTone: 'healthy' | 'review' | 'missing';
  daysSinceResearch: number | null;
  researchDate: string | null;
  missedExpectations: number;
  newFilingAlerts: number;
  activeAlerts: number;
  attention: 'HIGH' | 'REVIEW' | 'NORMAL';
  attentionReason: string;
};

type AllocationItem = {
  key: string;
  label: string;
  allocationPct: number;
  color: string;
  ticker?: string;
};

type PortfolioPickerOption = {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
};

function PortfolioPicker({
  value,
  onChange,
  options,
  ariaLabel,
  className = '',
  compact = false
}: {
  value: string;
  onChange: (value: string) => void;
  options: PortfolioPickerOption[];
  ariaLabel: string;
  className?: string;
  compact?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(option => option.value === value) || options[0];

  return (
    <div className={`relative min-w-0 ${className}`}>
      <motion.button
        type="button"
        whileTap={{ scale: 0.985 }}
        onClick={() => setIsOpen(open => !open)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setIsOpen(false);
        }}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`group flex w-full items-center justify-between gap-2 rounded-xl border px-3 text-left font-bold text-stone-800 outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#0b5a4b]/30 ${
          compact ? 'py-1.5 text-[10px]' : 'py-2 text-xs'
        } ${
          isOpen
            ? 'border-[#0b5a4b]/50 bg-white shadow-[0_0_0_3px_rgba(11,90,75,0.08)]'
            : 'border-stone-200 bg-white shadow-[0_2px_7px_rgba(28,25,23,0.05)] hover:border-[#0b5a4b]/35 hover:shadow-[0_5px_14px_rgba(28,25,23,0.08)]'
        }`}
      >
        <span className="min-w-0 truncate">{selectedOption?.label}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 430, damping: 30 }}
          className="flex shrink-0 text-[#0b5a4b]"
        >
          <ChevronDown className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 440, damping: 31, mass: 0.7 }}
            role="listbox"
            aria-label={ariaLabel}
            className="absolute left-0 z-30 mt-2 w-full min-w-[13rem] overflow-hidden rounded-2xl border border-stone-200/90 bg-white/98 p-1.5 shadow-[0_16px_36px_rgba(28,25,23,0.16)] backdrop-blur-xl"
          >
            <div className="max-h-56 space-y-0.5 overflow-y-auto pr-0.5">
              {options.map((option, index) => {
                const isSelected = option.value === value;
                return (
                  <motion.button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    key={option.value}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(index * 0.025, 0.12), duration: 0.16 }}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => {
                      if (option.disabled) return;
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors ${
                      option.disabled
                        ? 'cursor-not-allowed text-stone-300'
                        : isSelected
                        ? 'bg-[#0b5a4b] text-white shadow-sm'
                        : 'text-stone-700 hover:bg-emerald-50 hover:text-[#0b5a4b]'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isSelected ? 'bg-emerald-200' : option.disabled ? 'bg-stone-200' : 'bg-[#0b5a4b]/45'}`} />
                    <span className="min-w-0 flex-1 truncate text-xs font-bold">{option.label}</span>
                    {option.hint && <span className={`shrink-0 text-[9px] ${isSelected ? 'text-emerald-100' : 'text-stone-400'}`}>{option.hint}</span>}
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PortfolioModal({
  isOpen,
  onClose,
  isThai,
  user,
  onSelectTicker,
  quotes = {},
  latestReports = {},
  historyReports = [],
  alerts = [],
  onOpenNewsForTicker
}: Props) {
  const [activeTab, setActiveTab] = useState<'portfolio' | 'watchlist'>('portfolio');
  const [allocationView, setAllocationView] = useState<'portfolios' | 'stocks' | 'sectors'>('portfolios');
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [multiPortfolioConfig, setMultiPortfolioConfig] = useState<MultiPortfolioConfig>({
    version: 2,
    portfolios: [],
    ticker_limits: []
  });
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<'all' | 'unassigned' | string>('all');
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [internalQuotes, setInternalQuotes] = useState<Record<string, number>>({});
  const [isRefreshingQuotes, setIsRefreshingQuotes] = useState(false);

  // Add holding form state
  const [newTicker, setNewTicker] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newAvgCost, setNewAvgCost] = useState('');
  const [newSector, setNewSector] = useState('Technology');
  const [newNotes, setNewNotes] = useState('');
  const [newPortfolioId, setNewPortfolioId] = useState('');
  const [newTargetWeight, setNewTargetWeight] = useState('');
  const [newMaxWeight, setNewMaxWeight] = useState('');
  const [newOverallTickerMax, setNewOverallTickerMax] = useState('');
  const [isSectorMenuOpen, setIsSectorMenuOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'holding-form' | 'position' | 'portfolio-form' | 'aggregate' | null>(null);
  const [editingHoldingId, setEditingHoldingId] = useState<string | null>(null);
  const [selectedHoldingId, setSelectedHoldingId] = useState<string | null>(null);
  const [selectedAggregateTicker, setSelectedAggregateTicker] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [duplicateHoldingId, setDuplicateHoldingId] = useState<string | null>(null);

  // Create/edit portfolio form state
  const [editingPortfolioId, setEditingPortfolioId] = useState<string | null>(null);
  const [portfolioName, setPortfolioName] = useState('');
  const [portfolioTarget, setPortfolioTarget] = useState('');
  const [portfolioMax, setPortfolioMax] = useState('');
  const [portfolioNotes, setPortfolioNotes] = useState('');
  const [portfolioFilter, setPortfolioFilter] = useState<'all' | 'review' | 'overvalued' | 'no-thesis' | 'stale'>('all');
  const [portfolioSort, setPortfolioSort] = useState<'attention' | 'weight' | 'pnl' | 'mos' | 'research'>('attention');
  const [watchlistFilter, setWatchlistFilter] = useState<'all' | 'urgent' | 'review' | 'routine'>('all');

  // Add watchlist ticker state
  const [newWatchTicker, setNewWatchTicker] = useState('');

  // Research context cache for watchlist tickers
  const [researchStateMap, setResearchStateMap] = useState<
    Record<string, { thesis: InvestmentThesisRecord | null; expectations: TrackedExpectation[] }>
  >({});

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    const researchTickers = Array.from(new Set([
      ...watchlist,
      ...holdings.map(h => h.ticker)
    ]));

    const missingTickers = researchTickers
      .map(t => t.toUpperCase().trim())
      .filter(t => Boolean(t) && !researchStateMap[t]);

    if (missingTickers.length === 0) return;

    Promise.all(
      missingTickers.map(async (sym) => {
        try {
          const [th, ex] = await Promise.all([
            loadUserThesis(sym, user),
            loadExpectations(sym, user)
          ]);
          return { sym, thesis: th, expectations: ex };
        } catch {
          return { sym, thesis: null, expectations: [] };
        }
      })
    ).then(results => {
      if (!isMounted) return;
      setResearchStateMap(prev => {
        const next = { ...prev };
        for (const res of results) {
          next[res.sym] = { thesis: res.thesis, expectations: res.expectations };
        }
        return next;
      });
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, watchlist, holdings, user?.uid]);

  useEffect(() => {
    if (isOpen) {
      const loadedHoldings = loadLocalPortfolio(user?.uid);
      const loadedWatchlist = loadLocalWatchlist(user?.uid);
      const loadedMultiPortfolioConfig = loadLocalMultiPortfolioConfig(user?.uid);
      setHoldings(loadedHoldings);
      setWatchlist(loadedWatchlist);
      setMultiPortfolioConfig(loadedMultiPortfolioConfig);
      setSelectedPortfolioId('all');
      setAllocationView('portfolios');

      const allSymbols = Array.from(new Set([
        ...loadedHoldings.map(h => h.ticker.toUpperCase().trim()),
        ...loadedWatchlist.map(s => s.toUpperCase().trim())
      ])).filter(Boolean);

      if (allSymbols.length > 0) {
        setIsRefreshingQuotes(true);
        fetchLiveQuotes(allSymbols)
          .then(snap => {
            if (snap?.quotes) {
              const qMap: Record<string, number> = {};
              for (const [k, v] of Object.entries(snap.quotes)) {
                if (typeof v === 'number') qMap[k.toUpperCase()] = v;
                else if (typeof (v as any)?.price === 'number') qMap[k.toUpperCase()] = (v as any).price;
              }
              setInternalQuotes(prev => ({ ...prev, ...qMap }));
            }
          })
          .catch(err => {
            console.warn('PortfolioModal: failed to fetch live quotes', err);
          })
          .finally(() => {
            setIsRefreshingQuotes(false);
          });
      }
    }
  }, [isOpen, user?.uid]);

  // The application hydrates the local cache from the signed-in user's
  // Firestore workspace. Keep an already-open modal in sync with that cache
  // when another browser or device changes the same account.
  useEffect(() => {
    if (!isOpen) return;
    const refreshWorkspace = () => {
      setHoldings(loadLocalPortfolio(user?.uid));
      setWatchlist(loadLocalWatchlist(user?.uid));
      setMultiPortfolioConfig(loadLocalMultiPortfolioConfig(user?.uid));
    };
    window.addEventListener(PORTFOLIO_UPDATED_EVENT, refreshWorkspace);
    return () => window.removeEventListener(PORTFOLIO_UPDATED_EVENT, refreshWorkspace);
  }, [isOpen, user?.uid]);

  useEffect(() => {
    if (editingHoldingId) return;
    const ticker = newTicker.trim().toUpperCase();
    if (!ticker) return;
    const report = latestReports[ticker];
    const reportSector = report?.company_profile?.overview?.sector
      ?? report?.company_profile?.sector
      ?? report?.sector;
    const resolvedSector = resolveSectorOption(reportSector);
    if (resolvedSector) setNewSector(resolvedSector);
  }, [newTicker, editingHoldingId, latestReports]);

  const activeQuotes = useMemo(() => {
    return { ...internalQuotes, ...quotes };
  }, [internalQuotes, quotes]);

  const summary = useMemo(() => {
    return calculatePortfolioSummary(holdings, activeQuotes, latestReports);
  }, [holdings, activeQuotes, latestReports]);

  const multiPortfolioSummary = useMemo(() => computeMultiPortfolioAllocation(
    multiPortfolioConfig.portfolios,
    summary.computed_holdings,
    multiPortfolioConfig.ticker_limits,
    isThai ? 'ยังไม่ได้จัดเข้าพอร์ต' : 'Unassigned'
  ), [multiPortfolioConfig, summary.computed_holdings, isThai]);

  const selectedRawHoldings = useMemo(() => {
    if (selectedPortfolioId === 'all') return holdings;
    if (selectedPortfolioId === 'unassigned') {
      const validIds = new Set(multiPortfolioConfig.portfolios.map(portfolio => portfolio.id));
      return holdings.filter(holding => !holding.portfolio_id || !validIds.has(holding.portfolio_id));
    }
    return holdings.filter(holding => holding.portfolio_id === selectedPortfolioId);
  }, [holdings, selectedPortfolioId, multiPortfolioConfig.portfolios]);

  const displaySummary = useMemo(() => (
    selectedPortfolioId === 'all'
      ? summary
      : calculatePortfolioSummary(selectedRawHoldings, activeQuotes, latestReports)
  ), [selectedPortfolioId, summary, selectedRawHoldings, activeQuotes, latestReports]);

  const selectedPortfolioSummary = useMemo(() => {
    if (selectedPortfolioId === 'all') return null;
    const normalizedId = selectedPortfolioId === 'unassigned' ? null : selectedPortfolioId;
    return multiPortfolioSummary.portfolios.find(item => item.portfolio_id === normalizedId) || null;
  }, [selectedPortfolioId, multiPortfolioSummary.portfolios]);

  const selectedPositionUnallocatedTarget = useMemo(() => {
    if (!selectedPortfolioSummary?.portfolio_id) return null;
    const configured = multiPortfolioSummary.positions
      .filter(position => position.portfolio_id === selectedPortfolioSummary.portfolio_id)
      .reduce((total, position) => total + (position.target_pct_within_portfolio ?? 0), 0);
    return Math.max(0, 100 - configured);
  }, [selectedPortfolioSummary, multiPortfolioSummary.positions]);

  const positionAllocationById = useMemo(() => new Map(
    multiPortfolioSummary.positions.map(position => [position.holding.id || `${position.portfolio_id || 'unassigned'}:${position.holding.ticker}`, position])
  ), [multiPortfolioSummary.positions]);

  const watchlistEntries = useMemo(() => {
    const rawEntries = watchlist.map((tick) => {
      const cleanTick = tick.toUpperCase().trim();
      const q = activeQuotes[cleanTick];
      const price = typeof q === 'number' ? q : q?.price;
      const report = latestReports[cleanTick];
      const currentSnapshot = report ? extractMemorySnapshot(report) : null;
      const previousReport = getPreviousReport(cleanTick, historyReports, report);
      const previousSnapshot = previousReport ? extractMemorySnapshot(previousReport) : null;
      const isOwned = holdings.some(h => h.ticker.toUpperCase() === cleanTick);

      const cached = researchStateMap[cleanTick];
      const activeThesis = cached?.thesis || null;
      const rawExps = cached?.expectations || [];
      const evaluatedExpectations = currentSnapshot && rawExps.length > 0
        ? evaluateExpectations(rawExps, currentSnapshot)
        : rawExps;

      const whatChanged = (currentSnapshot && previousSnapshot)
        ? computeWhatChanged(currentSnapshot, previousSnapshot, evaluatedExpectations)
        : null;

      return computeWatchlistIntelligence(
        cleanTick,
        currentSnapshot,
        previousSnapshot,
        activeThesis,
        evaluatedExpectations,
        whatChanged,
        isOwned,
        price
      );
    });

    return rankWatchlistByPriority(rawEntries);
  }, [watchlist, activeQuotes, latestReports, historyReports, holdings, researchStateMap]);

  const portfolioResearchRows = useMemo<PortfolioResearchRow[]>(() => {
    const now = Date.now();
    const historyByTicker = new Map<string, ReturnType<typeof unwrapHistoryRecord>>();

    for (const raw of historyReports) {
      const record = unwrapHistoryRecord(raw);
      if (!record) continue;
      const existing = historyByTicker.get(record.ticker);
      if (!existing || (record.createdTimestamp || 0) > (existing.createdTimestamp || 0)) {
        historyByTicker.set(record.ticker, record);
      }
    }

    const uniqueHoldings = Array.from(new Map(
      displaySummary.computed_holdings.map(holding => [holding.ticker.toUpperCase().trim(), holding])
    ).values());

    return uniqueHoldings.map((holding) => {
      const ticker = holding.ticker.toUpperCase().trim();
      const report = latestReports[ticker];
      const snapshot = report ? extractMemorySnapshot(report) : null;
      const cached = researchStateMap[ticker];
      const thesis = cached?.thesis || null;
      const expectations = snapshot && cached?.expectations?.length
        ? evaluateExpectations(cached.expectations, snapshot)
        : (cached?.expectations || []);
      const missedExpectations = expectations.filter(exp => exp.status === 'MISSED').length;
      const tickerAlerts = alerts.filter(alert => alert.ticker.toUpperCase() === ticker && !alert.isRead);
      const newFilingAlerts = tickerAlerts.filter(alert => alert.type === 'FILING_NEW_10K_10Q' || alert.type === 'FILING_MATERIAL_8K').length;
      const hasCriticalAlert = tickerAlerts.some(alert => alert.severity === 'critical');

      const historyRecord = historyByTicker.get(ticker);
      const fallbackDate = report?.generated_at || report?.report_date || null;
      const researchTimestamp = historyRecord?.createdTimestamp
        || (fallbackDate ? Date.parse(String(fallbackDate)) : 0);
      const hasResearchDate = Number.isFinite(researchTimestamp) && researchTimestamp > 0;
      const daysSinceResearch = hasResearchDate
        ? Math.max(0, Math.floor((now - researchTimestamp) / 86_400_000))
        : null;
      const researchDate = hasResearchDate
        ? new Date(researchTimestamp).toLocaleDateString(isThai ? 'th-TH' : 'en-US', {
            day: '2-digit', month: 'short', year: '2-digit'
          })
        : null;

      const confirmedThesis = thesis?.confirmationStatus === 'USER_CONFIRMED'
        || thesis?.confirmationStatus === 'USER_EDITED';
      const challengedThesis = thesis?.status === 'UNDER_REVIEW'
        || thesis?.status === 'POTENTIALLY_CHALLENGED'
        || thesis?.status === 'INVALIDATED_BY_USER';

      let thesisLabel = isThai ? 'ยังไม่บันทึก' : 'Not recorded';
      let thesisTone: PortfolioResearchRow['thesisTone'] = 'missing';
      if (thesis && confirmedThesis && thesis.status === 'ACTIVE') {
        thesisLabel = isThai ? 'ปกติ' : 'Intact';
        thesisTone = 'healthy';
      } else if (thesis) {
        thesisLabel = thesis.status === 'INVALIDATED_BY_USER'
          ? (isThai ? 'ยกเลิกแล้ว' : 'Invalidated')
          : (isThai ? 'ต้องทบทวน' : 'Under review');
        thesisTone = 'review';
      }

      let attention: PortfolioResearchRow['attention'] = 'NORMAL';
      let attentionReason = isThai ? 'ข้อมูลวิจัยยังอยู่ในเกณฑ์ปกติ' : 'Research remains current';
      if (hasCriticalAlert || missedExpectations > 0 || challengedThesis) {
        attention = 'HIGH';
        attentionReason = hasCriticalAlert
          ? (isThai ? 'มีการแจ้งเตือนระดับ Critical' : 'Critical monitoring alert')
          : missedExpectations > 0
          ? (isThai ? `Expectation พลาด ${missedExpectations} รายการ` : `${missedExpectations} expectation missed`)
          : (isThai ? 'สถานะ Thesis ต้องตรวจสอบ' : 'Thesis requires review');
      } else if (newFilingAlerts > 0) {
        attention = 'REVIEW';
        attentionReason = isThai ? `พบเอกสาร SEC ใหม่ ${newFilingAlerts} รายการ` : `${newFilingAlerts} new SEC filing alert(s)`;
      } else if (tickerAlerts.length > 0) {
        attention = 'REVIEW';
        attentionReason = isThai ? `มีการแจ้งเตือนที่ยังไม่ได้อ่าน ${tickerAlerts.length} รายการ` : `${tickerAlerts.length} unread monitoring alert(s)`;
      } else if (!report || daysSinceResearch === null) {
        attention = 'REVIEW';
        attentionReason = isThai ? 'ยังไม่มีงานวิเคราะห์ที่ระบุวันที่ได้' : 'No dated research available';
      } else if (daysSinceResearch >= 45) {
        attention = 'REVIEW';
        attentionReason = isThai ? `งานวิจัยเก่า ${daysSinceResearch} วัน` : `Research is ${daysSinceResearch} days old`;
      } else if (!confirmedThesis) {
        attention = 'REVIEW';
        attentionReason = isThai ? 'ยังไม่มี Thesis ที่ยืนยันแล้ว' : 'No confirmed thesis';
      }

      return {
        ticker,
        thesis,
        thesisLabel,
        thesisTone,
        daysSinceResearch,
        researchDate,
        missedExpectations,
        newFilingAlerts,
        activeAlerts: tickerAlerts.length,
        attention,
        attentionReason
      };
    });
  }, [displaySummary.computed_holdings, latestReports, historyReports, researchStateMap, alerts, isThai]);

  const portfolioResearchByTicker = useMemo(
    () => new Map(portfolioResearchRows.map(row => [row.ticker, row])),
    [portfolioResearchRows]
  );

  const researchStats = useMemo(() => ({
    needsReview: portfolioResearchRows.filter(row => row.attention !== 'NORMAL').length,
    thesisIntact: portfolioResearchRows.filter(row => row.thesisTone === 'healthy').length,
    expectationsMissed: portfolioResearchRows.reduce((sum, row) => sum + row.missedExpectations, 0),
    newFilings: portfolioResearchRows.reduce((sum, row) => sum + row.newFilingAlerts, 0),
    staleResearch: portfolioResearchRows.filter(row => row.daysSinceResearch !== null && row.daysSinceResearch >= 45).length
  }), [portfolioResearchRows]);

  const allocationItems = useMemo<AllocationItem[]>(() => {
    if (allocationView === 'portfolios') {
      return multiPortfolioSummary.portfolios
        .map((portfolio, index) => ({
          key: portfolio.portfolio_id || 'unassigned',
          label: portfolio.name,
          allocationPct: portfolio.actual_pct_of_total ?? 0,
          color: SECTOR_COLORS[index % SECTOR_COLORS.length]
        }))
        .filter(item => item.allocationPct > 0);
    }
    if (allocationView === 'sectors') {
      return displaySummary.sector_breakdown.map((sector, index) => ({
        key: sector.sector,
        label: sector.sector,
        allocationPct: sector.allocation_pct,
        color: SECTOR_COLORS[index % SECTOR_COLORS.length]
      }));
    }

    if (selectedPortfolioId === 'all') {
      return multiPortfolioSummary.aggregate_tickers
        .map((aggregate, index) => ({
          key: aggregate.ticker,
          label: aggregate.ticker,
          ticker: aggregate.ticker,
          allocationPct: aggregate.total_pct_of_total ?? 0,
          color: SECTOR_COLORS[index % SECTOR_COLORS.length]
        }))
        .filter(item => item.allocationPct > 0);
    }

    return displaySummary.computed_holdings
      .map((holding, index) => ({
        key: holding.id || holding.ticker,
        label: holding.ticker,
        ticker: holding.ticker,
        allocationPct: displaySummary.is_fully_priced ? holding.allocation_pct : 0,
        color: SECTOR_COLORS[index % SECTOR_COLORS.length]
      }))
      .filter(item => item.allocationPct > 0)
      .sort((a, b) => b.allocationPct - a.allocationPct);
  }, [allocationView, displaySummary, multiPortfolioSummary, selectedPortfolioId]);

  const donutGradient = useMemo(() => {
    let cursor = 0;
    const stops = allocationItems.map((item) => {
      const start = cursor;
      cursor += item.allocationPct;
      return `${item.color} ${start}% ${cursor}%`;
    });
    return stops.length > 0 ? `conic-gradient(${stops.join(', ')})` : 'conic-gradient(#e7e5e4 0 100%)';
  }, [allocationItems]);

  const mosDistribution = useMemo(() => {
    const buckets = [
      { id: 'deep', label: isThai ? 'ส่วนเผื่อสูง' : 'Deep Discount', count: 0, color: '#0b5a4b', tone: 'text-emerald-700' },
      { id: 'fair', label: isThai ? 'ใกล้มูลค่าเหมาะสม' : 'Fair', count: 0, color: '#38bdf8', tone: 'text-sky-700' },
      { id: 'premium', label: isThai ? 'ราคาสูงกว่ามูลค่า' : 'Premium', count: 0, color: '#f59e0b', tone: 'text-amber-700' },
      { id: 'unavailable', label: isThai ? 'ยังคำนวณไม่ได้' : 'Unavailable', count: 0, color: '#d6d3d1', tone: 'text-stone-500' }
    ];
    for (const holding of displaySummary.computed_holdings) {
      const mos = holding.margin_of_safety_pct;
      if (typeof mos !== 'number') buckets[3].count += 1;
      else if (mos >= 20) buckets[0].count += 1;
      else if (mos >= 0) buckets[1].count += 1;
      else buckets[2].count += 1;
    }
    const total = Math.max(1, displaySummary.computed_holdings.length);
    return buckets.map(bucket => ({ ...bucket, percentage: (bucket.count / total) * 100 }));
  }, [displaySummary.computed_holdings, isThai]);

  const filteredSortedHoldings = useMemo(() => {
    const attentionRank = { HIGH: 3, REVIEW: 2, NORMAL: 1 } as const;
    const filtered = displaySummary.computed_holdings.filter((holding) => {
      const research = portfolioResearchByTicker.get(holding.ticker.toUpperCase());
      if (portfolioFilter === 'review') return research?.attention !== 'NORMAL';
      if (portfolioFilter === 'overvalued') return typeof holding.margin_of_safety_pct === 'number' && holding.margin_of_safety_pct < 0;
      if (portfolioFilter === 'no-thesis') return research?.thesisTone === 'missing';
      if (portfolioFilter === 'stale') return research?.daysSinceResearch !== null && research?.daysSinceResearch !== undefined && research.daysSinceResearch >= 45;
      return true;
    });

    return [...filtered].sort((a, b) => {
      const researchA = portfolioResearchByTicker.get(a.ticker.toUpperCase());
      const researchB = portfolioResearchByTicker.get(b.ticker.toUpperCase());
      if (portfolioSort === 'weight') return b.allocation_pct - a.allocation_pct;
      if (portfolioSort === 'pnl') return (b.unrealized_pnl_pct ?? -Infinity) - (a.unrealized_pnl_pct ?? -Infinity);
      if (portfolioSort === 'mos') return (b.margin_of_safety_pct ?? -Infinity) - (a.margin_of_safety_pct ?? -Infinity);
      if (portfolioSort === 'research') return (researchB?.daysSinceResearch ?? Infinity) - (researchA?.daysSinceResearch ?? Infinity);
      return (attentionRank[researchB?.attention || 'NORMAL'] - attentionRank[researchA?.attention || 'NORMAL'])
        || (b.allocation_pct - a.allocation_pct);
    });
  }, [displaySummary.computed_holdings, portfolioResearchByTicker, portfolioFilter, portfolioSort]);

  const watchlistStats = useMemo(() => ({
    urgent: watchlistEntries.filter(entry => entry.priority === 'URGENT_ATTENTION').length,
    review: watchlistEntries.filter(entry => entry.priority === 'REVIEW_RECOMMENDED').length,
    routine: watchlistEntries.filter(entry => entry.priority === 'ROUTINE_MONITORING').length,
    withoutResearch: watchlistEntries.filter(entry => !latestReports[entry.ticker]).length
  }), [watchlistEntries, latestReports]);

  const visibleWatchlistEntries = useMemo(() => watchlistEntries.filter((entry) => {
    if (watchlistFilter === 'urgent') return entry.priority === 'URGENT_ATTENTION';
    if (watchlistFilter === 'review') return entry.priority === 'REVIEW_RECOMMENDED';
    if (watchlistFilter === 'routine') return entry.priority === 'ROUTINE_MONITORING';
    return true;
  }), [watchlistEntries, watchlistFilter]);

  const selectedPosition = useMemo<PortfolioComputedHolding | null>(() => {
    if (!selectedHoldingId) return null;
    return summary.computed_holdings.find(holding => (
      (holding.id || `${holding.portfolio_id || 'unassigned'}:${holding.ticker}`) === selectedHoldingId
    )) || null;
  }, [summary.computed_holdings, selectedHoldingId]);

  const selectedPositionAllocation = selectedPosition
    ? positionAllocationById.get(selectedPosition.id || `${selectedPosition.portfolio_id || 'unassigned'}:${selectedPosition.ticker}`) || null
    : null;

  const selectedAggregate = useMemo<AggregateTickerExposure | null>(() => (
    selectedAggregateTicker
      ? multiPortfolioSummary.aggregate_tickers.find(item => item.ticker === selectedAggregateTicker) || null
      : null
  ), [selectedAggregateTicker, multiPortfolioSummary.aggregate_tickers]);

  const selectedPositionResearch = selectedPosition
    ? portfolioResearchByTicker.get(selectedPosition.ticker.toUpperCase()) || null
    : null;
  const selectedPositionAlerts = selectedPosition
    ? alerts.filter(alert => alert.ticker.toUpperCase() === selectedPosition.ticker.toUpperCase())
    : [];
  const selectedPositionExpectations = selectedPosition
    ? researchStateMap[selectedPosition.ticker.toUpperCase()]?.expectations || []
    : [];

  if (!isOpen) return null;

  const persistMultiPortfolioConfig = (config: MultiPortfolioConfig) => {
    setMultiPortfolioConfig(config);
    saveLocalMultiPortfolioConfig(config, user?.uid);
  };

  const getValidationMessage = (code: string): string => {
    const messages: Record<string, [string, string]> = {
      PORTFOLIO_NAME_REQUIRED: ['กรุณาตั้งชื่อพอร์ต', 'Portfolio name is required'],
      PORTFOLIO_TARGET_OUT_OF_RANGE: ['สัดส่วนเป้าหมายต้องอยู่ระหว่าง 0–100%', 'Portfolio target must be between 0–100%'],
      PORTFOLIO_MAX_OUT_OF_RANGE: ['สัดส่วนสูงสุดต้องอยู่ระหว่าง 0–100%', 'Portfolio maximum must be between 0–100%'],
      PORTFOLIO_TARGET_ABOVE_MAX: ['สัดส่วนเป้าหมายต้องไม่สูงกว่าสัดส่วนสูงสุด', 'Portfolio target cannot exceed its maximum'],
      PORTFOLIO_TARGET_TOTAL_ABOVE_100: ['เป้าหมายรวมทุกพอร์ตต้องไม่เกิน 100%', 'Combined portfolio targets cannot exceed 100%'],
      POSITION_TARGET_OUT_OF_RANGE: ['เป้าหมายของหุ้นต้องอยู่ระหว่าง 0–100%', 'Position target must be between 0–100%'],
      POSITION_MAX_OUT_OF_RANGE: ['สัดส่วนสูงสุดของหุ้นต้องอยู่ระหว่าง 0–100%', 'Position maximum must be between 0–100%'],
      POSITION_TARGET_ABOVE_MAX: ['เป้าหมายของหุ้นต้องไม่สูงกว่าสัดส่วนสูงสุด', 'Position target cannot exceed its maximum'],
      POSITION_TARGET_TOTAL_ABOVE_100: ['เป้าหมายรวมหุ้นในพอร์ตนี้ต้องไม่เกิน 100%', 'Position targets inside this portfolio cannot exceed 100%'],
      UNASSIGNED_POSITION_LIMIT_NOT_ALLOWED: ['หุ้นที่ยังไม่ได้จัดเข้าพอร์ตไม่สามารถตั้ง Target/Max ได้', 'Unassigned positions cannot have portfolio Target/Max values']
    };
    return messages[code]?.[isThai ? 0 : 1] || (isThai ? 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' : 'Please review the entered values');
  };

  const handleAddHolding = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setDuplicateHoldingId(null);
    const tick = newTicker.trim().toUpperCase();
    const qty = parseFloat(newQty);
    const cost = parseFloat(newAvgCost);
    if (!tick || isNaN(qty) || qty <= 0 || isNaN(cost) || cost < 0) {
      setFormError(isThai ? 'กรุณากรอกชื่อหุ้น จำนวน และต้นทุนให้ถูกต้อง' : 'Enter a valid ticker, quantity, and average cost');
      return;
    }
    if (!newPortfolioId) {
      setFormError(isThai ? 'กรุณาเลือกพอร์ต หรือเลือก “ยังไม่ได้จัดเข้าพอร์ต”' : 'Choose a portfolio or explicitly select Unassigned');
      return;
    }

    const existingHolding = editingHoldingId
      ? holdings.find(holding => holding.id === editingHoldingId)
      : undefined;
    const portfolioId = newPortfolioId === 'unassigned' ? null : newPortfolioId;
    const targetWeight = normalizeOptionalPct(newTargetWeight);
    const maxWeight = normalizeOptionalPct(newMaxWeight);
    const overallMax = normalizeOptionalPct(newOverallTickerMax);
    if (overallMax !== null && (overallMax < 0 || overallMax > 100)) {
      setFormError(isThai ? 'เพดานรวมของหุ้นต้องอยู่ระหว่าง 0–100%' : 'Overall ticker maximum must be between 0–100%');
      return;
    }
    const newHolding: PortfolioHolding = {
      id: existingHolding?.id || createLocalId('holding'),
      ticker: tick,
      quantity: qty,
      average_cost: cost,
      sector: newSector || 'Other',
      portfolio_id: portfolioId,
      target_weight_pct: targetWeight,
      max_weight_pct: maxWeight,
      notes: newNotes.trim() || undefined,
      created_at: existingHolding?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const duplicate = findDuplicatePosition(holdings, newHolding);
    if (duplicate) {
      const portfolioLabel = portfolioId
        ? multiPortfolioConfig.portfolios.find(portfolio => portfolio.id === portfolioId)?.name
        : (isThai ? 'ยังไม่ได้จัดเข้าพอร์ต' : 'Unassigned');
      setDuplicateHoldingId(duplicate.id || null);
      setFormError(isThai
        ? `${tick} มีอยู่ใน ${portfolioLabel} แล้ว กรุณาแก้ไขรายการเดิม`
        : `${tick} already exists in ${portfolioLabel}. Edit the existing position instead.`);
      return;
    }

    const validationError = validatePositionConfiguration(holdings, newHolding);
    if (validationError) {
      setFormError(getValidationMessage(validationError));
      return;
    }

    const updated = [
      ...holdings.filter(h => h.id !== editingHoldingId),
      newHolding
    ];
    setHoldings(updated);
    saveLocalPortfolio(updated, user?.uid);
    setIsRefreshingQuotes(true);
    fetchLiveQuotes([tick])
      .then(snapshot => {
        const quote = snapshot?.quotes?.[tick];
        const price = typeof quote === 'number' ? quote : quote?.price;
        if (typeof price === 'number') setInternalQuotes(previous => ({ ...previous, [tick]: price }));
      })
      .catch(error => console.warn('PortfolioModal: failed to refresh added holding quote', error))
      .finally(() => setIsRefreshingQuotes(false));

    const existingOverallLimit = multiPortfolioConfig.ticker_limits.find(limit => limit.ticker.toUpperCase() === tick);
    const shouldChangeOverallLimit = overallMax !== null || Boolean(editingHoldingId);
    const nextLimits = shouldChangeOverallLimit
      ? multiPortfolioConfig.ticker_limits.filter(limit => limit.ticker.toUpperCase() !== tick)
      : multiPortfolioConfig.ticker_limits;
    if (overallMax !== null && shouldChangeOverallLimit) {
      nextLimits.push({ ticker: tick, max_pct_of_total: overallMax, updated_at: new Date().toISOString() });
    }
    if (shouldChangeOverallLimit && overallMax !== normalizeOptionalPct(existingOverallLimit?.max_pct_of_total)) {
      persistMultiPortfolioConfig({ ...multiPortfolioConfig, ticker_limits: nextLimits });
    }

    // Also ensure ticker is in watchlist
    if (!watchlist.includes(tick)) {
      const updatedWatch = [...watchlist, tick];
      setWatchlist(updatedWatch);
      saveLocalWatchlist(updatedWatch, user?.uid);
    }

    setNewTicker('');
    setNewQty('');
    setNewAvgCost('');
    setNewNotes('');
    setNewPortfolioId('');
    setNewTargetWeight('');
    setNewMaxWeight('');
    setNewOverallTickerMax('');
    setEditingHoldingId(null);
    setDrawerMode(null);
  };

  const openAddHoldingDrawer = () => {
    setEditingHoldingId(null);
    setNewTicker('');
    setNewQty('');
    setNewAvgCost('');
    setNewSector('Technology');
    setNewNotes('');
    setNewPortfolioId(selectedPortfolioId === 'all' ? '' : selectedPortfolioId === 'unassigned' ? 'unassigned' : selectedPortfolioId);
    setNewTargetWeight('');
    setNewMaxWeight('');
    setNewOverallTickerMax('');
    setFormError('');
    setDuplicateHoldingId(null);
    setIsSectorMenuOpen(false);
    setDrawerMode('holding-form');
  };

  const openEditHoldingDrawer = (holding: PortfolioComputedHolding) => {
    setEditingHoldingId(holding.id || null);
    setNewTicker(holding.ticker);
    setNewQty(String(holding.quantity));
    setNewAvgCost(String(holding.average_cost));
    setNewSector(holding.sector || 'Other');
    setNewNotes(holding.notes || '');
    setNewPortfolioId(holding.portfolio_id || 'unassigned');
    setNewTargetWeight(holding.target_weight_pct?.toString() || '');
    setNewMaxWeight(holding.max_weight_pct?.toString() || '');
    setNewOverallTickerMax(multiPortfolioConfig.ticker_limits.find(limit => limit.ticker === holding.ticker.toUpperCase())?.max_pct_of_total.toString() || '');
    setFormError('');
    setDuplicateHoldingId(null);
    setIsSectorMenuOpen(false);
    setDrawerMode('holding-form');
  };

  const closeDrawer = () => {
    setDrawerMode(null);
    setEditingHoldingId(null);
    setSelectedHoldingId(null);
    setSelectedAggregateTicker(null);
    setEditingPortfolioId(null);
    setFormError('');
    setDuplicateHoldingId(null);
    setIsSectorMenuOpen(false);
  };

  const openCreatePortfolioDrawer = () => {
    setEditingPortfolioId(null);
    setPortfolioName('');
    setPortfolioTarget('');
    setPortfolioMax('');
    setPortfolioNotes('');
    setFormError('');
    setDrawerMode('portfolio-form');
  };

  const openEditPortfolioDrawer = (portfolio: UserPortfolio) => {
    setEditingPortfolioId(portfolio.id);
    setPortfolioName(portfolio.name);
    setPortfolioTarget(portfolio.target_pct_of_total?.toString() || '');
    setPortfolioMax(portfolio.max_pct_of_total?.toString() || '');
    setPortfolioNotes(portfolio.notes || '');
    setFormError('');
    setDrawerMode('portfolio-form');
  };

  const handleSavePortfolio = (event: React.FormEvent) => {
    event.preventDefault();
    const now = new Date().toISOString();
    const existing = editingPortfolioId
      ? multiPortfolioConfig.portfolios.find(portfolio => portfolio.id === editingPortfolioId)
      : null;
    const candidate: UserPortfolio = {
      id: existing?.id || createLocalId('portfolio'),
      name: portfolioName.trim(),
      target_pct_of_total: normalizeOptionalPct(portfolioTarget),
      max_pct_of_total: normalizeOptionalPct(portfolioMax),
      notes: portfolioNotes.trim() || undefined,
      created_at: existing?.created_at || now,
      updated_at: now
    };
    const result = upsertUserPortfolio(multiPortfolioConfig.portfolios, candidate);
    if (result.error) {
      setFormError(getValidationMessage(result.error));
      return;
    }
    persistMultiPortfolioConfig({ ...multiPortfolioConfig, portfolios: result.portfolios });
    setSelectedPortfolioId(candidate.id);
    setAllocationView('stocks');
    closeDrawer();
  };

  const handleDeletePortfolio = (portfolioId: string) => {
    const result = deleteUserPortfolioSafely(multiPortfolioConfig.portfolios, holdings, portfolioId);
    if (result.error === 'PORTFOLIO_NOT_EMPTY') {
      const count = holdings.filter(holding => holding.portfolio_id === portfolioId).length;
      setFormError(isThai
        ? `พอร์ตนี้ยังมี ${count} รายการ กรุณาย้ายหรือลบรายการก่อนลบพอร์ต`
        : `This portfolio still contains ${count} position(s). Move or remove them before deleting it.`);
      return;
    }
    persistMultiPortfolioConfig({ ...multiPortfolioConfig, portfolios: result.portfolios });
    setSelectedPortfolioId('all');
    setAllocationView('portfolios');
    closeDrawer();
  };

  const handleRemoveHolding = (id?: string) => {
    if (!id) return;
    const updated = holdings.filter(h => h.id !== id);
    setHoldings(updated);
    saveLocalPortfolio(updated, user?.uid);
  };

  const handleAddWatchlistTicker = (e: React.FormEvent) => {
    e.preventDefault();
    const tick = newWatchTicker.trim().toUpperCase();
    if (!tick || watchlist.includes(tick)) return;

    const updated = [...watchlist, tick];
    setWatchlist(updated);
    saveLocalWatchlist(updated, user?.uid);
    setNewWatchTicker('');
  };

  const handleRemoveWatchlistTicker = (tick: string) => {
    const updated = watchlist.filter(t => t !== tick);
    setWatchlist(updated);
    saveLocalWatchlist(updated, user?.uid);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5 bg-stone-900/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="portfolio-modal-title"
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.97, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 12, scale: 0.98, filter: 'blur(3px)' }}
        transition={{ type: 'spring', stiffness: 360, damping: 32, mass: 0.8 }}
        className="portfolio-cute-font relative bg-white rounded-t-[28px] sm:rounded-3xl max-w-6xl w-full h-[92dvh] sm:h-[720px] max-h-[92dvh] sm:max-h-[92vh] shadow-[0_24px_72px_rgba(0,0,0,0.28)] border border-slate-200 flex flex-col overflow-hidden [&_button]:focus-visible:outline-none [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-[#0b5a4b]/35 [&_button]:focus-visible:ring-offset-1 [&_input]:focus-visible:outline-none [&_input]:focus-visible:ring-2 [&_input]:focus-visible:ring-[#0b5a4b]/30 [&_textarea]:focus-visible:outline-none [&_textarea]:focus-visible:ring-2 [&_textarea]:focus-visible:ring-[#0b5a4b]/30"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-4 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-3.5 sm:gap-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 shrink-0 rounded-2xl bg-gradient-to-br from-[#0b5a4b] to-[#127a65] text-white flex items-center justify-center shadow-md shadow-[#0b5a4b]/20">
              <Briefcase className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 id="portfolio-modal-title" className="text-xl sm:text-2xl font-extrabold text-slate-900 font-cute-heading tracking-tight">
                  {isThai ? 'พอร์ตการลงทุน & Watchlist' : 'Portfolio & Watchlist'}
                </h2>
                <ProvenanceBadge classification="calculated" isThai={isThai} size="xs" />
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium font-cute mt-0.5 truncate">
                {isThai ? 'ติดตามสถานะพอร์ตการลงทุน ตรวจสอบความเข้มข้น และคำนวณ Margin of Safety รวม' : 'Track holdings, evaluate concentration risk, and monitor weighted portfolio valuation'}
              </p>
            </div>
          </div>

          <motion.button
            type="button"
            onClick={onClose}
            whileTap={{ scale: 0.92 }}
            className="shrink-0 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center cursor-pointer"
            aria-label={isThai ? 'ปิดหน้าพอร์ต' : 'Close portfolio modal'}
            title={isThai ? 'ปิด' : 'Close'}
          >
            <X className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-col gap-3 px-5 sm:px-7 py-3 border-b border-slate-200/70 bg-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5 rounded-2xl bg-slate-100/90 border border-slate-200/60 p-1.5 overflow-x-auto no-scrollbar">
            <motion.button
              type="button"
              onClick={() => setActiveTab('portfolio')}
              whileTap={{ scale: 0.97 }}
              aria-pressed={activeTab === 'portfolio'}
              className={`px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold font-cute rounded-xl transition-all duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'portfolio'
                  ? 'bg-white text-[#0b5a4b] shadow-xs border border-emerald-600/15'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>{isThai ? 'พอร์ตการลงทุน' : 'Portfolio Holdings'} ({holdings.length})</span>
            </motion.button>
            <motion.button
              type="button"
              onClick={() => setActiveTab('watchlist')}
              whileTap={{ scale: 0.97 }}
              aria-pressed={activeTab === 'watchlist'}
              className={`px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold font-cute rounded-xl transition-all duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'watchlist'
                  ? 'bg-white text-[#0b5a4b] shadow-xs border border-emerald-600/15'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Star className="w-4 h-4" />
              <span>{isThai ? 'รายการติดตาม (Watchlist)' : 'Watchlist'} ({watchlist.length})</span>
            </motion.button>
          </div>

          {activeTab === 'portfolio' && (
            <motion.button
              type="button"
              onClick={openAddHoldingDrawer}
              whileHover={{ y: -1, boxShadow: '0 8px 24px rgba(11,90,75,0.22)' }}
              whileTap={{ scale: 0.97 }}
              title={isThai ? 'เพิ่มรายการลงทุนใหม่' : 'Add a new portfolio holding'}
              className="text-xs sm:text-sm font-bold font-cute px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0b5a4b] to-[#127a65] text-white hover:brightness-105 transition-all duration-200 flex items-center gap-2 shadow-sm shadow-[#0b5a4b]/25 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isThai ? 'เพิ่มหุ้นในพอร์ต' : 'Add Holding'}</span>
            </motion.button>
          )}
        </div>

        {activeTab === 'portfolio' && (
          <div className="flex flex-col gap-2 border-b border-slate-200/70 bg-slate-50/60 px-5 sm:px-7 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-white text-[#0b5a4b] shadow-2xs sm:flex">
                <WalletCards className="h-4.5 w-4.5" />
              </div>
              <WalletCards className="h-4.5 w-4.5 shrink-0 text-[#0b5a4b] sm:hidden" />
              <PortfolioPicker
                value={selectedPortfolioId}
                onChange={(next) => {
                  setSelectedPortfolioId(next);
                  setAllocationView(next === 'all' ? 'portfolios' : 'stocks');
                }}
                ariaLabel={isThai ? 'เลือกพอร์ต' : 'Select portfolio'}
                className="min-w-0 max-w-xs flex-1 font-cute"
                options={[
                  { value: 'all', label: isThai ? 'ทุกพอร์ต' : 'All Portfolios', hint: isThai ? 'ภาพรวม' : 'Overview' },
                  { value: 'unassigned', label: isThai ? 'ยังไม่ได้จัดเข้าพอร์ต' : 'Unassigned' },
                  ...multiPortfolioConfig.portfolios.map(portfolio => ({ value: portfolio.id, label: portfolio.name }))
                ]}
              />
              {selectedPortfolioSummary?.portfolio && (
                <button
                  type="button"
                  onClick={() => openEditPortfolioDrawer(selectedPortfolioSummary.portfolio!)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition-colors hover:text-stone-900"
                  title={isThai ? 'แก้ไขพอร์ตนี้' : 'Edit this portfolio'}
                  aria-label={isThai ? `แก้ไข ${selectedPortfolioSummary.name}` : `Edit ${selectedPortfolioSummary.name}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {selectedPortfolioId === 'all' && multiPortfolioConfig.portfolios.length > 0 && (
                <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1 text-xs text-emerald-800 shadow-2xs font-cute lg:inline-flex font-bold">
                  <span>{isThai ? 'เป้าหมายที่ยังไม่ได้จัดสรร' : 'Unallocated Target'}</span>
                  <strong className="font-mono text-emerald-900">{multiPortfolioSummary.unallocated_target_pct.toFixed(1)}%</strong>
                </span>
              )}
            </div>
            <motion.button
              type="button"
              onClick={openCreatePortfolioDrawer}
              whileHover={{ y: -1, boxShadow: '0 8px 18px rgba(11,90,75,0.12)' }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition-colors hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-800 font-cute cursor-pointer"
            >
              <FolderPlus className="h-4 w-4 text-[#0b5a4b]" />
              {isThai ? 'สร้างพอร์ต' : 'Create Portfolio'}
            </motion.button>
          </div>
        )}

        {/* Content Body */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="no-scrollbar flex-1 overflow-y-auto overscroll-contain bg-[#f8fafc] p-4 sm:p-6 flex flex-col gap-4 sm:gap-6 [&>*]:shrink-0"
        >

          {/* TAB 1: PORTFOLIO */}
          {activeTab === 'portfolio' && (
            <>
              {/* Portfolio Metric Snapshot Cards */}
              <motion.div
                layout
                transition={{ layout: { type: 'spring', stiffness: 380, damping: 32, mass: 0.8 } }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4"
              >
                {/* Total Market Value */}
                <div className="p-4.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.05)] hover:shadow-md transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-600 font-cute">
                        {isThai ? 'มูลค่าพอร์ตรวม' : 'Total Market Value'}
                      </span>
                      <span className="p-2 rounded-xl bg-slate-100 text-slate-700">
                        <WalletCards className="w-4 h-4" />
                      </span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-mono font-extrabold text-slate-900 tracking-tight">
                      {displaySummary.total_market_value !== null
                        ? `$${displaySummary.total_market_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : displaySummary.priced_market_value > 0
                        ? `$${displaySummary.priced_market_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : (isThai ? 'ไม่สามารถระบุได้' : 'Unavailable')}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 font-cute mt-3 pt-2.5 border-t border-slate-100 leading-normal">
                    {displaySummary.unpriced_holdings_count > 0 ? (
                      <span className="text-amber-700 font-medium">
                        {isThai
                          ? `ครอบคลุมราคา ${displaySummary.pricing_coverage_pct}% (${displaySummary.unpriced_holdings_count} รายการขาดราคาตลาด)`
                          : `${displaySummary.pricing_coverage_pct}% priced (${displaySummary.unpriced_holdings_count} missing quote)`}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200/70 font-cute font-medium">
                        <span className="text-slate-400">{isThai ? 'ต้นทุนรวม:' : 'Cost Basis:'}</span>
                        <strong className="font-mono font-bold text-slate-800">${displaySummary.total_cost_basis.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Total Unrealized P/L */}
                <div className="p-4.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-emerald-50/70 via-white to-white border border-emerald-200/80 shadow-[0_2px_12px_-2px_rgba(16,185,129,0.07)] hover:shadow-md transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs sm:text-sm font-bold text-emerald-950/80 font-cute">
                        {isThai ? 'กำไร/ขาดทุนที่ยังไม่รับรู้' : 'Unrealized Gain / Loss'}
                      </span>
                      <span className="p-2 rounded-xl bg-emerald-100/80 text-emerald-700">
                        <TrendingUp className="w-4 h-4" />
                      </span>
                    </div>
                    {displaySummary.total_unrealized_pnl !== null && displaySummary.total_unrealized_pnl_pct !== null ? (
                      <div className="flex items-baseline gap-2">
                        <span className={`text-2xl sm:text-3xl font-mono font-extrabold tracking-tight ${displaySummary.total_unrealized_pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {displaySummary.total_unrealized_pnl >= 0 ? '+' : ''}${displaySummary.total_unrealized_pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ) : (
                      <div className="text-sm font-semibold text-slate-600 mt-1 font-cute">
                        {isThai ? 'ไม่สามารถคำนวณกำไร/ขาดทุนรวมได้' : 'Total P/L Unavailable'}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-emerald-100/70 flex items-center">
                    {displaySummary.total_unrealized_pnl !== null && displaySummary.total_unrealized_pnl_pct !== null ? (
                      <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg inline-flex items-center gap-1 ${
                        displaySummary.total_unrealized_pnl_pct >= 0
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300/70'
                          : 'bg-rose-100 text-rose-800 border border-rose-300/70'
                      }`}>
                        {displaySummary.total_unrealized_pnl_pct >= 0 ? '+' : ''}{displaySummary.total_unrealized_pnl_pct.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-xs text-amber-700 font-cute">
                        {isThai
                          ? `ขาดราคาตลาดสด ${displaySummary.unpriced_holdings_count} รายการ`
                          : `${displaySummary.unpriced_holdings_count} holdings missing live price`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Top Concentration Risk */}
                <div className="p-4.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-amber-50/60 via-white to-white border border-amber-200/80 shadow-[0_2px_12px_-2px_rgba(245,158,11,0.07)] hover:shadow-md transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs sm:text-sm font-bold text-amber-950/80 font-cute">
                        {isThai ? 'ความเข้มข้นสูงสุด (Concentration)' : 'Top Holding Weight'}
                      </span>
                      <span className="p-2 rounded-xl bg-amber-100 text-amber-700">
                        <AlertTriangle className="w-4 h-4" />
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl sm:text-3xl font-mono font-extrabold text-slate-900 tracking-tight">
                        {displaySummary.is_fully_priced ? `${displaySummary.top_holding_concentration_pct.toFixed(1)}%` : '—'}
                      </span>
                      {displaySummary.concentration_risk_alert && (
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-cute rounded-lg font-bold border border-amber-200" title={isThai ? 'เกินเกณฑ์ 30%' : 'Above 30% concentration limit'}>
                          ⚠️ Alert
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-amber-100/70 leading-snug">
                    <span className="text-xs text-slate-600 font-cute font-medium">
                      {!displaySummary.is_fully_priced
                        ? (isThai ? 'รอราคาตลาดครบก่อนคำนวณสัดส่วน' : 'Waiting for complete market pricing')
                        : displaySummary.concentration_risk_alert
                        ? (isThai ? 'มีหุ้นสัดส่วนเกิน 30% ควรพิจารณา Diversify' : 'Exceeds 30% single-holding prudent limit')
                        : (isThai ? 'สัดส่วนกระจายตัวในเกณฑ์ปลอดภัย' : 'Prudently diversified weight')}
                    </span>
                  </div>
                </div>

                {/* Weighted Margin of Safety */}
                <div className="p-4.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-teal-50/45 via-white to-white border border-slate-200/80 shadow-[0_2px_12px_-2px_rgba(13,148,136,0.06)] hover:shadow-md transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-600 font-cute">
                        {isThai ? 'Margin of Safety รวม' : 'Weighted Margin of Safety'}
                      </span>
                      <span className="p-2 rounded-xl bg-teal-100/80 text-teal-700">
                        <Target className="w-4 h-4" />
                      </span>
                    </div>
                    <div className={`text-2xl sm:text-3xl font-mono font-extrabold tracking-tight ${
                      displaySummary.weighted_margin_of_safety_pct !== null && displaySummary.weighted_margin_of_safety_pct !== undefined
                        ? (displaySummary.weighted_margin_of_safety_pct >= 0 ? 'text-[#0b5a4b]' : 'text-amber-700')
                        : 'text-slate-400'
                    }`}>
                      {displaySummary.weighted_margin_of_safety_pct !== null && displaySummary.weighted_margin_of_safety_pct !== undefined
                        ? `${displaySummary.weighted_margin_of_safety_pct > 0 ? '+' : ''}${displaySummary.weighted_margin_of_safety_pct.toFixed(1)}%`
                        : '-'}
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-100 leading-snug">
                    <span className="text-xs text-slate-500 font-cute font-medium">
                      {isThai ? 'ถ่วงน้ำหนักตามมูลค่าแท้จริง DCF' : 'Weighted across analyzed holdings'}
                    </span>
                  </div>
                </div>
              </motion.div>

              <motion.section layout className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)]">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-[#0b5a4b] border border-emerald-100/80">
                      <CircleGauge className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 font-cute-heading">
                        {selectedPortfolioId === 'all'
                          ? (isThai ? 'ภาพรวมหลายพอร์ต' : 'Multi-portfolio overview')
                          : selectedPortfolioSummary?.name}
                      </h3>
                      <p className="text-xs text-slate-500 font-cute">
                        {isThai ? 'สัดส่วนจริงคำนวณจากมูลค่าตลาดเท่านั้น' : 'Actual weights use market value only'}
                      </p>
                    </div>
                  </div>
                  {!multiPortfolioSummary.is_fully_priced && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 border border-amber-200 font-cute" title={isThai ? 'จะไม่ใช้ต้นทุนแทนราคาตลาด' : 'Cost basis is never substituted for market price'}>
                      <Info className="h-3.5 w-3.5" />
                      {isThai ? 'รอราคาครบเพื่อคำนวณสัดส่วน' : 'Exact weights unavailable'}
                    </span>
                  )}
                  {selectedPositionUnallocatedTarget !== null && (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 font-cute" title={isThai ? 'ส่วนของเป้าหมายภายในพอร์ตที่ยังไม่ได้กำหนดให้หุ้น' : 'Position target share that has not been configured'}>
                      {isThai ? 'เป้าหมายหุ้นยังไม่ได้จัดสรร' : 'Unallocated position target'} {selectedPositionUnallocatedTarget.toFixed(1)}%
                    </span>
                  )}
                </div>

                {multiPortfolioConfig.portfolios.length === 0 && multiPortfolioSummary.portfolios.every(item => item.portfolio_id === null) ? (
                  <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-5 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-sm font-bold text-slate-900 font-cute">{isThai ? 'ยังไม่มีพอร์ตที่คุณสร้าง' : 'No user-created portfolios yet'}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600 font-cute">
                        {holdings.length > 0
                          ? (isThai ? 'สร้างพอร์ตเพื่อจัดระเบียบรายการเดิม โดยรายการเดิมยังอยู่ใน “ยังไม่ได้จัดเข้าพอร์ต”' : 'Create a portfolio to organize existing positions. Legacy holdings remain Unassigned.')
                          : (isThai ? 'สร้างพอร์ตแรกและกำหนด Target/Max ของคุณเอง' : 'Create your first portfolio and set your own Target/Max.')}
                      </p>
                    </div>
                    <button type="button" onClick={openCreatePortfolioDrawer} className="shrink-0 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 font-cute shadow-xs cursor-pointer">
                      <FolderPlus className="mr-1.5 inline h-4 w-4" />{isThai ? 'สร้างพอร์ตแรก' : 'Create first portfolio'}
                    </button>
                  </div>
                ) : (
                  <div className={`grid gap-3.5 ${selectedPortfolioId === 'all'
                    ? (multiPortfolioSummary.portfolios.length <= 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3')
                    : 'grid-cols-1'}`}>
                    {(selectedPortfolioId === 'all'
                      ? multiPortfolioSummary.portfolios
                      : selectedPortfolioSummary ? [selectedPortfolioSummary] : []
                    ).map(portfolio => {
                      const actualWeight = portfolio.actual_pct_of_total;
                      const targetWeight = portfolio.target_pct_of_total;
                      const maximumWeight = portfolio.max_pct_of_total;
                      const weightWidth = Math.min(Math.max(actualWeight ?? 0, 0), 100);
                      const markerPosition = (value: number) => `${Math.min(Math.max(value, 0), 100)}%`;
                      const isOverLimit = portfolio.status === 'ABOVE_MAX';
                      const barTone = isOverLimit
                        ? 'bg-rose-500'
                        : portfolio.status === 'INCOMPLETE_PRICING'
                          ? 'bg-amber-500'
                          : 'bg-[#0b5a4b]';

                      return (
                        <motion.button
                          layout
                          type="button"
                          key={portfolio.portfolio_id || 'unassigned'}
                          onClick={() => {
                            setSelectedPortfolioId(portfolio.portfolio_id || 'unassigned');
                            setAllocationView('stocks');
                          }}
                          className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/60 p-4 sm:p-5 text-left shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md cursor-pointer"
                        >
                          <div className={`absolute inset-y-0 left-0 w-1.5 ${isOverLimit ? 'bg-rose-500' : portfolio.status === 'INCOMPLETE_PRICING' ? 'bg-amber-400' : 'bg-[#0b5a4b]'}`} />
                          <div className="flex items-start justify-between gap-3 pl-1.5">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${isOverLimit ? 'border-rose-100 bg-rose-50 text-rose-600' : 'border-emerald-100 bg-emerald-50 text-[#0b5a4b]'}`}>
                                <Briefcase className="h-5 w-5" />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-base font-extrabold tracking-tight text-slate-900 font-cute">{portfolio.name}</p>
                                <p className="mt-0.5 text-xs text-slate-500 font-cute">{portfolio.holdings_count} {isThai ? 'รายการในพอร์ต' : 'positions in portfolio'}</p>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <span className={`rounded-full px-3 py-1 text-xs font-bold font-cute ${isOverLimit ? 'bg-rose-100 text-rose-700' : portfolio.status === 'INCOMPLETE_PRICING' ? 'bg-amber-100 text-amber-700' : portfolio.status === 'WITHIN_LIMIT' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                {isOverLimit ? (isThai ? 'เกิน Max' : 'Above max') : portfolio.status === 'INCOMPLETE_PRICING' ? (isThai ? 'ราคายังไม่ครบ' : 'Partial pricing') : portfolio.status === 'WITHIN_LIMIT' ? (isThai ? 'อยู่ในกรอบ' : 'Within limit') : (isThai ? 'ไม่ได้ตั้ง Max' : 'No limit')}
                              </span>
                              <ChevronRight className="h-4 w-4 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5" />
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200/80 bg-white sm:grid-cols-4 shadow-2xs">
                            <div className="border-b border-r border-slate-100 p-3 sm:border-b-0"><span className="block text-xs font-bold text-slate-500 font-cute">{isThai ? 'มูลค่า' : 'Value'}</span><strong className="mt-0.5 block font-mono text-sm sm:text-base font-bold text-slate-900">{portfolio.market_value !== null ? `$${portfolio.market_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}</strong></div>
                            <div className="border-b border-slate-100 p-3 sm:border-b-0 sm:border-r"><span className="block text-xs font-bold text-slate-500 font-cute">{isThai ? 'สัดส่วนจริง' : 'Actual weight'}</span><strong className="mt-0.5 block font-mono text-sm sm:text-base font-bold text-slate-900">{actualWeight !== null ? `${actualWeight.toFixed(1)}%` : '—'}</strong></div>
                            <div className="border-r border-slate-100 p-3"><span className="block text-xs font-bold text-slate-500 font-cute">{isThai ? 'เป้าหมาย' : 'Target'}</span><strong className="mt-0.5 block font-mono text-sm sm:text-base font-bold text-slate-900">{targetWeight !== null ? `${targetWeight.toFixed(1)}%` : '—'}</strong></div>
                            <div className="p-3"><span className="block text-xs font-bold text-slate-500 font-cute">{isThai ? 'เพดานสูงสุด' : 'Maximum'}</span><strong className={isOverLimit ? 'mt-0.5 block font-mono text-sm sm:text-base font-bold text-rose-600' : 'mt-0.5 block font-mono text-sm sm:text-base font-bold text-slate-900'}>{maximumWeight !== null ? `${maximumWeight.toFixed(1)}%` : '—'}</strong></div>
                          </div>

                          <div className="mt-3.5 rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-3">
                            <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                              <span className="font-bold text-slate-700 font-cute">{isThai ? 'สัดส่วนเทียบกรอบที่ตั้งไว้' : 'Weight against allocation limits'}</span>
                              <span className="font-mono font-bold text-slate-900">{actualWeight !== null ? `${actualWeight.toFixed(1)}%` : '—'}</span>
                            </div>
                            <div className="relative h-3.5 overflow-hidden rounded-full bg-slate-200/80 shadow-inner">
                              <motion.span initial={{ width: 0 }} animate={{ width: `${weightWidth}%` }} transition={{ duration: 0.36, ease: 'easeOut' }} className={`absolute inset-y-0 left-0 rounded-full ${barTone}`} />
                              {targetWeight !== null && <span className="absolute -top-0.5 bottom-0.5 z-10 w-1.5 rounded-full bg-slate-800 shadow-xs" style={{ left: markerPosition(targetWeight) }} title={`${isThai ? 'เป้าหมาย' : 'Target'} ${targetWeight.toFixed(1)}%`} />}
                              {maximumWeight !== null && <span className="absolute -top-0.5 bottom-0.5 z-10 w-1.5 rounded-full bg-rose-500 shadow-xs" style={{ left: markerPosition(maximumWeight) }} title={`${isThai ? 'เพดานสูงสุด' : 'Maximum'} ${maximumWeight.toFixed(1)}%`} />}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-cute">
                              <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-slate-800" />{isThai ? 'เป้าหมาย' : 'Target'} {targetWeight !== null ? `${targetWeight.toFixed(1)}%` : '—'}</span>
                              <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-rose-500" />{isThai ? 'Max' : 'Maximum'} {maximumWeight !== null ? `${maximumWeight.toFixed(1)}%` : '—'}</span>
                              <span className="text-slate-400">·</span>
                              <span>{isThai ? 'ครอบคลุมราคา' : 'Pricing coverage'} {portfolio.pricing_coverage_pct.toFixed(0)}%</span>
                            </div>
                          </div>

                          {portfolio.drift_pct_points !== null && (
                            <div className={`mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl px-3 py-2 text-xs font-bold font-cute ${isOverLimit ? 'bg-rose-50 text-rose-700 border border-rose-200/60' : Math.abs(portfolio.drift_pct_points) >= 5 ? 'bg-amber-50 text-amber-700 border border-amber-200/60' : 'bg-slate-100 text-slate-700'}`}>
                              <span>{isThai ? 'ต่างจากเป้า' : 'Drift'} {portfolio.drift_pct_points > 0 ? '+' : ''}{portfolio.drift_pct_points.toFixed(1)} pp</span>
                              {portfolio.excess_pct_points !== null && <span className="opacity-80">• {isThai ? 'เกิน Max' : 'Above max'} +{portfolio.excess_pct_points.toFixed(1)} pp</span>}
                            </div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </motion.section>

              {selectedRawHoldings.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.3fr] gap-3.5 sm:gap-4">
                  <motion.section
                    layout
                    className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-[#0b5a4b] border border-emerald-100/80">
                          <PieChart className="w-4.5 h-4.5" />
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 font-cute-heading">
                          {isThai ? 'สัดส่วนพอร์ต' : 'Portfolio Allocation'}
                        </h3>
                      </div>
                      <div className="flex rounded-xl bg-slate-100/90 p-1 border border-slate-200/60" role="group" aria-label={isThai ? 'เลือกมุมมองสัดส่วนพอร์ต' : 'Select allocation view'}>
                        {([
                          ...(selectedPortfolioId === 'all' ? [{ id: 'portfolios' as const, label: isThai ? 'พอร์ต' : 'Portfolios' }] : []),
                          { id: 'stocks' as const, label: isThai ? 'หุ้น' : 'Stocks' },
                          { id: 'sectors', label: isThai ? 'หมวดธุรกิจ' : 'Sectors' }
                        ] as const).map(option => (
                          <motion.button
                            key={option.id}
                            type="button"
                            whileTap={{ scale: 0.96 }}
                            onClick={() => setAllocationView(option.id)}
                            className={`relative isolate overflow-hidden rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer font-cute ${
                              allocationView === option.id
                                ? 'text-slate-900'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                            aria-pressed={allocationView === option.id}
                            title={option.id === 'portfolios'
                              ? (isThai ? 'แสดงสัดส่วนแยกตามพอร์ต' : 'Show allocation by portfolio')
                              : option.id === 'stocks'
                              ? (isThai ? 'แสดงสัดส่วนแยกตามหุ้น' : 'Show allocation by stock')
                              : (isThai ? 'แสดงสัดส่วนแยกตามหมวดธุรกิจ' : 'Show allocation by sector')}
                          >
                            {allocationView === option.id && (
                              <motion.span
                                layoutId="portfolio-allocation-active-tab"
                                className="absolute inset-0 -z-10 rounded-lg bg-white shadow-xs ring-1 ring-slate-900/5"
                                transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.75 }}
                              />
                            )}
                            <span className="relative z-10">{option.label}</span>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-4 min-[440px]:flex-row min-[440px]:gap-6">
                      <div
                        className="relative h-32 w-32 sm:h-36 sm:w-36 shrink-0 rounded-full shadow-inner"
                        aria-label={allocationView === 'portfolios'
                          ? (isThai ? 'กราฟสัดส่วนรวมแยกตามพอร์ต' : 'Overall allocation by portfolio')
                          : allocationView === 'stocks'
                          ? (isThai ? 'กราฟสัดส่วนพอร์ตตามหุ้น' : 'Portfolio allocation by stock')
                          : (isThai ? 'กราฟสัดส่วนพอร์ตตามหมวดธุรกิจ' : 'Portfolio allocation by sector')}
                      >
                        <AnimatePresence initial={false} mode="sync">
                          <motion.div
                            key={allocationView}
                            initial={{ opacity: 0, scale: 0.96, rotate: -5 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            exit={{ opacity: 0, scale: 1.025, rotate: 5 }}
                            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                            className="absolute inset-0 rounded-full shadow-inner"
                            style={{ background: donutGradient }}
                          />
                        </AnimatePresence>
                        <div className="absolute inset-[24px] rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.06)] flex flex-col items-center justify-center">
                          <AnimatePresence mode="wait" initial={false}>
                            <motion.div
                              key={allocationView}
                              initial={{ opacity: 0, y: 3 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -3 }}
                              transition={{ duration: 0.16, ease: 'easeOut' }}
                              className="flex flex-col items-center justify-center"
                            >
                              <span className="font-mono text-xl font-extrabold text-slate-900">{allocationItems.length}</span>
                              <span className="text-xs text-slate-500 font-bold font-cute">
                                {allocationView === 'portfolios'
                                  ? (isThai ? 'พอร์ต' : 'Portfolios')
                                  : allocationView === 'stocks'
                                  ? (isThai ? 'หุ้น' : 'Stocks')
                                  : (isThai ? 'หมวด' : 'Sectors')}
                              </span>
                            </motion.div>
                          </AnimatePresence>
                        </div>
                      </div>
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.div
                          key={allocationView}
                          initial={{ opacity: 0, y: 3, filter: 'blur(2px)' }}
                          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                          exit={{ opacity: 0, y: -3, filter: 'blur(2px)' }}
                          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                          className="w-full min-w-0 flex-1 max-h-36 space-y-2 overflow-y-auto pr-1"
                        >
                        {allocationItems.map((item) => (
                          <div key={item.key} className="flex items-center gap-2 text-xs sm:text-sm font-cute" title={`${item.label}: ${item.allocationPct.toFixed(1)}%`}>
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                            {item.ticker && <CompanyLogo ticker={item.ticker} className="w-6 h-6 sm:w-7 sm:h-7" imgClassName="scale-110" />}
                            <span className={`min-w-0 flex-1 truncate text-slate-700 ${item.ticker ? 'font-mono font-bold' : 'font-medium'}`}>
                              {item.label}
                            </span>
                            <span className="font-mono font-bold text-slate-900">{item.allocationPct.toFixed(1)}%</span>
                          </div>
                        ))}
                        {displaySummary.unpriced_holdings_count > 0 && (
                          <p className="pt-1 text-xs leading-relaxed text-amber-700 font-cute font-medium">
                            {isThai
                              ? `ยังคำนวณสัดส่วนจริงไม่ได้ เพราะขาดราคาตลาด ${displaySummary.unpriced_holdings_count} รายการ`
                              : `Exact allocation is unavailable because ${displaySummary.unpriced_holdings_count} holding(s) lack market prices`}
                          </p>
                        )}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </motion.section>

                  <motion.section
                    layout
                    className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] flex flex-col justify-between"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200/80">
                          <AlertTriangle className="w-4.5 h-4.5" />
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 font-cute-heading">
                          {isThai ? 'Research Attention' : 'Research Attention'}
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: isThai ? 'ควรทบทวน' : 'Review', value: researchStats.needsReview, tone: 'bg-amber-50 text-amber-800 border-amber-200', hint: isThai ? 'หุ้นที่มีเหตุผลให้กลับไปทบทวนงานวิเคราะห์' : 'Holdings with a reason to revisit the research' },
                          { label: isThai ? 'Thesis ปกติ' : 'Thesis intact', value: researchStats.thesisIntact, tone: 'bg-emerald-50 text-emerald-800 border-emerald-200', hint: isThai ? 'Thesis ยังไม่พบสัญญาณผิดเงื่อนไข' : 'Thesis has no detected invalidation signal' },
                          { label: isThai ? 'พลาดเป้า' : 'Missed', value: researchStats.expectationsMissed, tone: 'bg-rose-50 text-rose-800 border-rose-200', hint: isThai ? 'มี expectation อย่างน้อยหนึ่งรายการที่พลาดเป้า' : 'At least one tracked expectation was missed' },
                          { label: isThai ? 'SEC ใหม่' : 'New filing', value: researchStats.newFilings, tone: 'bg-sky-50 text-sky-800 border-sky-200', hint: isThai ? 'มีเอกสาร SEC ใหม่ที่ยังไม่ได้อ่าน' : 'Unread SEC filing is available' },
                          { label: isThai ? 'ข้อมูลเก่า' : 'Stale', value: researchStats.staleResearch, tone: 'bg-slate-100 text-slate-700 border-slate-200', hint: isThai ? 'งานวิเคราะห์ล่าสุดมีอายุ 45 วันขึ้นไป' : 'Latest research is at least 45 days old' }
                        ].map(stat => (
                          <span key={stat.label} title={stat.hint} className={`rounded-full border px-3 py-1 text-xs font-bold font-cute cursor-help ${stat.tone}`}>
                            {stat.label} {stat.value}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {portfolioResearchRows
                        .filter(row => row.attention !== 'NORMAL')
                        .sort((a, b) => (a.attention === 'HIGH' ? -1 : 0) - (b.attention === 'HIGH' ? -1 : 0))
                        .slice(0, 3)
                        .map(row => (
                          <motion.button
                            key={row.ticker}
                            type="button"
                            whileHover={{ x: 2 }}
                            onClick={() => {
                              if (!onSelectTicker) return;
                              onSelectTicker(row.ticker);
                              onClose();
                            }}
                            className="w-full rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 text-left hover:border-slate-300 hover:bg-white transition-all cursor-pointer shadow-2xs"
                            title={row.attentionReason}
                          >
                            <div className="flex items-center gap-2.5">
                              <CompanyLogo ticker={row.ticker} className="w-8 h-8" imgClassName="scale-110" />
                              <span className="font-mono text-base font-extrabold text-slate-900">{row.ticker}</span>
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold tracking-wide ${
                                row.attention === 'HIGH' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}>
                                {row.attention === 'HIGH' ? 'HIGH' : 'REVIEW'}
                              </span>
                              <ArrowRight className="ml-auto h-4 w-4 text-slate-400" />
                            </div>
                            <p className="mt-1.5 truncate pl-10 text-xs text-slate-600 font-cute font-medium">{row.attentionReason}</p>
                          </motion.button>
                        ))}
                      {researchStats.needsReview === 0 && (
                        <div className="flex min-h-20 items-center justify-center gap-2 rounded-2xl bg-emerald-50/70 text-xs font-bold font-cute text-emerald-800 border border-emerald-100">
                          <ShieldCheck className="h-5 w-5" />
                          {isThai ? 'ยังไม่มีรายการที่ต้องกลับไปทบทวน' : 'No holdings currently need research review'}
                        </div>
                      )}
                    </div>
                  </motion.section>
                </div>
              )}

              {selectedPortfolioId === 'all' && multiPortfolioSummary.aggregate_tickers.length > 0 && (
                <motion.section layout className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)]">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-[#0b5a4b] border border-emerald-100/80">
                        <Layers className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 font-cute-heading">{isThai ? 'หุ้นรวมทุกพอร์ต' : 'Aggregate ticker exposure'}</h3>
                        <p className="text-xs text-slate-500 font-cute">{isThai ? 'รวม ticker เดียวกันจากทุกพอร์ตเพื่อไม่ให้ความเสี่ยงถูกซ่อน' : 'The same ticker is combined across portfolios so exposure stays visible'}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold font-cute text-slate-700">{multiPortfolioSummary.aggregate_tickers.length} {isThai ? 'หุ้น' : 'tickers'}</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {multiPortfolioSummary.aggregate_tickers.map(aggregate => (
                      <button
                        key={aggregate.ticker}
                        type="button"
                        onClick={() => { setSelectedAggregateTicker(aggregate.ticker); setDrawerMode('aggregate'); }}
                        className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 text-left transition-all hover:border-slate-300 hover:bg-white hover:shadow-xs cursor-pointer"
                      >
                        <CompanyLogo ticker={aggregate.ticker} className="h-9 w-9" imgClassName="scale-110" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-sm font-extrabold text-slate-900">{aggregate.ticker}</span>
                            <span className="text-xs text-slate-500 font-cute">{aggregate.portfolios.length} {isThai ? 'พอร์ต' : 'portfolios'}</span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500 font-cute">{isThai ? 'มูลค่ารวม' : 'Total value'} <span className="font-mono font-bold text-slate-800">{aggregate.total_market_value !== null ? `$${aggregate.total_market_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}</span></p>
                        </div>
                        <div className="text-right">
                          <strong className={`block font-mono text-sm ${aggregate.status === 'ABOVE_MAX' ? 'text-rose-600' : 'text-slate-900'}`}>{aggregate.total_pct_of_total !== null ? `${aggregate.total_pct_of_total.toFixed(1)}%` : '—'}</strong>
                          <span className="text-xs text-slate-500 font-mono">Max {aggregate.overall_max_pct !== null ? `${aggregate.overall_max_pct.toFixed(1)}%` : '—'}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    ))}
                  </div>
                </motion.section>
              )}

              {selectedRawHoldings.length > 0 && (
                <motion.section layout className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-[#0b5a4b] border border-emerald-100/80">
                        <Layers className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 font-cute-heading">
                          {isThai ? 'การกระจาย Margin of Safety' : 'Margin of Safety Distribution'}
                        </h3>
                        <p className="text-xs text-slate-500 font-cute">
                          {isThai ? 'จำนวนหุ้นในแต่ละช่วงมูลค่า' : 'Holdings grouped by valuation range'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {mosDistribution.map(bucket => (
                        <div key={bucket.id} title={`${bucket.label}: ${bucket.count}`} className="flex items-center gap-1.5 text-xs font-cute cursor-help">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: bucket.color }} />
                          <span className="text-slate-600">{bucket.label}</span>
                          <span className={`font-mono font-bold ${bucket.tone}`}>{bucket.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3.5 flex h-3.5 overflow-hidden rounded-full bg-slate-100 shadow-inner" aria-label="Margin of Safety distribution">
                    {mosDistribution.filter(bucket => bucket.percentage > 0).map(bucket => (
                      <motion.div
                        key={bucket.id}
                        initial={{ width: 0 }}
                        animate={{ width: `${bucket.percentage}%` }}
                        transition={{ type: 'spring', stiffness: 180, damping: 24 }}
                        style={{ backgroundColor: bucket.color }}
                        title={`${bucket.label}: ${bucket.count}`}
                      />
                    ))}
                  </div>
                </motion.section>
              )}

              {/* Holdings Table */}
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 overflow-hidden shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)]">
                {selectedRawHoldings.length > 0 && (
                  <div className="flex flex-col gap-3 border-b border-slate-200/80 bg-slate-50/70 px-5 sm:px-6 py-3.5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                      <SlidersHorizontal className="mr-1 h-4 w-4 shrink-0 text-slate-400" />
                      {([
                        { id: 'all', label: isThai ? 'ทั้งหมด' : 'All' },
                        { id: 'review', label: isThai ? 'ควรทบทวน' : 'Needs Review' },
                        { id: 'overvalued', label: isThai ? 'ราคาสูง' : 'Overvalued' },
                        { id: 'no-thesis', label: isThai ? 'ไม่มี Thesis' : 'No Thesis' },
                        { id: 'stale', label: isThai ? 'ข้อมูลเก่า' : 'Stale' }
                      ] as const).map(option => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setPortfolioFilter(option.id)}
                          aria-pressed={portfolioFilter === option.id}
                          className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer font-cute ${
                            portfolioFilter === option.id
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'bg-white text-slate-600 border border-slate-200/80 hover:text-slate-900 hover:bg-slate-100'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                      <span className="ml-1 text-xs text-slate-500 font-mono font-semibold">
                        {filteredSortedHoldings.length}/{selectedRawHoldings.length}
                      </span>
                    </div>
                    <label className="flex shrink-0 items-center gap-2 text-xs font-bold text-slate-700 font-cute">
                      {isThai ? 'เรียงตาม' : 'Sort by'}
                      <PortfolioPicker
                        value={portfolioSort}
                        onChange={(next) => setPortfolioSort(next as typeof portfolioSort)}
                        ariaLabel={isThai ? 'เรียงรายการพอร์ต' : 'Sort portfolio entries'}
                        className="w-44 font-cute"
                        compact
                        options={[
                          { value: 'attention', label: isThai ? 'ลำดับที่ควรดู' : 'Attention priority' },
                          { value: 'weight', label: isThai ? 'สัดส่วนมากสุด' : 'Weight' },
                          { value: 'pnl', label: 'P/L' },
                          { value: 'mos', label: 'Margin of Safety' },
                          { value: 'research', label: isThai ? 'งานวิจัยเก่าสุด' : 'Research age' }
                        ]}
                      />
                    </label>
                  </div>
                )}
                {selectedRawHoldings.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs italic font-cute">
                    {selectedPortfolioId === 'all'
                      ? (isThai ? 'ยังไม่มีหุ้นในพอร์ตการลงทุน กด “เพิ่มหุ้นในพอร์ต” เพื่อเริ่มบันทึก' : 'No holdings recorded yet. Choose “Add Holding” to begin.')
                      : (isThai ? 'พอร์ตที่เลือกยังไม่มีหุ้น' : 'The selected portfolio has no positions yet.')}
                  </div>
                ) : (
                  <>
                  <div className="space-y-2.5 p-3.5 md:hidden">
                    {filteredSortedHoldings.map(h => {
                      const research = portfolioResearchByTicker.get(h.ticker.toUpperCase());
                      const allocation = positionAllocationById.get(h.id || `${h.portfolio_id || 'unassigned'}:${h.ticker}`);
                      return (
                        <button
                          key={h.id || `${h.portfolio_id || 'unassigned'}:${h.ticker}`}
                          type="button"
                          onClick={() => { setSelectedHoldingId(h.id || `${h.portfolio_id || 'unassigned'}:${h.ticker}`); setDrawerMode('position'); }}
                          className="w-full rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-left transition-all hover:bg-white shadow-2xs cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <CompanyLogo ticker={h.ticker} className="h-10 w-10" imgClassName="scale-110" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-mono text-base font-extrabold text-slate-900">{h.ticker}</span>
                                <span className="rounded-full bg-white px-2.5 py-0.5 text-xs text-slate-700 font-cute border border-slate-200/70 font-semibold">{allocation?.portfolio_name}</span>
                                {research?.attention !== 'NORMAL' && <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800 font-cute border border-amber-200">{research?.attention}</span>}
                              </div>
                              <p className="mt-1 text-xs text-slate-500 font-cute">{h.quantity.toLocaleString()} @ ${h.average_cost.toFixed(2)}</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          </div>
                          <div className="mt-3.5 grid grid-cols-3 gap-2 text-xs rounded-xl bg-white p-3 border border-slate-100 shadow-2xs">
                            <div><span className="block text-slate-500 font-cute font-medium">{isThai ? 'มูลค่า' : 'Value'}</span><strong className="font-mono text-sm font-bold text-slate-900">{typeof h.market_value === 'number' ? `$${h.market_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}</strong></div>
                            <div><span className="block text-slate-500 font-cute font-medium">{isThai ? 'ในพอร์ต / รวม' : 'Within / Total'}</span><strong className="font-mono text-sm font-bold text-slate-900">{allocation?.pct_within_portfolio !== null ? `${allocation?.pct_within_portfolio.toFixed(1)}%` : '—'} / {allocation?.pct_of_total !== null ? `${allocation?.pct_of_total.toFixed(1)}%` : '—'}</strong></div>
                            <div><span className="block text-slate-500 font-cute font-medium">P/L</span><strong className={`font-mono text-sm font-bold ${typeof h.unrealized_pnl === 'number' && h.unrealized_pnl < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{typeof h.unrealized_pnl_pct === 'number' ? `${h.unrealized_pnl_pct > 0 ? '+' : ''}${h.unrealized_pnl_pct.toFixed(1)}%` : '—'}</strong></div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[940px] text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200/80 bg-slate-100/80 text-xs font-bold text-slate-700 font-cute tracking-wide">
                          <th className="py-3.5 px-4">{isThai ? 'หุ้น' : 'Ticker'}</th>
                          <th className="py-3.5 px-3 text-right">{isThai ? 'มูลค่า' : 'Market Value'}</th>
                          <th className="py-3.5 px-3 text-right">{isThai ? 'ในพอร์ต / รวม' : 'Within / Overall'}</th>
                          <th className="py-3.5 px-3 text-right">{isThai ? 'กำไร/ขาดทุน' : 'P/L'}</th>
                          <th className="py-3.5 px-3 text-right">MoS</th>
                          <th className="py-3.5 px-3">Thesis</th>
                          <th className="py-3.5 px-3">{isThai ? 'วิเคราะห์ล่าสุด' : 'Last Research'}</th>
                          <th className="py-3.5 px-3">Attention</th>
                          <th className="py-3.5 px-3 text-center">{isThai ? 'จัดการ' : 'Action'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans">
                        {filteredSortedHoldings.map((h) => {
                          const research = portfolioResearchByTicker.get(h.ticker.toUpperCase());
                          return (
                          <tr
                            key={h.id || `${h.portfolio_id || 'unassigned'}:${h.ticker}`}
                            className="group hover:bg-slate-50/90 transition-colors cursor-pointer"
                            onClick={() => {
                              setSelectedHoldingId(h.id || `${h.portfolio_id || 'unassigned'}:${h.ticker}`);
                              setDrawerMode('position');
                            }}
                          >
                            <td className="py-3.5 px-4 font-bold font-mono text-slate-900">
                              <div className="flex items-center gap-3">
                                <CompanyLogo ticker={h.ticker} className="w-9 h-9" />
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-base font-extrabold text-slate-900">{h.ticker}</span>
                                    {h.sector && (
                                      <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-cute font-medium">
                                        {h.sector}
                                      </span>
                                    )}
                                  </div>
                                  <span className="block text-xs font-normal text-slate-500 font-cute mt-0.5">
                                    {positionAllocationById.get(h.id || `${h.portfolio_id || 'unassigned'}:${h.ticker}`)?.portfolio_name} · {h.quantity.toLocaleString()} @ ${h.average_cost.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">
                              <span className="text-sm sm:text-base">{typeof h.market_value === 'number' ? `$${h.market_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}</span>
                              <span className="block text-xs font-normal text-slate-500 font-mono mt-0.5">
                                {typeof h.current_price === 'number' ? `@$${h.current_price.toFixed(2)}` : (isThai ? 'ไม่มีราคาสด' : 'No quote')}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono font-semibold text-slate-700">
                              {(() => {
                                const allocation = positionAllocationById.get(h.id || `${h.portfolio_id || 'unassigned'}:${h.ticker}`);
                                return <>
                                  <span className="text-sm font-bold text-slate-900">{allocation?.pct_within_portfolio !== null && allocation?.pct_within_portfolio !== undefined ? `${allocation.pct_within_portfolio.toFixed(1)}%` : '—'}</span>
                                  <span className="block text-xs font-normal text-slate-500 font-cute mt-0.5">{isThai ? 'รวม' : 'overall'} {allocation?.pct_of_total !== null && allocation?.pct_of_total !== undefined ? `${allocation.pct_of_total.toFixed(1)}%` : '—'}</span>
                                </> ;
                              })()}
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono">
                              {typeof h.unrealized_pnl === 'number' ? (
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className={`text-sm font-bold ${h.unrealized_pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {h.unrealized_pnl >= 0 ? '+' : ''}${h.unrealized_pnl.toFixed(2)}
                                  </span>
                                  {h.unrealized_pnl_pct !== null && h.unrealized_pnl_pct !== undefined && (
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
                                      h.unrealized_pnl_pct >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70' : 'bg-rose-50 text-rose-700 border-rose-200/70'
                                    }`}>
                                      {h.unrealized_pnl_pct >= 0 ? '+' : ''}{h.unrealized_pnl_pct.toFixed(2)}%
                                    </span>
                                  )}
                                </div>
                              ) : '-'}
                            </td>
                            <td className={`py-3.5 px-3 text-right font-mono font-bold ${
                              typeof h.margin_of_safety_pct !== 'number'
                                ? 'text-slate-400'
                                : h.margin_of_safety_pct >= 20
                                  ? 'text-emerald-700'
                                  : h.margin_of_safety_pct >= 0 ? 'text-slate-700' : 'text-amber-700'
                            }`}>
                              <span className="text-sm sm:text-base">
                                {typeof h.margin_of_safety_pct === 'number'
                                  ? `${h.margin_of_safety_pct > 0 ? '+' : ''}${h.margin_of_safety_pct.toFixed(1)}%`
                                  : '-'}
                              </span>
                            </td>
                            <td className="py-3.5 px-3">
                              {research && (
                                <span title={research.thesis?.summary || research.thesisLabel} className={`inline-flex rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap font-cute cursor-help ${
                                  research.thesisTone === 'healthy'
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : research.thesisTone === 'review'
                                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}>
                                  {research.thesisLabel}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-3 text-slate-600 whitespace-nowrap">
                              {research?.daysSinceResearch !== null && research?.daysSinceResearch !== undefined ? (
                                <>
                                  <span className={`font-cute font-bold text-xs ${research.daysSinceResearch >= 45 ? 'text-amber-700' : 'text-slate-800'}`}>
                                    {research.daysSinceResearch === 0
                                      ? (isThai ? 'วันนี้' : 'Today')
                                      : (isThai ? `${research.daysSinceResearch} วัน` : `${research.daysSinceResearch}d`)}
                                  </span>
                                  <span className="block text-xs text-slate-500 font-cute mt-0.5" title={isThai ? `วิเคราะห์เมื่อ ${research.researchDate}` : `Analyzed on ${research.researchDate}`}>{research.researchDate}</span>
                                </>
                              ) : (
                                <span className="text-xs text-slate-400 font-cute" title={isThai ? 'ยังไม่มีประวัติการวิเคราะห์' : 'No research history available'}>{isThai ? 'ยังไม่มีข้อมูล' : 'Unavailable'}</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {research && (
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ${
                                    research.attention === 'HIGH'
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : research.attention === 'REVIEW'
                                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  }`}
                                  title={research.attentionReason}
                                >
                                  {research.attention === 'HIGH'
                                    ? 'HIGH'
                                    : research.attention === 'REVIEW'
                                      ? 'REVIEW'
                                      : (isThai ? 'ปกติ' : 'NORMAL')}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {onSelectTicker && (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onSelectTicker(h.ticker);
                                      onClose();
                                    }}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#0b5a4b] hover:bg-emerald-50 transition-colors cursor-pointer"
                                    aria-label={isThai ? `วิเคราะห์ ${h.ticker}` : `Analyze ${h.ticker}`}
                                    title={isThai ? 'วิเคราะห์หุ้นตัวนี้' : 'Analyze this stock'}
                                  >
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openEditHoldingDrawer(h);
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer"
                                  aria-label={isThai ? `แก้ไข ${h.ticker}` : `Edit ${h.ticker}`}
                                  title={isThai ? 'แก้ไขรายการ' : 'Edit holding'}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleRemoveHolding(h.id);
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  aria-label={isThai ? `ลบ ${h.ticker}` : `Remove ${h.ticker}`}
                                  title={isThai ? 'ลบรายการ' : 'Remove holding'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );})}
                        {filteredSortedHoldings.length === 0 && (
                          <tr>
                            <td colSpan={9} className="px-4 py-8 text-center text-xs text-stone-500">
                              {isThai ? 'ไม่มีหุ้นที่ตรงกับตัวกรองนี้' : 'No holdings match this filter'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  </>
                )}
              </div>

            </>
          )}

          {/* TAB 2: WATCHLIST */}
          {activeTab === 'watchlist' && (
            <div className="flex flex-col gap-4">
              {watchlistEntries.length > 0 && (
                <section className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.35fr_0.9fr]">
                  <div className="rounded-2xl border border-stone-200/90 bg-stone-50/70 p-4 sm:p-5 shadow-xs">
                    <div className="mb-3.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Target className="h-4.5 w-4.5 text-[#0b5a4b]" />
                        <h3 className="text-sm sm:text-base font-bold text-stone-900 font-cute-heading">
                          {isThai ? 'หุ้นที่ควรดูก่อน' : 'Top Research Priority'}
                        </h3>
                      </div>
                      <span title={isThai ? watchlistEntries[0].summaryReasonTh : watchlistEntries[0].summaryReason} className={`rounded-full border px-2.5 py-1 text-xs font-bold font-cute cursor-help ${
                        watchlistEntries[0].priority === 'URGENT_ATTENTION'
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : watchlistEntries[0].priority === 'REVIEW_RECOMMENDED'
                            ? 'border-amber-200 bg-amber-50 text-amber-700'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      }`}>
                        {watchlistEntries[0].attentionScore}/100
                      </span>
                    </div>
                    <div className="flex items-start gap-3.5">
                      <CompanyLogo ticker={watchlistEntries[0].ticker} className="h-11 w-11" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-base font-extrabold text-stone-900">{watchlistEntries[0].ticker}</span>
                          {typeof watchlistEntries[0].currentPrice === 'number' && (
                            <span className="rounded-md bg-white px-2 py-0.5 text-xs font-mono font-bold text-stone-700 border border-stone-200">
                              ${watchlistEntries[0].currentPrice.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-stone-700 font-cute">
                          {isThai ? watchlistEntries[0].summaryReasonTh : watchlistEntries[0].summaryReason}
                        </p>
                      </div>
                      {onSelectTicker && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectTicker(watchlistEntries[0].ticker);
                            onClose();
                          }}
                          className="shrink-0 rounded-xl bg-[#0b5a4b] px-3.5 py-2 text-xs font-bold font-cute text-white hover:bg-[#09473b] cursor-pointer shadow-xs"
                        >
                          {isThai ? 'เปิด Research' : 'Open Research'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-stone-200/90 bg-white p-3.5 shadow-xs">
                    {[
                      { label: isThai ? 'เร่งด่วน' : 'Urgent', value: watchlistStats.urgent, tone: 'text-rose-600 bg-rose-50 border border-rose-100' },
                      { label: isThai ? 'ควรทบทวน' : 'Review', value: watchlistStats.review, tone: 'text-amber-700 bg-amber-50 border border-amber-100' },
                      { label: isThai ? 'ปกติ' : 'Routine', value: watchlistStats.routine, tone: 'text-emerald-700 bg-emerald-50 border border-emerald-100' },
                      { label: isThai ? 'ไม่มี Research' : 'No Research', value: watchlistStats.withoutResearch, tone: 'text-stone-700 bg-stone-100 border border-stone-200/60' }
                    ].map(stat => (
                      <div key={stat.label} title={`${stat.label}: ${stat.value}`} className={`rounded-xl px-3.5 py-2.5 cursor-help ${stat.tone}`}>
                        <span className="block text-xl font-mono font-extrabold">{stat.value}</span>
                        <span className="text-xs font-bold font-cute">{stat.label}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Add Watchlist Ticker input */}
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <form onSubmit={handleAddWatchlistTicker} className="flex min-w-0 items-center gap-2">
                  <input
                    type="text"
                    placeholder={isThai ? "พิมพ์ชื่อย่อหุ้น e.g. NVDA, AMZN" : "Enter ticker e.g. NVDA, AMZN"}
                    value={newWatchTicker}
                    onChange={(e) => setNewWatchTicker(e.target.value.toUpperCase())}
                    className="min-w-0 flex-1 sm:flex-none px-4 py-2.5 text-xs sm:text-sm font-mono font-bold text-stone-900 placeholder:text-stone-400 bg-stone-50 border border-stone-200 rounded-xl uppercase sm:max-w-xs focus:bg-white focus:border-[#0b5a4b] transition-colors"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-gradient-to-r from-[#0b5a4b] to-[#127a65] hover:brightness-105 text-white text-xs sm:text-sm font-bold font-cute rounded-xl transition duration-200 shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isThai ? 'เพิ่มใน Watchlist' : 'Add to Watchlist'}</span>
                  </button>
                </form>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {([
                    { id: 'all', label: isThai ? 'ทั้งหมด' : 'All', count: watchlist.length },
                    { id: 'urgent', label: isThai ? 'เร่งด่วน' : 'Urgent', count: watchlistStats.urgent },
                    { id: 'review', label: isThai ? 'ทบทวน' : 'Review', count: watchlistStats.review },
                    { id: 'routine', label: isThai ? 'ปกติ' : 'Routine', count: watchlistStats.routine }
                  ] as const).map(option => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setWatchlistFilter(option.id)}
                      aria-pressed={watchlistFilter === option.id}
                      className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer font-cute ${
                        watchlistFilter === option.id
                          ? 'bg-stone-900 text-white shadow-2xs'
                          : 'border border-stone-200 bg-white text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                      }`}
                    >
                      {option.label} {option.count}
                    </button>
                  ))}
                </div>
              </div>

              {/* Watchlist Table */}
              <div className="bg-white rounded-2xl border border-stone-200/90 overflow-hidden shadow-xs divide-y divide-stone-100">
                {watchlist.length === 0 ? (
                  <div className="p-8 text-center space-y-3">
                    <p className="text-stone-500 text-xs italic font-cute">
                      {isThai ? 'ยังไม่มีหุ้นใน Watchlist ของคุณ' : 'No stocks on your watchlist.'}
                    </p>
                    <div className="pt-2">
                      <span className="text-xs text-stone-600 font-bold block mb-2 font-cute">
                        {isThai ? 'หุ้นแนะนำเริ่มต้น (Suggested Tickers):' : 'Suggested Tickers:'}
                      </span>
                      <div className="flex flex-wrap justify-center gap-2">
                        {SUGGESTED_WATCHLIST_TICKERS.map((sug) => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => {
                              const next = Array.from(new Set([...watchlist, sug]));
                              setWatchlist(next);
                              saveLocalWatchlist(next, user?.uid);
                            }}
                            className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 text-[#0b5a4b]" />
                            <CompanyLogo ticker={sug} className="w-5 h-5" />
                            <span>{sug}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  visibleWatchlistEntries.map((entry) => {
                    const tick = entry.ticker;
                    const q = activeQuotes[tick];
                    const price = typeof q === 'number' ? q : q?.price;
                    let priorityBadgeClass = 'bg-stone-100 text-stone-600 border-stone-200';
                    let priorityLabel = isThai ? 'เฝ้าระวังปกติ' : 'Routine';

                    if (entry.priority === 'URGENT_ATTENTION') {
                      priorityBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
                      priorityLabel = isThai ? 'ต้องตรวจสอบเร่งด่วน' : 'Urgent';
                    } else if (entry.priority === 'REVIEW_RECOMMENDED') {
                      priorityBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                      priorityLabel = isThai ? 'ควรทบทวน' : 'Review';
                    }

                    return (
                      <div key={tick} className="p-4 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 hover:bg-emerald-50/15 transition-colors">
                        <div className="flex flex-col gap-1.5 min-w-0">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <CompanyLogo ticker={tick} className="w-8 h-8" />
                            <span className="font-mono font-extrabold text-base text-stone-900">{tick}</span>
                            {typeof price === 'number' && (
                              <span className="font-mono font-bold text-xs text-stone-700 bg-stone-100 px-2.5 py-0.5 rounded-md">
                                ${price.toFixed(2)}
                              </span>
                            )}
                            <span title={isThai ? entry.summaryReasonTh : entry.summaryReason} className={`px-2.5 py-1 rounded-full text-xs font-bold font-cute border cursor-help ${priorityBadgeClass}`}>
                              {priorityLabel} • {entry.attentionScore}/100
                            </span>
                          </div>

                          <p className="text-xs sm:text-sm text-stone-600 font-cute truncate">
                            {isThai ? entry.summaryReasonTh : entry.summaryReason}
                          </p>

                          {entry.factors.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {entry.factors.map(f => (
                                <span key={f.code} title={isThai ? f.labelTh : f.label} className="text-xs font-cute px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200/80 cursor-help">
                                  {isThai ? f.labelTh : f.label} (+{f.points})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          {onOpenNewsForTicker && (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenNewsForTicker(tick, 'watchlist');
                                onClose();
                              }}
                              className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold font-cute rounded-xl transition duration-200 flex items-center gap-1.5 cursor-pointer"
                              title={isThai ? `ดูข่าว ${tick}` : `View ${tick} News`}
                              aria-label={isThai ? `ดูข่าว ${tick}` : `View ${tick} News`}
                            >
                              <Newspaper className="w-4 h-4 text-[#0b5a4b]" />
                              <span>{isThai ? 'ข่าว' : 'News'}</span>
                            </button>
                          )}
                          {onSelectTicker && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectTicker(tick);
                                onClose();
                              }}
                              className="px-3.5 py-2 bg-[#0b5a4b] hover:bg-[#09473b] text-white text-xs font-bold font-cute rounded-xl transition duration-200 flex items-center gap-1.5 shadow-xs cursor-pointer"
                              aria-label={isThai ? `วิเคราะห์ ${tick}` : `Analyze ${tick}`}
                            >
                              <span>{isThai ? 'วิเคราะห์' : 'Analyze'}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveWatchlistTicker(tick)}
                            className="inline-flex h-8 w-8 items-center justify-center text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            aria-label={isThai ? `ลบ ${tick} ออกจาก Watchlist` : `Remove ${tick} from watchlist`}
                            title={isThai ? 'ลบออกจาก Watchlist' : 'Remove from watchlist'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
                {watchlist.length > 0 && visibleWatchlistEntries.length === 0 && (
                  <div className="p-8 text-center text-xs text-stone-500 font-cute">
                    {isThai ? 'ไม่มีหุ้นในสถานะนี้' : 'No watchlist items match this filter'}
                  </div>
                )}
              </div>
            </div>
          )}

        </motion.div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-white flex items-center justify-between gap-3 text-xs text-slate-600 font-cute">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[#0b5a4b]">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="truncate text-slate-600 font-medium">
              {isThai ? 'ข้อมูลพอร์ตถูกจัดเก็บในเครื่องของคุณอย่างปลอดภัย (Local Storage)' : 'Saved locally in your browser with zero third-party leakage'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 transition-colors cursor-pointer"
          >
            {isThai ? 'ปิด' : 'Close'}
          </button>
        </div>

        <AnimatePresence>
          {drawerMode && (
            <motion.button
              type="button"
              aria-label={isThai ? 'ปิดแผงด้านข้าง' : 'Close side panel'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              onClick={closeDrawer}
              className="absolute inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px] cursor-default"
            />
          )}

          {drawerMode === 'holding-form' && (
            <motion.aside
              key="holding-form-drawer"
              initial={{ x: '100%', opacity: 0.7 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0.7 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32, mass: 0.82 }}
              className="absolute inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-[-20px_0_50px_rgba(15,23,42,0.15)]"
              aria-label={editingHoldingId ? (isThai ? 'แก้ไขหุ้นในพอร์ต' : 'Edit holding') : (isThai ? 'เพิ่มหุ้นในพอร์ต' : 'Add holding')}
            >
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0b5a4b] to-[#127a65] text-white shadow-sm">
                    {editingHoldingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-5 w-5" />}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 font-cute-heading">
                      {editingHoldingId
                        ? (isThai ? 'แก้ไขรายการลงทุน' : 'Edit Position')
                        : (isThai ? 'เพิ่มหุ้นแบบรวดเร็ว' : 'Quick Add Holding')}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500 font-cute">
                      {isThai ? 'กรอกเฉพาะข้อมูลที่จำเป็น ระบบคำนวณส่วนที่เหลือให้' : 'Enter the essentials; Lumina calculates the rest'}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={closeDrawer} aria-label={isThai ? 'ปิดแบบฟอร์ม' : 'Close form'} title={isThai ? 'ปิด' : 'Close'} className="shrink-0 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleAddHolding} className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-5">
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-slate-700 font-cute">{isThai ? 'ชื่อย่อหุ้น (Ticker)' : 'Ticker Symbol'}</span>
                    <input
                      type="text"
                      value={newTicker}
                      onChange={(event) => setNewTicker(event.target.value.toUpperCase())}
                      placeholder="MSFT"
                      required
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm font-bold uppercase text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#0b5a4b] focus:bg-white focus:ring-2 focus:ring-emerald-500/10 font-mono transition-all"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold text-slate-700 font-cute">{isThai ? 'จำนวนหุ้น' : 'Quantity'}</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={newQty}
                        onChange={(event) => setNewQty(event.target.value)}
                        placeholder="100"
                        required
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#0b5a4b] focus:bg-white focus:ring-2 focus:ring-emerald-500/10 font-mono transition-all"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold text-slate-700 font-cute">{isThai ? 'ต้นทุนเฉลี่ย ($)' : 'Average Cost ($)'}</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={newAvgCost}
                        onChange={(event) => setNewAvgCost(event.target.value)}
                        placeholder="420.50"
                        required
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#0b5a4b] focus:bg-white focus:ring-2 focus:ring-emerald-500/10 font-mono transition-all"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-slate-700 font-cute">{isThai ? 'พอร์ตที่จัดเก็บ' : 'Portfolio'}</span>
                    <PortfolioPicker
                      value={newPortfolioId}
                      onChange={(nextPortfolioId) => {
                        if (editingHoldingId && nextPortfolioId !== newPortfolioId) {
                          setNewTargetWeight('');
                          setNewMaxWeight('');
                        }
                        setNewPortfolioId(nextPortfolioId);
                        setFormError('');
                      }}
                      ariaLabel={isThai ? 'พอร์ตสำหรับหุ้นนี้' : 'Portfolio for this holding'}
                      options={[
                        { value: '', label: isThai ? 'เลือกพอร์ต…' : 'Choose a portfolio…', disabled: true },
                        { value: 'unassigned', label: isThai ? 'ยังไม่ได้จัดเข้าพอร์ต' : 'Unassigned' },
                        ...multiPortfolioConfig.portfolios.map(portfolio => ({ value: portfolio.id, label: portfolio.name }))
                      ]}
                    />
                    {editingHoldingId && <span className="mt-1 block text-xs leading-relaxed text-slate-500 font-cute">{isThai ? 'เมื่อย้ายพอร์ต Target/Max เดิมจะถูกล้างเพื่อป้องกันการใช้สัดส่วนผิดบริบท' : 'Changing portfolio clears the old Target/Max to prevent applying weights in the wrong context.'}</span>}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold text-slate-700 font-cute">{isThai ? 'Target ในพอร์ต (%)' : 'Target in portfolio (%)'}</span>
                      <input type="number" step="any" min="0" max="100" value={newTargetWeight} onChange={event => setNewTargetWeight(event.target.value)} disabled={newPortfolioId === 'unassigned'} placeholder="20" className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50 font-mono" />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold text-slate-700 font-cute">{isThai ? 'Max ในพอร์ต (%)' : 'Max in portfolio (%)'}</span>
                      <input type="number" step="any" min="0" max="100" value={newMaxWeight} onChange={event => setNewMaxWeight(event.target.value)} disabled={newPortfolioId === 'unassigned'} placeholder="30" className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50 font-mono" />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-slate-700 font-cute">{isThai ? 'Max ของหุ้นรวมทุกพอร์ต (%)' : 'Overall ticker maximum (%)'}</span>
                    <input type="number" step="any" min="0" max="100" value={newOverallTickerMax} onChange={event => setNewOverallTickerMax(event.target.value)} placeholder="15" className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 font-mono" />
                    <span className="mt-1 block text-xs text-slate-500 font-cute">{isThai ? 'จำกัด ticker นี้เมื่อรวมจากทุกพอร์ต' : 'Applies after combining this ticker across every portfolio.'}</span>
                  </label>
                  <div className="relative">
                    <span className="mb-1.5 block text-xs font-bold text-slate-700 font-cute">{isThai ? 'หมวดธุรกิจ (Sector)' : 'Sector'}</span>
                    <button
                      type="button"
                      onClick={() => setIsSectorMenuOpen(open => !open)}
                      className={`flex w-full items-center justify-between rounded-xl border bg-slate-50/70 px-3.5 py-2.5 text-sm font-medium text-slate-900 cursor-pointer ${isSectorMenuOpen ? 'border-[#0b5a4b] ring-2 ring-emerald-500/10' : 'border-slate-200'}`}
                      aria-expanded={isSectorMenuOpen}
                    >
                      {newSector}
                      <motion.span animate={{ rotate: isSectorMenuOpen ? 180 : 0 }}><ChevronDown className="h-4 w-4 text-slate-400" /></motion.span>
                    </button>
                    <AnimatePresence>
                      {isSectorMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -5, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -5, scale: 0.98 }}
                          transition={{ duration: 0.16, ease: 'easeOut' }}
                          className="absolute z-10 mt-1.5 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
                        >
                          {SECTOR_OPTIONS.map(sector => (
                            <button
                              key={sector}
                              type="button"
                              onClick={() => { setNewSector(sector); setIsSectorMenuOpen(false); }}
                              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs cursor-pointer ${sector === newSector ? 'bg-emerald-50 font-bold text-[#0b5a4b]' : 'text-slate-700 hover:bg-slate-50'}`}
                            >
                              {sector}
                              {sector === newSector && <Check className="h-4 w-4 text-[#0b5a4b]" />}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-slate-700 font-cute">{isThai ? 'บันทึกเพิ่มเติม' : 'Notes'}</span>
                    <textarea
                      value={newNotes}
                      onChange={(event) => setNewNotes(event.target.value)}
                      rows={3}
                      placeholder={isThai ? 'เหตุผลที่ถือ หรือสิ่งที่ต้องติดตาม…' : 'Position context or items to watch…'}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#0b5a4b] focus:bg-white focus:ring-2 focus:ring-emerald-500/10 transition-all font-cute"
                    />
                  </label>
                  {formError && (
                    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 font-cute">
                      {formError}
                      {duplicateHoldingId && (
                        <button
                          type="button"
                          onClick={() => {
                            const duplicate = summary.computed_holdings.find(item => item.id === duplicateHoldingId);
                            if (duplicate) openEditHoldingDrawer(duplicate);
                          }}
                          className="mt-2 block rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-rose-700 shadow-xs cursor-pointer"
                        >
                          {isThai ? 'เปิดรายการเดิมเพื่อแก้ไข' : 'Edit existing position'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-auto flex gap-2.5 border-t border-slate-100 pt-5">
                  <button type="button" onClick={closeDrawer} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors font-cute">
                    {isThai ? 'ยกเลิก' : 'Cancel'}
                  </button>
                  <button type="submit" className="flex-[1.4] rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer transition-colors shadow-sm font-cute">
                    {editingHoldingId ? (isThai ? 'บันทึกการแก้ไข' : 'Save Changes') : (isThai ? 'เพิ่มเข้าพอร์ต' : 'Add to Portfolio')}
                  </button>
                </div>
              </form>
            </motion.aside>
          )}

          {drawerMode === 'portfolio-form' && (
            <motion.aside
              key="portfolio-form-drawer"
              initial={{ x: '100%', opacity: 0.7 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0.7 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32, mass: 0.82 }}
              className="absolute inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-[-20px_0_50px_rgba(15,23,42,0.15)]"
              aria-label={editingPortfolioId ? (isThai ? 'แก้ไขพอร์ต' : 'Edit portfolio') : (isThai ? 'สร้างพอร์ต' : 'Create portfolio')}
            >
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0b5a4b] to-[#127a65] text-white shadow-sm"><FolderPlus className="h-5 w-5" /></div>
                  <div><h3 className="text-base font-bold text-slate-900 font-cute-heading">{editingPortfolioId ? (isThai ? 'แก้ไขพอร์ต' : 'Edit Portfolio') : (isThai ? 'สร้างพอร์ตใหม่' : 'Create Portfolio')}</h3><p className="mt-0.5 text-xs text-slate-500 font-cute">{isThai ? 'คุณกำหนดชื่อ เป้าหมาย และเพดานเองได้ทั้งหมด' : 'You control the name, target, and maximum.'}</p></div>
                </div>
                <button type="button" onClick={closeDrawer} aria-label={isThai ? 'ปิดแบบฟอร์ม' : 'Close form'} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"><X className="h-4 w-4" /></button>
              </div>
              <form onSubmit={handleSavePortfolio} className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-5">
                <div className="space-y-4">
                  <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700 font-cute">{isThai ? 'ชื่อพอร์ต' : 'Portfolio name'}</span><input required value={portfolioName} onChange={event => setPortfolioName(event.target.value)} placeholder={isThai ? 'เช่น เกษียณระยะยาว' : 'e.g. Long-term retirement'} className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 font-cute outline-none focus:border-[#0b5a4b] focus:bg-white focus:ring-2 focus:ring-emerald-500/10" /></label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700 font-cute">{isThai ? 'Target ของเงินรวม (%)' : 'Target of total (%)'}</span><input type="number" step="any" min="0" max="100" value={portfolioTarget} onChange={event => setPortfolioTarget(event.target.value)} placeholder="40" className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-900 font-mono outline-none focus:border-[#0b5a4b] focus:bg-white" /></label>
                    <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700 font-cute">{isThai ? 'Max ของเงินรวม (%)' : 'Maximum of total (%)'}</span><input type="number" step="any" min="0" max="100" value={portfolioMax} onChange={event => setPortfolioMax(event.target.value)} placeholder="50" className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-900 font-mono outline-none focus:border-[#0b5a4b] focus:bg-white" /></label>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-xs leading-relaxed text-slate-600 font-cute"><Info className="mr-1.5 inline h-4 w-4 text-[#0b5a4b]" />{isThai ? 'Target รวมทุกพอร์ตต้องไม่เกิน 100% และ Target ของพอร์ตต้องไม่เกิน Max' : 'Combined portfolio targets cannot exceed 100%, and a portfolio target cannot exceed its maximum.'}</div>
                  <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700 font-cute">{isThai ? 'บันทึกเพิ่มเติม' : 'Notes'}</span><textarea rows={4} value={portfolioNotes} onChange={event => setPortfolioNotes(event.target.value)} className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs text-slate-900 font-cute outline-none focus:border-[#0b5a4b] focus:bg-white" /></label>
                  {formError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 font-cute">{formError}</div>}
                </div>
                <div className="mt-auto space-y-2 border-t border-slate-100 pt-5">
                  <div className="flex gap-2.5"><button type="button" onClick={closeDrawer} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 font-cute cursor-pointer">{isThai ? 'ยกเลิก' : 'Cancel'}</button><button type="submit" className="flex-[1.4] rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 shadow-sm font-cute cursor-pointer">{isThai ? 'บันทึกพอร์ต' : 'Save Portfolio'}</button></div>
                  {editingPortfolioId && <button type="button" onClick={() => handleDeletePortfolio(editingPortfolioId)} className="w-full rounded-xl px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 font-cute cursor-pointer transition-colors"><Trash2 className="mr-1.5 inline h-3.5 w-3.5" />{isThai ? 'ลบพอร์ตนี้' : 'Delete portfolio'}</button>}
                </div>
              </form>
            </motion.aside>
          )}

          {drawerMode === 'aggregate' && selectedAggregate && (
            <motion.aside
              key="aggregate-detail-drawer"
              initial={{ x: '100%', opacity: 0.7 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0.7 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32, mass: 0.82 }}
              className="absolute inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-[-20px_0_50px_rgba(15,23,42,0.15)]"
              aria-label={isThai ? `สัดส่วนรวม ${selectedAggregate.ticker}` : `${selectedAggregate.ticker} aggregate exposure`}
            >
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 p-4 sm:p-5">
                <div className="flex items-center gap-3"><CompanyLogo ticker={selectedAggregate.ticker} className="h-11 w-11" imgClassName="scale-110" /><div><h3 className="font-mono text-xl font-extrabold text-slate-900">{selectedAggregate.ticker}</h3><p className="text-xs text-slate-500 font-cute">{isThai ? 'สัดส่วนรวมทุกพอร์ต' : 'Combined across all portfolios'}</p></div></div>
                <button type="button" onClick={closeDrawer} aria-label={isThai ? 'ปิดรายละเอียด' : 'Close details'} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"><X className="h-4 w-4" /></button>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-2.5">
                  {[{ label: isThai ? 'สัดส่วนรวม' : 'Overall weight', value: selectedAggregate.total_pct_of_total !== null ? `${selectedAggregate.total_pct_of_total.toFixed(1)}%` : '—' }, { label: isThai ? 'เพดานรวม' : 'Overall maximum', value: selectedAggregate.overall_max_pct !== null ? `${selectedAggregate.overall_max_pct.toFixed(1)}%` : '—' }, { label: isThai ? 'มูลค่ารวม' : 'Total value', value: selectedAggregate.total_market_value !== null ? `$${selectedAggregate.total_market_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—' }, { label: isThai ? 'เป้าหมายรวมที่อนุมาน' : 'Derived target', value: selectedAggregate.aggregate_derived_target_pct_of_total !== null ? `${selectedAggregate.aggregate_derived_target_pct_of_total.toFixed(1)}%` : '—' }].map(metric => <div key={metric.label} className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5"><span className="block text-xs font-bold text-slate-500 font-cute">{metric.label}</span><strong className="mt-1 block font-mono text-xl font-black text-slate-900">{metric.value}</strong></div>)}
                </div>
                {selectedAggregate.status === 'ABOVE_MAX' && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-rose-700 font-cute">{isThai ? `เกินเพดานรวม ${selectedAggregate.excess_pct_points?.toFixed(1)} จุดเปอร์เซ็นต์` : `Above the overall maximum by ${selectedAggregate.excess_pct_points?.toFixed(1)} percentage points`}</div>}
                <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs"><h4 className="mb-3 text-xs font-bold text-slate-800 font-cute">{isThai ? 'แยกตามพอร์ต' : 'Portfolio breakdown'}</h4><div className="space-y-2">{selectedAggregate.portfolios.map((item, index) => <div key={`${item.portfolio_id || 'unassigned'}-${index}`} className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-2.5"><div><p className="text-xs font-bold text-slate-800 font-cute">{item.portfolio_name}</p><p className="text-xs text-slate-500 font-mono">{item.market_value !== null ? `$${item.market_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : (isThai ? 'ไม่มีราคาตลาด' : 'No market price')}</p></div><div className="text-right"><strong className="block font-mono text-sm font-bold text-slate-900">{item.pct_of_total !== null ? `${item.pct_of_total.toFixed(1)}%` : '—'}</strong><span className="text-[11px] text-slate-500 font-mono">Target {item.derived_target_pct_of_total !== null ? `${item.derived_target_pct_of_total.toFixed(1)}%` : '—'}</span></div></div>)}</div></section>
                <p className="text-xs leading-relaxed text-slate-500 font-cute">{isThai ? 'ข้อมูลนี้ใช้เพื่อแสดงการกระจุกตัวของ ticker เดียวกัน ไม่ได้เป็นคำสั่งซื้อขาย' : 'This view highlights cross-portfolio concentration and does not generate trading instructions.'}</p>
              </div>
            </motion.aside>
          )}

          {drawerMode === 'position' && selectedPosition && (
            <motion.aside
              key="position-detail-drawer"
              initial={{ x: '100%', opacity: 0.7 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0.7 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32, mass: 0.82 }}
              className="absolute inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-[-20px_0_50px_rgba(15,23,42,0.15)]"
              aria-label={isThai ? `รายละเอียด ${selectedPosition.ticker}` : `${selectedPosition.ticker} position details`}
            >
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <CompanyLogo ticker={selectedPosition.ticker} className="h-11 w-11" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black text-slate-900 font-mono">{selectedPosition.ticker}</h3>
                      <span className="rounded-full bg-slate-100 border border-slate-200/60 px-2.5 py-0.5 text-xs font-semibold text-slate-600 font-cute">{selectedPosition.sector || 'Other'}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 font-cute">
                      {selectedPosition.quantity.toLocaleString()} {isThai ? 'หุ้น' : 'shares'} @ ${selectedPosition.average_cost.toFixed(2)}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={closeDrawer} aria-label={isThai ? 'ปิดรายละเอียดหุ้น' : 'Close position details'} title={isThai ? 'ปิด' : 'Close'} className="shrink-0 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
                {selectedPositionAllocation && (
                  <section className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between gap-2"><div><span className="block text-xs font-bold text-slate-500 font-cute">{isThai ? 'พอร์ต' : 'Portfolio'}</span><strong className="text-sm font-bold text-slate-900 font-cute">{selectedPositionAllocation.portfolio_name}</strong></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${selectedPositionAllocation.status === 'ABOVE_MAX' ? 'bg-rose-100 text-rose-700' : selectedPositionAllocation.status === 'INCOMPLETE_PRICING' ? 'bg-amber-100 text-amber-700' : 'bg-white border border-slate-200 text-slate-700'}`}>{selectedPositionAllocation.status === 'ABOVE_MAX' ? (isThai ? 'เกิน Max' : 'Above max') : selectedPositionAllocation.status === 'INCOMPLETE_PRICING' ? (isThai ? 'ราคายังไม่ครบ' : 'Partial pricing') : selectedPositionAllocation.status === 'WITHIN_LIMIT' ? (isThai ? 'อยู่ในกรอบ' : 'Within limit') : (isThai ? 'ไม่ได้ตั้ง Max' : 'No limit')}</span></div>
                    <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      {[{ label: isThai ? 'ในพอร์ต' : 'Within', value: selectedPositionAllocation.pct_within_portfolio }, { label: isThai ? 'ของเงินรวม' : 'Overall', value: selectedPositionAllocation.pct_of_total }, { label: 'Target', value: selectedPositionAllocation.target_pct_within_portfolio }, { label: 'Max', value: selectedPositionAllocation.max_pct_within_portfolio }].map(metric => <div key={metric.label} className="rounded-xl bg-white border border-slate-200/60 p-2 text-center"><span className="block text-xs text-slate-500 font-cute">{metric.label}</span><strong className="font-mono text-sm font-extrabold text-slate-900">{metric.value !== null ? `${metric.value.toFixed(1)}%` : '—'}</strong></div>)}
                    </div>
                    <p className="mt-2.5 text-xs text-slate-500 font-cute">{isThai ? 'Target ที่อนุมานต่อเงินรวม' : 'Derived target of total'}: <strong className="font-mono font-bold text-slate-700">{selectedPositionAllocation.derived_target_pct_of_total !== null ? `${selectedPositionAllocation.derived_target_pct_of_total.toFixed(2)}%` : '—'}</strong></p>
                  </section>
                )}
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: isThai ? 'มูลค่าปัจจุบัน' : 'Current Value', value: typeof selectedPosition.market_value === 'number' ? `$${selectedPosition.market_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-' },
                    { label: isThai ? 'กำไร/ขาดทุน' : 'Unrealized P/L', value: typeof selectedPosition.unrealized_pnl === 'number' ? `${selectedPosition.unrealized_pnl >= 0 ? '+' : ''}$${selectedPosition.unrealized_pnl.toFixed(2)}` : '-' },
                    { label: isThai ? 'มูลค่าเหมาะสม' : 'Fair Value', value: typeof selectedPosition.fair_value === 'number' ? `$${selectedPosition.fair_value.toFixed(2)}` : '-' },
                    { label: 'Margin of Safety', value: typeof selectedPosition.margin_of_safety_pct === 'number' ? `${selectedPosition.margin_of_safety_pct > 0 ? '+' : ''}${selectedPosition.margin_of_safety_pct.toFixed(1)}%` : '-' }
                  ].map(metric => (
                    <div key={metric.label} className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5">
                      <span className="block text-xs font-bold text-slate-500 font-cute">{metric.label}</span>
                      <span className="mt-1 block text-lg font-black text-slate-900 font-mono">{metric.value}</span>
                    </div>
                  ))}
                </div>

                <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-[#0b5a4b]" /><h4 className="text-xs font-bold text-slate-800 font-cute">Thesis & Research</h4></div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${selectedPositionResearch?.thesisTone === 'healthy' ? 'bg-emerald-50 text-emerald-700' : selectedPositionResearch?.thesisTone === 'review' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                      {selectedPositionResearch?.thesisLabel || (isThai ? 'ยังไม่บันทึก' : 'Not recorded')}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600 font-cute">
                    {selectedPositionResearch?.thesis?.summary || (isThai ? 'ยังไม่มี Thesis ที่ผู้ใช้ยืนยันสำหรับหุ้นนี้' : 'No user-confirmed thesis for this holding')}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 font-cute">
                    <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                    {selectedPositionResearch?.researchDate
                      ? `${isThai ? 'วิเคราะห์ล่าสุด' : 'Last analyzed'} ${selectedPositionResearch.researchDate} (${selectedPositionResearch.daysSinceResearch} ${isThai ? 'วัน' : 'days'})`
                      : (isThai ? 'ยังไม่มีวันที่วิเคราะห์' : 'No research date available')}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2"><Target className="h-4 w-4 text-indigo-500" /><h4 className="text-xs font-bold text-slate-800 font-cute">Expectations</h4></div>
                    <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">{selectedPositionExpectations.length}</span>
                  </div>
                  {selectedPositionExpectations.length > 0 ? (
                    <div className="space-y-2">
                      {selectedPositionExpectations.slice(0, 3).map(expectation => (
                        <div key={expectation.expectationId} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs">
                          <span className="min-w-0 truncate text-slate-700 font-cute">{expectation.metricLabel}</span>
                          <span className={`shrink-0 font-bold font-mono ${expectation.status === 'MISSED' ? 'text-rose-600' : expectation.status === 'MET' || expectation.status === 'EXCEEDED' ? 'text-emerald-600' : 'text-slate-500'}`}>{expectation.status}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-slate-500 font-cute">{isThai ? 'ยังไม่มี expectation ที่ติดตาม' : 'No tracked expectations'}</p>}
                </section>

                <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2"><Bell className="h-4 w-4 text-amber-600" /><h4 className="text-xs font-bold text-slate-800 font-cute">Alerts</h4></div>
                    <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">{selectedPositionAlerts.length}</span>
                  </div>
                  {selectedPositionAlerts.length > 0 ? (
                    <div className="space-y-2">
                      {selectedPositionAlerts.slice(0, 3).map(alert => (
                        <div key={alert.id} className={`rounded-xl border p-3 ${alert.severity === 'critical' ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}>
                          <p className="text-xs font-bold text-slate-900 font-cute">{isThai ? alert.titleTh || alert.title : alert.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-600 font-cute">{isThai ? alert.messageTh || alert.message : alert.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-slate-500 font-cute">{isThai ? 'ยังไม่มีการแจ้งเตือนสำหรับหุ้นนี้' : 'No active alerts for this holding'}</p>}
                </section>
              </div>

              <div className="flex gap-2.5 border-t border-slate-100 p-4 sm:p-5">
                <button type="button" onClick={() => openEditHoldingDrawer(selectedPosition)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors font-cute">
                  <Pencil className="mr-1.5 inline h-3.5 w-3.5" />{isThai ? 'แก้ไข' : 'Edit'}
                </button>
                {onSelectTicker && (
                  <button
                    type="button"
                    onClick={() => { onSelectTicker(selectedPosition.ticker); onClose(); }}
                    className="flex-1 rounded-xl bg-gradient-to-r from-[#0b5a4b] to-[#127a65] px-4 py-2.5 text-xs font-bold text-white hover:opacity-95 cursor-pointer transition-opacity shadow-sm font-cute"
                  >
                    {isThai ? 'เปิด Research' : 'Open Research'} <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
