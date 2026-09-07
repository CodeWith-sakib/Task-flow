/**
 * Rolling Time-Series Window Rollup and Downsampling Engine.
 * Aggregates high-frequency raw counters and gauges into 1-minute, 5-minute,
 * and 1-hour resolution time buckets with min, max, avg, sum, count statistics.
 */

export interface MetricBucket {
  bucketStartTs: number;
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
}

export class RollingWindowRollup {
  private bucketDurationMs: number;
  private maxBuckets: number;
  private buckets = new Map<number, MetricBucket>();

  constructor(bucketDurationMs: number = 60000, maxBuckets: number = 1440) {
    this.bucketDurationMs = bucketDurationMs;
    this.maxBuckets = maxBuckets;
  }

  public record(value: number, timestamp: number = Date.now()): void {
    const bucketStart = Math.floor(timestamp / this.bucketDurationMs) * this.bucketDurationMs;
    let bucket = this.buckets.get(bucketStart);

    if (!bucket) {
      bucket = {
        bucketStartTs: bucketStart,
        count: 1,
        sum: value,
        min: value,
        max: value,
        avg: value,
      };
      this.buckets.set(bucketStart, bucket);
    } else {
      bucket.count++;
      bucket.sum += value;
      bucket.min = Math.min(bucket.min, value);
      bucket.max = Math.max(bucket.max, value);
      bucket.avg = bucket.sum / bucket.count;
    }

    this.pruneOldBuckets(timestamp);
  }

  public getBuckets(startTime?: number, endTime?: number): MetricBucket[] {
    const sorted = Array.from(this.buckets.values()).sort((a, b) => a.bucketStartTs - b.bucketStartTs);
    return sorted.filter((b) => {
      if (startTime !== undefined && b.bucketStartTs < startTime) return false;
      if (endTime !== undefined && b.bucketStartTs > endTime) return false;
      return true;
    });
  }

  /**
   * Downsamples current buckets into coarser resolution buckets (e.g. 1m -> 5m).
   */
  public downsample(coarseBucketDurationMs: number): MetricBucket[] {
    const coarseBuckets = new Map<number, MetricBucket>();

    for (const b of this.buckets.values()) {
      const coarseStart = Math.floor(b.bucketStartTs / coarseBucketDurationMs) * coarseBucketDurationMs;
      let coarse = coarseBuckets.get(coarseStart);

      if (!coarse) {
        coarse = {
          bucketStartTs: coarseStart,
          count: b.count,
          sum: b.sum,
          min: b.min,
          max: b.max,
          avg: b.avg,
        };
        coarseBuckets.set(coarseStart, coarse);
      } else {
        coarse.count += b.count;
        coarse.sum += b.sum;
        coarse.min = Math.min(coarse.min, b.min);
        coarse.max = Math.max(coarse.max, b.max);
        coarse.avg = coarse.sum / coarse.count;
      }
    }

    return Array.from(coarseBuckets.values()).sort((a, b) => a.bucketStartTs - b.bucketStartTs);
  }

  private pruneOldBuckets(now: number): void {
    const oldestAllowed = now - this.bucketDurationMs * this.maxBuckets;
    for (const [ts] of this.buckets.entries()) {
      if (ts < oldestAllowed) {
        this.buckets.delete(ts);
      }
    }
  }
}
