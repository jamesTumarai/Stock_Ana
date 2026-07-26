const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetDelete = `  const deleteReport = async (reportId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "reports", reportId));
      console.log("Report deleted successfully!");
      setHistoryReports(prev => prev.filter(r => r.id !== reportId));
    } catch (error: any) {
      console.error("Error deleting report: ", error);
      alert("Failed to delete report: " + error.message);
    }
  };`;

const replaceDelete = `  const deleteReports = async (reportIds: string | string[]) => {
    if (!user) return;
    const ids = Array.isArray(reportIds) ? reportIds : [reportIds];
    try {
      for (const id of ids) {
        await deleteDoc(doc(db, "reports", id));
      }
      console.log("Reports deleted successfully!");
      setHistoryReports(prev => prev.filter(r => !ids.includes(r.id)));
    } catch (error: any) {
      console.error("Error deleting reports: ", error);
      alert("Failed to delete reports: " + error.message);
    }
  };`;

content = content.replace(targetDelete, replaceDelete);
content = content.replace('onDelete={deleteReport}', 'onDelete={deleteReports}');

fs.writeFileSync('src/App.tsx', content);
