import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Plus, Trash2, TrendingUp, TrendingDown, Briefcase,
  Star, AlertTriangle, ShieldCheck, DollarSign, PieChart,
  Layers, ArrowRight, RefreshCw, Check
} from 'lucide-react';
import { PortfolioHolding } from '../types';
import {
  calculatePortfolioSummary,
  loadLocalPortfolio,
  saveLocalPortfolio,
  loadLocalWatchlist,
  saveLocalWatchlist,
  SUGGESTED_WATCHLIST_TICKERS
} from '../utils/portfolioEngine';
import { ProvenanceBadge } from './ProvenanceBadge';
import { fetchLiveQuotes } from '../services/marketDataService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isThai: boolean;
  user?: any;
  onSelectTicker?: (ticker: string) => void;
  quotes?: Record<string, any>;
  latestReports?: Record<string, any>;
}

export function PortfolioModal({
  isOpen,
  onClose,
  isThai,
  user,
  onSelectTicker,
  quotes = {},
  latestReports = {}
}: Props) {
  const [activeTab, setActiveTab] = useState<'portfolio' | 'watchlist'>('portfolio');
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [internalQuotes, setInternalQuotes] = useState<Record<string, number>>({});
  const [isRefreshingQuotes, setIsRefreshingQuotes] = useState(false);

  // Add holding form state
  const [isAddingHolding, setIsAddingHolding] = useState(false);
  const [newTicker, setNewTicker] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newAvgCost, setNewAvgCost] = useState('');
  const [newSector, setNewSector] = useState('Technology');
  const [newNotes, setNewNotes] = useState('');

  // Add watchlist ticker state
  const [newWatchTicker, setNewWatchTicker] = useState('');

  useEffect(() => {
    if (isOpen) {
      const loadedHoldings = loadLocalPortfolio(user?.uid);
      const loadedWatchlist = loadLocalWatchlist(user?.uid);
      setHoldings(loadedHoldings);
      setWatchlist(loadedWatchlist);

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

  const activeQuotes = useMemo(() => {
    return { ...internalQuotes, ...quotes };
  }, [internalQuotes, quotes]);

  const summary = useMemo(() => {
    return calculatePortfolioSummary(holdings, activeQuotes, latestReports);
  }, [holdings, activeQuotes, latestReports]);

  if (!isOpen) return null;

  const handleAddHolding = (e: React.FormEvent) => {
    e.preventDefault();
    const tick = newTicker.trim().toUpperCase();
    const qty = parseFloat(newQty);
    const cost = parseFloat(newAvgCost);
    if (!tick || isNaN(qty) || qty <= 0 || isNaN(cost) || cost < 0) return;

    const newHolding: PortfolioHolding = {
      id: `${tick}-${Date.now()}`,
      ticker: tick,
      quantity: qty,
      average_cost: cost,
      sector: newSector || 'Other',
      notes: newNotes.trim() || undefined,
      created_at: new Date().toISOString()
    };

    const updated = [...holdings.filter(h => h.ticker !== tick), newHolding];
    setHoldings(updated);
    saveLocalPortfolio(updated, user?.uid);

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
    setIsAddingHolding(false);
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="portfolio-modal-title"
    >
      <div
        className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] shadow-2xl border border-stone-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-stone-100 bg-stone-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#0b5a4b] border border-emerald-200/80 flex items-center justify-center shadow-2xs">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="portfolio-modal-title" className="text-xl font-bold text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight">
                  {isThai ? 'พอร์ตการลงทุน & Watchlist' : 'Portfolio & Watchlist Intelligence'}
                </h2>
                <ProvenanceBadge classification="calculated" isThai={isThai} size="xs" />
              </div>
              <p className="text-xs text-stone-500 font-sans">
                {isThai ? 'ติดตามสถานะพอร์ตการลงทุน ตรวจสอบความเข้มข้น และคำนวณ Margin of Safety รวม' : 'Track holdings, evaluate concentration risk, and monitor weighted portfolio valuation'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-2 rounded-full hover:bg-stone-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center justify-between px-6 pt-3 border-b border-stone-100 bg-white">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('portfolio')}
              className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'portfolio'
                  ? 'border-[#0b5a4b] text-[#0b5a4b]'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>{isThai ? 'พอร์ตการลงทุน' : 'Portfolio Holdings'} ({holdings.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('watchlist')}
              className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'watchlist'
                  ? 'border-[#0b5a4b] text-[#0b5a4b]'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Star className="w-4 h-4" />
              <span>{isThai ? 'รายการติดตาม (Watchlist)' : 'Watchlist'} ({watchlist.length})</span>
            </button>
          </div>

          {activeTab === 'portfolio' && (
            <button
              type="button"
              onClick={() => setIsAddingHolding(!isAddingHolding)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-stone-900 text-white hover:bg-stone-800 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isThai ? 'เพิ่มหุ้นในพอร์ต' : 'Add Holding'}</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-6">

          {/* TAB 1: PORTFOLIO */}
          {activeTab === 'portfolio' && (
            <>
              {/* Add Holding Inline Form */}
              {isAddingHolding && (
                <form onSubmit={handleAddHolding} className="p-4 sm:p-5 bg-stone-50 rounded-2xl border border-stone-200 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                      {isThai ? 'บันทึกการถือครองหุ้น' : 'New Portfolio Holding'}
                    </span>
                    <button type="button" onClick={() => setIsAddingHolding(false)} className="text-stone-400 hover:text-stone-600 text-xs">
                      {isThai ? 'ยกเลิก' : 'Cancel'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono uppercase font-bold text-stone-500 mb-1">{isThai ? 'ชื่อย่อหุ้น' : 'Ticker'}</label>
                      <input
                        type="text"
                        placeholder="e.g. MSFT"
                        value={newTicker}
                        onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                        required
                        className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-stone-200 rounded-xl uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase font-bold text-stone-500 mb-1">{isThai ? 'จำนวนหุ้น' : 'Shares (Qty)'}</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="100"
                        value={newQty}
                        onChange={(e) => setNewQty(e.target.value)}
                        required
                        className="w-full px-3 py-2 text-xs font-mono bg-white border border-stone-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase font-bold text-stone-500 mb-1">{isThai ? 'ต้นทุนเฉลี่ย ($)' : 'Avg Cost ($)'}</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="420.50"
                        value={newAvgCost}
                        onChange={(e) => setNewAvgCost(e.target.value)}
                        required
                        className="w-full px-3 py-2 text-xs font-mono bg-white border border-stone-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase font-bold text-stone-500 mb-1">{isThai ? 'หมวดธุรกิจ' : 'Sector'}</label>
                      <select
                        value={newSector}
                        onChange={(e) => setNewSector(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-stone-200 rounded-xl"
                      >
                        <option value="Technology">Technology</option>
                        <option value="Financial Services">Financial Services</option>
                        <option value="Healthcare">Healthcare</option>
                        <option value="Consumer Cyclical">Consumer Cyclical</option>
                        <option value="Communication">Communication</option>
                        <option value="Industrials">Industrials</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#0b5a4b] text-white text-xs font-bold rounded-xl hover:bg-[#09473b] transition-all shadow-xs cursor-pointer"
                    >
                      {isThai ? 'บันทึกเข้าพอร์ต' : 'Save Holding'}
                    </button>
                  </div>
                </form>
              )}

              {/* Portfolio Metric Snapshot Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Total Market Value */}
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col">
                  <span className="text-[10px] font-mono uppercase font-bold text-stone-400">
                    {isThai ? 'มูลค่าพอร์ตรวม' : 'Total Market Value'}
                  </span>
                  <span className="text-xl font-mono font-extrabold text-stone-900 mt-1">
                    {summary.total_market_value !== null
                      ? `$${summary.total_market_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : summary.priced_market_value > 0
                      ? `$${summary.priced_market_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : (isThai ? 'ไม่สามารถระบุได้' : 'Unavailable')}
                  </span>
                  <span className="text-[10px] text-stone-500 font-mono mt-0.5">
                    {summary.unpriced_holdings_count > 0 ? (
                      <span className="text-amber-700 font-sans">
                        {isThai
                          ? `ครอบคลุมราคา ${summary.pricing_coverage_pct}% (${summary.unpriced_holdings_count} รายการขาดราคาตลาด)`
                          : `${summary.pricing_coverage_pct}% priced (${summary.unpriced_holdings_count} missing quote)`}
                      </span>
                    ) : (
                      <>{isThai ? 'ต้นทุน:' : 'Cost Basis:'} ${summary.total_cost_basis.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                    )}
                  </span>
                </div>

                {/* Total Unrealized P/L */}
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col">
                  <span className="text-[10px] font-mono uppercase font-bold text-stone-400">
                    {isThai ? 'กำไร/ขาดทุนที่ยังไม่รับรู้' : 'Unrealized Gain / Loss'}
                  </span>
                  {summary.total_unrealized_pnl !== null && summary.total_unrealized_pnl_pct !== null ? (
                    <>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <span className={`text-xl font-mono font-extrabold ${summary.total_unrealized_pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {summary.total_unrealized_pnl >= 0 ? '+' : ''}${summary.total_unrealized_pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <span className={`text-[10px] font-mono font-bold ${summary.total_unrealized_pnl_pct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {summary.total_unrealized_pnl_pct >= 0 ? '+' : ''}{summary.total_unrealized_pnl_pct.toFixed(2)}%
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-semibold text-stone-600 mt-1">
                        {isThai ? 'ไม่สามารถคำนวณกำไร/ขาดทุนรวมได้' : 'Total P/L Unavailable'}
                      </div>
                      <span className="text-[10px] text-amber-700 font-sans mt-0.5">
                        {isThai
                          ? `ขาดราคาตลาดสด ${summary.unpriced_holdings_count} รายการ`
                          : `${summary.unpriced_holdings_count} holdings missing live price`}
                      </span>
                    </>
                  )}
                </div>

                {/* Top Concentration Risk */}
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col">
                  <span className="text-[10px] font-mono uppercase font-bold text-stone-400">
                    {isThai ? 'ความเข้มข้นสูงสุด (Concentration)' : 'Top Holding Weight'}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xl font-mono font-extrabold text-stone-900">
                      {summary.top_holding_concentration_pct.toFixed(1)}%
                    </span>
                    {summary.concentration_risk_alert && (
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-mono rounded font-bold" title={isThai ? 'เกินเกณฑ์ 30%' : 'Above 30% concentration limit'}>
                        ⚠️ Alert
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-stone-500 font-sans mt-0.5">
                    {summary.concentration_risk_alert
                      ? (isThai ? 'มีหุ้นสัดส่วนเกิน 30% ควรพิจารณา Diversify' : 'Exceeds 30% single-holding prudent limit')
                      : (isThai ? 'สัดส่วนกระจายตัวในเกณฑ์ปลอดภัย' : 'Prudently diversified weight')}
                  </span>
                </div>

                {/* Weighted Margin of Safety */}
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col">
                  <span className="text-[10px] font-mono uppercase font-bold text-stone-400">
                    {isThai ? 'Margin of Safety เฉลี่ยของพอร์ต' : 'Weighted Margin of Safety'}
                  </span>
                  <span className={`text-xl font-mono font-extrabold mt-1 ${
                    summary.weighted_margin_of_safety_pct !== null && summary.weighted_margin_of_safety_pct !== undefined
                      ? (summary.weighted_margin_of_safety_pct >= 0 ? 'text-[#0b5a4b]' : 'text-amber-700')
                      : 'text-stone-400'
                  }`}>
                    {summary.weighted_margin_of_safety_pct !== null && summary.weighted_margin_of_safety_pct !== undefined
                      ? `${summary.weighted_margin_of_safety_pct > 0 ? '+' : ''}${summary.weighted_margin_of_safety_pct.toFixed(1)}%`
                      : '-'}
                  </span>
                  <span className="text-[10px] text-stone-500 font-sans mt-0.5">
                    {isThai ? 'ถ่วงน้ำหนักตามมูลค่าแท้จริง DCF' : 'Weighted across analyzed holdings'}
                  </span>
                </div>
              </div>

              {/* Holdings Table */}
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
                {holdings.length === 0 ? (
                  <div className="p-8 text-center text-stone-400 text-xs italic">
                    {isThai ? 'ยังไม่มีหุ้นในพอร์ตการลงทุน กด "เพิ่มหุ้นในพอร์ต" เพื่อเริ่มบันทึก' : 'No holdings recorded yet. Click "Add Holding" to start tracking your portfolio.'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-stone-200 bg-stone-50/80 text-[10px] font-bold text-stone-500 uppercase tracking-wider font-mono">
                          <th className="py-2.5 px-4">{isThai ? 'หุ้น' : 'Ticker'}</th>
                          <th className="py-2.5 px-3 text-right">{isThai ? 'จำนวน' : 'Quantity'}</th>
                          <th className="py-2.5 px-3 text-right">{isThai ? 'ต้นทุนเฉลี่ย' : 'Avg Cost'}</th>
                          <th className="py-2.5 px-3 text-right">{isThai ? 'ราคาตลาด' : 'Market Price'}</th>
                          <th className="py-2.5 px-3 text-right">{isThai ? 'มูลค่า' : 'Market Value'}</th>
                          <th className="py-2.5 px-3 text-right">{isThai ? 'กำไร/ขาดทุน' : 'Unrealized P/L'}</th>
                          <th className="py-2.5 px-3 text-right">{isThai ? 'สัดส่วน' : 'Weight'}</th>
                          <th className="py-2.5 px-3 text-center">{isThai ? 'จัดการ' : 'Action'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 font-sans">
                        {summary.computed_holdings.map((h) => (
                          <tr key={h.id || h.ticker} className="hover:bg-stone-50/70 transition-colors">
                            <td className="py-2.5 px-4 font-bold font-mono text-stone-900">
                              <div className="flex items-center gap-1.5">
                                <span>{h.ticker}</span>
                                {h.sector && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 font-sans font-normal">
                                    {h.sector}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-stone-700">
                              {h.quantity.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-stone-700">
                              ${h.average_cost.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-stone-900">
                              {typeof h.current_price === 'number' ? `$${h.current_price.toFixed(2)}` : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-stone-900">
                              {typeof h.market_value === 'number' ? `$${h.market_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : `$${h.total_cost.toFixed(2)}`}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">
                              {typeof h.unrealized_pnl === 'number' ? (
                                <div className={h.unrealized_pnl >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                                  <span>{h.unrealized_pnl >= 0 ? '+' : ''}${h.unrealized_pnl.toFixed(2)}</span>
                                  <div className="text-[10px]">
                                    {h.unrealized_pnl_pct !== null && h.unrealized_pnl_pct !== undefined ? `${h.unrealized_pnl_pct >= 0 ? '+' : ''}${h.unrealized_pnl_pct.toFixed(2)}%` : ''}
                                  </div>
                                </div>
                              ) : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-stone-700">
                              {h.allocation_pct.toFixed(1)}%
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {onSelectTicker && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onSelectTicker(h.ticker);
                                      onClose();
                                    }}
                                    className="p-1 rounded-md text-[#0b5a4b] hover:bg-emerald-50 transition-colors cursor-pointer"
                                    title={isThai ? 'วิเคราะห์หุ้นตัวนี้' : 'Analyze this stock'}
                                  >
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveHolding(h.id)}
                                  className="p-1 rounded-md text-stone-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title={isThai ? 'ลบรายการ' : 'Remove holding'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Sector Allocation Breakdown */}
              {summary.sector_breakdown.length > 0 && (
                <div className="p-4 sm:p-5 bg-stone-50 rounded-2xl border border-stone-200 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-[#0b5a4b]" />
                    <span className="text-xs font-bold text-stone-800 uppercase tracking-wider font-mono">
                      {isThai ? 'การกระจายตัวตามหมวดธุรกิจ (Sector Exposure)' : 'Sector Allocation Breakdown'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {summary.sector_breakdown.map((sec, i) => (
                      <div key={i} className="p-3 bg-white rounded-xl border border-stone-200/80 flex items-center justify-between text-xs">
                        <span className="font-semibold text-stone-800">{sec.sector}</span>
                        <div className="text-right font-mono">
                          <span className="font-bold text-stone-900">{sec.allocation_pct.toFixed(1)}%</span>
                          <span className="text-[10px] text-stone-400 block">${sec.market_value.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB 2: WATCHLIST */}
          {activeTab === 'watchlist' && (
            <div className="flex flex-col gap-4">
              {/* Add Watchlist Ticker input */}
              <form onSubmit={handleAddWatchlistTicker} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={isThai ? "พิมพ์ชื่อย่อหุ้น e.g. NVDA, AMZN" : "Enter ticker e.g. NVDA, AMZN"}
                  value={newWatchTicker}
                  onChange={(e) => setNewWatchTicker(e.target.value.toUpperCase())}
                  className="px-3.5 py-2 text-xs font-mono font-bold bg-stone-50 border border-stone-200 rounded-xl uppercase max-w-xs focus:bg-white focus:outline-hidden focus:border-[#0b5a4b]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isThai ? 'เพิ่มใน Watchlist' : 'Add to Watchlist'}</span>
                </button>
              </form>

              {/* Watchlist Table */}
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs divide-y divide-stone-100">
                {watchlist.length === 0 ? (
                  <div className="p-8 text-center space-y-3">
                    <p className="text-stone-400 text-xs italic">
                      {isThai ? 'ยังไม่มีหุ้นใน Watchlist ของคุณ' : 'No stocks on your watchlist.'}
                    </p>
                    <div className="pt-2">
                      <span className="text-xs text-stone-500 font-semibold block mb-2">
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
                            className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Plus className="w-3 h-3 text-[#0b5a4b]" />
                            <span>{sug}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  watchlist.map((tick) => {
                    const q = quotes[tick];
                    const price = typeof q === 'number' ? q : q?.price;
                    return (
                      <div key={tick} className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-stone-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                          <span className="font-mono font-bold text-sm sm:text-base text-stone-900">{tick}</span>
                          {typeof price === 'number' && (
                            <span className="font-mono font-bold text-xs text-stone-700 bg-stone-100 px-2 py-0.5 rounded-md">
                              ${price.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {onSelectTicker && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectTicker(tick);
                                onClose();
                              }}
                              className="px-3 py-1.5 bg-[#0b5a4b] hover:bg-[#09473b] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                            >
                              <span>{isThai ? 'วิเคราะห์' : 'Analyze'}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveWatchlistTicker(tick)}
                            className="p-1.5 text-stone-300 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title={isThai ? 'ลบออกจาก Watchlist' : 'Remove from watchlist'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-100 bg-stone-50/50 flex items-center justify-between text-xs text-stone-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#0b5a4b]" />
            <span>{isThai ? 'ข้อมูลถูกจัดเก็บในเครื่องของคุณอย่างปลอดภัย' : 'Saved locally with zero third-party leakage'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-700 hover:text-stone-900 font-bold px-3 py-1 cursor-pointer"
          >
            {isThai ? 'ปิด' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
