export class FileLockCoordinator {
  private activeLocks: Map<string, { ownerId: string; acquiredAt: number; ttlMs: number }> = new Map();

  public tryAcquire(resourcePath: string, ownerId: string, ttlMs: number = 30000): boolean {
    const now = Date.now();
    const existing = this.activeLocks.get(resourcePath);

    if (existing) {
      if (now - existing.acquiredAt < existing.ttlMs) {
        if (existing.ownerId === ownerId) {
          // Re-entrant renewal
          existing.acquiredAt = now;
          existing.ttlMs = ttlMs;
          return true;
        }
        return false;
      }
    }

    this.activeLocks.set(resourcePath, { ownerId, acquiredAt: now, ttlMs });
    return true;
  }

  public release(resourcePath: string, ownerId: string): boolean {
    const existing = this.activeLocks.get(resourcePath);
    if (!existing || existing.ownerId !== ownerId) {
      return false;
    }
    this.activeLocks.delete(resourcePath);
    return true;
  }

  public isLocked(resourcePath: string): boolean {
    const existing = this.activeLocks.get(resourcePath);
    if (!existing) return false;
    if (Date.now() - existing.acquiredAt >= existing.ttlMs) {
      this.activeLocks.delete(resourcePath);
      return false;
    }
    return true;
  }
}
