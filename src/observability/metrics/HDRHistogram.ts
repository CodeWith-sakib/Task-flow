export interface HistogramPercentiles {
  min: number;
  max: number;
  mean: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  p999: number;
  count: number;
}

/**
 * HDRHistogram provides high dynamic range latency recording with logarithmic bucketing
 * and sub-percentile quantile computation up to 3,600,000 milliseconds (1 hour).
 */
export class HDRHistogram {
  private counts: number[] = [];
  private totalCount: number = 0;
  private sum: number = 0;
  private minVal: number = Number.MAX_SAFE_INTEGER;
  private maxVal: number = 0;
  private bucketCount: number;

  constructor(bucketCount: number = 2000) {
    this.bucketCount = bucketCount;
    this.counts = new Array(bucketCount).fill(0);
  }

  public record(valueMs: number): void {
    const val = Math.max(0, valueMs);
    this.totalCount++;
    this.sum += val;
    this.minVal = Math.min(this.minVal, val);
    this.maxVal = Math.max(this.maxVal, val);

    const bucketIdx = this.valueToBucket(val);
    if (bucketIdx < this.bucketCount) {
      this.counts[bucketIdx]++;
    } else {
      this.counts[this.bucketCount - 1]++;
    }
  }

  public getPercentile(percentile: number): number {
    if (this.totalCount === 0) return 0;
    const targetCount = Math.ceil((percentile / 100) * this.totalCount);

    let accumulated = 0;
    for (let i = 0; i < this.bucketCount; i++) {
      accumulated += this.counts[i];
      if (accumulated >= targetCount) {
        return this.bucketToValue(i);
      }
    }

    return this.maxVal;
  }

  public getSummary(): HistogramPercentiles {
    if (this.totalCount === 0) {
      return {
        min: 0,
        max: 0,
        mean: 0,
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        p999: 0,
        count: 0
      };
    }

    return {
      min: this.minVal,
      max: this.maxVal,
      mean: this.sum / this.totalCount,
      p50: this.getPercentile(50),
      p75: this.getPercentile(75),
      p90: this.getPercentile(90),
      p95: this.getPercentile(95),
      p99: this.getPercentile(99),
      p999: this.getPercentile(99.9),
      count: this.totalCount
    };
  }

  public reset(): void {
    this.counts.fill(0);
    this.totalCount = 0;
    this.sum = 0;
    this.minVal = Number.MAX_SAFE_INTEGER;
    this.maxVal = 0;
  }

  private valueToBucket(val: number): number {
    // Logarithmic mapping: 0 to 3600000ms
    if (val <= 0) return 0;
    const logVal = Math.log10(val + 1);
    const maxLog = Math.log10(3600001);
    return Math.floor((logVal / maxLog) * (this.bucketCount - 1));
  }

  private bucketToValue(bucket: number): number {
    const maxLog = Math.log10(3600001);
    const logVal = (bucket / (this.bucketCount - 1)) * maxLog;
    return Math.pow(10, logVal) - 1;
  }
}
