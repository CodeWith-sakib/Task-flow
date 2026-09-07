export interface ResourceVector {
  cpu: number;     // e.g. Cores
  memoryMb: number;// e.g. Megabytes
  ioOps: number;   // e.g. IOPS
}

export interface TenantAllocation {
  tenantId: string;
  allocated: ResourceVector;
  dominantShare: number;
}

export interface TaskResourceRequest {
  taskId: string;
  tenantId: string;
  demand: ResourceVector;
}

/**
 * DominantResourceFairness (DRF) multi-resource fair scheduler allocating cluster resources
 * based on each tenant's dominant resource consumption share relative to total cluster capacity.
 */
export class DominantResourceFairness {
  private totalCapacity: ResourceVector;
  private tenants: Map<string, ResourceVector> = new Map();

  constructor(totalCapacity: ResourceVector) {
    this.totalCapacity = { ...totalCapacity };
  }

  public allocate(request: TaskResourceRequest): boolean {
    const currentAlloc = this.tenants.get(request.tenantId) || { cpu: 0, memoryMb: 0, ioOps: 0 };
    const newAlloc: ResourceVector = {
      cpu: currentAlloc.cpu + request.demand.cpu,
      memoryMb: currentAlloc.memoryMb + request.demand.memoryMb,
      ioOps: currentAlloc.ioOps + request.demand.ioOps
    };

    if (
      newAlloc.cpu > this.totalCapacity.cpu ||
      newAlloc.memoryMb > this.totalCapacity.memoryMb ||
      newAlloc.ioOps > this.totalCapacity.ioOps
    ) {
      return false; // Insufficient cluster capacity
    }

    this.tenants.set(request.tenantId, newAlloc);
    return true;
  }

  public release(tenantId: string, resources: ResourceVector): void {
    const current = this.tenants.get(tenantId);
    if (!current) return;

    current.cpu = Math.max(0, current.cpu - resources.cpu);
    current.memoryMb = Math.max(0, current.memoryMb - resources.memoryMb);
    current.ioOps = Math.max(0, current.ioOps - resources.ioOps);
  }

  public getDominantShare(tenantId: string): number {
    const alloc = this.tenants.get(tenantId);
    if (!alloc) return 0;

    const cpuShare = this.totalCapacity.cpu > 0 ? alloc.cpu / this.totalCapacity.cpu : 0;
    const memShare = this.totalCapacity.memoryMb > 0 ? alloc.memoryMb / this.totalCapacity.memoryMb : 0;
    const ioShare = this.totalCapacity.ioOps > 0 ? alloc.ioOps / this.totalCapacity.ioOps : 0;

    return Math.max(cpuShare, memShare, ioShare);
  }

  public selectNextTenant(activeTenants: string[]): string | null {
    if (activeTenants.length === 0) return null;

    let bestTenant = activeTenants[0];
    let minDominantShare = this.getDominantShare(bestTenant);

    for (let i = 1; i < activeTenants.length; i++) {
      const share = this.getDominantShare(activeTenants[i]);
      if (share < minDominantShare) {
        minDominantShare = share;
        bestTenant = activeTenants[i];
      }
    }

    return bestTenant;
  }

  public getAllocations(): TenantAllocation[] {
    const allocations: TenantAllocation[] = [];
    for (const [tId, alloc] of this.tenants.entries()) {
      allocations.push({
        tenantId: tId,
        allocated: { ...alloc },
        dominantShare: this.getDominantShare(tId)
      });
    }
    return allocations;
  }
}
