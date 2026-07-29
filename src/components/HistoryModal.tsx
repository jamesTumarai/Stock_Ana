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
      className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#F6F4F0] w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="p-4 border-b border-stone-200 flex flex-col gap-4 bg-white">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-stone-900 font-display">Report History</h3>
            <button onClick={onClose} className="text-stone-500 hover:text-stone-800">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input 
                type="text" 
                placeholder="Search by ticker..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)} onBlur={() => window.scrollTo(0, 0)}
                className="w-full bg-stone-100 border border-stone-200 rounded-lg pl-10 pr-4 py-2 text-base text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-500"
              />
            </div>
            {selectedIds.length > 0 && onDelete && (
              <button 
                onClick={() => setConfirmState({ type: 'multi' })}
                className="flex items-center gap-2 bg-red-50 text-red-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected ({selectedIds.length})
              </button>
            )}
          </div>
        </div>
        <div className="p-4 overflow-y-auto flex-1 text-stone-900">
          {filteredReports.length === 0 ? (
            <p className="text-stone-500 text-center py-8">
              {searchTerm ? 'No matching reports found.' : 'No reports found.'}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredReports.map(report => (
                <div key={report.id} className="p-4 border border-stone-200 rounded-xl bg-white flex items-center justify-between hover:border-stone-300 transition-colors">
                  <div className="flex items-center gap-4">
                    <input 
                      type="checkbox"
                      checked={selectedIds.includes(report.id)}
                      onChange={() => toggleSelection(report.id)}
                      className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-500"
                    />
                    <div>
                      <div className="font-bold text-lg">{report.ticker?.toUpperCase()}</div>
                    <div className="text-xs text-stone-500 flex gap-2 items-center">
                      <span>{new Date(report.createdAt?.seconds * 1000 || report.createdAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span className="uppercase text-[10px] bg-stone-100 px-2 py-0.5 rounded-full">{report.language || 'English'}</span>
                    </div>
                  </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    {onDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmState({ type: 'single', id: report.id });
                        }}
                        className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete report"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={() => onSelect(report)}
                      className="px-4 py-2 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800"
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
            className="absolute inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white max-w-sm w-full rounded-2xl p-6 shadow-xl"
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-stone-900">Confirm Deletion</h3>
                  <p className="text-sm text-stone-500 mt-2">
                    Are you sure you want to delete {confirmState.type === 'multi' ? `${selectedIds.length} report(s)` : 'this report'}? This action cannot be undone.
                  </p>
                </div>
                <div className="flex gap-3 w-full mt-2">
                  <button 
                    onClick={() => setConfirmState(null)}
                    className="flex-1 px-4 py-2 bg-stone-100 text-stone-700 font-medium rounded-lg hover:bg-stone-200"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmDelete}
                    className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700"
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
