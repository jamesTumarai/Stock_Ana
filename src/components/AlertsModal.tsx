import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  X, Bell, AlertTriangle, ShieldAlert, Info, CheckCircle2,
  Settings, ExternalLink, ArrowRight, Check, WalletCards,
  RefreshCw, Newspaper, Sparkles, Building2, ChevronDown, ChevronUp, RotateCcw
} from 'lucide-react';
import { MonitoringAlert, MonitoringPreferences, RecentTrustedNewsItem, MaterialEventSourceAuthority, MaterialEventSourceType } from '../types';
import { ProvenanceBadge } from './ProvenanceBadge';
import { CompanyLogo } from './CompanyLogo';
import { DEFAULT_MONITORING_PREFERENCES } from '../utils/monitoringEngine';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isThai: boolean;
  alerts: MonitoringAlert[];
  recentNews?: RecentTrustedNewsItem[];
  preferences: MonitoringPreferences;
  onUpdatePreferences: (prefs: MonitoringPreferences) => void;
  onMarkAsRead: (alertId: string) => void;
  onMarkAllAsRead: () => void;
  onSelectTicker?: (ticker: string, linkSection?: string) => void;
  onRefreshNews?: () => void;
  isNewsRefreshing?: boolean;
  lastNewsCheckedAt?: number | null;
  newsError?: string | null;
  initialFilterType?: string;
  watchlistSymbols?: string[];
  portfolioSymbols?: string[];
  initialNewsScope?: 'all' | 'watchlist' | 'portfolio';
  initialNewsTicker?: string;
}

export function AlertsModal({
  isOpen,
  onClose,
  isThai,
  alerts,
  recentNews = [],
  preferences,
  onUpdatePreferences,
  onMarkAsRead,
  onMarkAllAsRead,
  onSelectTicker,
  onRefreshNews,
  isNewsRefreshing = false,
  lastNewsCheckedAt,
  newsError,
  initialFilterType = 'all',
  watchlistSymbols = [],
  portfolioSymbols = [],
  initialNewsScope = 'all',
  initialNewsTicker = undefined,
}: Props) {
  const [filterType, setFilterType] = useState<string>(initialFilterType);
  const [showSettings, setShowSettings] = useState(false);
  const [expandedSupportingSources, setExpandedSupportingSources] = useState<Record<string, boolean>>({});
  const [newsScope, setNewsScope] = useState<'all' | 'watchlist' | 'portfolio'>(initialNewsScope);
  const [newsTickerFilter, setNewsTickerFilter] = useState<string | null>(initialNewsTicker || null);
  const [expandedOriginalHeadlines, setExpandedOriginalHeadlines] = useState<Record<string, boolean>>({});

  const toggleOriginalHeadline = (id: string) => {
    setExpandedOriginalHeadlines(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Settings form local state
  const [mosThreshold, setMosThreshold] = useState(preferences.mosThresholdPct);
  const [convictionThreshold, setConvictionThreshold] = useState(preferences.convictionThresholdPoints);
  const [concentrationThreshold, setConcentrationThreshold] = useState(preferences.concentrationThresholdPct);
  const [enableNews, setEnableNews] = useState(preferences.enableNewsAlerts ?? true);

  if (!isOpen) return null;

  const unreadCount = alerts.filter(a => !a.isRead).length;
  const newsAlertsCount = alerts.filter(a => a.type === 'NEWS_MATERIAL_EVENT').length;

  const filteredAlerts = alerts.filter(a => {
    if (filterType === 'unread') return !a.isRead;
    if (filterType === 'valuation') return a.type.startsWith('VALUATION');
    if (filterType === 'news') return a.type === 'NEWS_MATERIAL_EVENT';
    if (filterType === 'filings') return a.type.startsWith('FILING');
    if (filterType === 'portfolio') return [
      'PORTFOLIO_CONCENTRATION',
      'PORTFOLIO_ALLOCATION_LIMIT',
      'POSITION_PORTFOLIO_LIMIT',
      'OVERALL_TICKER_EXPOSURE_LIMIT'
    ].includes(a.type);
    return true;
  });

  // Scope-filtered alerts for the News tab
  const displayedAlerts = filteredAlerts.filter(a => {
    if (filterType === 'news') {
      if (newsScope === 'watchlist') {
        const set = new Set(watchlistSymbols.map(s => s.toUpperCase().trim()));
        if (!set.has(a.ticker.toUpperCase().trim())) return false;
      } else if (newsScope === 'portfolio') {
        const set = new Set(portfolioSymbols.map(s => s.toUpperCase().trim()));
        if (!set.has(a.ticker.toUpperCase().trim())) return false;
      }
      if (newsTickerFilter) {
        if (a.ticker.toUpperCase().trim() !== newsTickerFilter.toUpperCase().trim()) return false;
      }
    }
    return true;
  });

  // Scope-filtered recent news items for the News tab
  const displayedRecentNews = recentNews.filter(n => {
    if (filterType === 'news') {
      if (newsScope === 'watchlist') {
        const set = new Set(watchlistSymbols.map(s => s.toUpperCase().trim()));
        if (!set.has(n.ticker.toUpperCase().trim())) return false;
      } else if (newsScope === 'portfolio') {
        const set = new Set(portfolioSymbols.map(s => s.toUpperCase().trim()));
        if (!set.has(n.ticker.toUpperCase().trim())) return false;
      }
      if (newsTickerFilter) {
        if (n.ticker.toUpperCase().trim() !== newsTickerFilter.toUpperCase().trim()) return false;
      }
    }
    return true;
  });

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdatePreferences({
      ...preferences,
      mosThresholdPct: Number(mosThreshold) || 20,
      convictionThresholdPoints: Number(convictionThreshold) || 10,
      concentrationThresholdPct: Number(concentrationThreshold) || 30,
      enableNewsAlerts: Boolean(enableNews)
    });
    setShowSettings(false);
  };

  const handleResetDefaults = () => {
    setMosThreshold(DEFAULT_MONITORING_PREFERENCES.mosThresholdPct);
    setConvictionThreshold(DEFAULT_MONITORING_PREFERENCES.convictionThresholdPoints);
    setConcentrationThreshold(DEFAULT_MONITORING_PREFERENCES.concentrationThresholdPct);
    setEnableNews(DEFAULT_MONITORING_PREFERENCES.enableNewsAlerts ?? true);
    onUpdatePreferences({ ...DEFAULT_MONITORING_PREFERENCES });
    setShowSettings(false);
  };

  const formatLastCheckedTime = (ts?: number | null): string => {
    if (!ts) return isThai ? 'ยังไม่ได้ตรวจสอบ' : 'Not checked yet';
    const d = new Date(ts);
    return d.toLocaleTimeString(isThai ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatPublishedTime = (publishedAt?: string | null): string => {
    if (!publishedAt) {
      return isThai ? 'ไม่ระบุเวลาเผยแพร่' : 'Publication time unavailable';
    }
    const d = new Date(publishedAt);
    if (isNaN(d.getTime())) {
      return isThai ? 'ไม่ระบุเวลาเผยแพร่' : 'Publication time unavailable';
    }
    const diffHours = Math.floor((Date.now() - d.getTime()) / (3600 * 1000));
    if (diffHours < 1) {
      const diffMins = Math.max(1, Math.floor((Date.now() - d.getTime()) / (60 * 1000)));
      return isThai ? `${diffMins} นาทีที่แล้ว` : `${diffMins} min ago`;
    }
    if (diffHours < 24) {
      return isThai ? `${diffHours} ชั่วโมงที่แล้ว` : `${diffHours}h ago`;
    }
    const diffDays = Math.floor(diffHours / 24);
    return isThai ? `${diffDays} วันที่แล้ว` : `${diffDays}d ago`;
  };

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          badge: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />,
          border: 'border-rose-200/80 bg-rose-50/20'
        };
      case 'warning':
        return {
          badge: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />,
          border: 'border-amber-200/80 bg-amber-50/20'
        };
      default:
        return {
          badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: <Info className="w-4 h-4 text-[#0b5a4b] shrink-0" />,
          border: 'border-stone-200 bg-white'
        };
    }
  };

  const toggleSupportingSources = (alertId: string) => {
    setExpandedSupportingSources(prev => ({
      ...prev,
      [alertId]: !prev[alertId]
    }));
  };

  const renderProvenanceTag = (
    sourceAuthority?: MaterialEventSourceAuthority,
    sourceType?: MaterialEventSourceType,
    sourceName?: string
  ) => {
    if (sourceType === 'SEC_EDGAR' || sourceAuthority === 'AUTHORITATIVE_SEC') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200/60 text-[10px]">
          <span>{isThai ? 'ก.ล.ต. สหรัฐฯ (SEC)' : 'SEC / Regulator'}</span>
        </span>
      );
    }
    if (sourceAuthority === 'COMPANY_OFFICIAL' || sourceAuthority === 'COMPANY_PRIMARY_IR') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200/60 text-[10px]">
          <Building2 className="w-3 h-3" />
          <span>{isThai ? 'เว็บนักลงทุนสัมพันธ์' : 'Official Company'}</span>
        </span>
      );
    }
    if (sourceAuthority === 'PRESS_RELEASE_WIRE' || sourceType === 'WIRE_SERVICE') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold border border-purple-200/60 text-[10px]">
          <Newspaper className="w-3 h-3" />
          <span>{isThai ? 'ข่าวประชาสัมพันธ์' : 'Press Release'}</span>
        </span>
      );
    }
    if (sourceAuthority === 'REPUTABLE_NEWS') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold border border-amber-200/60 text-[10px]">
          <span>{isThai ? 'สำนักข่าวการเงิน' : 'Reputable News'}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 font-medium text-[10px]">
        <span>{sourceName || (isThai ? 'ข้อมูลตลาด' : 'Market Source')}</span>
      </span>
    );
  };

  const renderRecentNewsCard = (item: RecentTrustedNewsItem, index: number) => {
    const isWatchlist = watchlistSymbols.some(s => s.toUpperCase().trim() === item.ticker.toUpperCase().trim());
    const isPortfolio = portfolioSymbols.some(s => s.toUpperCase().trim() === item.ticker.toUpperCase().trim());
    const isExpanded = Boolean(expandedOriginalHeadlines[item.id]);

    return (
      <motion.div
        key={item.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.03, 0.15), duration: 0.18 }}
        className="p-3.5 sm:p-4 rounded-2xl border border-stone-200/80 bg-white hover:border-emerald-300 hover:shadow-2xs transition-all flex flex-col gap-2.5 relative text-left"
      >
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <CompanyLogo ticker={item.ticker} className="w-5 h-5" />
            <span className="font-mono font-bold text-xs text-stone-900 bg-stone-100 px-2 py-0.5 rounded-md">
              {item.ticker}
            </span>

            {/* Category Tag */}
            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 font-mono">
              {item.category.replace(/_/g, ' ')}
            </span>

            {/* Source Provenance Tag */}
            {renderProvenanceTag(item.sourceAuthority, item.sourceType, item.sourceName)}

            {/* Scope Badge */}
            {isWatchlist && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-mono">
                {isThai ? 'วอทช์ลิสต์' : 'Watchlist'}
              </span>
            )}
            {isPortfolio && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-mono">
                {isThai ? 'พอร์ต' : 'Portfolio'}
              </span>
            )}
          </div>

          <span className="text-[10px] text-stone-400 font-mono">
            {formatPublishedTime(item.publishedAt)}
          </span>
        </div>

        {/* Headline */}
        <div>
          <h5 className="text-xs sm:text-sm font-bold text-stone-900 leading-snug font-['Prompt','Mitr','Nunito',sans-serif]">
            {isThai && item.headlineTh ? item.headlineTh : item.headline}
          </h5>

          {/* Expandable Original Headline in Thai mode */}
          {isThai && item.headlineTh && (
            <div className="mt-1">
              <button
                type="button"
                onClick={() => toggleOriginalHeadline(item.id)}
                className="text-[11px] text-stone-400 hover:text-stone-700 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>{isExpanded ? 'ซ่อนหัวข้อข่าวต้นฉบับ' : '[ดูหัวข้อข่าวต้นฉบับ]'}</span>
                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {isExpanded && (
                <p className="text-[11px] text-stone-500 italic bg-stone-50 p-2 rounded-lg border border-stone-200/60 font-sans mt-1">
                  {item.originalHeadline || item.headline}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Grounded Summary (สรุป) */}
        {((isThai && item.summaryTh) || (!isThai && item.summaryEn) || (item.factualSummary && item.factualSummary !== `Reported by ${item.sourceName}.`)) && (
          <div className="bg-stone-50/80 p-2.5 rounded-xl border border-stone-200/60 text-xs">
            <div className="font-bold text-stone-700 mb-0.5 text-[11px]">
              {isThai ? 'สรุป' : 'Summary'}
            </div>
            <p className="text-stone-600 leading-relaxed font-sans">
              {isThai ? (item.summaryTh || item.factualSummary) : (item.summaryEn || item.factualSummary)}
            </p>
          </div>
        )}

        {/* Source Footer & External Link */}
        <div className="pt-1 flex items-center justify-between gap-2 text-[11px] border-t border-stone-100 mt-0.5">
          <span className="text-stone-400 font-medium">
            {item.sourceName} · {item.sourceAuthority === 'PRESS_RELEASE_WIRE' ? (isThai ? 'ข่าวประชาสัมพันธ์' : 'Press Release') : (isThai ? 'แหล่งข้อมูลทางการ' : 'Verified Source')}
          </span>
          {item.sourceUrl && (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-[#0b5a4b] hover:text-[#084337] hover:underline cursor-pointer shrink-0"
            >
              <span>{isThai ? 'เปิดแหล่งข่าว' : 'Open Source'}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-stone-900/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="alerts-modal-title"
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.97, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 12, scale: 0.98, filter: 'blur(3px)' }}
        transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.78 }}
        className="bg-white rounded-3xl max-w-3xl w-full h-[92vh] sm:h-[680px] max-h-[92vh] shadow-[0_24px_72px_rgba(0,0,0,0.28)] border border-stone-200 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-stone-100 bg-stone-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200/80 flex items-center justify-center shadow-2xs relative shrink-0">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="alerts-modal-title" className="text-xl font-bold text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight">
                  {isThai ? 'การตรวจสอบวิจัยและการแจ้งเตือน' : 'On-Open Research Checks & Alerts'}
                </h2>
                <ProvenanceBadge classification="calculated" isThai={isThai} size="xs" />
              </div>
              <p className="text-xs text-stone-500 font-sans mt-0.5">
                {isThai
                  ? 'ตรวจสอบมูลค่า งบ SEC พอร์ต และข่าว/เหตุการณ์สำคัญของหุ้นที่ติดตามเมื่อเปิด Lumina หรือรีเฟรช'
                  : 'Checks valuation, SEC filings, portfolio risk, and material company events when Lumina opens or refreshes'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onRefreshNews && (
              <motion.button
                type="button"
                onClick={onRefreshNews}
                disabled={isNewsRefreshing}
                whileTap={{ scale: 0.9 }}
                className={`p-2 rounded-full transition-colors cursor-pointer text-stone-500 hover:text-stone-900 hover:bg-stone-100 ${
                  isNewsRefreshing ? 'animate-spin text-[#0b5a4b]' : ''
                }`}
                title={isThai ? 'รีเฟรชข่าวล่าสุด' : 'Refresh latest events'}
              >
                <RefreshCw className="w-4 h-4" />
              </motion.button>
            )}
            <motion.button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              whileTap={{ scale: 0.9 }}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                showSettings ? 'bg-stone-200 text-stone-900' : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'
              }`}
              title={isThai ? 'ตั้งค่าเกณฑ์การแจ้งเตือน' : 'Alert Settings'}
            >
              <Settings className="w-5 h-5" />
            </motion.button>
            <motion.button
              type="button"
              onClick={onClose}
              whileTap={{ scale: 0.9 }}
              className="text-stone-400 hover:text-stone-700 p-2 rounded-full hover:bg-stone-100 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>
        </div>

        {/* Settings Panel Popover */}
        {showSettings && (
          <form onSubmit={handleSavePreferences} className="p-4 sm:p-6 bg-stone-50 border-b border-stone-200 flex flex-col gap-4 animate-in slide-in-from-top-4 duration-200">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
              <h3 className="text-sm font-bold text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif]">
                {isThai ? 'กำหนดเกณฑ์การแจ้งเตือน (Materiality Thresholds)' : 'Configure Materiality Thresholds'}
              </h3>
              <span className="text-[10px] text-stone-500 uppercase font-bold">{isThai ? 'ป้องกัน Alert Spam' : 'Prevents Alert Fatigue'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-stone-700">
                  {isThai ? 'เกณฑ์ Margin of Safety (%)' : 'MoS Deep Value (%)'}
                </label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={mosThreshold}
                  onChange={(e) => setMosThreshold(Number(e.target.value))}
                  className="px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-mono font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#0b5a4b]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-stone-700">
                  {isThai ? 'การเปลี่ยน Conviction (แต้ม)' : 'Conviction Delta (pts)'}
                </label>
                <input
                  type="number"
                  min="3"
                  max="50"
                  value={convictionThreshold}
                  onChange={(e) => setConvictionThreshold(Number(e.target.value))}
                  className="px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-mono font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#0b5a4b]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-stone-700">
                  {isThai ? 'ความเข้มข้นในพอร์ต (%)' : 'Holding Concentration (%)'}
                </label>
                <input
                  type="number"
                  min="10"
                  max="80"
                  value={concentrationThreshold}
                  onChange={(e) => setConcentrationThreshold(Number(e.target.value))}
                  className="px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-mono font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#0b5a4b]"
                />
              </div>
            </div>

            {/* News & Events Toggle */}
            <div className="flex items-center justify-between p-3 bg-white border border-stone-200 rounded-xl">
              <div className="flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-[#0b5a4b]" />
                <div>
                  <div className="text-xs font-bold text-stone-800">
                    {isThai ? 'ข่าวและเหตุการณ์สำคัญ (News & Events)' : 'News & Material Corporate Events'}
                  </div>
                  <div className="text-[11px] text-stone-500">
                    {isThai
                      ? 'ตรวจสอบเหตุการณ์สำคัญจาก SEC และสำนักข่าวชั้นนำสำหรับหุ้นที่ติดตาม'
                      : 'Checks SEC 8-K items and primary corporate news for tracked stocks'}
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableNews}
                  onChange={(e) => setEnableNews(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0b5a4b]"></div>
              </label>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-500 hover:text-stone-800 hover:bg-stone-200 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isThai ? 'คืนค่าเริ่มต้น' : 'Reset Defaults'}</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-200 transition-colors"
                >
                  {isThai ? 'ยกเลิก' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  {isThai ? 'บันทึกเกณฑ์' : 'Save Thresholds'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Action Bar / Filter Tabs */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-2.5 border-b border-stone-100 bg-white">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar rounded-2xl bg-stone-100 p-1">
            {[
              { id: 'all', labelEn: 'All', labelTh: 'ทั้งหมด', count: alerts.length },
              { id: 'unread', labelEn: 'Unread', labelTh: 'ยังไม่อ่าน', count: unreadCount },
              { id: 'valuation', labelEn: 'Valuation', labelTh: 'มูลค่า' },
              { id: 'news', labelEn: 'News / Events', labelTh: 'ข่าว / เหตุการณ์', count: newsAlertsCount },
              { id: 'filings', labelEn: 'Filings', labelTh: 'งบ SEC' },
              { id: 'portfolio', labelEn: 'Portfolio', labelTh: 'พอร์ต' }
            ].map((tab) => (
              <motion.button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id)}
                whileTap={{ scale: 0.96 }}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                  filterType === tab.id
                    ? 'bg-white text-stone-900 font-bold shadow-sm'
                    : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <span>{isThai ? tab.labelTh : tab.labelEn}</span>
                {typeof tab.count === 'number' && tab.count > 0 && (
                  <span className={`ml-1.5 text-[10px] px-1.5 py-0.2 rounded-full ${
                    filterType === tab.id ? 'bg-[#0b5a4b] text-white' : 'bg-stone-200 text-stone-700'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </motion.button>
            ))}
          </div>

          <div className="flex items-center gap-3 shrink-0 ml-2">
            {lastNewsCheckedAt && (
              <span className="text-[11px] text-stone-400 font-mono hidden sm:inline">
                {isThai ? 'ตรวจล่าสุด: ' : 'Checked: '}
                {formatLastCheckedTime(lastNewsCheckedAt)}
              </span>
            )}

            {unreadCount > 0 && (
              <motion.button
                type="button"
                onClick={onMarkAllAsRead}
                whileTap={{ scale: 0.96 }}
                className="text-xs font-semibold text-[#0b5a4b] hover:text-[#084237] transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isThai ? 'อ่านทั้งหมดแล้ว' : 'Mark all read'}</span>
              </motion.button>
            )}
          </div>
        </div>

        {/* Non-blocking Failure Banner (if news check had errors) */}
        {newsError && (
          <div className="px-4 sm:px-6 py-2 bg-amber-50/80 border-b border-amber-200/80 text-amber-800 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                {isThai
                  ? 'ระบบตรวจสอบข่าวล่าสุดไม่พร้อมใช้งานชั่วคราว การแจ้งเตือนอื่นยังคงแสดงผลตามปกติ'
                  : 'News check unavailable. Existing research alerts remain available.'}
              </span>
            </div>
            {onRefreshNews && (
              <button
                type="button"
                onClick={onRefreshNews}
                className="text-[11px] font-bold underline hover:text-amber-900 cursor-pointer shrink-0"
              >
                {isThai ? 'ลองใหม่' : 'Retry'}
              </button>
            )}
          </div>
        )}

        {/* Alerts List */}
        <motion.div
          key={filterType}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="no-scrollbar flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 flex flex-col gap-3"
        >
          {/* Scope Selector for News / Events Tab */}
          {filterType === 'news' && (
            <div className="flex items-center justify-between gap-2 pb-2 flex-wrap border-b border-stone-100 mb-1">
              <div className="flex items-center gap-1 p-1 bg-stone-100/90 rounded-xl">
                <button
                  type="button"
                  onClick={() => setNewsScope('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    newsScope === 'all'
                      ? 'bg-white text-stone-900 shadow-2xs font-bold'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  {isThai ? 'ทั้งหมดที่ติดตาม' : 'All Tracked'}
                </button>
                <button
                  type="button"
                  onClick={() => setNewsScope('watchlist')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    newsScope === 'watchlist'
                      ? 'bg-white text-stone-900 shadow-2xs font-bold'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  <span>{isThai ? 'วอทช์ลิสต์' : 'Watchlist'}</span>
                  {watchlistSymbols.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-200 text-stone-700 font-mono">
                      {watchlistSymbols.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setNewsScope('portfolio')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    newsScope === 'portfolio'
                      ? 'bg-white text-stone-900 shadow-2xs font-bold'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  <span>{isThai ? 'พอร์ตการลงทุน' : 'Portfolio'}</span>
                  {portfolioSymbols.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-200 text-stone-700 font-mono">
                      {portfolioSymbols.length}
                    </span>
                  )}
                </button>
              </div>

              {newsTickerFilter && (
                <div className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-lg">
                  <span className="font-mono font-bold">{newsTickerFilter}</span>
                  <button
                    type="button"
                    onClick={() => setNewsTickerFilter(null)}
                    className="hover:text-emerald-950 cursor-pointer p-0.5"
                    title={isThai ? 'ล้างตัวกรองหุ้น' : 'Clear ticker filter'}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}

          {displayedAlerts.length === 0 ? (
            filterType === 'news' ? (
              newsError ? (
                /* Case D — Provider Failure */
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                    <AlertTriangle className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-bold text-stone-800 font-['Prompt','Mitr','Nunito',sans-serif]">
                    {isThai ? 'ไม่สามารถดึงข้อมูลข่าวและเหตุการณ์ได้ในขณะนี้' : 'Failed to Retrieve Recent News'}
                  </h4>
                  <p className="text-xs text-stone-500 mt-1 max-w-sm leading-relaxed">
                    {isThai
                      ? 'เกิดข้อผิดพลาดในการเชื่อมต่อกับแหล่งข้อมูลข่าว กรุณากดลองใหม่อีกครั้ง'
                      : 'An error occurred while connecting to news providers. Please retry.'}
                  </p>
                  {onRefreshNews && (
                    <button
                      type="button"
                      onClick={onRefreshNews}
                      className="mt-3 px-3.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      {isThai ? 'ลองใหม่อีกครั้ง' : 'Retry Now'}
                    </button>
                  )}
                </div>
              ) : displayedRecentNews.length > 0 ? (
                /* Case B — No Material Events, Recent Trusted News Exists */
                <div className="flex flex-col gap-3">
                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-emerald-900 font-['Prompt','Mitr','Nunito',sans-serif]">
                        {isThai ? '✓ ไม่มีเหตุการณ์สำคัญใน 72 ชั่วโมงล่าสุด' : '✓ No material events in the last 72 hours'}
                      </h4>
                      <p className="text-[11px] text-emerald-700/90 mt-0.5 leading-relaxed">
                        {isThai
                          ? 'แต่พบข่าวล่าสุดจากแหล่งข้อมูลที่เชื่อถือได้สำหรับหุ้นที่คุณติดตาม (บริบททั่วไป ไม่สร้างการแจ้งเตือน)'
                          : 'However, recent trusted headlines were found for your tracked companies (informational context only, not alerts).'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 pb-1 text-xs font-bold text-stone-700">
                    <Newspaper className="w-3.5 h-3.5 text-stone-500" />
                    <span>{isThai ? 'ข่าวล่าสุดจากแหล่งที่เชื่อถือได้' : 'Recent Trusted News'}</span>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {displayedRecentNews.map(renderRecentNewsCard)}
                  </div>
                </div>
              ) : (
                /* Case C — No Material Events and No Recent News */
                <div className="py-16 flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center mb-3">
                    <Newspaper className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-bold text-stone-800 font-['Prompt','Mitr','Nunito',sans-serif]">
                    {isThai ? 'ไม่พบเหตุการณ์สำคัญล่าสุด' : 'No Material Recent Events Found'}
                  </h4>
                  <p className="text-xs text-stone-500 mt-1 max-w-sm leading-relaxed">
                    {isThai
                      ? 'ไม่พบข่าวล่าสุดจากแหล่งที่ผ่านเกณฑ์ในช่วง 30 วันที่ตรวจสอบ'
                      : 'No trusted recent headlines found in the 30-day review window.'}
                  </p>
                </div>
              )
            ) : (
              /* Non-news standard empty state */
              <div className="py-16 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-[#0b5a4b] flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-stone-800 font-['Prompt','Mitr','Nunito',sans-serif]">
                  {isThai ? 'ไม่มีการแจ้งเตือนที่ตรงเงื่อนไข' : 'No Active Alerts Found'}
                </h4>
                <p className="text-xs text-stone-400 mt-1 max-w-sm leading-relaxed">
                  {isThai
                    ? 'หุ้นทั้งหมดในรายการติดตามและพอร์ตยังอยู่ในเกณฑ์ปกติ ไม่มีเหตุการณ์ที่ละเมิดเกณฑ์ความเสี่ยง'
                    : 'All tracked watchlist & portfolio assets are currently within normal baseline parameters.'}
                </p>
              </div>
            )
          ) : (
            <>
              {displayedAlerts.map((alert, index) => {
              const style = getSeverityStyle(alert.severity);
              const isNewsAlert = alert.type === 'NEWS_MATERIAL_EVENT';

              if (isNewsAlert) {
                const isWatchlist = watchlistSymbols.some(s => s.toUpperCase().trim() === alert.ticker.toUpperCase().trim());
                const isPortfolio = portfolioSymbols.some(s => s.toUpperCase().trim() === alert.ticker.toUpperCase().trim());
                const isExpanded = Boolean(expandedOriginalHeadlines[alert.id]);
                const isSupportingExpanded = Boolean(expandedSupportingSources[alert.id]);
                const pCtx = alert.portfolioContext;

                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.04, 0.16), duration: 0.2 }}
                    className={`p-4 rounded-2xl border transition-all flex flex-col gap-3 ${style.border} ${
                      alert.isRead ? 'opacity-70 bg-stone-50/50' : 'shadow-2xs bg-white'
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {style.icon}
                        <CompanyLogo ticker={alert.ticker} className="w-6 h-6" />
                        <span className="font-mono font-bold text-sm text-stone-900 bg-stone-100 px-2 py-0.5 rounded-md">
                          {alert.ticker}
                        </span>

                        {/* Materiality Badge */}
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${
                          alert.eventMateriality === 'HIGH'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {alert.eventMateriality || 'EVENT'}
                        </span>

                        {/* Category Badge */}
                        {alert.eventCategory && (
                          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600">
                            {alert.eventCategory.replace(/_/g, ' ')}
                          </span>
                        )}

                        {/* Provenance Tag */}
                        {renderProvenanceTag(alert.sourceAuthority, alert.sourceType, String(alert.evidence?.currentValue || alert.newsEvent?.sourceName || ''))}

                        {/* Scope Badges */}
                        {isWatchlist && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-mono">
                            {isThai ? 'วอทช์ลิสต์' : 'Watchlist'}
                          </span>
                        )}
                        {isPortfolio && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-mono">
                            {isThai ? 'พอร์ต' : 'Portfolio'}
                          </span>
                        )}

                        <span className="text-[10px] text-stone-400 font-mono">
                          {formatPublishedTime(alert.newsEvent?.publishedAt)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onMarkAsRead(alert.id)}
                        className="text-stone-400 hover:text-stone-700 text-xs flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                        title={alert.isRead ? 'Mark unread' : 'Mark read'}
                      >
                        {alert.isRead ? (
                          <span className="text-[11px] text-stone-400">{isThai ? 'อ่านแล้ว' : 'Read'}</span>
                        ) : (
                          <Check className="w-4 h-4 text-emerald-600" />
                        )}
                      </button>
                    </div>

                    {/* Headline */}
                    <div>
                      <h4 className="text-sm font-bold text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif] leading-snug">
                        {isThai && alert.headlineTh ? alert.headlineTh : (isThai && alert.titleTh ? alert.titleTh : alert.title)}
                      </h4>

                      {/* Expandable Original English Headline */}
                      {isThai && (alert.headlineTh || alert.titleTh) && (
                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={() => toggleOriginalHeadline(alert.id)}
                            className="text-[11px] text-stone-400 hover:text-stone-700 flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <span>{isExpanded ? 'ซ่อนหัวข้อข่าวต้นฉบับ' : '[ดูหัวข้อข่าวต้นฉบับ]'}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                          {isExpanded && (
                            <p className="text-[11px] text-stone-500 italic bg-stone-50 p-2 rounded-lg border border-stone-200/60 font-sans mt-1">
                              {alert.originalHeadline || alert.title}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Grounded Summary (สรุป) */}
                    {((isThai && alert.summaryTh) || (!isThai && alert.summaryEn) || alert.message) && (
                      <div className="bg-stone-50/80 p-2.5 rounded-xl border border-stone-200/60 text-xs">
                        <div className="font-bold text-stone-700 mb-0.5 text-[11px]">
                          {isThai ? 'สรุป' : 'Summary'}
                        </div>
                        <p className="text-stone-600 leading-relaxed font-sans">
                          {isThai ? (alert.summaryTh || alert.messageTh || alert.message) : (alert.summaryEn || alert.message)}
                        </p>
                      </div>
                    )}

                    {/* Why It Matters (AI Interpretation / Analyst Synthesis) */}
                    {(alert.whyItMatters || alert.whyItMattersTh) && (
                      <div className="p-2.5 rounded-xl bg-[#0b5a4b]/5 border border-[#0b5a4b]/20 flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-[#0b5a4b] shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <strong className="text-[#0b5a4b] font-bold block mb-0.5">
                            {isThai ? 'ทำไมเรื่องนี้ถึงสำคัญต่อการวิจัย:' : 'Why it matters:'}
                          </strong>
                          <span className="text-stone-700 leading-relaxed">
                            {isThai && alert.whyItMattersTh ? alert.whyItMattersTh : alert.whyItMatters}
                          </span>
                        </div>
                      </div>
                    )}



                    {/* Research Relevance Tags */}
                    {((alert.relatedCatalysts && alert.relatedCatalysts.length > 0) ||
                      (alert.relatedRisks && alert.relatedRisks.length > 0) ||
                      (alert.relatedExpectations && alert.relatedExpectations.length > 0)) && (
                      <div className="flex flex-wrap gap-1.5">
                        {alert.relatedCatalysts?.map((c, i) => (
                          <span key={`cat-${i}`} className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                            {isThai ? 'เกี่ยวข้องกับ Catalyst' : 'Related to Catalyst'}: {c.slice(0, 40)}
                          </span>
                        ))}
                        {alert.relatedRisks?.map((r, i) => (
                          <span key={`risk-${i}`} className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                            {isThai ? 'เกี่ยวข้องกับความเสี่ยง' : 'Related to Risk'}: {r.slice(0, 40)}
                          </span>
                        ))}
                        {alert.relatedExpectations?.map((exp, i) => (
                          <span key={`exp-${i}`} className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 font-medium">
                            {isThai ? 'เกี่ยวข้องกับเป้าหมาย' : 'Relevant to Expectation'}: {exp}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Portfolio Exposure Context (if held) */}
                    {pCtx && pCtx.held ? (
                      <div className="p-2 rounded-xl bg-stone-100/80 border border-stone-200/60 text-xs flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-stone-700">
                          <span className="flex items-center gap-1">
                            <WalletCards className="w-3.5 h-3.5 text-stone-500" />
                            {isThai
                              ? `ถืออยู่ใน ${pCtx.heldPortfolioCount} พอร์ต · สัดส่วนรวม: ${pCtx.aggregateOverallExposurePct !== null ? `${pCtx.aggregateOverallExposurePct}%` : 'ยังไม่ระบุ'}`
                              : `Held in ${pCtx.heldPortfolioCount} portfolio(s) · Overall exposure: ${pCtx.aggregateOverallExposurePct !== null ? `${pCtx.aggregateOverallExposurePct}%` : 'Unavailable'}`}
                          </span>
                          {pCtx.overallTickerMaxPct !== null && (
                            <span className="text-stone-500 font-mono text-[10px]">
                              {isThai ? 'ขีดจำกัดรวม' : 'Overall Max'}: {pCtx.overallTickerMaxPct}%
                            </span>
                          )}
                        </div>
                        {pCtx.portfolioContexts.length > 0 && (
                          <div className="flex flex-wrap gap-2 text-[10px] text-stone-500">
                            {pCtx.portfolioContexts.map((ctx, idx) => (
                              <span key={idx}>
                                {ctx.portfolioName}: {ctx.pctWithinPortfolio !== null ? `${ctx.pctWithinPortfolio}% ในพอร์ต` : 'ไม่มีราคา'}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-stone-400 font-sans italic">
                        {isThai ? 'ไม่ได้ถือครองในพอร์ต (อยู่ในรายการ Watchlist)' : 'Not held in portfolio (Watchlist asset)'}
                      </div>
                    )}

                    {/* Supporting Sources (Progressive Disclosure) */}
                    {alert.supportingSources && alert.supportingSources.length > 0 && (
                      <div className="border-t border-stone-100 pt-1.5">
                        <button
                          type="button"
                          onClick={() => toggleSupportingSources(alert.id)}
                          className="text-[11px] text-stone-500 hover:text-stone-800 flex items-center gap-1 cursor-pointer"
                        >
                          <span>
                            {isThai
                              ? `+ แหล่งข้อมูลสนับสนุนอีก ${alert.supportingSources.length} แหล่ง`
                              : `+${alert.supportingSources.length} supporting sources`}
                          </span>
                          {isSupportingExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {isSupportingExpanded && (
                          <div className="mt-1.5 flex flex-col gap-1 pl-2 border-l-2 border-stone-200">
                            {alert.supportingSources.map((s, idx) => (
                              <div key={idx} className="flex items-center justify-between text-[11px] text-stone-600">
                                <span>{s.sourceName}</span>
                                {s.sourceUrl && (
                                  <a
                                    href={s.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#0b5a4b] hover:underline flex items-center gap-0.5 text-[10px]"
                                  >
                                    <span>Link</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Source Footer Box */}
                    <div className="pt-1 flex items-center justify-between gap-2 text-[11px] border-t border-stone-100">
                      <span className="text-stone-400 font-medium">
                        {alert.evidence?.currentValue || alert.newsEvent?.sourceName} · {alert.sourceAuthority === 'PRESS_RELEASE_WIRE' ? (isThai ? 'ข่าวประชาสัมพันธ์' : 'Press Release') : (isThai ? 'แหล่งข้อมูลทางการ' : 'Verified Source')}
                      </span>

                      {alert.evidence?.sourceUrl && (
                        <a
                          href={alert.evidence.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#0b5a4b] hover:underline flex items-center gap-1 text-[11px] font-sans font-semibold shrink-0"
                        >
                          <span>{isThai ? 'เปิดแหล่งข่าว' : 'Open Source'}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {/* Action Link to Inspect Ticker */}
                    {onSelectTicker && (
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectTicker(alert.ticker, alert.linkSection);
                            onClose();
                          }}
                          className="text-xs font-bold text-[#0b5a4b] hover:text-[#084237] flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <span>{isThai ? `ดูบทวิเคราะห์ ${alert.ticker}` : `Inspect ${alert.ticker} Analysis`}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              }

              // Standard Alerts (Valuation, SEC, Portfolio limits, Conviction)
              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.04, 0.16), duration: 0.2 }}
                  whileHover={{ y: -1 }}
                  className={`p-4 rounded-2xl border transition-all flex flex-col gap-2.5 ${style.border} ${
                    alert.isRead ? 'opacity-70 bg-stone-50/50' : 'shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {style.icon}
                      {alert.ticker === 'PORTFOLIO'
                        ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-100 text-stone-600"><WalletCards className="h-3.5 w-3.5" /></span>
                        : <CompanyLogo ticker={alert.ticker} className="w-6 h-6" />}
                      <span className="font-mono font-bold text-sm text-stone-900 bg-stone-100 px-2 py-0.5 rounded-md">
                        {alert.ticker}
                      </span>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${style.badge}`}>
                        {alert.severity}
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono">
                        {alert.dateStr}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onMarkAsRead(alert.id)}
                      className="text-stone-400 hover:text-stone-700 text-xs flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                      title={alert.isRead ? 'Mark unread' : 'Mark read'}
                    >
                      {alert.isRead ? (
                        <span className="text-[11px] text-stone-400">{isThai ? 'อ่านแล้ว' : 'Read'}</span>
                      ) : (
                        <Check className="w-4 h-4 text-emerald-600" />
                      )}
                    </button>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif]">
                      {isThai && alert.titleTh ? alert.titleTh : alert.title}
                    </h4>
                    <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                      {isThai && alert.messageTh ? alert.messageTh : alert.message}
                    </p>
                  </div>

                  {/* Evidence Box */}
                  {alert.evidence && (
                    <div className="bg-white/80 p-2.5 rounded-xl border border-stone-200/70 flex items-center justify-between gap-2 text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <span className="text-stone-500 font-sans">{alert.evidence.metricName}:</span>
                        <strong className="text-stone-900">{alert.evidence.currentValue}</strong>
                        {alert.evidence.thresholdValue && (
                          <span className="text-stone-400 text-[11px]">
                            (threshold: {alert.evidence.thresholdValue})
                          </span>
                        )}
                        {alert.evidence.previousValue && (
                          <span className="text-stone-400 text-[11px]">
                            (prior: {alert.evidence.previousValue})
                          </span>
                        )}
                      </div>

                      {alert.evidence.sourceUrl && (
                        <a
                          href={alert.evidence.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#0b5a4b] hover:underline flex items-center gap-1 text-[11px] font-sans shrink-0"
                        >
                          <span>SEC Source</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Action Link */}
                  {onSelectTicker && alert.ticker !== 'PORTFOLIO' && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTicker(alert.ticker, alert.linkSection);
                          onClose();
                        }}
                        className="text-xs font-bold text-[#0b5a4b] hover:text-[#084237] flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <span>{isThai ? `ดูบทวิเคราะห์ ${alert.ticker}` : `Inspect ${alert.ticker} Analysis`}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}

            {/* Case A — Additional Recent News when Material Events exist */}
            {filterType === 'news' && recentNews.length > 0 && (
              <div className="pt-4 pb-2 flex flex-col gap-2.5">
                <div className="flex items-center gap-2 pt-2 border-t border-stone-200/80">
                  <Newspaper className="w-3.5 h-3.5 text-stone-500" />
                  <span className="text-xs font-bold text-stone-700">
                    {isThai ? 'ข่าวล่าสุดเพิ่มเติมจากแหล่งที่เชื่อถือได้' : 'Additional Recent Trusted News'}
                  </span>
                </div>
                <p className="text-[11px] text-stone-400 -mt-1 leading-relaxed">
                  {isThai
                    ? 'ข่าวสารและบริบททั่วไปที่ผ่านการคัดกรองความน่าเชื่อถือ (ไม่นับเป็นเหตุการณ์สำคัญ)'
                    : 'Contextual headlines from approved sources (informational only, not alerts)'}
                </p>
                <div className="flex flex-col gap-2.5 mt-0.5">
                  {recentNews.map(renderRecentNewsCard)}
                </div>
              </div>
            )}
          </>
        )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
