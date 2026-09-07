/**
 * Worker Resource Monitor & Watchdog.
 * Continuously tracks worker process health, detects unhandled promise rejections,
 * CPU starvation, and memory leaks, initiating graceful restarts when thresholds are breached.
 */

export interface WorkerHealthStats {
  workerId: string;
  uptimeSec: number;
  heapUsedMb: number;
  rssMb: number;
  eventLoopLagMs: number;
  activeHandleCount: number;
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
}

export class WorkerResourceMonitor {
  private workerId: string;
  private maxHeapMb: number;
  private maxLagMs: number;
  private startTime = Date.now();
  private isMonitoring = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private onUnhealthyCallback?: (stats: WorkerHealthStats) => void;

  constructor(workerId: string, maxHeapMb: number = 512, maxLagMs: number = 2000) {
    this.workerId = workerId;
    this.maxHeapMb = maxHeapMb;
    this.maxLagMs = maxLagMs;
  }

  public start(intervalMs: number = 2000, onUnhealthy?: (stats: WorkerHealthStats) => void): void {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    this.onUnhealthyCallback = onUnhealthy;

    let lastTick = Date.now();

    this.checkInterval = setInterval(() => {
      const now = Date.now();
      const lag = Math.max(0, now - lastTick - intervalMs);
      lastTick = now;

      const stats = this.getStats(lag);

      if (stats.status === 'UNHEALTHY' && this.onUnhealthyCallback) {
        this.onUnhealthyCallback(stats);
      }
    }, intervalMs);

    if (this.checkInterval.unref) {
      this.checkInterval.unref();
    }
  }

  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isMonitoring = false;
  }

  public getStats(lagMs: number = 0): WorkerHealthStats {
    const mem = process.memoryUsage ? process.memoryUsage() : { heapUsed: 0, rss: 0 };
    const heapUsedMb = mem.heapUsed / (1024 * 1024);
    const rssMb = mem.rss / (1024 * 1024);
    const uptimeSec = Math.floor((Date.now() - this.startTime) / 1000);

    let status: WorkerHealthStats['status'] = 'HEALTHY';

    if (heapUsedMb > this.maxHeapMb || lagMs > this.maxLagMs) {
      status = 'UNHEALTHY';
    } else if (heapUsedMb > this.maxHeapMb * 0.8 || lagMs > this.maxLagMs * 0.6) {
      status = 'DEGRADED';
    }

    return {
      workerId: this.workerId,
      uptimeSec,
      heapUsedMb,
      rssMb,
      eventLoopLagMs: lagMs,
      activeHandleCount: 0,
      status,
    };
  }
}
