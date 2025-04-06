export class TieredCacheManager<T> {
  private l1: Map<string, T> = new Map();
  private l2: Map<string, T> = new Map();
  private l1Capacity: number;

  constructor(l1Capacity: number = 50) {
    this.l1Capacity = l1Capacity;
  }

  public get(key: string): T | undefined {
    if (this.l1.has(key)) {
      return this.l1.get(key);
    }
    if (this.l2.has(key)) {
      const val = this.l2.get(key)!;
      // promote to L1
      this.putL1(key, val);
      return val;
    }
    return undefined;
  }

  public put(key: string, value: T): void {
    this.putL1(key, value);
    this.l2.set(key, value);
  }

  private putL1(key: string, value: T): void {
    if (this.l1.size >= this.l1Capacity) {
      const oldestKey = this.l1.keys().next().value;
      if (oldestKey) this.l1.delete(oldestKey);
    }
    this.l1.set(key, value);
  }

  public has(key: string): boolean {
    return this.l1.has(key) || this.l2.has(key);
  }
}
