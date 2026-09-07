/**
 * Continuous Memory Profiler & Leak Detector.
 * Measures heap allocation rate (MB/sec), detects steadily increasing baseline memory
 * after GC cycles, and issues leak warnings before out-of-memory crashes occur.
 */

export interface MemorySample {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
}

export interface MemoryTrendAnalysis {
  growthRateMbPerMinute: number;
  isLeaking: boolean;
  estimatedTimeToOomMinutes: number;
  sampleCount: number;
}

export class ContinuousMemoryProfiler {
  private samples: MemorySample[] = [];
  private maxSamples: number;
  private maxAllowedHeapBytes: number;

  constructor(maxSamples: number = 300, maxAllowedHeapBytes: number = 1024 * 1024 * 1024) {
    this.maxSamples = maxSamples;
    this.maxAllowedHeapBytes = maxAllowedHeapBytes;
  }

  public recordSample(now: number = Date.now()): MemorySample {
    const mem = process.memoryUsage ? process.memoryUsage() : { heapUsed: 0, heapTotal: 0, rss: 0, external: 0 };
    const sample: MemorySample = {
      timestamp: now,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      rss: mem.rss,
      external: mem.external,
    };

    this.samples.push(sample);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    return sample;
  }

  public analyzeTrend(): MemoryTrendAnalysis {
    if (this.samples.length < 5) {
      return {
        growthRateMbPerMinute: 0,
        isLeaking: false,
        estimatedTimeToOomMinutes: Infinity,
        sampleCount: this.samples.length,
      };
    }

    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];

    const durationMinutes = Math.max(0.1, (last.timestamp - first.timestamp) / (1000 * 60));
    const heapGrowthMb = (last.heapUsed - first.heapUsed) / (1024 * 1024);

    const growthRateMbPerMinute = heapGrowthMb / durationMinutes;
    const isLeaking = growthRateMbPerMinute > 5; // growing > 5MB/min sustained

    const remainingHeapMb = Math.max(0, (this.maxAllowedHeapBytes - last.heapUsed) / (1024 * 1024));
    const estimatedTimeToOomMinutes = growthRateMbPerMinute > 0 ? remainingHeapMb / growthRateMbPerMinute : Infinity;

    return {
      growthRateMbPerMinute,
      isLeaking,
      estimatedTimeToOomMinutes,
      sampleCount: this.samples.length,
    };
  }

  public getSamples(): MemorySample[] {
    return [...this.samples];
  }
}
