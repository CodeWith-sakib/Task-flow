/**
 * Leaky Bucket Traffic Shaping & Rate Limiter.
 * Smooths bursty task submission traffic into a constant, deterministic output rate,
 * queuing allowable bursts and dropping or rejecting overflows.
 */

export class LeakyBucketRateLimiter {
  private capacity: number; // Max burst water level
  private leakRatePerSec: number; // Constant drain rate (tokens/sec)
  private currentWaterLevel: number = 0;
  private lastLeakTs: number = Date.now();

  constructor(capacity: number = 100, leakRatePerSec: number = 20) {
    this.capacity = capacity;
    this.leakRatePerSec = leakRatePerSec;
  }

  public tryAcquire(amount: number = 1, now: number = Date.now()): { allowed: boolean; remainingCapacity: number } {
    this.leak(now);

    if (this.currentWaterLevel + amount <= this.capacity) {
      this.currentWaterLevel += amount;
      return {
        allowed: true,
        remainingCapacity: this.capacity - this.currentWaterLevel,
      };
    }

    return {
      allowed: false,
      remainingCapacity: this.capacity - this.currentWaterLevel,
    };
  }

  public getEstimatedWaitTimeMs(amount: number = 1, now: number = Date.now()): number {
    this.leak(now);
    const excess = this.currentWaterLevel + amount - this.capacity;
    if (excess <= 0) return 0;

    return Math.ceil((excess / this.leakRatePerSec) * 1000);
  }

  public getCurrentWaterLevel(): number {
    this.leak(Date.now());
    return this.currentWaterLevel;
  }

  private leak(now: number): void {
    const elapsedSec = (now - this.lastLeakTs) / 1000;
    const leakedAmount = elapsedSec * this.leakRatePerSec;

    this.currentWaterLevel = Math.max(0, this.currentWaterLevel - leakedAmount);
    this.lastLeakTs = now;
  }
}
