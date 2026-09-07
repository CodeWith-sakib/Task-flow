/**
 * Generic Cell Rate Algorithm (GCRA) Rate Limiter.
 * Implements leaky-bucket equivalent as a virtual scheduling algorithm (TAT = Theoretical Arrival Time),
 * requiring only a single scalar timestamp per rate limit key.
 */

export interface GCRAPolicy {
  ratePerSec: number;
  burstToleranceSec: number;
}

export class DistributedGCRARateLimiter {
  private tatByKey = new Map<string, number>(); // key -> Theoretical Arrival Time (ms)
  private emissionIntervalMs: number;
  private burstOffsetMs: number;

  constructor(policy: GCRAPolicy = { ratePerSec: 50, burstToleranceSec: 2 }) {
    this.emissionIntervalMs = 1000 / policy.ratePerSec;
    this.burstOffsetMs = policy.burstToleranceSec * 1000;
  }

  /**
   * Attempts to consume 1 cell for a rate limit key.
   * Returns whether request is allowed and time to next allowed arrival.
   */
  public check(key: string, now: number = Date.now()): { allowed: boolean; retryAfterMs: number; resetAfterMs: number } {
    const currentTat = this.tatByKey.get(key) || now;
    const tat = Math.max(currentTat, now);

    // If TAT is beyond (now + burstOffset), request violates limit
    if (tat > now + this.burstOffsetMs) {
      const retryAfterMs = Math.ceil(tat - (now + this.burstOffsetMs));
      const resetAfterMs = Math.ceil(tat - now);
      return {
        allowed: false,
        retryAfterMs,
        resetAfterMs,
      };
    }

    // Schedule next TAT
    const nextTat = tat + this.emissionIntervalMs;
    this.tatByKey.set(key, nextTat);

    return {
      allowed: true,
      retryAfterMs: 0,
      resetAfterMs: Math.max(0, Math.ceil(nextTat - now)),
    };
  }

  public reset(key: string): void {
    this.tatByKey.delete(key);
  }
}
