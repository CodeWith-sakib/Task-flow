/**
 * FIFO (First-In-First-Out) Time-Series Compaction Coordinator.
 * Manages time-series and append-only workflow log data by dropping entire SSTables
 * once their max record timestamp exceeds the retention TTL threshold.
 */

export interface TimeSeriesSSTable {
  tableId: string;
  minTimestamp: number;
  maxTimestamp: number;
  byteSize: number;
  recordCount: number;
}

export class FifoCompactor {
  private maxTtlMs: number;
  private maxTotalStorageBytes: number;

  constructor(maxTtlMs: number = 7 * 86400000, maxTotalStorageBytes: number = 50 * 1024 * 1024 * 1024) {
    this.maxTtlMs = maxTtlMs;
    this.maxTotalStorageBytes = maxTotalStorageBytes;
  }

  public planCompaction(tables: TimeSeriesSSTable[], now: number = Date.now()): { tablesToDrop: string[]; reason: string } {
    const tablesToDrop: string[] = [];
    const sorted = [...tables].sort((a, b) => a.minTimestamp - b.minTimestamp);

    // 1. Drop tables whose maxTimestamp is older than maxTtlMs
    for (const table of sorted) {
      if (now - table.maxTimestamp > this.maxTtlMs) {
        tablesToDrop.push(table.tableId);
      }
    }

    if (tablesToDrop.length > 0) {
      return {
        tablesToDrop,
        reason: `TTL Expiration: dropped ${tablesToDrop.length} expired tables`,
      };
    }

    // 2. If storage quota is exceeded, drop oldest tables until within quota
    let totalSize = sorted.reduce((acc, t) => acc + t.byteSize, 0);
    let idx = 0;

    while (totalSize > this.maxTotalStorageBytes && idx < sorted.length) {
      const oldest = sorted[idx++];
      tablesToDrop.push(oldest.tableId);
      totalSize -= oldest.byteSize;
    }

    if (tablesToDrop.length > 0) {
      return {
        tablesToDrop,
        reason: `Storage Quota Exceeded: dropped ${tablesToDrop.length} oldest tables to reclaim space`,
      };
    }

    return {
      tablesToDrop: [],
      reason: 'No compaction needed',
    };
  }
}
