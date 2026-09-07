/**
 * Compaction I/O Bandwidth Rate Limiter.
 * Uses a token bucket algorithm to rate-limit background compaction disk writes,
 * preventing write bursts from causing read latency spikes on production storage engines.
 */

export class CompactionRateLimiter {
  private maxBytesPerSec: number;
  private currentTokens: number;
  private lastRefillTs: number = Date.now();

  constructor(maxBytesPerSec: number = 20 * 1024 * 1024) {
    // 20 MB/s default
    this.maxBytesPerSec = maxBytesPerSec;
    this.currentTokens = maxBytesPerSec;
  }

  public async throttle(bytesToWrite: number, now: number = Date.now()): Promise<void> {
    this.refill(now);

    if (this.currentTokens >= bytesToWrite) {
      this.currentTokens -= bytesToWrite;
      return;
    }

    // Need to wait until enough tokens are replenished
    const deficit = bytesToWrite - this.currentTokens;
    const waitMs = Math.ceil((deficit / this.maxBytesPerSec) * 1000);

    await new Promise((resolve) => setTimeout(resolve, waitMs));

    this.refill(Date.now());
    this.currentTokens = Math.max(0, this.currentTokens - bytesToWrite);
  }

  public setMaxRate(maxBytesPerSec: number): void {
    this.maxBytesPerSec = maxBytesPerSec;
    this.currentTokens = Math.min(this.currentTokens, maxBytesPerSec);
  }

  private refill(now: number): void {
    const elapsedSec = (now - this.lastRefillTs) / 1000;
    const addedTokens = elapsedSec * this.maxBytesPerSec;

    this.currentTokens = Math.min(this.maxBytesPerSec, this.currentTokens + addedTokens);
    this.lastRefillTs = now;
  }
}
