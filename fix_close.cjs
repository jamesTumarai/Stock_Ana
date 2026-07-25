const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `  const allReports = [...pastReports, ...(currentReport ? [currentReport] : [])];

  if (isReportOpen && allReports.length > 0) {
    return (
      <div className="w-full h-screen overflow-y-auto bg-[#F6F4F0] text-stone-900 font-sans print:h-auto print:overflow-visible print:block">
        <div className="w-full border-b border-stone-200 px-4 md:px-[40px] py-4 flex flex-col sm:flex-row items-center justify-between sticky top-0 z-50 bg-[#F6F4F0] print:static print:bg-white shadow-sm gap-4 sm:gap-0">`;

const replacement = `  const handleCloseReport = () => {
    const reportContainer = document.getElementById('report-scroll-container');
    if (reportContainer && reportContainer.scrollTop > 0) {
      reportContainer.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => {
        setIsReportOpen(false);
        setTimeout(() => window.scrollTo(0, 0), 10);
      }, 500);
    } else {
      setIsReportOpen(false);
      setTimeout(() => window.scrollTo(0, 0), 10);
    }
  };

  const allReports = [...pastReports, ...(currentReport ? [currentReport] : [])];

  if (isReportOpen && allReports.length > 0) {
    return (
      <div id="report-scroll-container" className="w-full h-screen overflow-y-auto bg-[#F6F4F0] text-stone-900 font-sans print:h-auto print:overflow-visible print:block">
        <div className="w-full border-b border-stone-200 px-4 md:px-[40px] py-4 flex flex-col sm:flex-row items-center justify-between sticky top-0 z-50 bg-[#F6F4F0] print:static print:bg-white shadow-sm gap-4 sm:gap-0">`;

content = content.replace(target, replacement);

const targetBtn1 = `            <button 
              onClick={() => {
                setIsReportOpen(false);
                window.scrollTo(0, 0);
              }}`;

const replacementBtn1 = `            <button 
              onClick={handleCloseReport}`;

content = content.replace(targetBtn1, replacementBtn1);

const targetBtn2 = `               onClose={() => {
                 setIsReportOpen(false);
                 window.scrollTo(0, 0);
               }}`;

const replacementBtn2 = `               onClose={handleCloseReport}`;

content = content.replace(targetBtn2, replacementBtn2);

fs.writeFileSync('src/App.tsx', content);
