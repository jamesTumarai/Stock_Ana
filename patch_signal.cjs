const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

content = content.replace(
  '                     {data.technical_analysis.signal_summary?.status || \'Wait\'}\n                   </div>\n                 </div>\n              </AnalysisCard>',
  '                     {data.technical_analysis.signal_summary?.status || \'Wait\'}\n                   </div>\n                 </div>\n                 <div className="flex justify-center">\n                   <TrackRecordBadge ticker={ticker} currentPrice={parseFloat(data.technical_analysis.key_levels?.current_price)} historyReports={historyReports} isThai={isThai} />\n                 </div>\n              </AnalysisCard>'
);

fs.writeFileSync('src/ReportTemplate.tsx', content);
console.log("Patched signal summary card");
