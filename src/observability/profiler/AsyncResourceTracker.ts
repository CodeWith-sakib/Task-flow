/**
 * Asynchronous Resource & Event Loop Lag Tracker.
 * Monitors Node.js event loop latency, memory consumption, active handles,
 * and asynchronous task execution overhead.
 */

export interface SystemResourceSnapshot {
  timestamp: number;
  eventLoopLagMs: number;
  heapUsedBytes: number;
  heapTotalBytes: number;
  externalBytes: number;
  rssBytes: number;
  activeAsyncOperations: number;
}

export class AsyncResourceTracker {
  private isTracking = false;
  private intervalTimer: NodeJS.Timeout | null = null;
  private snapshots: SystemResourceSnapshot[] = [];
  private maxSnapshots: number;
  private activeOperationsCount = 0;

  constructor(maxSnapshots: number = 100) {
    this.maxSnapshots = maxSnapshots;
  }

  public start(sampleIntervalMs: number = 1000): void {
    if (this.isTracking) return;
    this.isTracking = true;

    let lastCheck = Date.now();

    this.intervalTimer = setInterval(() => {
      const now = Date.now();
      const lag = Math.max(0, now - lastCheck - sampleIntervalMs);
      lastCheck = now;

      const mem = process.memoryUsage ? process.memoryUsage() : { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 };

      const snapshot: SystemResourceSnapshot = {
        timestamp: now,
        eventLoopLagMs: lag,
        heapUsedBytes: mem.heapUsed,
        heapTotalBytes: mem.heapTotal,
        externalBytes: mem.external,
        rssBytes: mem.rss,
        activeAsyncOperations: this.activeOperationsCount,
      };

      this.recordSnapshot(snapshot);
    }, sampleIntervalMs);

    if (this.intervalTimer.unref) {
      this.intervalTimer.unref();
    }
  }

  public stop(): void {
    if (!this.isTracking) return;
    this.isTracking = false;
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  public trackAsyncOperation<T>(promise: Promise<T>): Promise<T> {
    this.activeOperationsCount++;
    return promise.finally(() => {
      this.activeOperationsCount = Math.max(0, this.activeOperationsCount - 1);
    });
  }

  public getSnapshots(): SystemResourceSnapshot[] {
    return [...this.snapshots];
  }

  public getAverageLagMs(): number {
    if (this.snapshots.length === 0) return 0;
    const sum = this.snapshots.reduce((acc, s) => acc + s.eventLoopLagMs, 0);
    return sum / this.snapshots.length;
  }

  public getMaxHeapUsedBytes(): number {
    if (this.snapshots.length === 0) return 0;
    return this.snapshots.reduce((max, s) => Math.max(max, s.heapUsedBytes), 0);
  }

  private recordSnapshot(snapshot: SystemResourceSnapshot): void {
    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
  }
}
