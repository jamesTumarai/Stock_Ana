const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `  const handleCloseReport = () => {
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
  };`;
                 
const replacement = `  const handleCloseReport = () => {
    const reportContainer = document.getElementById('report-scroll-container');
    if (reportContainer && reportContainer.scrollTop > 0) {
      reportContainer.scrollTo({ top: 0, behavior: 'smooth' });
      
      const checkScroll = setInterval(() => {
        if (reportContainer.scrollTop <= 5) {
          clearInterval(checkScroll);
          setIsReportOpen(false);
          setTimeout(() => window.scrollTo(0, 0), 10);
        }
      }, 50);

      // Fallback timeout in case the scroll takes too long or gets stuck
      setTimeout(() => {
        clearInterval(checkScroll);
        setIsReportOpen(false);
        setTimeout(() => window.scrollTo(0, 0), 10);
      }, 1500);
      
    } else {
      setIsReportOpen(false);
      setTimeout(() => window.scrollTo(0, 0), 10);
    }
  };`;

content = content.replace(target, replacement);
fs.writeFileSync('src/App.tsx', content);
