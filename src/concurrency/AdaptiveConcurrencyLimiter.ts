export class AdaptiveConcurrencyLimiter {
  private limit: number;
  private minLimit: number;
  private maxLimit: number;
  private inFlight: number = 0;

  constructor(initialLimit: number = 10, minLimit: number = 2, maxLimit: number = 100) {
    this.limit = initialLimit;
    this.minLimit = minLimit;
    this.maxLimit = maxLimit;
  }

  public acquire(): boolean {
    if (this.inFlight >= this.limit) {
      return false;
    }
    this.inFlight++;
    return true;
  }

  public release(success: boolean): void {
    this.inFlight = Math.max(0, this.inFlight - 1);
    if (success) {
      // Additive increase
      this.limit = Math.min(this.maxLimit, this.limit + 1);
    } else {
      // Multiplicative decrease
      this.limit = Math.max(this.minLimit, Math.floor(this.limit * 0.7));
    }
  }

  public getLimit(): number {
    return this.limit;
  }

  public getInFlight(): number {
    return this.inFlight;
  }
}
