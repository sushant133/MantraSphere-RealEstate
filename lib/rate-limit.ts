/**
 * Fixed-window rate limiter kept in process memory (fine for one VPS / one
 * PM2 instance per key space). Swap for Upstash Redis when running several
 * instances: same `rateLimit()` signature.
 */
type Bucket = { count: number; resetAt: number };

const g = globalThis as unknown as { __rl?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = g.__rl ?? (g.__rl = new Map());
const MAX_KEYS = 50_000;

function sweep(now: number) {
  if (buckets.size < MAX_KEYS) return;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  // Still too big (abuse): drop the oldest quarter.
  if (buckets.size >= MAX_KEYS) [...buckets.keys()].slice(0, MAX_KEYS / 4).forEach((k) => buckets.delete(k));
}

/**
 * Test servers can raise every limit (e.g. RATE_LIMIT_MULTIPLIER=50 for
 * repeated e2e runs from one IP). Ignored in production unless explicitly allowed.
 */
const MULT = (() => {
  const m = Number(process.env.RATE_LIMIT_MULTIPLIER ?? 1);
  const allowed = process.env.NODE_ENV !== "production" || process.env.ALLOW_RATE_LIMIT_MULTIPLIER === "1";
  return allowed && Number.isFinite(m) && m >= 1 ? m : 1;
})();

export function rateLimit(key: string, baseLimit: number, windowMs: number): { ok: boolean; remaining: number; retryAfterS: number } {
  const limit = baseLimit * MULT;
  const now = Date.now();
  sweep(now);
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;
  return { ok: b.count <= limit, remaining: Math.max(0, limit - b.count), retryAfterS: Math.ceil((b.resetAt - now) / 1000) };
}

/** Test helper. */
export function _resetRateLimits() {
  buckets.clear();
}
