import { TenantQuota } from '../types';

export class TenantQuotaManager {
  private quotas: Map<string, TenantQuota> = new Map();
  private activeTasks: Map<string, number> = new Map();
  private defaultQuota: TenantQuota = {
    tenantId: 'default',
    maxConcurrentTasks: 10,
    maxDailyTasks: 10000,
    maxPayloadBytes: 1024 * 1024, // 1MB
  };

  setQuota(quota: TenantQuota): void {
    this.quotas.set(quota.tenantId, quota);
  }

  getQuota(tenantId: string): TenantQuota {
    return this.quotas.get(tenantId) ?? { ...this.defaultQuota, tenantId };
  }

  checkAndAcquireConcurrentSlot(tenantId: string): { allowed: boolean; reason?: string } {
    const quota = this.getQuota(tenantId);
    const active = this.activeTasks.get(tenantId) ?? 0;

    if (active >= quota.maxConcurrentTasks) {
      return {
        allowed: false,
        reason: `Tenant '${tenantId}' exceeded max concurrent tasks (${active}/${quota.maxConcurrentTasks})`,
      };
    }

    this.activeTasks.set(tenantId, active + 1);
    return { allowed: true };
  }

  releaseConcurrentSlot(tenantId: string): void {
    const active = this.activeTasks.get(tenantId) ?? 0;
    if (active > 0) {
      this.activeTasks.set(tenantId, active - 1);
    }
  }

  validatePayloadSize(tenantId: string, payloadBytes: number): { allowed: boolean; reason?: string } {
    const quota = this.getQuota(tenantId);
    if (payloadBytes > quota.maxPayloadBytes) {
      return {
        allowed: false,
        reason: `Payload size (${payloadBytes} bytes) exceeds limit (${quota.maxPayloadBytes} bytes)`,
      };
    }
    return { allowed: true };
  }

  getActiveCount(tenantId: string): number {
    return this.activeTasks.get(tenantId) ?? 0;
  }

  clear(): void {
    this.quotas.clear();
    this.activeTasks.clear();
  }
}
