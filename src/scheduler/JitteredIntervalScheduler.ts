export class JitteredIntervalScheduler {
  private baseIntervalMs: number;
  private maxJitterMs: number;

  constructor(baseIntervalMs: number, maxJitterMs: number) {
    this.baseIntervalMs = baseIntervalMs;
    this.maxJitterMs = maxJitterMs;
  }

  public computeNextDelay(): number {
    const jitter = Math.floor(Math.random() * this.maxJitterMs);
    return this.baseIntervalMs + jitter;
  }
}
