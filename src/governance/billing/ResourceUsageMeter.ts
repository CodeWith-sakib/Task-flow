export interface TenantUsageSummary {
  tenantId: string;
  totalTaskExecutions: number;
  totalCpuExecutionMs: number;
  totalMemoryByteSeconds: number;
  totalNetworkBytesIngress: number;
  totalNetworkBytesEgress: number;
  totalStorageBytes: number;
  billingPeriodStart: number;
  billingPeriodEnd: number;
}

/**
 * ResourceUsageMeter aggregates multidimensional resource consumption telemetry
 * for usage-based cloud billing and tenant quota accounting.
 */
export class ResourceUsageMeter {
  private summaries: Map<string, TenantUsageSummary> = new Map();

  public recordExecution(
    tenantId: string,
    cpuExecutionMs: number,
    memoryBytes: number,
    networkIngressBytes: number = 0,
    networkEgressBytes: number = 0
  ): void {
    const summary = this.getOrCreateSummary(tenantId);
    summary.totalTaskExecutions++;
    summary.totalCpuExecutionMs += cpuExecutionMs;
    summary.totalMemoryByteSeconds += (memoryBytes * (cpuExecutionMs / 1000));
    summary.totalNetworkBytesIngress += networkIngressBytes;
    summary.totalNetworkBytesEgress += networkEgressBytes;
    summary.billingPeriodEnd = Date.now();
  }

  public updateStorageFootprint(tenantId: string, totalBytes: number): void {
    const summary = this.getOrCreateSummary(tenantId);
    summary.totalStorageBytes = totalBytes;
  }

  public getSummary(tenantId: string): TenantUsageSummary | null {
    const summary = this.summaries.get(tenantId);
    return summary ? { ...summary } : null;
  }

  public resetBillingPeriod(tenantId: string): TenantUsageSummary | null {
    const existing = this.summaries.get(tenantId);
    if (!existing) return null;

    const snapshot = { ...existing };
    this.summaries.set(tenantId, {
      tenantId,
      totalTaskExecutions: 0,
      totalCpuExecutionMs: 0,
      totalMemoryByteSeconds: 0,
      totalNetworkBytesIngress: 0,
      totalNetworkBytesEgress: 0,
      totalStorageBytes: existing.totalStorageBytes,
      billingPeriodStart: Date.now(),
      billingPeriodEnd: Date.now()
    });

    return snapshot;
  }

  private getOrCreateSummary(tenantId: string): TenantUsageSummary {
    let summary = this.summaries.get(tenantId);
    if (!summary) {
      const now = Date.now();
      summary = {
        tenantId,
        totalTaskExecutions: 0,
        totalCpuExecutionMs: 0,
        totalMemoryByteSeconds: 0,
        totalNetworkBytesIngress: 0,
        totalNetworkBytesEgress: 0,
        totalStorageBytes: 0,
        billingPeriodStart: now,
        billingPeriodEnd: now
      };
      this.summaries.set(tenantId, summary);
    }
    return summary;
  }
}
