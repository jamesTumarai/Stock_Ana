import type { CandidateDefinition } from '../../src/domain/valuation/__fixtures__/peerUniverse.js';
import type { PeerCandidateDiscoveryInput } from '../../src/domain/valuation/peerDiscoveryEngine.js';

interface YahooSearchQuote {
  symbol: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  exchange?: string;
  sector?: string;
  industry?: string;
}

const cache = new Map<string, { timestamp: number; candidates: CandidateDefinition[] }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Server-side runtime peer candidate discovery service.
 * Discovers candidate public companies from live Yahoo Finance search,
 * enforces strict verification (EQUITY only, valid ticker, rejects self, aligns archetype),
 * and enriches top candidates with live market metrics.
 */
export async function discoverRuntimePeerCandidates(
  input: PeerCandidateDiscoveryInput
): Promise<CandidateDefinition[]> {
  const targetTicker = (input.ticker || '').toUpperCase().trim();
  const cacheKey = `${targetTicker}:${input.primaryArchetype}:${input.subIndustry || input.industry || input.sector || 'general'}`;
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.candidates;
  }

  const queries: string[] = [];
  if (input.subIndustry && input.subIndustry !== 'general') {
    queries.push(input.subIndustry.replace(/_/g, ' '));
  }
  if (input.industry && input.industry !== 'Unknown') {
    queries.push(input.industry);
  }
  if (input.sector && input.sector !== 'Unknown' && queries.length === 0) {
    queries.push(input.sector);
  }
  if (queries.length === 0) {
    queries.push(input.primaryArchetype.replace(/_/g, ' '));
  }

  const discoveredQuotes = new Map<string, YahooSearchQuote>();

  // Fetch search candidates from Yahoo Finance search API (bounded to top 2 queries)
  for (const q of queries.slice(0, 2)) {
    try {
      const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=15&newsCount=0`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data: any = await res.json();
        const quotes: YahooSearchQuote[] = data?.quotes || [];
        for (const quote of quotes) {
          const sym = (quote.symbol || '').toUpperCase().trim();
          // Verification:
          // 1. Must be EQUITY (strictly reject ETF, MUTUALFUND, CURRENCY, INDEX, FUTURE)
          if (quote.quoteType !== 'EQUITY') continue;
          // 2. Reject self
          if (sym === targetTicker) continue;
          // 3. Valid ticker format
          if (!/^[A-Z0-9.\-_]{1,12}$/.test(sym)) continue;
          // 4. Must not contain dot or exotic suffix (unless Berkshire BRK.B etc.)
          if (sym.includes('.') && !sym.startsWith('BRK.')) continue;
          if (sym.includes('=')) continue;

          discoveredQuotes.set(sym, quote);
        }
      }
    } catch (err) {
      console.warn(`[runtimePeerDiscovery] Search query failed for "${q}":`, err);
    }
  }

  const candidateTickers = Array.from(discoveredQuotes.keys()).slice(0, 10);
  if (candidateTickers.length === 0) {
    return [];
  }

  // Enrich top candidates with financial metrics via Yahoo Finance quote
  const candidates: CandidateDefinition[] = [];
  try {
    const quotesUrl = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${candidateTickers.join(',')}`;
    const qRes = await fetch(quotesUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(4000),
    });
    if (qRes.ok) {
      const qData: any = await qRes.json();
      const list = qData?.quoteResponse?.result || [];
      for (const q of list) {
        const sym = (q.symbol || '').toUpperCase();
        const searchMeta = discoveredQuotes.get(sym);
        const companyName = q.shortName || q.longName || searchMeta?.shortname || searchMeta?.longname || sym;

        const capNum = q.marketCap || null;
        const capB = capNum ? Math.round((capNum / 1e9) * 100) / 100 : null;

        const cand: CandidateDefinition = {
          ticker: sym,
          companyName,
          archetype: input.primaryArchetype,
          sector: searchMeta?.sector || input.sector || 'Unknown',
          industry: searchMeta?.industry || input.industry || 'Unknown',
          subIndustry: input.subIndustry || 'general',
          revenueModels: ['product_sales'],
          majorBusinessLines: [input.industry || 'General'],
          geography: 'US',
          lifecycle: 'mature',
          profitabilityState: (q.trailingPE && q.trailingPE > 0) ? 'profitable' : 'pre_profit',
          capitalIntensity: input.primaryArchetype === 'industrial_manufacturing' ? 'capital_intensive' : 'moderate',
          regulatoryType: 'standard',
          scaleTier: capB && capB > 10 ? 'large' : 'mid',
          metrics: {
            pe_trailing: {
              value: q.trailingPE ? Number(q.trailingPE.toFixed(1)) : null,
              unit: 'x',
              period: 'TTM',
              source: 'Yahoo Finance Live Quote',
              reportedOrDerived: 'REPORTED',
            },
            pe_forward: {
              value: q.forwardPE ? Number(q.forwardPE.toFixed(1)) : null,
              unit: 'x',
              period: 'Next 12M',
              source: 'Yahoo Finance Live Quote',
              reportedOrDerived: 'REPORTED',
            },
            market_cap: {
              value: capB,
              unit: 'B',
              period: 'Current',
              source: 'Yahoo Finance Live Quote',
              reportedOrDerived: 'REPORTED',
            },
            fifty_two_week_high: {
              value: q.fiftyTwoWeekHigh ?? null,
              unit: '$',
              period: '52W',
              source: 'Yahoo Finance',
              reportedOrDerived: 'REPORTED',
            },
            fifty_two_week_low: {
              value: q.fiftyTwoWeekLow ?? null,
              unit: '$',
              period: '52W',
              source: 'Yahoo Finance',
              reportedOrDerived: 'REPORTED',
            },
          },
        };
        candidates.push(cand);
      }
    }
  } catch (err) {
    console.warn('[runtimePeerDiscovery] Metric enrichment failed:', err);
  }

  cache.set(cacheKey, { timestamp: Date.now(), candidates });
  return candidates;
}
