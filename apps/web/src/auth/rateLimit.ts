/**
 * P2 slice 2: login rate limiter (blueprint 11: rate limiting on login).
 *
 * In-memory sliding window keyed by (client address, username). Single
 * instance by design — the app is a single-organization deployment behind
 * Cloudflare Access; if the worker ever needs shared state the interface
 * stays and the store moves. Clock injectable for deterministic tests.
 */
export interface LoginRateLimiterOptions {
  maxAttempts?: number;
  windowMs?: number;
  now?: () => number;
}

export interface RateLimitVerdict {
  allowed: boolean;
  /** Milliseconds until the oldest failure leaves the window; 0 when allowed. */
  retryAfterMs: number;
}

export interface LoginRateLimiter {
  check(key: string): RateLimitVerdict;
  recordFailure(key: string): void;
  reset(key: string): void;
}

export function createLoginRateLimiter({
  maxAttempts = 5,
  windowMs = 15 * 60 * 1000,
  now = Date.now,
}: LoginRateLimiterOptions = {}): LoginRateLimiter {
  const failuresByKey = new Map<string, number[]>();

  const prune = (key: string, at: number): number[] => {
    const kept = (failuresByKey.get(key) ?? []).filter((timestamp) => at - timestamp < windowMs);
    if (kept.length === 0) failuresByKey.delete(key);
    else failuresByKey.set(key, kept);
    return kept;
  };

  return {
    check(key: string): RateLimitVerdict {
      const at = now();
      const kept = prune(key, at);
      if (kept.length < maxAttempts) return { allowed: true, retryAfterMs: 0 };
      const oldest = kept[0]!;
      return { allowed: false, retryAfterMs: Math.max(1, windowMs - (at - oldest)) };
    },
    recordFailure(key: string): void {
      const at = now();
      const kept = prune(key, at);
      kept.push(at);
      failuresByKey.set(key, kept);
    },
    reset(key: string): void {
      failuresByKey.delete(key);
    },
  };
}
