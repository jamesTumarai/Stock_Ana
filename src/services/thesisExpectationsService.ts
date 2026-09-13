import { User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db, firebaseDataAccessAllowed } from '../lib/firebase';
import {
  InvestmentThesisRecord,
  TrackedExpectation
} from '../domain/thesisExpectations';
import { sanitizeUndefinedForPersistence } from '../utils/firestorePersistence';

const LOCAL_THESIS_PREFIX = 'lumina_user_thesis_';
const LOCAL_EXPECTATIONS_PREFIX = 'lumina_user_expectations_';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getStorage(): StorageLike | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).window?.localStorage) {
    return (globalThis as any).window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
    return (globalThis as any).localStorage;
  }
  return null;
}

function getLocalKey(prefix: string, ticker: string): string {
  return `${prefix}${ticker.toUpperCase().trim()}`;
}

export async function saveUserThesis(
  thesis: InvestmentThesisRecord,
  user?: User | null
): Promise<void> {
  const cleanTicker = thesis.ticker.toUpperCase().trim();
  const cleanThesis = {
    ...thesis,
    ticker: cleanTicker,
    userId: user?.uid || thesis.userId || undefined
  };

  // 1. Save to local storage for instant offline availability & fallback
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(getLocalKey(LOCAL_THESIS_PREFIX, cleanTicker), JSON.stringify(cleanThesis));
    } catch (e) {
      console.warn('Failed to save thesis to localStorage', e);
    }
  }

  // 2. Persist to owner-scoped Firestore if authenticated and network allowed
  if (user?.uid && firebaseDataAccessAllowed) {
    try {
      const sanitized = sanitizeUndefinedForPersistence(cleanThesis);
      const thesisDocRef = doc(db, 'users', user.uid, 'theses', cleanTicker);
      await setDoc(thesisDocRef, sanitized, { merge: true });
    } catch (error) {
      console.error('Error persisting thesis to Firestore:', error);
    }
  }
}

export async function loadUserThesis(
  ticker: string,
  user?: User | null
): Promise<InvestmentThesisRecord | null> {
  const cleanTicker = ticker.toUpperCase().trim();

  // 1. If authenticated and allowed, attempt Firestore load
  if (user?.uid && firebaseDataAccessAllowed) {
    try {
      const thesisDocRef = doc(db, 'users', user.uid, 'theses', cleanTicker);
      const snap = await getDoc(thesisDocRef);
      if (snap.exists()) {
        const data = snap.data() as InvestmentThesisRecord;
        // Update local cache
        const storage = getStorage();
        if (storage) {
          try {
            storage.setItem(getLocalKey(LOCAL_THESIS_PREFIX, cleanTicker), JSON.stringify(data));
          } catch (e) {}
        }
        return data;
      }
    } catch (error) {
      console.warn('Error loading thesis from Firestore, falling back to local storage:', error);
    }
  }

  // 2. Fallback to localStorage
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(getLocalKey(LOCAL_THESIS_PREFIX, cleanTicker));
      if (raw) {
        return JSON.parse(raw) as InvestmentThesisRecord;
      }
    } catch (e) {
      console.warn('Failed to read thesis from localStorage', e);
    }
  }

  return null;
}

export async function saveExpectations(
  ticker: string,
  expectations: TrackedExpectation[],
  user?: User | null
): Promise<void> {
  const cleanTicker = ticker.toUpperCase().trim();

  // 1. LocalStorage cache
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(getLocalKey(LOCAL_EXPECTATIONS_PREFIX, cleanTicker), JSON.stringify(expectations));
    } catch (e) {
      console.warn('Failed to save expectations to localStorage', e);
    }
  }

  // 2. Firestore owner-scoped subcollection
  if (user?.uid && firebaseDataAccessAllowed) {
    try {
      for (const exp of expectations) {
        const sanitized = sanitizeUndefinedForPersistence({
          ...exp,
          ticker: cleanTicker,
          userId: user.uid
        });
        const expDocRef = doc(db, 'users', user.uid, 'expectations', exp.expectationId);
        await setDoc(expDocRef, sanitized, { merge: true });
      }
    } catch (error) {
      console.error('Error persisting expectations to Firestore:', error);
    }
  }
}

export async function loadExpectations(
  ticker: string,
  user?: User | null
): Promise<TrackedExpectation[]> {
  const cleanTicker = ticker.toUpperCase().trim();

  // 1. Firestore owner-scoped query
  if (user?.uid && firebaseDataAccessAllowed) {
    try {
      const q = query(
        collection(db, 'users', user.uid, 'expectations'),
        where('ticker', '==', cleanTicker)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const list: TrackedExpectation[] = [];
        snap.forEach(d => list.push(d.data() as TrackedExpectation));
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // Update local cache
        const storage = getStorage();
        if (storage) {
          try {
            storage.setItem(getLocalKey(LOCAL_EXPECTATIONS_PREFIX, cleanTicker), JSON.stringify(list));
          } catch (e) {}
        }
        return list;
      }
    } catch (error) {
      console.warn('Error loading expectations from Firestore, falling back to local storage:', error);
    }
  }

  // 2. LocalStorage fallback
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(getLocalKey(LOCAL_EXPECTATIONS_PREFIX, cleanTicker));
      if (raw) {
        return JSON.parse(raw) as TrackedExpectation[];
      }
    } catch (e) {
      console.warn('Failed to read expectations from localStorage', e);
    }
  }

  return [];
}
