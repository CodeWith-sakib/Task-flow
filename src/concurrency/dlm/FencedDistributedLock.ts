export interface FencedLockToken {
  resource: string;
  fencingToken: number;
  ownerId: string;
  acquiredAt: number;
  expiresAt: number;
}

/**
 * FencedDistributedLock issues strictly monotonically increasing fencing tokens (Martin Kleppmann pattern)
 * to guard against out-of-order writes caused by GC pauses or network delays.
 */
export class FencedDistributedLock {
  private resourceCounters: Map<string, number> = new Map();
  private activeLocks: Map<string, FencedLockToken> = new Map();

  public acquire(resource: string, ownerId: string, leaseDurationMs: number = 30000): FencedLockToken | null {
    const now = Date.now();
    const existing = this.activeLocks.get(resource);

    if (existing && existing.expiresAt > now && existing.ownerId !== ownerId) {
      return null; // Lock held by another owner
    }

    const currentCounter = (this.resourceCounters.get(resource) || 0) + 1;
    this.resourceCounters.set(resource, currentCounter);

    const token: FencedLockToken = {
      resource,
      fencingToken: currentCounter,
      ownerId,
      acquiredAt: now,
      expiresAt: now + leaseDurationMs
    };

    this.activeLocks.set(resource, token);
    return token;
  }

  public release(resource: string, ownerId: string): boolean {
    const lock = this.activeLocks.get(resource);
    if (!lock || lock.ownerId !== ownerId) {
      return false;
    }

    this.activeLocks.delete(resource);
    return true;
  }

  public validateFencingToken(resource: string, token: number): boolean {
    const latest = this.resourceCounters.get(resource) || 0;
    return token >= latest;
  }
}
