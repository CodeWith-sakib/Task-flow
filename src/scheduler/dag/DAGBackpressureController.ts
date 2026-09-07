/**
 * DAG Pipeline Backpressure Controller.
 * Monitors downstream buffer sizes and in-flight step memory,
 * throttling upstream workflow source nodes when backpressure watermarks are exceeded.
 */

export interface BackpressureMetrics {
  stageId: string;
  bufferDepth: number;
  maxBufferDepth: number;
  memoryUsageBytes: number;
  maxMemoryBytes: number;
  isThrottled: boolean;
}

export class DAGBackpressureController {
  private stageMetrics = new Map<string, BackpressureMetrics>();
  private highWatermarkRatio: number;
  private lowWatermarkRatio: number;

  constructor(highWatermarkRatio: number = 0.8, lowWatermarkRatio: number = 0.4) {
    this.highWatermarkRatio = highWatermarkRatio;
    this.lowWatermarkRatio = lowWatermarkRatio;
  }

  public registerStage(stageId: string, maxBufferDepth: number = 1000, maxMemoryBytes: number = 50 * 1024 * 1024): void {
    this.stageMetrics.set(stageId, {
      stageId,
      bufferDepth: 0,
      maxBufferDepth,
      memoryUsageBytes: 0,
      maxMemoryBytes,
      isThrottled: false,
    });
  }

  public updateMetrics(stageId: string, currentBufferDepth: number, currentMemoryBytes: number): boolean {
    const metrics = this.stageMetrics.get(stageId);
    if (!metrics) return false;

    metrics.bufferDepth = currentBufferDepth;
    metrics.memoryUsageBytes = currentMemoryBytes;

    const bufferRatio = currentBufferDepth / metrics.maxBufferDepth;
    const memoryRatio = currentMemoryBytes / metrics.maxMemoryBytes;
    const maxRatio = Math.max(bufferRatio, memoryRatio);

    if (maxRatio >= this.highWatermarkRatio) {
      metrics.isThrottled = true;
    } else if (maxRatio <= this.lowWatermarkRatio) {
      metrics.isThrottled = false;
    }

    return metrics.isThrottled;
  }

  public shouldThrottle(stageId: string): boolean {
    return this.stageMetrics.get(stageId)?.isThrottled ?? false;
  }

  public getStageMetrics(stageId: string): BackpressureMetrics | undefined {
    return this.stageMetrics.get(stageId);
  }
}
