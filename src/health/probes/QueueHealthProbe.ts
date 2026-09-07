export interface QueueHealthReport {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  queueDepth: number;
  consumerLag: number;
  dlqCount: number;
  backpressureActive: boolean;
  message?: string;
  checkedAt: number;
}

/**
 * QueueHealthProbe monitors distributed stream queues, backpressure states, and consumer lag.
 */
export class QueueHealthProbe {
  private maxAcceptableLag: number;
  private maxQueueDepth: number;

  constructor(maxAcceptableLag: number = 1000, maxQueueDepth: number = 5000) {
    this.maxAcceptableLag = maxAcceptableLag;
    this.maxQueueDepth = maxQueueDepth;
  }

  public checkHealth(stats: {
    queueDepth: number;
    consumerLag: number;
    dlqCount: number;
    backpressureActive: boolean;
  }): QueueHealthReport {
    let status: QueueHealthReport['status'] = 'HEALTHY';
    let message = 'Queue streams operating nominally';

    if (stats.backpressureActive || stats.consumerLag >= this.maxAcceptableLag * 2 || stats.queueDepth >= this.maxQueueDepth) {
      status = 'UNHEALTHY';
      message = `Severe queue congestion: lag=${stats.consumerLag}, depth=${stats.queueDepth}, backpressure=${stats.backpressureActive}`;
    } else if (stats.consumerLag >= this.maxAcceptableLag || stats.dlqCount > 100) {
      status = 'DEGRADED';
      message = `Elevated consumer lag: lag=${stats.consumerLag}, dlqCount=${stats.dlqCount}`;
    }

    return {
      status,
      queueDepth: stats.queueDepth,
      consumerLag: stats.consumerLag,
      dlqCount: stats.dlqCount,
      backpressureActive: stats.backpressureActive,
      message,
      checkedAt: Date.now()
    };
  }
}
