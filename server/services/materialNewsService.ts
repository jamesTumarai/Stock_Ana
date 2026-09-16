import { GoogleGenAI } from '@google/genai';
import {
  MaterialCompanyEvent,
  MaterialEventCategory,
  MaterialEventMateriality,
  MaterialEventSourceAuthority,
  MaterialEventSourceType,
  MaterialEventSupportingSource
} from '../../src/types';
import { SecEdgarClient } from '../../src/services/sec/secClient';

export interface NewsFetchResult {
  events: MaterialCompanyEvent[];
  requestedSymbols: string[];
  successfulSymbols: string[];
  failedSymbols: string[];
  sourceStatus: {
    sec: 'OK' | 'PARTIAL' | 'ERROR' | 'UNAVAILABLE';
    news: 'OK' | 'PARTIAL' | 'ERROR' | 'UNAVAILABLE';
  };
  checkedAt: string;
  cacheStatus: 'HIT' | 'MISS' | 'PARTIAL';
}

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes canonical TTL
const LOOKBACK_HOURS = 72; // 72 hours bounded lookback

interface CacheEntry {
  events: MaterialCompanyEvent[];
  cachedAt: number;
}

const memoryCache = new Map<string, CacheEntry>();

/**
 * Normalizes ticker symbols.
 */
export function normalizeTicker(ticker: unknown): string {
  return typeof ticker === 'string' ? ticker.trim().toUpperCase() : '';
}

/**
 * Filter out low-value noise headlines (price movement recaps, stock picks, listicles, promotional content).
 */
export function isNoiseHeadline(headline: string): boolean {
  if (!headline || !headline.trim()) return true;
  const h = headline.trim().toLowerCase();

  const noisePatterns = [
    /\bwhy\s+.+\s+(stock\s+)?(moved|is\s+up|is\s+down|surged|fell|dropped|plunged|jumped|rallied|tumbled)\b/i,
    /\b(stocks?\s+to\s+buy|stocks?\s+to\s+sell|top\s+picks?|best\s+stocks?|picks?\s+for\s+investors)\b/i,
    /\bhere'?s\s+why\b/i,
    /\bis\s+.+\s+a\s+(buy|sell|good\s+investment)\b/i,
    /\b\d+\s+reasons\s+to\s+(buy|sell|hold)\b/i,
    /\b(options?\s+alert|bullish\s+or\s+bearish|bear\s+of\s+the\s+day|bull\s+of\s+the\s+day)\b/i,
    /\b(how\s+to\s+retire|millionaire-maker|retire\s+rich)\b/i,
    /\b(market\s+recap|stock\s+market\s+today|pre-market\s+movers)\b/i,
  ];

  return noisePatterns.some(pattern => pattern.test(h));
}

/**
 * Classifies publisher name into Source Authority and Source Type.
 */
export function classifyPublisher(publisher: string): {
  sourceAuthority: MaterialEventSourceAuthority;
  sourceType: MaterialEventSourceType;
  isApproved: boolean;
} {
  const p = (publisher || '').trim().toLowerCase();

  // Tier 2: Company Primary / Investor Relations Wire Services
  const irWires = ['pr newswire', 'business wire', 'globenewswire', 'accesswire', 'investor relations'];
  if (irWires.some(w => p.includes(w))) {
    return {
      sourceAuthority: 'COMPANY_PRIMARY_IR',
      sourceType: 'COMPANY_IR',
      isApproved: true,
    };
  }

  // Tier 4: Reputable Financial / Business Journalism
  const reputableMedia = [
    'reuters',
    'bloomberg',
    'associated press',
    'ap news',
    'the wall street journal',
    'wall street journal',
    'wsj',
    'financial times',
    'cnbc',
    'barron\'s',
    'barrons',
    'marketwatch'
  ];
  if (reputableMedia.some(m => p.includes(m))) {
    return {
      sourceAuthority: 'REPUTABLE_NEWS',
      sourceType: 'FINANCIAL_NEWS',
      isApproved: true,
    };
  }

  // Tier 3: Recognized Market / Exchange
  const marketProviders = ['yahoo finance', 'benzinga', 'investor\'s business daily', 'the fly', 'seeking alpha'];
  if (marketProviders.some(m => p.includes(m))) {
    return {
      sourceAuthority: 'RECOGNIZED_MARKET',
      sourceType: 'MARKET_EXCHANGE',
      isApproved: true,
    };
  }

  // Reject unvetted blogs and SEO article farms
  const rejected = ['motley fool', 'zacks', 'trefis', 'simply wall st', 'investorplace', 'tipranks', 'benzinga insights'];
  if (rejected.some(r => p.includes(r))) {
    return {
      sourceAuthority: 'REPUTABLE_NEWS',
      sourceType: 'FINANCIAL_NEWS',
      isApproved: false,
    };
  }

  // Default: unvetted source is not approved
  return {
    sourceAuthority: 'REPUTABLE_NEWS',
    sourceType: 'FINANCIAL_NEWS',
    isApproved: false,
  };
}

/**
 * Classifies SEC 8-K Items into Category and Materiality.
 */
export function classifySec8KItems(itemsStr: string | null): {
  category: MaterialEventCategory;
  materiality: MaterialEventMateriality;
  summary: string;
} {
  if (!itemsStr) {
    return {
      category: 'SEC_FILING',
      materiality: 'MEDIUM',
      summary: 'Form 8-K Current Report filed with the SEC.',
    };
  }

  const items = itemsStr.split(',').map(s => s.trim());

  if (items.includes('1.01') || items.includes('1.02')) {
    return {
      category: 'M_AND_A',
      materiality: 'HIGH',
      summary: 'Entry into or termination of a Material Definitive Agreement (M&A, major transaction, or partnership).',
    };
  }
  if (items.includes('1.03')) {
    return {
      category: 'OPERATIONS',
      materiality: 'HIGH',
      summary: 'Bankruptcy or receivership proceedings filed.',
    };
  }
  if (items.includes('2.02')) {
    return {
      category: 'EARNINGS',
      materiality: 'HIGH',
      summary: 'Results of Operations and Financial Condition (Earnings release or quarterly performance).',
    };
  }
  if (items.includes('2.05') || items.includes('2.06')) {
    return {
      category: 'OPERATIONS',
      materiality: 'HIGH',
      summary: 'Restructuring, disposal activities, or material asset impairment charge.',
    };
  }
  if (items.includes('3.02') || items.includes('3.03')) {
    return {
      category: 'CAPITAL_RAISE',
      materiality: 'HIGH',
      summary: 'Unregistered sales of equity securities or material modification to security holder rights.',
    };
  }
  if (items.includes('4.02')) {
    return {
      category: 'LEGAL_REGULATORY',
      materiality: 'HIGH',
      summary: 'Non-Reliance on Previously Issued Financial Statements or Related Audit Report.',
    };
  }
  if (items.includes('5.01')) {
    return {
      category: 'MANAGEMENT',
      materiality: 'HIGH',
      summary: 'Changes in Control of Registrant.',
    };
  }
  if (items.includes('5.02')) {
    return {
      category: 'MANAGEMENT',
      materiality: 'HIGH',
      summary: 'Departure of Directors or Certain Officers; Election of Directors; Appointment of Certain Officers.',
    };
  }
  if (items.includes('7.01')) {
    return {
      category: 'GUIDANCE',
      materiality: 'MEDIUM',
      summary: 'Regulation FD Disclosure (Investor presentation, guidance update, or conference remarks).',
    };
  }
  if (items.includes('8.01')) {
    return {
      category: 'OTHER',
      materiality: 'MEDIUM',
      summary: 'Other Events deemed of importance by the registrant.',
    };
  }

  return {
    category: 'SEC_FILING',
    materiality: 'MEDIUM',
    summary: `Form 8-K Current Report (Items: ${itemsStr}) filed with the SEC.`,
  };
}

/**
 * Evaluates headline text to assign Category and Materiality deterministically.
 */
export function evaluateTextMateriality(headline: string): {
  category: MaterialEventCategory;
  materiality: MaterialEventMateriality;
} {
  const h = headline.toLowerCase();

  // High materiality indicators
  if (/\b(guidance\s+(cut|lowered|slashed|raised|hiked)|(lowers?|cuts?|slashes?|raises?|hikes?)\s+(fy|q\d|full\s+year)?\s*(guidance|outlook)|pre-?announces?\s+earnings)\b/i.test(h)) {
    return { category: 'GUIDANCE', materiality: 'HIGH' };
  }
  if (/\b(ceo|cfo|chief\s+executive|chief\s+financial)\s+(steps\s+down|resigns|departs|ousted|appointed|named|retires)\b/i.test(h)) {
    return { category: 'MANAGEMENT', materiality: 'HIGH' };
  }
  if (/\b(to\s+acquire|acquires|acquisition\s+of|merger\s+with|takeover|buyout|deal\s+to\s+buy)\b/i.test(h)) {
    return { category: 'M_AND_A', materiality: 'HIGH' };
  }
  if (/\b(secondary\s+offering|public\s+offering|pricing\s+of\s+offering|convertible\s+notes|capital\s+raise|debt\s+restructuring)\b/i.test(h)) {
    return { category: 'CAPITAL_RAISE', materiality: 'HIGH' };
  }
  if (/\b(sec\s+charges|sec\s+investigation|doj\s+investigation|settles\s+lawsuit|court\s+rules|injunction|patent\s+infringement\s+verdict)\b/i.test(h)) {
    return { category: 'LEGAL_REGULATORY', materiality: 'HIGH' };
  }
  if (/\b(reports\s+q\d\s+results|q\d\s+earnings|beats\s+on\s+revenue|misses\s+on\s+revenue|reports\s+loss)\b/i.test(h)) {
    return { category: 'EARNINGS', materiality: 'HIGH' };
  }
  if (/\b(share\s+repurchase\s+program|buyback\s+authorization|suspends\s+dividend|dividend\s+cut|dividend\s+hike)\b/i.test(h)) {
    return { category: 'BUYBACK_DIVIDEND', materiality: 'HIGH' };
  }
  if (/\b(ransomware|cybersecurity\s+incident|data\s+breach)\b/i.test(h)) {
    return { category: 'CYBERSECURITY', materiality: 'HIGH' };
  }
  if (/\b(fda\s+approval|fda\s+rejects|fda\s+complete\s+response|product\s+recall)\b/i.test(h)) {
    return { category: 'PRODUCT', materiality: 'HIGH' };
  }
  if (/\b(awarded\s+\$\d+|wins\s+contract|multi-year\s+contract|defense\s+contract)\b/i.test(h)) {
    return { category: 'MAJOR_CONTRACT', materiality: 'HIGH' };
  }

  // Medium materiality indicators
  if (/\b(partners?\s+with|partnership|announces\s+collaboration|new\s+product|expands\s+into)\b/i.test(h)) {
    return { category: 'PRODUCT', materiality: 'MEDIUM' };
  }
  if (/\b(analyst\s+upgrades?|analyst\s+downgrades?|price\s+target\s+raised|price\s+target\s+cut)\b/i.test(h)) {
    return { category: 'ANALYST_RESEARCH', materiality: 'MEDIUM' };
  }
  if (/\b(conference|investor\s+day|presents\s+at)\b/i.test(h)) {
    return { category: 'OTHER', materiality: 'MEDIUM' };
  }

  return { category: 'OTHER', materiality: 'LOW' };
}

/**
 * Generates a clean, normalized fingerprint for deduplication.
 */
export function generateDedupeFingerprint(
  ticker: string,
  headline: string,
  publishedAt: string | null
): string {
  const normTicker = ticker.toUpperCase().trim();
  const normTitle = headline
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 8)
    .join('_');
  const dateKey = publishedAt ? publishedAt.split('T')[0] : 'nodate';
  return `${normTicker}_${normTitle}_${dateKey}`;
}

/**
 * Collapses duplicate and syndicated articles into a single logical MaterialCompanyEvent.
 */
export function deduplicateEvents(rawEvents: MaterialCompanyEvent[]): MaterialCompanyEvent[] {
  const map = new Map<string, MaterialCompanyEvent>();

  // Source hierarchy weights: SEC (4) > Company IR (3) > Recognized Market (2) > Financial News (1)
  const authorityRank: Record<MaterialEventSourceAuthority, number> = {
    AUTHORITATIVE_SEC: 4,
    COMPANY_PRIMARY_IR: 3,
    RECOGNIZED_MARKET: 2,
    REPUTABLE_NEWS: 1,
  };

  for (const event of rawEvents) {
    const key = event.dedupeFingerprint;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, { ...event, supportingSources: event.supportingSources || [] });
    } else {
      const existingRank = authorityRank[existing.sourceAuthority] || 0;
      const newRank = authorityRank[event.sourceAuthority] || 0;

      if (newRank > existingRank) {
        // New source is higher authority: make it primary and demote existing to supporting source
        const demotedSupporting: MaterialEventSupportingSource = {
          sourceName: existing.sourceName,
          sourceUrl: existing.sourceUrl,
          sourceType: existing.sourceType,
          publishedAt: existing.publishedAt,
        };
        const nextSupporting = [demotedSupporting, ...(existing.supportingSources || [])]
          .filter((s, idx, arr) => arr.findIndex(x => x.sourceName === s.sourceName || (x.sourceUrl && x.sourceUrl === s.sourceUrl)) === idx)
          .slice(0, 3);

        map.set(key, {
          ...event,
          supportingSources: nextSupporting,
        });
      } else {
        // Existing is higher or equal: add new source to supporting sources
        const supporting: MaterialEventSupportingSource = {
          sourceName: event.sourceName,
          sourceUrl: event.sourceUrl,
          sourceType: event.sourceType,
          publishedAt: event.publishedAt,
        };
        const nextSupporting = [...(existing.supportingSources || []), supporting]
          .filter((s, idx, arr) => arr.findIndex(x => x.sourceName === s.sourceName || (x.sourceUrl && x.sourceUrl === s.sourceUrl)) === idx)
          .slice(0, 3);

        map.set(key, {
          ...existing,
          supportingSources: nextSupporting,
        });
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Fetches recent SEC 8-K filings for a single ticker via SecEdgarClient.
 */
export async function fetchSecEventsForTicker(
  ticker: string,
  client?: SecEdgarClient,
  nowMs = Date.now()
): Promise<MaterialCompanyEvent[]> {
  const normTicker = normalizeTicker(ticker);
  if (!normTicker) return [];

  const secClient = client || new SecEdgarClient();
  const events: MaterialCompanyEvent[] = [];

  try {
    const identity = await secClient.resolveTicker(normTicker);
    if (!identity) return [];

    const submissions = await secClient.fetchSubmissions(identity.cik);
    const recent = submissions.filings?.recent;
    if (!recent || !Array.isArray(recent.form)) return [];

    const cutoffMs = nowMs - LOOKBACK_HOURS * 3600 * 1000;
    const len = recent.form.length;

    for (let i = 0; i < Math.min(len, 30); i++) {
      const form = recent.form[i];
      if (form !== '8-K') continue; // Focus on 8-K corporate events

      const rawDate = recent.filingDate?.[i];
      const filingDateStr = typeof rawDate === 'string' ? rawDate : null;
      if (!filingDateStr) continue;
      const filingDateMs = new Date(filingDateStr).getTime();
      if (isNaN(filingDateMs) || filingDateMs < cutoffMs) continue;

      const accession = recent.accessionNumber?.[i] as string;
      const primaryDoc = recent.primaryDocument?.[i] as string;
      const itemsStr = (recent.items?.[i] as string) || null;
      const { category, materiality, summary } = classifySec8KItems(itemsStr);

      const accNoHyphens = accession.replace(/-/g, '');
      const cikNumber = String(identity.cik).replace(/\D/g, '');
      const sourceUrl = `https://www.sec.gov/Archives/edgar/data/${cikNumber}/${accNoHyphens}/${primaryDoc}`;

      const eventId = `sec_${normTicker}_${accession}`;
      const publishedAt = `${filingDateStr}T00:00:00Z`;
      const headline = `${normTicker} Form 8-K: ${itemsStr ? `Item ${itemsStr}` : 'Current Report'}`;
      const dedupeFingerprint = `sec_${normTicker}_${accession}`;

      events.push({
        eventId,
        ticker: normTicker,
        headline,
        factualSummary: summary,
        category,
        materiality,
        publishedAt,
        retrievedAt: new Date(nowMs).toISOString(),
        sourceName: 'U.S. SEC EDGAR',
        sourceUrl,
        sourceType: 'SEC_EDGAR',
        sourceAuthority: 'AUTHORITATIVE_SEC',
        sourceDocumentId: accession,
        secAccession: accession,
        provenanceStatus: 'sec_verified',
        dedupeFingerprint,
        interpretationStatus: 'DETERMINISTIC_ONLY',
      });
    }
  } catch (err) {
    console.warn(`[materialNewsService] SEC fetch error for ${normTicker}:`, (err as any)?.message || err);
  }

  return events;
}

/**
 * Fetches recent market & company news for a ticker via Yahoo Finance search.
 */
export async function fetchYahooNewsForTicker(
  ticker: string,
  fetchImpl: typeof fetch = fetch,
  nowMs = Date.now()
): Promise<MaterialCompanyEvent[]> {
  const normTicker = normalizeTicker(ticker);
  if (!normTicker) return [];

  const events: MaterialCompanyEvent[] = [];
  const cutoffMs = nowMs - LOOKBACK_HOURS * 3600 * 1000;

  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(normTicker)}&newsCount=10`;
    const res = await fetchImpl(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(4500),
    });

    if (!res.ok) return [];

    const json: any = await res.json();
    const newsItems = Array.isArray(json?.news) ? json.news : [];

    for (const item of newsItems) {
      const title = (item.title || '').trim();
      const publisher = (item.publisher || '').trim();
      const link = (item.link || '').trim();
      const publishSec = typeof item.providerPublishTime === 'number' ? item.providerPublishTime : null;

      // 1. Noise check
      if (isNoiseHeadline(title)) continue;

      // 2. Source trust check
      const { sourceAuthority, sourceType, isApproved } = classifyPublisher(publisher);
      if (!isApproved) continue;

      // 3. Freshness check
      let publishedAt: string | null = null;
      if (publishSec !== null) {
        const publishMs = publishSec * 1000;
        if (publishMs < cutoffMs) continue; // older than 72 hours
        publishedAt = new Date(publishMs).toISOString();
      }

      // 4. Materiality check
      const { category, materiality } = evaluateTextMateriality(title);
      if (materiality === 'LOW') continue; // Filter out low materiality routine items

      const uuid = (item.uuid || '').trim();
      const dedupeFingerprint = generateDedupeFingerprint(normTicker, title, publishedAt);
      const eventId = uuid ? `news_${normTicker}_${uuid}` : `news_${normTicker}_${dedupeFingerprint}`;

      events.push({
        eventId,
        ticker: normTicker,
        headline: title,
        factualSummary: `Reported by ${publisher}.`,
        category,
        materiality,
        publishedAt,
        retrievedAt: new Date(nowMs).toISOString(),
        sourceName: publisher || 'Financial News Wire',
        sourceUrl: link || undefined,
        sourceType,
        sourceAuthority,
        dedupeFingerprint,
        interpretationStatus: 'DETERMINISTIC_ONLY',
      });
    }
  } catch (err) {
    console.warn(`[materialNewsService] Yahoo news fetch error for ${normTicker}:`, err);
  }

  return events;
}

/**
 * Optional Gemini batch interpretation for candidate material events.
 * AI adds "whyItMatters" / thesis relevance notes without inventing facts or modifying numbers.
 */
export async function enrichWithAiInterpretation(
  events: MaterialCompanyEvent[],
  apiKey = process.env.GEMINI_API_KEY
): Promise<MaterialCompanyEvent[]> {
  if (!apiKey || events.length === 0) {
    return events;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    // Bounded batch: interpret top 6 candidate events
    const candidateEvents = events.slice(0, 6);
    const eventSummaries = candidateEvents.map((e, idx) => (
      `[Event ${idx + 1}] Ticker: ${e.ticker} | Category: ${e.category} | Source: ${e.sourceName} | Headline: "${e.headline}"`
    )).join('\n');

    const prompt = `You are Lumina's institutional research intelligence layer.
Below is a list of verified corporate events retrieved from authoritative SEC filings and trusted business news wires.
Provide a concise, 1-2 sentence "Why It Matters" explanation for each event from an equity research / fundamental investor perspective.

RULES:
1. Ground strictly in the headline provided. NEVER invent dates, deal values, guidance numbers, executive names, or financial metrics.
2. If the impact is uncertain, express prudent analyst caution.
3. Respond in professional language (both English and Thai).

INPUT EVENTS:
${eventSummaries}

OUTPUT FORMAT:
Respond STRICTLY with a raw JSON array matching this schema:
[
  {
    "eventIndex": 1,
    "whyItMattersEn": "1-2 sentence institutional analysis in English",
    "whyItMattersTh": "1-2 sentence institutional analysis in Thai"
  }
]`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      }
    });

    const text = response.text || '';
    const parsed = JSON.parse(text);

    if (Array.isArray(parsed)) {
      const enrichedMap = new Map<number, { whyItMattersEn: string; whyItMattersTh: string }>();
      for (const item of parsed) {
        if (typeof item?.eventIndex === 'number') {
          enrichedMap.set(item.eventIndex, {
            whyItMattersEn: item.whyItMattersEn || '',
            whyItMattersTh: item.whyItMattersTh || '',
          });
        }
      }

      return events.map((event, idx) => {
        const enriched = enrichedMap.get(idx + 1);
        if (enriched) {
          return {
            ...event,
            whyItMatters: enriched.whyItMattersEn || undefined,
            whyItMattersTh: enriched.whyItMattersTh || undefined,
            interpretationStatus: 'AI_GROUNDED',
          };
        }
        return event;
      });
    }
  } catch (err) {
    console.warn('[materialNewsService] AI interpretation skipped or failed, degrading gracefully:', err);
  }

  return events;
}

/**
 * Main retrieval orchestrator for tracked tickers.
 */
export async function getMaterialEventsForTickers(
  tickers: string[],
  options: {
    forceRefresh?: boolean;
    secClient?: SecEdgarClient;
    fetchImpl?: typeof fetch;
    nowMs?: number;
    useAi?: boolean;
  } = {}
): Promise<NewsFetchResult> {
  const nowMs = options.nowMs || Date.now();
  const rawCleanTickers = Array.from(new Set(tickers.map(normalizeTicker).filter(Boolean)));
  // Bound to maximum 25 symbols per request
  const cleanTickers = rawCleanTickers.slice(0, 25);

  if (cleanTickers.length === 0) {
    return {
      events: [],
      requestedSymbols: [],
      successfulSymbols: [],
      failedSymbols: [],
      sourceStatus: { sec: 'OK', news: 'OK' },
      checkedAt: new Date(nowMs).toISOString(),
      cacheStatus: 'HIT',
    };
  }

  const resultEvents: MaterialCompanyEvent[] = [];
  const successfulSymbols: string[] = [];
  const failedSymbols: string[] = [];
  let cacheHits = 0;

  const symbolsToFetch: string[] = [];

  // Check in-memory cache
  for (const ticker of cleanTickers) {
    if (!options.forceRefresh && memoryCache.has(ticker)) {
      const entry = memoryCache.get(ticker)!;
      if (nowMs - entry.cachedAt < CACHE_TTL_MS) {
        resultEvents.push(...entry.events);
        successfulSymbols.push(ticker);
        cacheHits++;
        continue;
      }
    }
    symbolsToFetch.push(ticker);
  }

  let secStatus: 'OK' | 'PARTIAL' | 'ERROR' | 'UNAVAILABLE' = 'OK';
  let newsStatus: 'OK' | 'PARTIAL' | 'ERROR' | 'UNAVAILABLE' = 'OK';

  if (symbolsToFetch.length > 0) {
    await Promise.all(symbolsToFetch.map(async (sym) => {
      try {
        const [secEvents, newsEvents] = await Promise.all([
          fetchSecEventsForTicker(sym, options.secClient, nowMs).catch(() => {
            secStatus = 'PARTIAL';
            return [];
          }),
          fetchYahooNewsForTicker(sym, options.fetchImpl, nowMs).catch(() => {
            newsStatus = 'PARTIAL';
            return [];
          }),
        ]);

        const combined = [...secEvents, ...newsEvents];
        const deduplicated = deduplicateEvents(combined);

        // Update in-memory cache
        memoryCache.set(sym, {
          events: deduplicated,
          cachedAt: nowMs,
        });

        resultEvents.push(...deduplicated);
        successfulSymbols.push(sym);
      } catch (err) {
        console.error(`[materialNewsService] Failed to process events for ${sym}:`, err);
        failedSymbols.push(sym);
      }
    }));
  }

  // Deduplicate across all returned events
  let finalEvents = deduplicateEvents(resultEvents);

  // Optional AI batch enrichment if requested and enabled
  if (options.useAi !== false && finalEvents.length > 0) {
    finalEvents = await enrichWithAiInterpretation(finalEvents);
  }

  // Sort: Authoritative SEC first, then HIGH > MEDIUM, then newest publication date
  finalEvents.sort((a, b) => {
    const matRank = { HIGH: 2, MEDIUM: 1, LOW: 0 };
    const mDiff = (matRank[b.materiality] || 0) - (matRank[a.materiality] || 0);
    if (mDiff !== 0) return mDiff;

    const timeA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const timeB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return timeB - timeA;
  });

  const cacheStatus: 'HIT' | 'MISS' | 'PARTIAL' =
    cacheHits === cleanTickers.length
      ? 'HIT'
      : cacheHits > 0
        ? 'PARTIAL'
        : 'MISS';

  return {
    events: finalEvents,
    requestedSymbols: cleanTickers,
    successfulSymbols,
    failedSymbols,
    sourceStatus: {
      sec: failedSymbols.length === cleanTickers.length ? 'ERROR' : secStatus,
      news: failedSymbols.length === cleanTickers.length ? 'ERROR' : newsStatus,
    },
    checkedAt: new Date(nowMs).toISOString(),
    cacheStatus,
  };
}

/**
 * Clear in-memory cache for testing or explicit flush.
 */
export function clearMaterialNewsCache(): void {
  memoryCache.clear();
}
