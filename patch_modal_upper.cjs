const fs = require('fs');
let content = fs.readFileSync('src/components/HistoryModal.tsx', 'utf8');

const targetSearch = `  const filteredReports = reports.filter(r => 
    r.ticker?.toLowerCase().includes(searchTerm.toLowerCase())
  );`;
const replaceSearch = `  const filteredReports = reports.filter(r => 
    r.ticker?.toUpperCase().includes(searchTerm.toUpperCase())
  );`;
content = content.replace(targetSearch, replaceSearch);

const targetRender = `<div className="font-bold text-lg">{report.ticker}</div>`;
const replaceRender = `<div className="font-bold text-lg">{report.ticker?.toUpperCase()}</div>`;
content = content.replace(targetRender, replaceRender);

fs.writeFileSync('src/components/HistoryModal.tsx', content);
