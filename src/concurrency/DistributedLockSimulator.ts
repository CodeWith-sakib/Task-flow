export class DistributedLockSimulator {
  private locks: Map<string, { owner: string; expiresAt: number; fencingToken: number }> = new Map();
  private tokenSeq: number = 0;

  public tryLock(resource: string, owner: string, ttlMs: number): { success: boolean; token?: number } {
    const now = Date.now();
    const existing = this.locks.get(resource);

    if (existing && existing.expiresAt > now) {
      if (existing.owner === owner) {
        existing.expiresAt = now + ttlMs;
        return { success: true, token: existing.fencingToken };
      }
      return { success: false };
    }

    const token = ++this.tokenSeq;
    this.locks.set(resource, { owner, expiresAt: now + ttlMs, fencingToken: token });
    return { success: true, token };
  }

  public unlock(resource: string, owner: string): boolean {
    const existing = this.locks.get(resource);
    if (!existing || existing.owner !== owner) return false;
    this.locks.delete(resource);
    return true;
  }
}
