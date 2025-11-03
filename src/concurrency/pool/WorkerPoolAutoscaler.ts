import { WorkerPoolMetrics } from '../types';

export class WorkerPoolAutoscaler {
  private minConcurrency: number;
  private maxConcurrency: number;
  private targetQueueDepthPerWorker: number;

  constructor(
    minConcurrency: number = 2,
    maxConcurrency: number = 20,
    targetQueueDepthPerWorker: number = 5
  ) {
    this.minConcurrency = minConcurrency;
    this.maxConcurrency = maxConcurrency;
    this.targetQueueDepthPerWorker = targetQueueDepthPerWorker;
  }

  evaluate(metrics: WorkerPoolMetrics): { targetConcurrency: number; shouldScale: boolean } {
    const { queueDepth, currentConcurrency, activeWorkers } = metrics;

    let desired = Math.ceil(queueDepth / this.targetQueueDepthPerWorker);
    // Always maintain capacity for currently running tasks
    desired = Math.max(desired, activeWorkers);

    // Bound within min and max
    desired = Math.max(this.minConcurrency, Math.min(this.maxConcurrency, desired));

    return {
      targetConcurrency: desired,
      shouldScale: desired !== currentConcurrency,
    };
  }
}
