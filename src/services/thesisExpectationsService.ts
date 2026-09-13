import { User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db, firebaseDataAccessAllowed } from '../lib/firebase';
import {
  InvestmentThesisRecord,
  TrackedExpectation
} from '../domain/thesisExpectations';
import { sanitizeUndefinedForPersistence } from '../utils/firestorePersistence';

const LEGACY_THESIS_PREFIX = 'lumina_user_thesis_';
const LEGACY_EXPECTATIONS_PREFIX = 'lumina_user_expectations_';

export function getLocalKey(feature: 'thesis' | 'expectations', ticker: string, userId?: string | null): string {
  const cleanTicker = ticker.toUpperCase().trim();
  if (userId) {
    return `lumina_${feature}:user:${userId}:${cleanTicker}`;
  }
  return `lumina_${feature}:anonymous:${cleanTicker}`;
}

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

export async function saveUserThesis(
  thesis: InvestmentThesisRecord,
  user?: User | null
): Promise<void> {
  const cleanTicker = thesis.ticker.toUpperCase().trim();
  const userId = user?.uid || thesis.userId || undefined;
  const cleanThesis = {
    ...thesis,
    ticker: cleanTicker,
    userId
  };

  // 1. Save to local storage isolated by user UID or anonymous
  const storage = getStorage();
  if (storage) {
    try {
      const key = getLocalKey('thesis', cleanTicker, userId);
      storage.setItem(key, JSON.stringify(cleanThesis));
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
  const userId = user?.uid || null;

  // 1. If authenticated and allowed, attempt Firestore load
  if (userId && firebaseDataAccessAllowed) {
    try {
      const thesisDocRef = doc(db, 'users', userId, 'theses', cleanTicker);
      const snap = await getDoc(thesisDocRef);
      if (snap.exists()) {
        const data = snap.data() as InvestmentThesisRecord;
        // Verify owner ID
        if (!data.userId || data.userId === userId) {
          const verifiedData = { ...data, userId };
          // Update user-scoped local cache
          const storage = getStorage();
          if (storage) {
            try {
              storage.setItem(getLocalKey('thesis', cleanTicker, userId), JSON.stringify(verifiedData));
            } catch (e) {}
          }
          return verifiedData;
        }
      }
    } catch (error) {
      console.warn('Error loading thesis from Firestore, falling back to user-scoped local storage:', error);
    }
  }

  // 2. Fallback to localStorage: strictly isolated by UID if authenticated
  const storage = getStorage();
  if (storage) {
    try {
      if (userId) {
        // Authenticated: ONLY read from user-scoped key
        const raw = storage.getItem(getLocalKey('thesis', cleanTicker, userId));
        if (raw) {
          const parsed = JSON.parse(raw) as InvestmentThesisRecord;
          if (parsed && (!parsed.userId || parsed.userId === userId)) {
            return { ...parsed, userId };
          }
        }
        // Never fall back to anonymous or another user's cache for authenticated users!
        return null;
      } else {
        // Anonymous user: read from anonymous key
        const raw = storage.getItem(getLocalKey('thesis', cleanTicker, null));
        if (raw) {
          return JSON.parse(raw) as InvestmentThesisRecord;
        }
        // Conservative legacy migration: only allow legacy cache if it has NO userId
        const legacyRaw = storage.getItem(`${LEGACY_THESIS_PREFIX}${cleanTicker}`);
        if (legacyRaw) {
          const parsed = JSON.parse(legacyRaw) as InvestmentThesisRecord;
          if (!parsed.userId) {
            return parsed;
          }
        }
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
  const userId = user?.uid || null;

  // 1. LocalStorage cache strictly scoped
  const storage = getStorage();
  if (storage) {
    try {
      const key = getLocalKey('expectations', cleanTicker, userId);
      storage.setItem(key, JSON.stringify(expectations));
    } catch (e) {
      console.warn('Failed to save expectations to localStorage', e);
    }
  }

  // 2. Firestore owner-scoped subcollection
  if (userId && firebaseDataAccessAllowed) {
    try {
      for (const exp of expectations) {
        const sanitized = sanitizeUndefinedForPersistence({
          ...exp,
          ticker: cleanTicker,
          userId
        });
        const expDocRef = doc(db, 'users', userId, 'expectations', exp.expectationId);
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
  const userId = user?.uid || null;

  // 1. Firestore owner-scoped query
  if (userId && firebaseDataAccessAllowed) {
    try {
      const q = query(
        collection(db, 'users', userId, 'expectations'),
        where('ticker', '==', cleanTicker)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const list: TrackedExpectation[] = [];
        snap.forEach(d => {
          const data = d.data() as TrackedExpectation;
          if (!data.userId || data.userId === userId) {
            list.push({ ...data, userId });
          }
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // Update user-scoped local cache
        const storage = getStorage();
        if (storage) {
          try {
            storage.setItem(getLocalKey('expectations', cleanTicker, userId), JSON.stringify(list));
          } catch (e) {}
        }
        return list;
      }
    } catch (error) {
      console.warn('Error loading expectations from Firestore, falling back to user-scoped local storage:', error);
    }
  }

  // 2. LocalStorage fallback
  const storage = getStorage();
  if (storage) {
    try {
      if (userId) {
        // Authenticated: ONLY read from user-scoped key
        const raw = storage.getItem(getLocalKey('expectations', cleanTicker, userId));
        if (raw) {
          const list = JSON.parse(raw) as TrackedExpectation[];
          if (Array.isArray(list)) {
            return list.filter(item => !item.userId || item.userId === userId);
          }
        }
        // Never fall back to anonymous or another user's cache
        return [];
      } else {
        // Anonymous user: read from anonymous key
        const raw = storage.getItem(getLocalKey('expectations', cleanTicker, null));
        if (raw) {
          const list = JSON.parse(raw) as TrackedExpectation[];
          if (Array.isArray(list)) return list;
        }
        // Conservative legacy migration: only allow legacy cache if items have NO userId
        const legacyRaw = storage.getItem(`${LEGACY_EXPECTATIONS_PREFIX}${cleanTicker}`);
        if (legacyRaw) {
          const list = JSON.parse(legacyRaw) as TrackedExpectation[];
          if (Array.isArray(list) && list.every(item => !item.userId)) {
            return list;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to read expectations from localStorage', e);
    }
  }

  return [];
}
