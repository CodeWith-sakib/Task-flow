/**
 * Statistical Metric Aggregator.
 * Computes P50, P90, P99, P99.9 quantiles, rates, standard deviations,
 * and EWMA rates over rolling sliding windows.
 */

export interface MetricSummary {
  count: number;
  min: number;
  max: number;
  mean: number;
  stdDev: number;
  p50: number;
  p90: number;
  p99: number;
  p999: number;
  ratePerSec: number;
}

export class MetricAggregator {
  private samples: { timestamp: number; value: number }[] = [];
  private windowDurationMs: number;

  constructor(windowDurationMs: number = 60000) {
    this.windowDurationMs = windowDurationMs;
  }

  public record(value: number, timestamp: number = Date.now()): void {
    this.samples.push({ timestamp, value });
    this.purgeOldSamples(timestamp);
  }

  public getSummary(now: number = Date.now()): MetricSummary {
    this.purgeOldSamples(now);

    if (this.samples.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        mean: 0,
        stdDev: 0,
        p50: 0,
        p90: 0,
        p99: 0,
        p999: 0,
        ratePerSec: 0,
      };
    }

    const values = this.samples.map((s) => s.value).sort((a, b) => a - b);
    const count = values.length;
    const min = values[0];
    const max = values[count - 1];

    const sum = values.reduce((acc, v) => acc + v, 0);
    const mean = sum / count;

    const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);

    const p50 = this.getPercentile(values, 0.5);
    const p90 = this.getPercentile(values, 0.9);
    const p99 = this.getPercentile(values, 0.99);
    const p999 = this.getPercentile(values, 0.999);

    const oldestTs = this.samples[0].timestamp;
    const durationSec = Math.max(1, (now - oldestTs) / 1000);
    const ratePerSec = count / durationSec;

    return {
      count,
      min,
      max,
      mean,
      stdDev,
      p50,
      p90,
      p99,
      p999,
      ratePerSec,
    };
  }

  private getPercentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    const idx = Math.min(sortedValues.length - 1, Math.floor(sortedValues.length * p));
    return sortedValues[idx];
  }

  private purgeOldSamples(now: number): void {
    const threshold = now - this.windowDurationMs;
    while (this.samples.length > 0 && this.samples[0].timestamp < threshold) {
      this.samples.shift();
    }
  }
}
