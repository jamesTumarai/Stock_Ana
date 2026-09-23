import type { PeerCompanyItem } from '../types';
import type { BusinessArchetype } from '../domain/financialMetricContext';

export interface PeerCompletionResult {
  ticker: string;
  peers: PeerCompanyItem[];
  enrichedCandidates?: any[];
  gaps?: any[];
  count: number;
  asOf: string;
}

/**
 * Client service to fetch verified peer completion facts from the server-side pipeline.
 * Dispatches to /api/peer-completion which enriches peer candidates with SEC EDGAR company facts
 * and derives accounting-compatible fundamentals (revenue growth, margins, canonical ROIC).
 */
export async function fetchPeerCompletion(
  ticker: string,
  peers?: PeerCompanyItem[] | string[],
  archetype?: BusinessArchetype,
  signal?: AbortSignal
): Promise<PeerCompletionResult | null> {
  const sym = (ticker || '').toUpperCase().trim();
  if (!sym) return null;

  try {
    const res = await fetch('/api/peer-completion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticker: sym,
        peers: peers || [],
        archetype,
      }),
      signal: signal || AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.warn(`[/api/peer-completion] Request failed with HTTP ${res.status}`);
      return null;
    }

    const data: PeerCompletionResult = await res.json();
    return data;
  } catch (err: any) {
    if (err?.name !== 'AbortError') {
      console.warn('[/api/peer-completion] Request failed:', err);
    }
    return null;
  }
}
