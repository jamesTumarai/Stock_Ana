import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  X, Bell, AlertTriangle, ShieldAlert, Info, CheckCircle2,
  Settings, ExternalLink, ArrowRight, Filter, Check, Trash2
} from 'lucide-react';
import { MonitoringAlert, MonitoringPreferences } from '../types';
import { ProvenanceBadge } from './ProvenanceBadge';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isThai: boolean;
  alerts: MonitoringAlert[];
  preferences: MonitoringPreferences;
  onUpdatePreferences: (prefs: MonitoringPreferences) => void;
  onMarkAsRead: (alertId: string) => void;
  onMarkAllAsRead: () => void;
  onSelectTicker?: (ticker: string, linkSection?: string) => void;
}

export function AlertsModal({
  isOpen,
  onClose,
  isThai,
  alerts,
  preferences,
  onUpdatePreferences,
  onMarkAsRead,
  onMarkAllAsRead,
  onSelectTicker
}: Props) {
  const [filterType, setFilterType] = useState<string>('all');
  const [showSettings, setShowSettings] = useState(false);

  // Settings form local state
  const [mosThreshold, setMosThreshold] = useState(preferences.mosThresholdPct);
  const [convictionThreshold, setConvictionThreshold] = useState(preferences.convictionThresholdPoints);
  const [concentrationThreshold, setConcentrationThreshold] = useState(preferences.concentrationThresholdPct);

  if (!isOpen) return null;

  const unreadCount = alerts.filter(a => !a.isRead).length;

  const filteredAlerts = alerts.filter(a => {
    if (filterType === 'unread') return !a.isRead;
    if (filterType === 'valuation') return a.type.startsWith('VALUATION');
    if (filterType === 'filings') return a.type.startsWith('FILING');
    if (filterType === 'portfolio') return a.type === 'PORTFOLIO_CONCENTRATION';
    return true;
  });

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdatePreferences({
      ...preferences,
      mosThresholdPct: Number(mosThreshold) || 20,
      convictionThresholdPoints: Number(convictionThreshold) || 10,
      concentrationThresholdPct: Number(concentrationThreshold) || 30
    });
    setShowSettings(false);
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
        className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] shadow-[0_24px_72px_rgba(0,0,0,0.28)] border border-stone-200 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-stone-100 bg-stone-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200/80 flex items-center justify-center shadow-2xs relative">
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
              <p className="text-xs text-stone-500 font-sans">
                {isThai
                  ? `ระบบตรวจสอบความปลอดภัย มูลค่า และเอกสาร SEC เมื่อเปิดแอป อิงข้อมูลราคาตลาดและรายงานจริง`
                  : `Evaluated dynamically from live market quotes and verified research reports when the application is opened`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              whileTap={{ scale: 0.9 }}
              className={`p-2 rounded-full transition-colors cursor-pointer ${showSettings ? 'bg-stone-200 text-stone-900' : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'}`}
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

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-200 transition-colors"
              >
                {isThai ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 transition-colors"
              >
                {isThai ? 'บันทึกเกณฑ์' : 'Save Thresholds'}
              </button>
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
                    filterType === tab.id ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </motion.button>
            ))}
          </div>

          {unreadCount > 0 && (
            <motion.button
              type="button"
              onClick={onMarkAllAsRead}
              whileTap={{ scale: 0.96 }}
              className="text-xs font-semibold text-[#0b5a4b] hover:text-[#084237] transition-colors flex items-center gap-1 cursor-pointer shrink-0 ml-2"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isThai ? 'อ่านทั้งหมดแล้ว' : 'Mark all read'}</span>
            </motion.button>
          )}
        </div>

        {/* Alerts List */}
        <motion.div
          key={filterType}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-3"
        >
          {filteredAlerts.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-[#0b5a4b] flex items-center justify-center mb-3">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-stone-800 font-['Prompt','Mitr','Nunito',sans-serif]">
                {isThai ? 'ไม่มีการแจ้งเตือนที่ตรงเงื่อนไข' : 'No Active Alerts Found'}
              </h4>
              <p className="text-xs text-stone-400 mt-1 max-w-sm">
                {isThai
                  ? 'หุ้นทั้งหมดในรายการติดตามและพอร์ตยังอยู่ในเกณฑ์ปกติ ไม่มีเหตุการณ์ที่ละเมิดเกณฑ์ความเสี่ยง'
                  : 'All tracked watchlist & portfolio assets are currently within normal baseline parameters.'}
              </p>
            </div>
          ) : (
            filteredAlerts.map((alert, index) => {
              const style = getSeverityStyle(alert.severity);

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
            })
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
