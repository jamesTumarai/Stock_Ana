const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetSave = `  const saveReportToFirebase = async (reportData: ReportData) => {
    if (!user) return;
    try {
      await addDoc(collection(db, "reports"), {
        userId: user.uid,
        ticker,
        language: selectedLanguage,
        createdAt: new Date(),
        data: reportData
      });
      fetchHistory(user.uid);
    } catch (error) {
      console.error("Error saving report: ", error);
    }
  };`;

const replaceSave = `  const saveReportToFirebase = async (reportData: ReportData) => {
    if (!user) return;
    try {
      console.log("Saving report to Firebase...", { ticker, userId: user.uid });
      await addDoc(collection(db, "reports"), {
        userId: user.uid,
        ticker,
        language: selectedLanguage,
        createdAt: new Date(),
        data: reportData
      });
      console.log("Report saved successfully!");
      fetchHistory(user.uid);
    } catch (error) {
      console.error("Error saving report: ", error);
      alert("Failed to save report: " + error.message);
    }
  };`;

content = content.replace(targetSave, replaceSave);
fs.writeFileSync('src/App.tsx', content);
