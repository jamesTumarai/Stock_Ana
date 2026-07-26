import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCOoXe_HxUrdUgMMchwRtgBPb-Jvi91UR4",
  authDomain: "stock-analyze-a89d0.firebaseapp.com",
  projectId: "stock-analyze-a89d0",
  storageBucket: "stock-analyze-a89d0.firebasestorage.app",
  messagingSenderId: "251448969613",
  appId: "1:251448969613:web:7678d9ec4649558f8195c4",
  measurementId: "G-GSVXQJRSWN"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
