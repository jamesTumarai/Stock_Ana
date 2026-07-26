const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetFetch = `  const fetchHistory = async (userId: string) => {
    try {
      const q = query(
        collection(db, "reports"), 
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const reports = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistoryReports(reports);
    } catch (error) {
      console.error("Error fetching history: ", error);
    }
  };`;

const replaceFetch = `  const fetchHistory = async (userId: string) => {
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

content = content.replace(targetFetch, replaceFetch);
fs.writeFileSync('src/App.tsx', content);
