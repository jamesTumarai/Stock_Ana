const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetOld = `                      <div key={report.id} className="p-4 border border-stone-200 rounded-xl bg-white flex items-center justify-between hover:border-stone-300 transition-colors">
                        <div>
                          <div className="font-bold text-lg">{report.ticker}</div>
                          <div className="text-xs text-stone-500 flex gap-2 items-center">
                            <span>{new Date(report.createdAt?.seconds * 1000 || report.createdAt).toLocaleDateString()}</span>
                            <span>•</span>
                            <span className="uppercase text-[10px] bg-stone-100 px-2 py-0.5 rounded-full">{report.language || 'English'}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            setTicker(report.ticker);
                            setSelectedLanguage(report.language || 'English');
                            setCurrentReport(report.data);
                            setPastReports([]);
                            setIsHistoryModalOpen(false);
                            setIsReportOpen(true);
                          }}
                          className="px-4 py-2 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800"
                        >
                          View
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>`;

const replaceOld = ``;

content = content.replace(targetOld, replaceOld);

// Add import for HistoryModal
const importTarget = `import { LandingView } from './LandingView';`;
const importReplace = `import { LandingView } from './LandingView';
import { HistoryModal } from './components/HistoryModal';`;
content = content.replace(importTarget, importReplace);

fs.writeFileSync('src/App.tsx', content);
