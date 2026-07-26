const fs = require('fs');
let content = fs.readFileSync('src/components/HistoryModal.tsx', 'utf8');

// Add AnimatePresence and AlertTriangle
content = content.replace("import { motion } from 'motion/react';", "import { motion, AnimatePresence } from 'motion/react';");
content = content.replace("import { Trash2 } from 'lucide-react';", "import { Trash2, AlertTriangle } from 'lucide-react';");

// Add confirm state
const stateTarget = `  const [selectedIds, setSelectedIds] = useState<string[]>([]);`;
const stateReplace = `  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
  };`;
content = content.replace(stateTarget, stateReplace);

// Update multi delete button
const multiTarget = `                onClick={() => {
                  onDelete(selectedIds);
                  setSelectedIds([]);
                }}`;
const multiReplace = `                onClick={() => setConfirmState({ type: 'multi' })}`;
content = content.replace(multiTarget, multiReplace);

// Update single delete button
const singleTarget = `                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(report.id);
                          setSelectedIds(prev => prev.filter(i => i !== report.id));
                        }}`;
const singleReplace = `                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmState({ type: 'single', id: report.id });
                        }}`;
content = content.replace(singleTarget, singleReplace);

// Add modal render
const renderTarget = `    </motion.div>
  );
}`;
const renderReplace = `      <AnimatePresence>
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
                    Are you sure you want to delete {confirmState.type === 'multi' ? \`\${selectedIds.length} report(s)\` : 'this report'}? This action cannot be undone.
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
}`;
content = content.replace(renderTarget, renderReplace);

fs.writeFileSync('src/components/HistoryModal.tsx', content);
