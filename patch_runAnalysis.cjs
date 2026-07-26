const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetRun = `  const runAnalysis = () => {
    if (!ticker.trim() || running) return;
    
    if (currentReport) {
      setPastReports(prev => [...prev, currentReport]);
    }
    
    setIsReportOpen(false);
    window.scrollTo(0, 0);
    
    startStream(`;

const replaceRun = `  const runAnalysis = () => {
    if (!ticker.trim() || running) return;
    
    // Clear old data when running a new analysis
    setPastReports([]);
    setCurrentReport(null);
    
    setIsReportOpen(false);
    window.scrollTo(0, 0);
    
    startStream(`;

content = content.replace(targetRun, replaceRun);
fs.writeFileSync('src/App.tsx', content);
