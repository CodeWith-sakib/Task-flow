import { Lease } from '../types';

export class LeaseManager {
  private leases: Map<string, Lease> = new Map();
  private fenceCounter: number = 0;

  acquireLease(key: string, holderId: string, ttlMs: number = 5000): Lease | null {
    const now = new Date();
    const existing = this.leases.get(key);

    if (existing && existing.expiresAt.getTime() > now.getTime()) {
      // Lease is held and not expired
      if (existing.holderId === holderId) {
        // Re-entrant acquisition: update expiry and return
        existing.expiresAt = new Date(now.getTime() + ttlMs);
        return existing;
      }
      return null;
    }

    // Allocate new monotonically increasing fence token
    this.fenceCounter++;
    const lease: Lease = {
      key,
      holderId,
      fenceToken: this.fenceCounter,
      acquiredAt: now,
      expiresAt: new Date(now.getTime() + ttlMs),
      renewCount: 0,
    };

    this.leases.set(key, lease);
    return lease;
  }

  renewLease(
    key: string,
    holderId: string,
    fenceToken: number,
    extendMs: number = 5000
  ): boolean {
    const now = new Date();
    const existing = this.leases.get(key);

    if (!existing) return false;
    if (existing.holderId !== holderId) return false;
    if (existing.fenceToken !== fenceToken) return false;
    if (existing.expiresAt.getTime() <= now.getTime()) return false; // Already expired

    existing.expiresAt = new Date(now.getTime() + extendMs);
    existing.renewCount++;
    return true;
  }

  releaseLease(key: string, holderId: string, fenceToken: number): boolean {
    const existing = this.leases.get(key);
    if (!existing) return false;
    if (existing.holderId !== holderId || existing.fenceToken !== fenceToken) {
      return false;
    }

    this.leases.delete(key);
    return true;
  }

  isLeaseValid(key: string, fenceToken: number): boolean {
    const now = new Date();
    const existing = this.leases.get(key);
    if (!existing) return false;
    if (existing.fenceToken !== fenceToken) return false;
    return existing.expiresAt.getTime() > now.getTime();
  }

  getActiveLeases(): Lease[] {
    const now = new Date();
    return Array.from(this.leases.values()).filter(l => l.expiresAt.getTime() > now.getTime());
  }

  clear(): void {
    this.leases.clear();
  }
}
