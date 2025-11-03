import { RateLimiterOptions } from '../types';

export class TokenBucketRateLimiter {
  private capacity: number;
  private refillRatePerSec: number;
  private tokens: number;
  private lastRefillTimestamp: number;

  constructor(options: RateLimiterOptions) {
    this.capacity = options.capacity;
    this.refillRatePerSec = options.refillRatePerSec;
    this.tokens = options.initialTokens ?? options.capacity;
    this.lastRefillTimestamp = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefillTimestamp) / 1000;
    if (elapsedSec > 0) {
      const addedTokens = elapsedSec * this.refillRatePerSec;
      this.tokens = Math.min(this.capacity, this.tokens + addedTokens);
      this.lastRefillTimestamp = now;
    }
  }

  tryAcquire(requested: number = 1): boolean {
    this.refill();
    if (this.tokens >= requested) {
      this.tokens -= requested;
      return true;
    }
    return false;
  }

  async acquire(requested: number = 1, timeoutMs: number = 2000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() <= deadline) {
      if (this.tryAcquire(requested)) {
        return true;
      }
      // Sleep briefly before re-checking
      await new Promise(res => setTimeout(res, 20));
    }

    return false;
  }

  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}
