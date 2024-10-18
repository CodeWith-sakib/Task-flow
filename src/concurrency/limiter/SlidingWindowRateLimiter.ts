export interface SlidingWindowOptions {
  windowSizeMs: number;
  maxRequests: number;
}

export class SlidingWindowRateLimiter {
  private windowSizeMs: number;
  private maxRequests: number;
  private timestamps: Map<string, number[]> = new Map();

  constructor(options: SlidingWindowOptions) {
    this.windowSizeMs = options.windowSizeMs;
    this.maxRequests = options.maxRequests;
  }

  tryAcquire(key: string, now: number = Date.now()): boolean {
    const list = this.timestamps.get(key) || [];
    const threshold = now - this.windowSizeMs;
    const valid = list.filter(t => t > threshold);

    if (valid.length < this.maxRequests) {
      valid.push(now);
      this.timestamps.set(key, valid);
      return true;
    }

    this.timestamps.set(key, valid);
    return false;
  }

  clear(): void {
    this.timestamps.clear();
  }
}
