const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetFetch = `  const fetchHistory = async (userId: string) => {
    try {
      const q = query(
        collection(db, "reports"), 
        where("userId", "==", userId)
      );
      const querySnapshot = await getDocs(q);
      let reports = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort client-side to avoid requiring composite index
      reports.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt || 0);
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt || 0);
        return timeB - timeA;
      });
      setHistoryReports(reports);
    } catch (error) {
      console.error("Error fetching history: ", error);
    }
  };`;

const replaceFetch = `  const fetchHistory = async (userId: string) => {
    try {
      console.log("Fetching history for user: ", userId);
      const q = query(
        collection(db, "reports"), 
        where("userId", "==", userId)
      );
      const querySnapshot = await getDocs(q);
      let reports = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort client-side to avoid requiring composite index
      reports.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt?.toMillis?.() || new Date(a.createdAt).getTime() || 0);
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt?.toMillis?.() || new Date(b.createdAt).getTime() || 0);
        return timeB - timeA;
      });
      console.log("Fetched history count: ", reports.length);
      setHistoryReports(reports);
    } catch (error: any) {
      console.error("Error fetching history: ", error);
      alert("Failed to fetch history: " + error.message);
    }
  };`;

content = content.replace(targetFetch, replaceFetch);
fs.writeFileSync('src/App.tsx', content);
