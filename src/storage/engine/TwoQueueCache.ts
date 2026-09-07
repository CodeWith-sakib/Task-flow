/**
 * TwoQueueCache (2Q) block cache implementation.
 * Combines A1in (FIFO for newly loaded blocks), A1out (ghost cache for evicted keys),
 * and Am (LRU for frequently accessed hot blocks) to eliminate scan-resistant cache pollution.
 */
export class TwoQueueCache<K, V> {
  private capacity: number;
  private inFifoLimit: number;
  private outGhostLimit: number;

  private a1In: Map<K, V> = new Map();
  private a1Out: Set<K> = new Set();
  private am: Map<K, V> = new Map();

  private hits: number = 0;
  private misses: number = 0;

  constructor(capacity: number = 1000, inFifoRatio: number = 0.25, outGhostRatio: number = 0.5) {
    this.capacity = capacity;
    this.inFifoLimit = Math.max(1, Math.floor(capacity * inFifoRatio));
    this.outGhostLimit = Math.max(1, Math.floor(capacity * outGhostRatio));
  }

  public get(key: K): V | undefined {
    // Check hot LRU (Am)
    if (this.am.has(key)) {
      const val = this.am.get(key)!;
      this.am.delete(key);
      this.am.set(key, val); // Refresh MRU position
      this.hits++;
      return val;
    }

    // Check FIFO (A1in)
    if (this.a1In.has(key)) {
      this.hits++;
      return this.a1In.get(key);
    }

    this.misses++;
    return undefined;
  }

  public put(key: K, value: V): void {
    if (this.am.has(key)) {
      this.am.delete(key);
      this.am.set(key, value);
      return;
    }

    if (this.a1In.has(key)) {
      this.a1In.set(key, value);
      return;
    }

    if (this.a1Out.has(key)) {
      // Re-referenced block promoted to hot LRU (Am)
      this.a1Out.delete(key);
      this.reclaimAm();
      this.am.set(key, value);
      return;
    }

    // New block enters FIFO queue (A1in)
    this.reclaimA1In();
    this.a1In.set(key, value);
  }

  public has(key: K): boolean {
    return this.am.has(key) || this.a1In.has(key);
  }

  public delete(key: K): boolean {
    const deleted = this.am.delete(key) || this.a1In.delete(key);
    this.a1Out.delete(key);
    return deleted;
  }

  public clear(): void {
    this.a1In.clear();
    this.a1Out.clear();
    this.am.clear();
    this.hits = 0;
    this.misses = 0;
  }

  public getStats(): { hits: number; misses: number; hitRatio: number; size: number; capacity: number } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRatio: total > 0 ? this.hits / total : 0,
      size: this.a1In.size + this.am.size,
      capacity: this.capacity
    };
  }

  private reclaimA1In(): void {
    if (this.a1In.size >= this.inFifoLimit) {
      const oldestKey = this.a1In.keys().next().value;
      if (oldestKey !== undefined) {
        this.a1In.delete(oldestKey);
        this.a1Out.add(oldestKey);
        if (this.a1Out.size > this.outGhostLimit) {
          const oldestGhost = this.a1Out.keys().next().value;
          if (oldestGhost !== undefined) {
            this.a1Out.delete(oldestGhost);
          }
        }
      }
    }
  }

  private reclaimAm(): void {
    const totalSize = this.a1In.size + this.am.size;
    if (totalSize >= this.capacity) {
      const oldestKey = this.am.keys().next().value;
      if (oldestKey !== undefined) {
        this.am.delete(oldestKey);
      }
    }
  }
}
