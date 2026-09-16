import { MaterialCompanyEvent } from '../types';

export interface MaterialNewsState {
  events: MaterialCompanyEvent[];
  status: 'idle' | 'loading' | 'success' | 'partial' | 'error';
  lastCheckedAt: number | null;
  lastCheckedStr: string | null;
  errorMessage: string | null;
  failedSymbols: string[];
}

const CLIENT_NEWS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL

interface ClientCacheEntry {
  events: MaterialCompanyEvent[];
  timestamp: number;
}

const clientMemoryCache = new Map<string, ClientCacheEntry>();

export function getClientCachedEvents(ticker: string, nowMs = Date.now()): MaterialCompanyEvent[] | null {
  const norm = ticker.toUpperCase().trim();
  const entry = clientMemoryCache.get(norm);
  if (entry && nowMs - entry.timestamp < CLIENT_NEWS_CACHE_TTL_MS) {
    return entry.events;
  }
  return null;
}

export function setClientCachedEvents(ticker: string, events: MaterialCompanyEvent[], nowMs = Date.now()): void {
  const norm = ticker.toUpperCase().trim();
  clientMemoryCache.set(norm, {
    events,
    timestamp: nowMs,
  });
}

export function clearClientNewsCache(): void {
  clientMemoryCache.clear();
}

export async function fetchMaterialEvents(
  symbols: string[],
  options: {
    forceRefresh?: boolean;
    nowMs?: number;
  } = {}
): Promise<{
  events: MaterialCompanyEvent[];
  status: 'success' | 'partial' | 'error';
  errorMessage?: string;
  checkedAt: string;
  successfulSymbols: string[];
  failedSymbols: string[];
}> {
  const nowMs = options.nowMs || Date.now();
  const cleanSymbols = Array.from(new Set(symbols.map(s => s.toUpperCase().trim()).filter(Boolean))).slice(0, 25);

  if (cleanSymbols.length === 0) {
    return {
      events: [],
      status: 'success',
      checkedAt: new Date(nowMs).toISOString(),
      successfulSymbols: [],
      failedSymbols: [],
    };
  }

  // Check client cache if not forced
  if (!options.forceRefresh) {
    const cachedEvents: MaterialCompanyEvent[] = [];
    let allCached = true;
    for (const sym of cleanSymbols) {
      const cached = getClientCachedEvents(sym, nowMs);
      if (cached) {
        cachedEvents.push(...cached);
      } else {
        allCached = false;
        break;
      }
    }
    if (allCached) {
      return {
        events: cachedEvents,
        status: 'success',
        checkedAt: new Date(nowMs).toISOString(),
        successfulSymbols: cleanSymbols,
        failedSymbols: [],
      };
    }
  }

  try {
    const res = await fetch('/api/material-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbols: cleanSymbols,
        refresh: options.forceRefresh || false,
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      return {
        events: [],
        status: 'error',
        errorMessage: errorJson?.error || `HTTP ${res.status}`,
        checkedAt: new Date(nowMs).toISOString(),
        successfulSymbols: [],
        failedSymbols: cleanSymbols,
      };
    }

    const data: any = await res.json();
    const events: MaterialCompanyEvent[] = Array.isArray(data?.events) ? data.events : [];
    const successfulSymbols: string[] = Array.isArray(data?.successfulSymbols) ? data.successfulSymbols : [];
    const failedSymbols: string[] = Array.isArray(data?.failedSymbols) ? data.failedSymbols : [];

    // Update client cache per symbol
    for (const sym of successfulSymbols) {
      const symEvents = events.filter(e => e.ticker.toUpperCase() === sym.toUpperCase());
      setClientCachedEvents(sym, symEvents, nowMs);
    }

    const hasErrors = failedSymbols.length > 0;
    const isTotalFailure = failedSymbols.length === cleanSymbols.length && cleanSymbols.length > 0;

    return {
      events,
      status: isTotalFailure ? 'error' : hasErrors ? 'partial' : 'success',
      checkedAt: data?.checkedAt || new Date(nowMs).toISOString(),
      successfulSymbols,
      failedSymbols,
    };
  } catch (err: any) {
    console.warn('[materialNewsService] Fetch failed:', err);
    return {
      events: [],
      status: 'error',
      errorMessage: err?.message || 'Network error fetching material events',
      checkedAt: new Date(nowMs).toISOString(),
      successfulSymbols: [],
      failedSymbols: cleanSymbols,
    };
  }
}
