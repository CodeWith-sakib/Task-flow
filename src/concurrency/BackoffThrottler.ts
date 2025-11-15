export class BackoffThrottler {
  private consecutiveErrors: number = 0;
  private baseDelayMs: number;
  private maxDelayMs: number;

  constructor(baseDelayMs: number = 100, maxDelayMs: number = 10000) {
    this.baseDelayMs = baseDelayMs;
    this.maxDelayMs = maxDelayMs;
  }

  public recordSuccess(): void {
    this.consecutiveErrors = 0;
  }

  public recordFailure(): number {
    this.consecutiveErrors++;
    return this.getCurrentDelay();
  }

  public getCurrentDelay(): number {
    if (this.consecutiveErrors === 0) return 0;
    const delay = this.baseDelayMs * Math.pow(2, this.consecutiveErrors - 1);
    return Math.min(this.maxDelayMs, delay);
  }
}
