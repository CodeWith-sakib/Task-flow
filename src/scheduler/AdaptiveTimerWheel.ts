export class AdaptiveTimerWheel {
  private baseTickMs: number;
  private currentMultiplier: number = 1;

  constructor(baseTickMs: number = 100) {
    this.baseTickMs = baseTickMs;
  }

  public adjustForLoad(pendingCount: number): number {
    if (pendingCount > 1000) {
      this.currentMultiplier = 2; // Coarsen ticks under heavy load
    } else {
      this.currentMultiplier = 1;
    }
    return this.getEffectiveTickMs();
  }

  public getEffectiveTickMs(): number {
    return this.baseTickMs * this.currentMultiplier;
  }
}
