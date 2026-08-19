import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search } from 'lucide-react';

import { Trash2, AlertTriangle } from 'lucide-react';

interface HistoryModalProps {
  onClose: () => void;
  reports: any[];
  onSelect: (report: any) => void;
  onDelete?: (reportIds: string | string[]) => void;
}

export function HistoryModal({ onClose, reports, onSelect, onDelete }: HistoryModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmState, setConfirmState] = useState<{type: 'single' | 'multi', id?: string} | null>(null);

  const confirmDelete = () => {
    if (!onDelete || !confirmState) return;
    if (confirmState.type === 'multi') {
      onDelete(selectedIds);
      setSelectedIds([]);
    } else if (confirmState.type === 'single' && confirmState.id) {
      onDelete(confirmState.id);
      setSelectedIds(prev => prev.filter(i => i !== confirmState.id));
    }
    setConfirmState(null);
  };
  
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const filteredReports = reports.filter(r => 
    r.ticker?.toUpperCase().includes(searchTerm.toUpperCase())
  );

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
        className="bg-stone-50 text-stone-900 border border-stone-200/60 w-full max-w-2xl rounded-t-[28px] sm:rounded-2xl shadow-2xl flex flex-col max-h-[88vh] sm:max-h-[80vh] overflow-hidden"
      >
        <div className="p-4 sm:p-5 border-b border-stone-200/80 flex flex-col gap-3 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-stone-900 font-display">Report History</h3>
              <span className="text-xs text-stone-400 font-mono">({reports.length})</span>
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
                placeholder="Search by ticker (e.g. NVDA)..." 
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
        
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 scrollbar-hide">
          {filteredReports.length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center gap-2">
              <p className="text-sm text-stone-400 font-medium">
                {searchTerm ? 'No matching reports found.' : 'No saved reports in history yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredReports.map(report => (
                <div 
                  key={report.id} 
                  className="p-3 sm:p-4 border border-stone-200/80 rounded-xl bg-white flex items-center justify-between hover:bg-stone-50 transition-colors gap-2 shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <input 
                      type="checkbox"
                      checked={selectedIds.includes(report.id)}
                      onChange={() => toggleSelection(report.id)}
                      className="w-4 h-4 rounded border-stone-300 text-black focus:ring-stone-200 bg-white shrink-0 cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-base sm:text-lg font-mono text-stone-900 tracking-wide truncate">
                        {report.ticker?.toUpperCase()}
                      </div>
                      <div className="text-[11px] text-stone-500 flex flex-wrap gap-1.5 items-center mt-0.5 font-mono">
                        <span>{new Date(report.createdAt?.seconds * 1000 || report.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className="uppercase text-[10px] bg-stone-100 px-2 py-0.5 rounded-full text-stone-600">
                          {report.language || 'English'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-1.5 items-center shrink-0">
                    {onDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmState({ type: 'single', id: report.id });
                        }}
                        className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete report"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={() => onSelect(report)}
                      className="px-3.5 py-1.5 bg-stone-900 text-white font-semibold rounded-lg text-xs hover:bg-black transition-colors cursor-pointer shadow-sm"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
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
                  <h3 className="text-base sm:text-lg font-bold text-white">Confirm Deletion</h3>
                  <p className="text-xs sm:text-sm text-white/60 mt-1.5 leading-relaxed">
                    Are you sure you want to delete {confirmState.type === 'multi' ? `${selectedIds.length} report(s)` : 'this report'}? This action cannot be undone.
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
