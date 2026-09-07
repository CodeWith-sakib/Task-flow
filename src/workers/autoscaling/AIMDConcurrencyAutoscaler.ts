export interface AIMDConfig {
  minConcurrency?: number;
  maxConcurrency?: number;
  additiveIncrement?: number;   // +1
  multiplicativeFactor?: number;// 0.5
  errorThresholdPct?: number;   // 5%
  latencyThresholdMs?: number;  // 1000ms
}

/**
 * AIMDConcurrencyAutoscaler implements Additive-Increase / Multiplicative-Decrease
 * concurrency control to dynamically optimize worker throughput while avoiding system overload.
 */
export class AIMDConcurrencyAutoscaler {
  private minConcurrency: number;
  private maxConcurrency: number;
  private additiveIncrement: number;
  private multiplicativeFactor: number;
  private errorThresholdPct: number;
  private latencyThresholdMs: number;

  private currentConcurrency: number;
  private recentLatencies: number[] = [];
  private recentErrors: number = 0;
  private recentTotal: number = 0;

  constructor(config?: AIMDConfig) {
    this.minConcurrency = config?.minConcurrency ?? 1;
    this.maxConcurrency = config?.maxConcurrency ?? 50;
    this.additiveIncrement = config?.additiveIncrement ?? 1;
    this.multiplicativeFactor = config?.multiplicativeFactor ?? 0.7;
    this.errorThresholdPct = config?.errorThresholdPct ?? 5;
    this.latencyThresholdMs = config?.latencyThresholdMs ?? 1000;
    this.currentConcurrency = this.minConcurrency;
  }

  public recordExecution(latencyMs: number, isError: boolean): void {
    this.recentTotal++;
    if (isError) this.recentErrors++;
    this.recentLatencies.push(latencyMs);
    if (this.recentLatencies.length > 100) {
      this.recentLatencies.shift();
    }
  }

  public evaluateAndAdjust(): number {
    if (this.recentTotal < 10) {
      return this.currentConcurrency; // Wait for sufficient samples
    }

    const errorRatePct = (this.recentErrors / this.recentTotal) * 100;
    const avgLatency = this.recentLatencies.reduce((a, b) => a + b, 0) / this.recentLatencies.length;

    const isOverloaded = errorRatePct >= this.errorThresholdPct || avgLatency >= this.latencyThresholdMs;

    if (isOverloaded) {
      // Multiplicative Decrease
      this.currentConcurrency = Math.max(
        this.minConcurrency,
        Math.floor(this.currentConcurrency * this.multiplicativeFactor)
      );
    } else {
      // Additive Increase
      this.currentConcurrency = Math.min(
        this.maxConcurrency,
        this.currentConcurrency + this.additiveIncrement
      );
    }

    // Reset window
    this.recentErrors = 0;
    this.recentTotal = 0;

    return this.currentConcurrency;
  }

  public getConcurrency(): number {
    return this.currentConcurrency;
  }
}
