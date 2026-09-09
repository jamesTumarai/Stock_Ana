export const SEC_DATA_BASE_URL = 'https://data.sec.gov';
export const SEC_TICKER_INDEX_URL = 'https://www.sec.gov/files/company_tickers.json';

export interface SecTickerRecord {
  cik: string;
  ticker: string;
  title: string;
}

export interface SecSubmissionsResponse {
  cik: string;
  entityType?: string;
  sic?: string;
  sicDescription?: string;
  name?: string;
  tickers?: string[];
  exchanges?: string[];
  filings?: {
    recent?: Record<string, unknown[]>;
    files?: Array<{ name: string; filingCount?: number; filingFrom?: string; filingTo?: string }>;
  };
  [key: string]: unknown;
}

export interface SecCompanyFactsResponse {
  cik: number;
  entityName?: string;
  facts?: Record<string, Record<string, SecCompanyConcept>>;
  [key: string]: unknown;
}

export interface SecCompanyConcept {
  label?: string;
  description?: string;
  units?: Record<string, SecCompanyFact[]>;
}

export interface SecCompanyFact {
  start?: string;
  end?: string;
  val?: number;
  accn?: string;
  fy?: number;
  fp?: string;
  form?: string;
  filed?: string;
  frame?: string;
  [key: string]: unknown;
}

export interface SecClientOptions {
  userAgent?: string;
  fetchImpl?: typeof fetch;
  minIntervalMs?: number;
  tickerCacheTtlMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export class SecDataError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'SecDataError';
  }
}

const normalizeUserAgent = (value?: string) => value?.trim() || '';
const normalizeTicker = (value: string) => value.trim().toUpperCase();
const normalizeCik = (value: string | number) => String(value).replace(/\D/g, '').padStart(10, '0').slice(-10);

/**
 * Server-side SEC EDGAR client.
 *
 * Integrity / fair-access rules:
 * - no browser use (data.sec.gov does not support CORS)
 * - no requests without an explicitly configured SEC_USER_AGENT
 * - requests are rate-spaced below the SEC's published 10 requests/sec ceiling
 * - HTTP/network failures throw; callers must fail closed rather than substitute data
 */
export class SecEdgarClient {
  private readonly userAgent: string;
  private readonly fetchImpl: typeof fetch;
  private readonly minIntervalMs: number;
  private readonly tickerCacheTtlMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private requestChain: Promise<void> = Promise.resolve();
  private lastRequestAt = 0;
  private tickerCache: { expiresAt: number; records: Map<string, SecTickerRecord> } | null = null;

  constructor(options: SecClientOptions = {}) {
    this.userAgent = normalizeUserAgent(options.userAgent ?? (typeof process !== 'undefined' ? process.env.SEC_USER_AGENT : undefined));
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.minIntervalMs = Math.max(110, options.minIntervalMs ?? 125); // <= 8 requests/sec per runtime instance.
    this.tickerCacheTtlMs = Math.max(60_000, options.tickerCacheTtlMs ?? 6 * 60 * 60 * 1000);
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((ms: number) => new Promise(resolve => setTimeout(resolve, ms)));
  }

  get isConfigured() {
    return this.userAgent.length > 0;
  }

  private requireConfigured() {
    if (!this.isConfigured) {
      throw new SecDataError(
        'SEC EDGAR access is disabled until SEC_USER_AGENT is configured with an application/company name and contact address.',
        'SEC_USER_AGENT_MISSING',
      );
    }
  }

  private async waitForRateSlot() {
    const run = async () => {
      const elapsed = this.now() - this.lastRequestAt;
      const waitMs = Math.max(0, this.minIntervalMs - elapsed);
      if (waitMs > 0) await this.sleep(waitMs);
      this.lastRequestAt = this.now();
    };
    this.requestChain = this.requestChain.then(run, run);
    await this.requestChain;
  }

  async fetchJson<T>(url: string): Promise<T> {
    this.requireConfigured();
    if (!/^https:\/\/(?:data\.)?sec\.gov\//i.test(url) && !/^https:\/\/www\.sec\.gov\//i.test(url)) {
      throw new SecDataError(`Refusing non-SEC URL: ${url}`, 'SEC_URL_NOT_ALLOWED');
    }

    await this.waitForRateSlot();
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
      });
    } catch (error) {
      throw new SecDataError(`SEC request failed: ${error instanceof Error ? error.message : String(error)}`, 'SEC_NETWORK_ERROR');
    }

    if (!response.ok) {
      throw new SecDataError(`SEC request returned HTTP ${response.status}.`, 'SEC_HTTP_ERROR', response.status);
    }

    try {
      return await response.json() as T;
    } catch {
      throw new SecDataError('SEC response was not valid JSON.', 'SEC_INVALID_JSON', response.status);
    }
  }

  private async loadTickerIndex(): Promise<Map<string, SecTickerRecord>> {
    if (this.tickerCache && this.tickerCache.expiresAt > this.now()) return this.tickerCache.records;

    const payload = await this.fetchJson<Record<string, { cik_str?: number; ticker?: string; title?: string }>>(SEC_TICKER_INDEX_URL);
    const records = new Map<string, SecTickerRecord>();
    for (const entry of Object.values(payload ?? {})) {
      if (!entry?.ticker || entry.cik_str === undefined) continue;
      const ticker = normalizeTicker(entry.ticker);
      records.set(ticker, {
        cik: normalizeCik(entry.cik_str),
        ticker,
        title: entry.title?.trim() || ticker,
      });
    }
    this.tickerCache = { expiresAt: this.now() + this.tickerCacheTtlMs, records };
    return records;
  }

  async resolveTicker(ticker: string): Promise<SecTickerRecord | null> {
    const normalized = normalizeTicker(ticker);
    if (!normalized) return null;
    return (await this.loadTickerIndex()).get(normalized) ?? null;
  }

  async fetchSubmissions(cik: string | number): Promise<SecSubmissionsResponse> {
    const normalized = normalizeCik(cik);
    return this.fetchJson<SecSubmissionsResponse>(`${SEC_DATA_BASE_URL}/submissions/CIK${normalized}.json`);
  }

  async fetchCompanyFacts(cik: string | number): Promise<SecCompanyFactsResponse> {
    const normalized = normalizeCik(cik);
    return this.fetchJson<SecCompanyFactsResponse>(`${SEC_DATA_BASE_URL}/api/xbrl/companyfacts/CIK${normalized}.json`);
  }

  async fetchCompanyBundle(ticker: string): Promise<{
    identity: SecTickerRecord;
    submissions: SecSubmissionsResponse;
    companyFacts: SecCompanyFactsResponse;
    retrievedAt: string;
  } | null> {
    const identity = await this.resolveTicker(ticker);
    if (!identity) return null;
    const submissions = await this.fetchSubmissions(identity.cik);
    const companyFacts = await this.fetchCompanyFacts(identity.cik);
    return {
      identity,
      submissions,
      companyFacts,
      retrievedAt: new Date(this.now()).toISOString(),
    };
  }
}

export const createSecEdgarClientFromEnv = () => new SecEdgarClient();
