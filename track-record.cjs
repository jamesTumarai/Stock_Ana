const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

const trackRecordComponent = `
const TrackRecordBadge = ({ ticker, currentPrice, historyReports = [], isThai }: { ticker: string, currentPrice?: number, historyReports: any[], isThai: boolean }) => {
  if (!historyReports.length || !currentPrice) return null;
  
  const pastReports = historyReports.filter(r => 
    r.ticker?.toUpperCase() === ticker?.toUpperCase() && 
    r.data?.technical_analysis?.signal_summary?.status &&
    r.data?.technical_analysis?.key_levels?.current_price
  ).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)); // oldest first

  if (pastReports.length < 2) return null; // Need at least some history

  let wins = 0;
  let totalEvaluated = 0;

  pastReports.forEach(report => {
    const status = (report.data.technical_analysis.signal_summary.status || '').toLowerCase();
    const pastPrice = parseFloat(report.data.technical_analysis.key_levels.current_price);
    
    if (isNaN(pastPrice)) return;
    
    // Evaluate if 'Buy' made money, or 'Sell/Avoid' saved money
    if (status.includes('buy')) {
       totalEvaluated++;
       if (currentPrice > pastPrice) wins++;
    } else if (status.includes('sell') || status.includes('avoid')) {
       totalEvaluated++;
       if (currentPrice < pastPrice) wins++;
    }
  });

  if (totalEvaluated === 0) return null;
  
  const winRate = Math.round((wins / totalEvaluated) * 100);
  
  return (
    <div className="flex items-center gap-2 mt-4 bg-white/50 border border-stone-200 px-4 py-2 rounded-lg inline-flex">
      <span className="text-xl">🎯</span>
      <div className="flex flex-col">
        <span className="text-xs text-stone-500 font-medium uppercase tracking-wider">{isThai ? 'สถิติความแม่นยำ (Track Record)' : 'Signal Track Record'}</span>
        <span className="text-sm font-bold text-stone-900">
          {winRate}% {isThai ? 'ชนะ' : 'Win Rate'} <span className="text-stone-400 font-normal">({wins}/{totalEvaluated} {isThai ? 'ครั้งที่ให้สัญญาณถูก' : 'correct calls'})</span>
        </span>
      </div>
    </div>
  );
};
`;

content = content.replace('const IndicatorVisualizer', trackRecordComponent + '\nconst IndicatorVisualizer');

fs.writeFileSync('src/ReportTemplate.tsx', content);
console.log("Added track record component");
