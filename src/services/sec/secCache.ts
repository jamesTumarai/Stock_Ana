export interface SecCacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
  evictions: number;
  hitRate: number;
}

export interface SecCacheOptions {
  defaultTtlMs?: number;
  maxSize?: number;
  now?: () => number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  lastAccessed: number;
}

/**
 * Per-instance best-effort warm cache for SEC filing facts and company bundles.
 * Enforces bounded in-memory capacity (LRU eviction, default max 50 companies) and
 * time-to-live freshness (default 15-minute TTL) per Node runtime / serverless instance.
 * Eliminates redundant multi-megabyte SEC EDGAR network transfers while adhering to
 * fair-use rate limits. Note: This cache is in-memory only (not distributed or persistent)
 * and resets across container cold starts or process restarts.
 */
export class SecTtlCache {
  private readonly defaultTtlMs: number;
  private readonly maxSize: number;
  private readonly now: () => number;
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(options: SecCacheOptions = {}) {
    this.defaultTtlMs = Math.max(1000, options.defaultTtlMs ?? 15 * 60 * 1000); // Default 15 minutes
    this.maxSize = Math.max(1, options.maxSize ?? 50); // Default 50 companies max in-memory
    this.now = options.now ?? Date.now;
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    const currentTime = this.now();

    if (!entry) {
      this.misses++;
      return null;
    }

    if (entry.expiresAt <= currentTime) {
      this.store.delete(key);
      this.misses++;
      return null;
    }

    entry.lastAccessed = currentTime;
    this.hits++;
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    if (value === null || value === undefined) return;

    const currentTime = this.now();
    const effectiveTtl = Math.max(1000, ttlMs ?? this.defaultTtlMs);

    if (!this.store.has(key) && this.store.size >= this.maxSize) {
      this.evictOldest();
    }

    this.store.set(key, {
      value,
      expiresAt: currentTime + effectiveTtl,
      lastAccessed: currentTime,
    });
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  pruneExpired(): number {
    const currentTime = this.now();
    let pruned = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= currentTime) {
        this.store.delete(key);
        pruned++;
      }
    }
    return pruned;
  }

  getStats(): SecCacheStats {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? Number((this.hits / totalRequests).toFixed(4)) : 0;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.store.size,
      maxSize: this.maxSize,
      evictions: this.evictions,
      hitRate,
    };
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.store.entries()) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey !== null) {
      this.store.delete(oldestKey);
      this.evictions++;
    }
  }
}

let globalSecCache: SecTtlCache | null = null;

export function getGlobalSecCache(): SecTtlCache {
  if (!globalSecCache) {
    globalSecCache = new SecTtlCache();
  }
  return globalSecCache;
}

export function resetGlobalSecCache(): void {
  if (globalSecCache) {
    globalSecCache.clear();
  }
  globalSecCache = null;
}
