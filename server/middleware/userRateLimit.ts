import type { RequestHandler } from 'express';

interface WindowEntry {
  count: number;
  resetAt: number;
  touchedAt: number;
}

export interface UserRateLimitOptions {
  scope: string;
  limit: number;
  windowMs: number;
  maxEntries?: number;
  now?: () => number;
}

export interface UserConcurrencyLimitOptions {
  scope: string;
  maxConcurrent: number;
}

const positiveInteger = (value: number, fallback: number) =>
  Number.isInteger(value) && value > 0 ? value : fallback;

const userKey = (req: any, res: any, scope: string) => {
  const uid = res.locals?.authUser?.uid;
  if (typeof uid === 'string' && uid.trim()) return `${scope}:uid:${uid}`;
  const ip = typeof req.ip === 'string' && req.ip.trim() ? req.ip : 'unknown';
  return `${scope}:ip:${ip}`;
};

const retryAfterSeconds = (resetAt: number, now: number) =>
  Math.max(1, Math.ceil((resetAt - now) / 1000));

/**
 * Per-instance abuse guard. Authenticated UID is the primary identity; IP is only a defensive
 * fallback if middleware ordering changes. This is intentionally not presented as a globally
 * distributed quota across every serverless instance.
 */
export function createUserRateLimiter(options: UserRateLimitOptions): RequestHandler {
  const limit = positiveInteger(options.limit, 1);
  const windowMs = positiveInteger(options.windowMs, 60_000);
  const maxEntries = positiveInteger(options.maxEntries ?? 5_000, 5_000);
  const now = options.now ?? Date.now;
  const windows = new Map<string, WindowEntry>();

  const prune = (timestamp: number) => {
    for (const [key, entry] of windows) {
      if (entry.resetAt <= timestamp) windows.delete(key);
    }
    if (windows.size <= maxEntries) return;
    const oldest = [...windows.entries()]
      .sort((left, right) => left[1].touchedAt - right[1].touchedAt)
      .slice(0, windows.size - maxEntries);
    oldest.forEach(([key]) => windows.delete(key));
  };

  return (req, res, next) => {
    const timestamp = now();
    prune(timestamp);
    const key = userKey(req, res, options.scope);
    const existing = windows.get(key);
    const entry = !existing || existing.resetAt <= timestamp
      ? { count: 0, resetAt: timestamp + windowMs, touchedAt: timestamp }
      : existing;

    entry.touchedAt = timestamp;
    if (entry.count >= limit) {
      const retryAfter = retryAfterSeconds(entry.resetAt, timestamp);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        code: 'RATE_LIMITED',
        error: 'Too many requests. Please retry later.',
        retryAfterSeconds: retryAfter,
      });
      return;
    }

    entry.count += 1;
    windows.set(key, entry);
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - entry.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
    next();
  };
}

/** Release is tied to both finish and close, with an idempotent guard for aborted SSE streams. */
export function createUserConcurrencyLimiter(options: UserConcurrencyLimitOptions): RequestHandler {
  const maxConcurrent = positiveInteger(options.maxConcurrent, 1);
  const active = new Map<string, number>();

  return (req, res, next) => {
    const key = userKey(req, res, options.scope);
    const current = active.get(key) ?? 0;
    if (current >= maxConcurrent) {
      res.setHeader('Retry-After', '1');
      res.status(429).json({
        code: 'CONCURRENT_LIMIT',
        error: 'An analysis is already running for this user.',
        retryAfterSeconds: 1,
      });
      return;
    }

    active.set(key, current + 1);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      const nextCount = (active.get(key) ?? 1) - 1;
      if (nextCount <= 0) active.delete(key);
      else active.set(key, nextCount);
    };
    res.once('finish', release);
    res.once('close', release);
    next();
  };
}
