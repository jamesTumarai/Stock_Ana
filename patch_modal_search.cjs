const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetModal = `    <div className="relative h-screen bg-black overflow-hidden font-sans text-stone-100 flex flex-col">
      <AnimatePresence>
        {isHistoryModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#F6F4F0] w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-white">
                <h3 className="text-lg font-bold text-stone-900 font-display">Report History</h3>
                <button onClick={() => setIsHistoryModalOpen(false)} className="text-stone-500 hover:text-stone-800">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 text-stone-900">
                {historyReports.length === 0 ? (
                  <p className="text-stone-500 text-center py-8">No reports found.</p>
                ) : (
                  <div className="space-y-3">
                    {historyReports.map(report => (`;

const replaceModal = `    <div className="relative h-screen bg-black overflow-hidden font-sans text-stone-100 flex flex-col">
      <AnimatePresence>
        {isHistoryModalOpen && (
          <HistoryModal 
            onClose={() => setIsHistoryModalOpen(false)} 
            reports={historyReports} 
            onSelect={(report) => {
              setTicker(report.ticker);
              setSelectedLanguage(report.language || 'English');
              setCurrentReport(report.data);
              setPastReports([]);
              setIsHistoryModalOpen(false);
              setIsReportOpen(true);
            }} 
          />
        )}
      </AnimatePresence>
`;

content = content.replace(targetModal, replaceModal);
fs.writeFileSync('src/App.tsx', content);
