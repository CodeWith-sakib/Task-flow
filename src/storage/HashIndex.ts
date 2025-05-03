export class HashIndex<T> {
  private buckets: Map<number, Array<{ key: string; value: T }>> = new Map();
  private numBuckets: number;

  constructor(numBuckets: number = 64) {
    this.numBuckets = numBuckets;
  }

  private hash(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % this.numBuckets;
  }

  public set(key: string, value: T): void {
    const b = this.hash(key);
    let list = this.buckets.get(b);
    if (!list) {
      list = [];
      this.buckets.set(b, list);
    }
    const idx = list.findIndex(item => item.key === key);
    if (idx >= 0) {
      list[idx].value = value;
    } else {
      list.push({ key, value });
    }
  }

  public get(key: string): T | undefined {
    const b = this.hash(key);
    const list = this.buckets.get(b);
    if (!list) return undefined;
    const found = list.find(item => item.key === key);
    return found ? found.value : undefined;
  }

  public delete(key: string): boolean {
    const b = this.hash(key);
    const list = this.buckets.get(b);
    if (!list) return false;
    const idx = list.findIndex(item => item.key === key);
    if (idx >= 0) {
      list.splice(idx, 1);
      return true;
    }
    return false;
  }
}
