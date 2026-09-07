export type TenantId = string;

export interface DRRItem<T = any> {
  id: string;
  tenantId: TenantId;
  cost: number;
  payload: T;
}

interface TenantQueue<T> {
  tenantId: TenantId;
  quantum: number;
  deficit: number;
  items: DRRItem<T>[];
}

/**
 * DeficitRoundRobinScheduler enforces proportional fair-share throughput across multiple competing tenants
 * by allocating quantum credit tokens per round and preventing heavy tasks from starving light tenants.
 */
export class DeficitRoundRobinScheduler<T = any> {
  private queues: Map<TenantId, TenantQueue<T>> = new Map();
  private activeTenantList: TenantId[] = [];
  private currentTenantIdx: number = 0;
  private defaultQuantum: number;

  constructor(defaultQuantum: number = 100) {
    this.defaultQuantum = defaultQuantum;
  }

  public enqueue(item: DRRItem<T>, quantum?: number): void {
    if (!this.queues.has(item.tenantId)) {
      this.queues.set(item.tenantId, {
        tenantId: item.tenantId,
        quantum: quantum ?? this.defaultQuantum,
        deficit: 0,
        items: []
      });
      this.activeTenantList.push(item.tenantId);
    }

    const q = this.queues.get(item.tenantId)!;
    q.items.push(item);
  }

  public dequeue(): DRRItem<T> | null {
    if (this.activeTenantList.length === 0) {
      return null;
    }

    const initialIdx = this.currentTenantIdx;
    let iterations = 0;

    while (iterations < this.activeTenantList.length) {
      const tenantId = this.activeTenantList[this.currentTenantIdx];
      const queue = this.queues.get(tenantId);

      if (!queue || queue.items.length === 0) {
        if (queue) queue.deficit = 0;
        this.advanceTenant();
        iterations++;
        continue;
      }

      // Add quantum to deficit for this round
      queue.deficit += queue.quantum;

      while (queue.items.length > 0) {
        const head = queue.items[0];
        if (head.cost <= queue.deficit) {
          queue.deficit -= head.cost;
          queue.items.shift();
          return head;
        } else {
          // Cannot service head item with current deficit; save deficit and advance to next tenant
          break;
        }
      }

      this.advanceTenant();
      iterations++;
    }

    return null;
  }

  public size(): number {
    let total = 0;
    for (const q of this.queues.values()) {
      total += q.items.length;
    }
    return total;
  }

  public tenantQueueSize(tenantId: TenantId): number {
    return this.queues.get(tenantId)?.items.length ?? 0;
  }

  private advanceTenant(): void {
    this.currentTenantIdx = (this.currentTenantIdx + 1) % this.activeTenantList.length;
  }
}
