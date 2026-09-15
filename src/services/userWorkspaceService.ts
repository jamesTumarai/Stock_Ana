import { doc, onSnapshot, serverTimestamp, setDoc, Unsubscribe } from 'firebase/firestore';
import {
  MonitoringPreferences,
  MultiPortfolioConfig,
  PortfolioHolding
} from '../types';
import { db, firebaseDataAccessAllowed } from '../lib/firebase';
import { sanitizeUndefinedForPersistence } from '../utils/firestorePersistence';

/**
 * User-created portfolio and monitoring data is stored in the signed-in user's
 * Firestore document. Local storage stays as an offline cache and migration
 * source; it is never the cross-device source of truth for authenticated users.
 */
export interface PortfolioWorkspaceState {
  holdings: PortfolioHolding[];
  watchlist: string[];
  multiPortfolioConfig: MultiPortfolioConfig;
}

export interface MonitoringWorkspaceState {
  preferences: MonitoringPreferences;
  readAlertIds: string[];
  lastSeenFilings: Record<string, string>;
}

export interface UserWorkspaceState {
  portfolio?: PortfolioWorkspaceState;
  monitoring?: MonitoringWorkspaceState;
}

const EMPTY_MULTI_PORTFOLIO_CONFIG: MultiPortfolioConfig = {
  version: 2,
  portfolios: [],
  ticker_limits: []
};

const normalizeTicker = (value: unknown): string => (
  typeof value === 'string' ? value.toUpperCase().trim() : ''
);

function parsePortfolioWorkspace(value: unknown): PortfolioWorkspaceState | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Partial<PortfolioWorkspaceState>;
  if (!Array.isArray(raw.holdings) || !Array.isArray(raw.watchlist) || !raw.multiPortfolioConfig || typeof raw.multiPortfolioConfig !== 'object') {
    return undefined;
  }

  const holdings = raw.holdings
    .filter((holding): holding is PortfolioHolding => Boolean(
      holding
      && typeof holding === 'object'
      && normalizeTicker((holding as PortfolioHolding).ticker)
      && Number.isFinite((holding as PortfolioHolding).quantity)
      && Number.isFinite((holding as PortfolioHolding).average_cost)
    ))
    .map(holding => ({
      ...holding,
      ticker: normalizeTicker(holding.ticker),
      portfolio_id: holding.portfolio_id || null
    }));

  const watchlist = Array.from(new Set(raw.watchlist.map(normalizeTicker).filter(Boolean)));
  const config = raw.multiPortfolioConfig as MultiPortfolioConfig;

  return {
    holdings,
    watchlist,
    multiPortfolioConfig: {
      version: 2,
      portfolios: Array.isArray(config.portfolios) ? config.portfolios : [],
      ticker_limits: Array.isArray(config.ticker_limits) ? config.ticker_limits : []
    }
  };
}

function parseMonitoringWorkspace(value: unknown): MonitoringWorkspaceState | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Partial<MonitoringWorkspaceState>;
  if (!raw.preferences || typeof raw.preferences !== 'object' || !Array.isArray(raw.readAlertIds)) return undefined;

  const lastSeenFilings = Object.entries(raw.lastSeenFilings || {}).reduce<Record<string, string>>((result, [ticker, accession]) => {
    const cleanTicker = normalizeTicker(ticker);
    if (cleanTicker && typeof accession === 'string' && accession.trim()) result[cleanTicker] = accession.trim();
    return result;
  }, {});

  return {
    preferences: raw.preferences as MonitoringPreferences,
    readAlertIds: Array.from(new Set(raw.readAlertIds.filter((id): id is string => typeof id === 'string' && Boolean(id)))),
    lastSeenFilings
  };
}

export function parseUserWorkspace(value: unknown): UserWorkspaceState {
  if (!value || typeof value !== 'object') return {};
  const raw = value as Record<string, unknown>;
  return {
    portfolio: parsePortfolioWorkspace(raw.portfolioWorkspace),
    monitoring: parseMonitoringWorkspace(raw.monitoringWorkspace)
  };
}

export function hasPortfolioWorkspaceData(state: PortfolioWorkspaceState): boolean {
  return state.holdings.length > 0
    || state.watchlist.length > 0
    || state.multiPortfolioConfig.portfolios.length > 0
    || state.multiPortfolioConfig.ticker_limits.length > 0;
}

export function hasMonitoringWorkspaceData(state: MonitoringWorkspaceState, defaultPreferences: MonitoringPreferences): boolean {
  return state.readAlertIds.length > 0
    || Object.keys(state.lastSeenFilings).length > 0
    || JSON.stringify(state.preferences) !== JSON.stringify(defaultPreferences);
}

export async function savePortfolioWorkspace(userId: string, workspace: PortfolioWorkspaceState): Promise<void> {
  if (!userId || !firebaseDataAccessAllowed) return;
  await setDoc(doc(db, 'users', userId), sanitizeUndefinedForPersistence({
    portfolioWorkspace: workspace,
    portfolioWorkspaceUpdatedAt: serverTimestamp()
  }), { merge: true });
}

export async function saveMonitoringWorkspace(userId: string, workspace: MonitoringWorkspaceState): Promise<void> {
  if (!userId || !firebaseDataAccessAllowed) return;
  await setDoc(doc(db, 'users', userId), sanitizeUndefinedForPersistence({
    monitoringWorkspace: workspace,
    monitoringWorkspaceUpdatedAt: serverTimestamp()
  }), { merge: true });
}

export function subscribeToUserWorkspace(
  userId: string,
  onWorkspace: (workspace: UserWorkspaceState) => void,
  onError?: (error: Error) => void
): Unsubscribe | null {
  if (!userId || !firebaseDataAccessAllowed) return null;
  return onSnapshot(
    doc(db, 'users', userId),
    snapshot => onWorkspace(parseUserWorkspace(snapshot.data())),
    error => onError?.(error)
  );
}

export { EMPTY_MULTI_PORTFOLIO_CONFIG };
