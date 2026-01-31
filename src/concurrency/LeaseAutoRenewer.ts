export class LeaseAutoRenewer {
  private activeLeases: Map<string, number> = new Map(); // leaseId -> expiryTimestamp

  public trackLease(leaseId: string, ttlMs: number): void {
    this.activeLeases.set(leaseId, Date.now() + ttlMs);
  }

  public renewLease(leaseId: string, ttlMs: number): boolean {
    if (this.activeLeases.has(leaseId)) {
      this.activeLeases.set(leaseId, Date.now() + ttlMs);
      return true;
    }
    return false;
  }

  public stopTracking(leaseId: string): void {
    this.activeLeases.delete(leaseId);
  }

  public isHealthy(leaseId: string, now: number = Date.now()): boolean {
    const expiry = this.activeLeases.get(leaseId);
    return expiry !== undefined && expiry > now;
  }
}
