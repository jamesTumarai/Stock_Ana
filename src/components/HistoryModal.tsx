import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Search, 
  Trash2, 
  AlertTriangle, 
  Layers, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  History,
  Calendar,
  Sparkles
} from 'lucide-react';
import { CompanyLogo } from './CompanyLogo';

interface HistoryModalProps {
  onClose: () => void;
  reports: any[];
  onSelect: (report: any) => void;
  onDelete?: (reportIds: string | string[]) => void;
}

interface TickerGroup {
  ticker: string;
  reports: any[];
  latestReport: any;
  latestTimestamp: number;
}

export function HistoryModal({ onClose, reports, onSelect, onDelete }: HistoryModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedTickers, setExpandedTickers] = useState<Record<string, boolean>>({});
  const [confirmState, setConfirmState] = useState<{
    type: 'single' | 'group' | 'multi';
    id?: string;
    ids?: string[];
    ticker?: string;
  } | null>(null);

  // Helper to extract uniform epoch timestamp
  const getReportTimestamp = (r: any): number => {
    if (r.createdAt?.seconds) return r.createdAt.seconds * 1000;
    if (r.createdAt?.toMillis) return r.createdAt.toMillis();
    if (r.createdAt) {
      const t = new Date(r.createdAt).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    if (r.data?.generated_at) {
      const t = new Date(r.data.generated_at).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    return 0;
  };

  // Helper to format date and time
  const formatTimestamp = (timestamp: number, showTime: boolean = true) => {
    if (!timestamp) return 'Unknown date';
    const d = new Date(timestamp);
    if (showTime) {
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
  };

  // Group reports by ticker symbol and sort chronologically
  const groupedReports: TickerGroup[] = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const report of reports) {
      const ticker = (report.ticker || report.data?.ticker || 'UNKNOWN').toUpperCase();
      if (!map.has(ticker)) {
        map.set(ticker, []);
      }
      map.get(ticker)!.push(report);
    }

    const groups: TickerGroup[] = [];
    map.forEach((items, ticker) => {
      // Sort reports in group newest to oldest
      items.sort((a, b) => getReportTimestamp(b) - getReportTimestamp(a));
      const latest = items[0];
      groups.push({
        ticker,
        reports: items,
        latestReport: latest,
        latestTimestamp: getReportTimestamp(latest)
      });
    });

    // Sort ticker groups so the most recently analyzed stock is on top
    groups.sort((a, b) => b.latestTimestamp - a.latestTimestamp);
    return groups;
  }, [reports]);

  // Filter groups by search query
  const filteredGroups = useMemo(() => {
    const q = searchTerm.trim().toUpperCase();
    if (!q) return groupedReports;
    return groupedReports.filter(g => g.ticker.includes(q));
  }, [groupedReports, searchTerm]);

  // Toggle accordion expansion for a specific ticker
  const toggleExpand = (ticker: string) => {
    setExpandedTickers(prev => ({
      ...prev,
      [ticker]: !prev[ticker]
    }));
  };

  // Toggle selection of a single report ID
  const toggleSingleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // Toggle selection of all reports in a ticker group
  const toggleGroupSelection = (group: TickerGroup) => {
    const groupIds = group.reports.map(r => r.id);
    const allSelected = groupIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !groupIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...groupIds])));
    }
  };

  // Execution of deletion
  const confirmDelete = () => {
    if (!onDelete || !confirmState) return;
    if (confirmState.type === 'multi') {
      onDelete(selectedIds);
      setSelectedIds([]);
    } else if (confirmState.type === 'group' && confirmState.ids) {
      onDelete(confirmState.ids);
      setSelectedIds(prev => prev.filter(i => !confirmState.ids!.includes(i)));
    } else if (confirmState.type === 'single' && confirmState.id) {
      onDelete(confirmState.id);
      setSelectedIds(prev => prev.filter(i => i !== confirmState.id));
    }
    setConfirmState(null);
  };

  // Extract quick valuation/fair value badge if available
  const extractQuickMetric = (report: any) => {
    const dcf = report.data?.intrinsic_value?.summary?.dcf_fair_value;
    const currentPrice = report.data?.intrinsic_value?.summary?.current_price || report.data?.currentPrice;
    if (dcf && typeof dcf === 'number') {
      return `DCF: $${dcf.toFixed(2)}`;
    }
    if (currentPrice && typeof currentPrice === 'number') {
      return `$${currentPrice.toFixed(2)}`;
    }
    return null;
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <motion.div 
        initial={{ y: 30, opacity: 0, scale: 0.98 }} 
        animate={{ y: 0, opacity: 1, scale: 1 }} 
        exit={{ y: 30, opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="bg-stone-50 text-stone-900 border border-stone-200/60 w-full max-w-2xl rounded-t-[28px] sm:rounded-2xl shadow-2xl flex flex-col max-h-[88vh] sm:max-h-[82vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200/80 flex flex-col gap-3 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center text-stone-700">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-stone-900 font-display leading-tight">Report History</h3>
                <p className="text-xs text-stone-500 font-mono mt-0.5">
                  {groupedReports.length} {groupedReports.length === 1 ? 'stock' : 'stocks'} • {reports.length} total {reports.length === 1 ? 'analysis' : 'analyses'}
                </p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-stone-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input 
                type="text" 
                placeholder="SEARCH BY TICKER (E.G. NVDA)..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-stone-100/50 border border-stone-200/80 rounded-xl pl-9 pr-4 py-2 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-300 font-mono uppercase"
              />
            </div>
            {selectedIds.length > 0 && onDelete && (
              <button 
                onClick={() => setConfirmState({ type: 'multi' })}
                className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-red-100 transition-colors shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete ({selectedIds.length})</span>
              </button>
            )}
          </div>
        </div>
        
        {/* Body list */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 no-scrollbar scrollbar-hide">
          {filteredGroups.length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-1">
                <Search className="w-5 h-5" />
              </div>
              <p className="text-sm text-stone-500 font-medium">
                {searchTerm ? `No reports found matching "${searchTerm}".` : 'No saved reports in history yet.'}
              </p>
              <p className="text-xs text-stone-400">
                Run a stock valuation analysis to start building your history.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredGroups.map(group => {
                const isExpanded = !!expandedTickers[group.ticker];
                const count = group.reports.length;
                const groupIds = group.reports.map(r => r.id);
                const allSelected = groupIds.length > 0 && groupIds.every(id => selectedIds.includes(id));
                const someSelected = groupIds.some(id => selectedIds.includes(id)) && !allSelected;
                const quickMetric = extractQuickMetric(group.latestReport);
                const latestIsLegacy = Boolean(group.latestReport.isLegacy);

                return (
                  <div 
                    key={group.ticker}
                    className="border border-stone-200/80 rounded-2xl bg-white shadow-sm transition-all overflow-hidden hover:border-stone-300"
                  >
                    {/* Main Consolidated Ticker Card */}
                    <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Group Selection Checkbox */}
                        <input 
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someSelected;
                          }}
                          onChange={() => toggleGroupSelection(group)}
                          className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-200 bg-white shrink-0 cursor-pointer accent-stone-900"
                          title={allSelected ? "Deselect all" : "Select all versions of " + group.ticker}
                        />

                        {/* Company Logo */}
                        <CompanyLogo ticker={group.ticker} className="w-9 h-9 sm:w-10 sm:h-10" />

                        {/* Ticker & Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-base sm:text-lg font-mono text-stone-900 tracking-wide">
                              {group.ticker}
                            </span>

                            {/* Stack Badge (if multiple versions) */}
                            {count > 1 ? (
                              <button
                                onClick={() => toggleExpand(group.ticker)}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold transition-all cursor-pointer bg-amber-50 text-amber-700 border border-amber-200/80 hover:bg-amber-100/80"
                                title="Click to view previous versions"
                              >
                                <Layers className="w-3 h-3" />
                                <span>{count} versions</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3 h-3 ml-0.5" />
                                ) : (
                                  <ChevronDown className="w-3 h-3 ml-0.5" />
                                )}
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-stone-500 bg-stone-100 border border-stone-200/50">
                                1 version
                              </span>
                            )}

                            {quickMetric && (
                              <span className="hidden sm:inline-flex text-[11px] font-mono font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                                {quickMetric}
                              </span>
                            )}
                            {latestIsLegacy && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"
                                title="Generated before Lumina financial-integrity runtime validation. Re-analyze for verified data."
                              >
                                <AlertTriangle className="w-3 h-3" />
                                Legacy / unverified
                              </span>
                            )}
                          </div>

                          {/* Timestamp & Meta */}
                          <div className="text-[11px] text-stone-500 flex flex-wrap gap-1.5 items-center mt-1 font-mono">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-stone-400" />
                              {formatTimestamp(group.latestTimestamp, false)}
                            </span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3 text-stone-400" />
                              {new Date(group.latestTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span>•</span>
                            <span className="uppercase text-[10px] bg-stone-100 px-2 py-0.5 rounded-full text-stone-600 font-semibold">
                              {group.latestReport.language || 'English'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right-side Actions */}
                      <div className="flex gap-1.5 items-center shrink-0">
                        {/* Delete entire group / single item */}
                        {onDelete && (
                          <button
                            onClick={() => {
                              if (count > 1) {
                                setConfirmState({ 
                                  type: 'group', 
                                  ids: groupIds, 
                                  ticker: group.ticker 
                                });
                              } else {
                                setConfirmState({ 
                                  type: 'single', 
                                  id: group.latestReport.id 
                                });
                              }
                            }}
                            className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title={count > 1 ? `Delete all ${count} reports for ${group.ticker}` : "Delete report"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* If multiple versions, toggle history expand button */}
                        {count > 1 && (
                          <button
                            onClick={() => toggleExpand(group.ticker)}
                            className={`p-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1 ${
                              isExpanded 
                                ? 'bg-stone-200/70 text-stone-800 border-stone-300' 
                                : 'bg-stone-100 hover:bg-stone-200/60 text-stone-700 border-stone-200'
                            }`}
                            title={isExpanded ? "Hide past versions" : "Show past versions"}
                          >
                            <History className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline text-[11px]">History</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}

                        {/* View Latest Report directly */}
                        <button 
                          onClick={() => onSelect(group.latestReport)}
                          className="px-3.5 py-1.5 bg-stone-900 text-white font-semibold rounded-lg text-xs hover:bg-black transition-colors cursor-pointer shadow-sm flex items-center gap-1"
                        >
                          <span>View</span>
                          {count > 1 && <span className="text-[10px] opacity-75 font-mono">(Latest)</span>}
                        </button>
                      </div>
                    </div>

                    {/* Sub-History Drawer: Historical Versions */}
                    <AnimatePresence>
                      {isExpanded && count > 1 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                          className="border-t border-stone-200/80 bg-stone-50/70 px-3 sm:px-4 py-3"
                        >
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-200/50">
                            <span className="text-[11px] font-mono font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                              <History className="w-3.5 h-3.5 text-stone-400" />
                              Historical Versions for {group.ticker} ({count})
                            </span>
                            <span className="text-[10px] text-stone-400 font-mono">
                              Sorted newest to oldest
                            </span>
                          </div>

                          <div className="space-y-2">
                            {group.reports.map((report, idx) => {
                              const repTimestamp = getReportTimestamp(report);
                              const isLatest = idx === 0;
                              const isSelected = selectedIds.includes(report.id);
                              const subMetric = extractQuickMetric(report);
                              const reportIsLegacy = Boolean(report.isLegacy);

                              return (
                                <div 
                                  key={report.id || idx}
                                  className={`p-2.5 sm:p-3 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                                    isSelected 
                                      ? 'bg-amber-50/60 border-amber-300/80' 
                                      : isLatest 
                                      ? 'bg-white border-stone-200/90 shadow-2xs' 
                                      : 'bg-white/80 border-stone-200/60 hover:bg-white'
                                  }`}
                                >
                                  {/* Left: Checkbox + Logo + Version tag + Timestamp */}
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <input 
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleSingleSelection(report.id)}
                                      className="w-3.5 h-3.5 rounded border-stone-300 text-stone-900 focus:ring-stone-200 bg-white shrink-0 cursor-pointer accent-stone-900"
                                    />

                                    <CompanyLogo ticker={group.ticker} className="w-6 h-6 rounded-md p-0.5" />
                                    
                                    <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                                      {/* Version Badge */}
                                      {isLatest ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-900 text-white rounded text-[10px] font-mono font-semibold shrink-0">
                                          <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                                          v{count - idx} (Latest)
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded text-[10px] font-mono font-medium shrink-0">
                                          v{count - idx}
                                        </span>
                                      )}

                                      {/* Date & Time */}
                                      <span className="text-xs font-mono text-stone-700 font-medium">
                                        {formatTimestamp(repTimestamp, true)}
                                      </span>

                                      {/* Language */}
                                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">
                                        {report.language || 'English'}
                                      </span>
                                      {reportIsLegacy && (
                                        <span
                                          className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/70"
                                          title="Legacy report — re-analyze for verified data."
                                        >
                                          <AlertTriangle className="w-3 h-3" />
                                          Legacy
                                        </span>
                                      )}

                                      {/* Metric if available */}
                                      {subMetric && (
                                        <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/50">
                                          {subMetric}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Right: Actions */}
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {onDelete && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setConfirmState({ 
                                            type: 'single', 
                                            id: report.id 
                                          });
                                        }}
                                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                        title="Delete this historical version"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}

                                    <button 
                                      onClick={() => onSelect(report)}
                                      className="px-2.5 py-1 bg-stone-100 hover:bg-stone-900 hover:text-white text-stone-800 font-medium rounded-lg text-xs transition-colors cursor-pointer font-mono"
                                    >
                                      Load
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {confirmState && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#242426] border border-white/15 max-w-sm w-full rounded-2xl p-6 shadow-2xl text-white"
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">Confirm Removal</h3>
                  <p className="text-xs sm:text-sm text-white/60 mt-1.5 leading-relaxed">
                    {confirmState.type === 'multi' && (
                      `Are you sure you want to remove ${selectedIds.length} selected report(s)? These reports will be removed from your visible history.`
                    )}
                    {confirmState.type === 'group' && (
                      `Are you sure you want to remove all ${confirmState.ids?.length || 0} historical reports for ${confirmState.ticker}? These reports will be removed from your visible history.`
                    )}
                    {confirmState.type === 'single' && (
                      'Are you sure you want to remove this historical report? This report will be removed from your visible history.'
                    )}
                  </p>
                </div>
                <div className="flex gap-2.5 w-full mt-2">
                  <button 
                    onClick={() => setConfirmState(null)}
                    className="flex-1 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white font-medium rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmDelete}
                    className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

