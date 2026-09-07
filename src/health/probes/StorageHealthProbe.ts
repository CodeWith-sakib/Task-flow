export interface StorageHealthReport {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  memtableUtilizationPct: number;
  sstableCount: number;
  freeDiskSpaceBytes?: number;
  message?: string;
  checkedAt: number;
}

/**
 * StorageHealthProbe inspects LSM-tree storage internals, memory usage, and compaction backlog.
 */
export class StorageHealthProbe {
  private memtableLimitBytes: number;
  private maxSstableThreshold: number;

  constructor(memtableLimitBytes: number = 64 * 1024 * 1024, maxSstableThreshold: number = 500) {
    this.memtableLimitBytes = memtableLimitBytes;
    this.maxSstableThreshold = maxSstableThreshold;
  }

  public checkHealth(stats: { memtableBytes: number; totalSstables: number }): StorageHealthReport {
    const memtablePct = (stats.memtableBytes / this.memtableLimitBytes) * 100;
    let status: StorageHealthReport['status'] = 'HEALTHY';
    let message = 'Storage engine operating within normal parameters';

    if (memtablePct >= 95 || stats.totalSstables >= this.maxSstableThreshold * 1.5) {
      status = 'UNHEALTHY';
      message = `Critical storage saturation: MemTable ${memtablePct.toFixed(1)}%, SSTables ${stats.totalSstables}`;
    } else if (memtablePct >= 80 || stats.totalSstables >= this.maxSstableThreshold) {
      status = 'DEGRADED';
      message = `Elevated storage pressure: MemTable ${memtablePct.toFixed(1)}%, SSTables ${stats.totalSstables}`;
    }

    return {
      status,
      memtableUtilizationPct: memtablePct,
      sstableCount: stats.totalSstables,
      message,
      checkedAt: Date.now()
    };
  }
}
