/**
 * P2 slice 2: login rate limiter (blueprint 11: rate limiting on login).
 *
 * Sliding window per key: attempts are allowed until `maxAttempts` failures
 * fall inside the window, then blocked with a retry-after hint that shrinks
 * as old failures age out. A successful login resets the key. Keys isolate
 * (one username/IP cannot lock out another). Clock is injected for
 * deterministic window math.
 */
import { describe, expect, it } from 'vitest';
import { createLoginRateLimiter } from '../../apps/web/src/auth/rateLimit.js';

describe('login rate limiter', () => {
  it('allows attempts up to the limit, blocks, then unlocks when the window elapses', () => {
    let now = 1_000_000;
    const limiter = createLoginRateLimiter({ maxAttempts: 3, windowMs: 60_000, now: () => now });

    for (let i = 0; i < 3; i++) {
      expect(limiter.check('ip|owner').allowed).toBe(true);
      limiter.recordFailure('ip|owner');
    }

    const blocked = limiter.check('ip|owner');
    expect(blocked.allowed).toBe(false);
    // Oldest failure was at t=1_000_000; it leaves the window at t=1_060_000.
    expect(blocked.retryAfterMs).toBe(60_000);

    now = 1_059_999;
    expect(limiter.check('ip|owner').allowed).toBe(false);

    now = 1_060_000;
    expect(limiter.check('ip|owner').allowed).toBe(true);
  });

  it('isolates keys and resets a key after a successful login', () => {
    let now = 500_000;
    const limiter = createLoginRateLimiter({ maxAttempts: 1, windowMs: 60_000, now: () => now });

    limiter.recordFailure('alice');
    expect(limiter.check('alice').allowed).toBe(false);
    expect(limiter.check('bob').allowed).toBe(true);

    limiter.reset('alice');
    expect(limiter.check('alice').allowed).toBe(true);

    // Failures older than the window are pruned, so they cannot accumulate.
    limiter.recordFailure('bob');
    now = 560_000;
    expect(limiter.check('bob').allowed).toBe(true);
  });
});
