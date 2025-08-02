export class DynamicScheduleTrigger {
  private intervalMs: number;
  private nextRun: number;

  constructor(initialIntervalMs: number) {
    this.intervalMs = initialIntervalMs;
    this.nextRun = Date.now() + initialIntervalMs;
  }

  public updateInterval(newIntervalMs: number): void {
    this.intervalMs = newIntervalMs;
    this.nextRun = Date.now() + newIntervalMs;
  }

  public isDue(now: number = Date.now()): boolean {
    return now >= this.nextRun;
  }

  public advance(now: number = Date.now()): void {
    this.nextRun = now + this.intervalMs;
  }

  public getNextRun(): number {
    return this.nextRun;
  }
}
