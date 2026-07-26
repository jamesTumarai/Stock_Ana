const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetImport = `import { LandingView } from './LandingView';`;
const replaceImport = `import { LandingView } from './LandingView';
import { auth, db, googleProvider } from './lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, getDocs, query, where, orderBy } from 'firebase/firestore';`;

content = content.replace(targetImport, replaceImport);

const targetState = `  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);`;
const replaceState = `  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  
  const [user, setUser] = useState<User | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyReports, setHistoryReports] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchHistory(currentUser.uid);
      } else {
        setHistoryReports([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const fetchHistory = async (userId: string) => {
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
  };

  const saveReportToFirebase = async (reportData: ReportData) => {
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
  };
`;
content = content.replace(targetState, replaceState);

fs.writeFileSync('src/App.tsx', content);
