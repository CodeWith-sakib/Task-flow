export class DebounceThrottleCoordinator {
  private lastExecTime: number = 0;
  private throttleIntervalMs: number;

  constructor(throttleIntervalMs: number = 500) {
    this.throttleIntervalMs = throttleIntervalMs;
  }

  public shouldExecute(now: number = Date.now()): boolean {
    if (now - this.lastExecTime >= this.throttleIntervalMs) {
      this.lastExecTime = now;
      return true;
    }
    return false;
  }

  public reset(): void {
    this.lastExecTime = 0;
  }
}
