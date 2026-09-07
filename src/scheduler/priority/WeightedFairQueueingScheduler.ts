/**
 * Weighted Fair Queueing (WFQ) / Generalized Processor Sharing Task Scheduler.
 * Allocates execution service proportional to tenant weights, tracking virtual time
 * and packet/task virtual finish times to ensure max-min fairness without starvation.
 */

export interface WFQTask {
  id: string;
  tenantId: string;
  estimatedCost: number; // e.g. weight / duration
  virtualFinishTime: number;
  enqueuedAt: number;
  payload: any;
}

export class WeightedFairQueueingScheduler {
  private tenantWeights = new Map<string, number>();
  private tenantQueues = new Map<string, WFQTask[]>();
  private tenantVirtualTimes = new Map<string, number>();
  private globalVirtualTime = 0;

  public setTenantWeight(tenantId: string, weight: number): void {
    if (weight <= 0) throw new Error('Tenant weight must be positive');
    this.tenantWeights.set(tenantId, weight);
  }

  public enqueue(tenantId: string, taskId: string, estimatedCost: number = 1, payload?: any): WFQTask {
    const weight = this.tenantWeights.get(tenantId) || 1.0;
    const lastFinishTime = this.tenantVirtualTimes.get(tenantId) || this.globalVirtualTime;

    const startVirtualTime = Math.max(lastFinishTime, this.globalVirtualTime);
    const virtualFinishTime = startVirtualTime + estimatedCost / weight;

    this.tenantVirtualTimes.set(tenantId, virtualFinishTime);

    const task: WFQTask = {
      id: taskId,
      tenantId,
      estimatedCost,
      virtualFinishTime,
      enqueuedAt: Date.now(),
      payload,
    };

    let queue = this.tenantQueues.get(tenantId);
    if (!queue) {
      queue = [];
      this.tenantQueues.set(tenantId, queue);
    }
    queue.push(task);

    return task;
  }

  public pollNext(): WFQTask | null {
    let bestTenantId: string | null = null;
    let earliestFinishTime = Infinity;

    for (const [tId, queue] of this.tenantQueues.entries()) {
      if (queue.length > 0) {
        const head = queue[0];
        if (head.virtualFinishTime < earliestFinishTime) {
          earliestFinishTime = head.virtualFinishTime;
          bestTenantId = tId;
        }
      }
    }

    if (!bestTenantId) return null;

    const chosenQueue = this.tenantQueues.get(bestTenantId)!;
    const task = chosenQueue.shift()!;

    // Advance global virtual time
    this.globalVirtualTime = Math.max(this.globalVirtualTime, task.virtualFinishTime);

    return task;
  }

  public size(): number {
    let count = 0;
    for (const q of this.tenantQueues.values()) {
      count += q.length;
    }
    return count;
  }
}
