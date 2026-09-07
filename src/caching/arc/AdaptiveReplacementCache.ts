/**
 * AdaptiveReplacementCache (ARC) implements Megiddo & Modha's self-tuning cache algorithm.
 * Dynamically balances recency (T1) and frequency (T2) using ghost caches (B1, B2)
 * and an adaptive tuning target parameter p.
 */
export class AdaptiveReplacementCache<K, V> {
  private capacity: number;
  private p: number = 0; // Target size for T1

  private t1: Map<K, V> = new Map(); // Recent items in cache
  private t2: Map<K, V> = new Map(); // Frequent items in cache
  private b1: Set<K> = new Set();    // Ghost cache for recency
  private b2: Set<K> = new Set();    // Ghost cache for frequency

  private hits: number = 0;
  private misses: number = 0;

  constructor(capacity: number = 1000) {
    this.capacity = Math.max(1, capacity);
  }

  public get(key: K): V | undefined {
    // Case 1: Hit in T1 or T2 -> Move to MRU of T2
    if (this.t1.has(key)) {
      const val = this.t1.get(key)!;
      this.t1.delete(key);
      this.t2.set(key, val);
      this.hits++;
      return val;
    }

    if (this.t2.has(key)) {
      const val = this.t2.get(key)!;
      this.t2.delete(key);
      this.t2.set(key, val);
      this.hits++;
      return val;
    }

    this.misses++;
    return undefined;
  }

  public put(key: K, value: V): void {
    // Case 1: Key is already in T1 or T2
    if (this.t1.has(key)) {
      this.t1.delete(key);
      this.t2.set(key, value);
      return;
    }
    if (this.t2.has(key)) {
      this.t2.delete(key);
      this.t2.set(key, value);
      return;
    }

    // Case 2: Key is in ghost cache B1 (Recency was favored)
    if (this.b1.has(key)) {
      const delta = this.b1.size >= this.b2.size ? 1 : this.b2.size / this.b1.size;
      this.p = Math.min(this.capacity, this.p + delta);
      this.replace(false);
      this.b1.delete(key);
      this.t2.set(key, value);
      return;
    }

    // Case 3: Key is in ghost cache B2 (Frequency was favored)
    if (this.b2.has(key)) {
      const delta = this.b2.size >= this.b1.size ? 1 : this.b1.size / this.b2.size;
      this.p = Math.max(0, this.p - delta);
      this.replace(true);
      this.b2.delete(key);
      this.t2.set(key, value);
      return;
    }

    // Case 4: Complete cache miss (neither in T1, T2, B1, B2)
    const l1Size = this.t1.size + this.b1.size;
    if (l1Size === this.capacity) {
      if (this.t1.size < this.capacity) {
        const oldestB1 = this.b1.keys().next().value;
        if (oldestB1 !== undefined) this.b1.delete(oldestB1);
        this.replace(false);
      } else {
        const oldestT1 = this.t1.keys().next().value;
        if (oldestT1 !== undefined) this.t1.delete(oldestT1);
      }
    } else if (l1Size < this.capacity) {
      const totalSize = this.t1.size + this.t2.size + this.b1.size + this.b2.size;
      if (totalSize >= 2 * this.capacity) {
        if (this.b2.size > 0) {
          const oldestB2 = this.b2.keys().next().value;
          if (oldestB2 !== undefined) this.b2.delete(oldestB2);
        } else if (this.b1.size > 0) {
          const oldestB1 = this.b1.keys().next().value;
          if (oldestB1 !== undefined) this.b1.delete(oldestB1);
        }
      }
      this.replace(false);
    }

    this.t1.set(key, value);
  }

  public size(): number {
    return this.t1.size + this.t2.size;
  }

  public getStats(): { hits: number; misses: number; hitRatio: number; p: number; size: number } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRatio: total > 0 ? this.hits / total : 0,
      p: this.p,
      size: this.size()
    };
  }

  public clear(): void {
    this.t1.clear();
    this.t2.clear();
    this.b1.clear();
    this.b2.clear();
    this.p = 0;
    this.hits = 0;
    this.misses = 0;
  }

  private replace(b2Hit: boolean): void {
    if (
      this.t1.size > 0 &&
      ((this.t1.size > this.p) || (b2Hit && this.t1.size === Math.round(this.p)))
    ) {
      const oldestT1 = this.t1.keys().next().value;
      if (oldestT1 !== undefined) {
        this.t1.delete(oldestT1);
        this.b1.add(oldestT1);
      }
    } else if (this.t2.size > 0) {
      const oldestT2 = this.t2.keys().next().value;
      if (oldestT2 !== undefined) {
        this.t2.delete(oldestT2);
        this.b2.add(oldestT2);
      }
    }
  }
}
