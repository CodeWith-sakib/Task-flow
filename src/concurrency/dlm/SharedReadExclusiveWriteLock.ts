export interface LockLease {
  resource: string;
  type: 'READ' | 'WRITE';
  ownerId: string;
  expiresAt: number;
}

/**
 * SharedReadExclusiveWriteLock coordinates distributed reader-writer locks across resources.
 */
export class SharedReadExclusiveWriteLock {
  private readLeases: Map<string, LockLease[]> = new Map();
  private writeLease: Map<string, LockLease> = new Map();

  public acquireRead(resource: string, ownerId: string, ttlMs: number = 10000): LockLease | null {
    const now = Date.now();
    this.cleanExpired(resource);

    const writeLock = this.writeLease.get(resource);
    if (writeLock && writeLock.expiresAt > now && writeLock.ownerId !== ownerId) {
      return null;
    }

    const lease: LockLease = {
      resource,
      type: 'READ',
      ownerId,
      expiresAt: now + ttlMs
    };

    let leases = this.readLeases.get(resource);
    if (!leases) {
      leases = [];
      this.readLeases.set(resource, leases);
    }
    leases.push(lease);

    return lease;
  }

  public acquireWrite(resource: string, ownerId: string, ttlMs: number = 10000): LockLease | null {
    const now = Date.now();
    this.cleanExpired(resource);

    const writeLock = this.writeLease.get(resource);
    if (writeLock && writeLock.expiresAt > now && writeLock.ownerId !== ownerId) {
      return null;
    }

    const readers = this.readLeases.get(resource) || [];
    if (readers.some(r => r.ownerId !== ownerId && r.expiresAt > now)) {
      return null;
    }

    const lease: LockLease = {
      resource,
      type: 'WRITE',
      ownerId,
      expiresAt: now + ttlMs
    };

    this.writeLease.set(resource, lease);
    return lease;
  }

  public release(resource: string, ownerId: string): void {
    const writeLock = this.writeLease.get(resource);
    if (writeLock && writeLock.ownerId === ownerId) {
      this.writeLease.delete(resource);
    }

    const readers = this.readLeases.get(resource);
    if (readers) {
      this.readLeases.set(resource, readers.filter(r => r.ownerId !== ownerId));
    }
  }

  private cleanExpired(resource: string): void {
    const now = Date.now();
    const writeLock = this.writeLease.get(resource);
    if (writeLock && writeLock.expiresAt <= now) {
      this.writeLease.delete(resource);
    }

    const readers = this.readLeases.get(resource);
    if (readers) {
      this.readLeases.set(resource, readers.filter(r => r.expiresAt > now));
    }
  }
}
