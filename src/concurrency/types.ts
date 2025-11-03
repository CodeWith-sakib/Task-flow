export interface Lease {
  key: string;
  holderId: string;
  fenceToken: number;
  acquiredAt: Date;
  expiresAt: Date;
  renewCount: number;
}

export interface RateLimiterOptions {
  capacity: number;
  refillRatePerSec: number;
  initialTokens?: number;
}

export interface WorkerPoolMetrics {
  currentConcurrency: number;
  minConcurrency: number;
  maxConcurrency: number;
  queueDepth: number;
  activeWorkers: number;
  averageTaskDurationMs: number;
}
