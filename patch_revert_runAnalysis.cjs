const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetRun = `  const runAnalysis = () => {
    if (!ticker.trim() || running) return;
    
    // Clear old data when running a new analysis
    setPastReports([]);
    setCurrentReport(null);
    
    setIsReportOpen(false);
    window.scrollTo(0, 0);`;

const replaceRun = `  const runAnalysis = () => {
    if (!ticker.trim() || running) return;
    
    if (currentReport) {
      setPastReports(prev => [...prev, currentReport]);
    }
    
    setIsReportOpen(false);
    window.scrollTo(0, 0);`;

content = content.replace(targetRun, replaceRun);

const targetInterface = `export interface ReportData {`;
const replaceInterface = `export interface ReportData {
  ticker?: string;`;
content = content.replace(targetInterface, replaceInterface);

const targetSelect = `            onSelect={(report) => {
              setTicker(report.ticker);
              setSelectedLanguage(report.language || 'English');
              setCurrentReport(report.data);
              setPastReports([]);`;
const replaceSelect = `            onSelect={(report) => {
              setTicker(report.ticker);
              setSelectedLanguage(report.language || 'English');
              setCurrentReport({ ...report.data, ticker: report.ticker });
              setPastReports([]);`;
content = content.replace(targetSelect, replaceSelect);

const targetStream1 = `            if (foundData) setRep({ ...foundData, analysis_type: aType });`;
const replaceStream1 = `            if (foundData) setRep({ ...foundData, analysis_type: aType, ticker: ticker.trim() });`;
content = content.replace(targetStream1, replaceStream1);

const targetStream2 = `            const finalRep = { ...finalData, analysis_type: aType };`;
const replaceStream2 = `            const finalRep = { ...finalData, analysis_type: aType, ticker: ticker.trim() };`;
content = content.replace(targetStream2, replaceStream2);

const targetRender = `             <ReportTemplate 
               key={idx}
               data={report} 
               ticker={ticker} 
               onClose={handleCloseReport}
               durationSecs={idx === allReports.length - 1 ? durationSecs : undefined}
             />`;
const replaceRender = `             <ReportTemplate 
               key={idx}
               data={report} 
               ticker={report.ticker || ticker} 
               onClose={handleCloseReport}
               durationSecs={idx === allReports.length - 1 ? durationSecs : undefined}
             />`;
content = content.replace(targetRender, replaceRender);

fs.writeFileSync('src/App.tsx', content);
