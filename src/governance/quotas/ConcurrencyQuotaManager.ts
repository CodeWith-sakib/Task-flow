export interface TenantConcurrencyLimit {
  maxConcurrentTasks: number;
  maxQueuedTasks: number;
}

/**
 * ConcurrencyQuotaManager enforces hard task concurrency limits and queue depth ceilings per tenant.
 */
export class ConcurrencyQuotaManager {
  private activeTasks: Map<string, Set<string>> = new Map(); // tenantId -> taskIds
  private limits: Map<string, TenantConcurrencyLimit> = new Map();
  private defaultLimit: TenantConcurrencyLimit;

  constructor(defaultLimit?: TenantConcurrencyLimit) {
    this.defaultLimit = defaultLimit ?? { maxConcurrentTasks: 20, maxQueuedTasks: 500 };
  }

  public setLimit(tenantId: string, limit: TenantConcurrencyLimit): void {
    this.limits.set(tenantId, limit);
  }

  public tryAcquire(tenantId: string, taskId: string): boolean {
    const limit = this.limits.get(tenantId) || this.defaultLimit;
    let set = this.activeTasks.get(tenantId);
    if (!set) {
      set = new Set();
      this.activeTasks.set(tenantId, set);
    }

    if (set.size >= limit.maxConcurrentTasks) {
      return false; // Concurrency limit reached
    }

    set.add(taskId);
    return true;
  }

  public release(tenantId: string, taskId: string): void {
    this.activeTasks.get(tenantId)?.delete(taskId);
  }

  public getActiveCount(tenantId: string): number {
    return this.activeTasks.get(tenantId)?.size ?? 0;
  }

  public getUtilization(tenantId: string): number {
    const limit = this.limits.get(tenantId) || this.defaultLimit;
    const active = this.getActiveCount(tenantId);
    return limit.maxConcurrentTasks > 0 ? (active / limit.maxConcurrentTasks) * 100 : 0;
  }
}
