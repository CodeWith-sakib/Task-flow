export interface MemoryStats {
  heapUsedMb: number;
  heapTotalMb: number;
  rssMb: number;
  externalMb: number;
}

export class MemoryWatcher {
  private thresholdMb: number;

  constructor(thresholdMb: number = 512) {
    this.thresholdMb = thresholdMb;
  }

  getMemoryUsage(): MemoryStats {
    const mem = process.memoryUsage();
    return {
      heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
      heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
      rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
      externalMb: Math.round((mem.external / 1024 / 1024) * 100) / 100,
    };
  }

  isMemoryThresholdExceeded(): boolean {
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    return used >= this.thresholdMb;
  }
}
