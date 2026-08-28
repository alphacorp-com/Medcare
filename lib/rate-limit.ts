// Minimal in-memory rate limiter. There's no Redis (or any shared cache) in this
// stack, so this only protects a single server process — it resets on restart and
// doesn't coordinate across instances if the app is ever scaled horizontally. That's
// still a real improvement over the current zero throttling on sensitive endpoints
// like license activation, and can be swapped for a Redis-backed version later
// without changing call sites.
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Buckets never get cleaned up otherwise (the Map would grow forever under
// sustained traffic from many keys) — a simple periodic sweep of expired entries.
const SWEEP_INTERVAL_MS = 5 * 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, SWEEP_INTERVAL_MS).unref();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Fixed-window limiter: allows up to `limit` calls per `windowMs` for a given `key`.
 * Call once per attempt (success or failure) — the caller decides whether a
 * particular outcome should count against the window.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}
