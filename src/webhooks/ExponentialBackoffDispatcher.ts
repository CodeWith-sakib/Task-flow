export class ExponentialBackoffDispatcher {
  public static computeDelay(attempt: number, baseMs: number = 1000, maxMs: number = 30000): number {
    const delay = baseMs * Math.pow(2, attempt);
    return Math.min(maxMs, delay);
  }
}
