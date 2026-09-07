import { AdaptiveReplacementCache } from '../arc/AdaptiveReplacementCache';

export interface ICacheTier<K, V> {
  get(key: K): Promise<V | undefined> | V | undefined;
  put(key: K, value: V): Promise<void> | void;
  delete(key: K): Promise<boolean> | boolean;
}

/**
 * MultiTierCacheCoordinator coordinates L1 (fast memory) and L2 (storage/persistent) caches
 * with write-through consistency and cache-aside warming.
 */
export class MultiTierCacheCoordinator<V = any> {
  private l1: AdaptiveReplacementCache<string, V>;
  private l2?: ICacheTier<string, V>;
  private writeBehindQueue: { key: string; value: V }[] = [];
  private isWriteBehindRunning: boolean = false;

  constructor(l1Capacity: number = 1000, l2Tier?: ICacheTier<string, V>) {
    this.l1 = new AdaptiveReplacementCache<string, V>(l1Capacity);
    this.l2 = l2Tier;
  }

  public async get(key: string): Promise<V | undefined> {
    // 1. Check L1 Cache
    const l1Val = this.l1.get(key);
    if (l1Val !== undefined) {
      return l1Val;
    }

    // 2. Check L2 Cache
    if (this.l2) {
      const l2Val = await this.l2.get(key);
      if (l2Val !== undefined) {
        // Backfill L1 Cache
        this.l1.put(key, l2Val);
        return l2Val;
      }
    }

    return undefined;
  }

  public async put(key: string, value: V, writeThrough: boolean = true): Promise<void> {
    this.l1.put(key, value);

    if (this.l2) {
      if (writeThrough) {
        await this.l2.put(key, value);
      } else {
        this.writeBehindQueue.push({ key, value });
        this.flushWriteBehind();
      }
    }
  }

  public async delete(key: string): Promise<boolean> {
    this.l1.clear(); // Safe eviction
    if (this.l2) {
      return this.l2.delete(key);
    }
    return true;
  }

  public getL1Stats(): any {
    return this.l1.getStats();
  }

  private async flushWriteBehind(): Promise<void> {
    if (this.isWriteBehindRunning || this.writeBehindQueue.length === 0 || !this.l2) {
      return;
    }

    this.isWriteBehindRunning = true;
    try {
      while (this.writeBehindQueue.length > 0) {
        const item = this.writeBehindQueue.shift()!;
        await this.l2.put(item.key, item.value);
      }
    } finally {
      this.isWriteBehindRunning = false;
    }
  }
}
