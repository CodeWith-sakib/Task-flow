export interface SSTableEntry<T = unknown> {
  key: string;
  value: T;
  timestamp: number;
}

export class SSTableReader<T = unknown> {
  private entries: SSTableEntry<T>[];

  constructor(entries: SSTableEntry<T>[]) {
    this.entries = [...entries].sort((a, b) => a.key.localeCompare(b.key));
  }

  public get(key: string): T | undefined {
    let low = 0;
    let high = this.entries.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const cmp = this.entries[mid].key.localeCompare(key);
      if (cmp === 0) {
        return this.entries[mid].value;
      } else if (cmp < 0) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return undefined;
  }

  public scanRange(minKey: string, maxKey: string): SSTableEntry<T>[] {
    return this.entries.filter(e => e.key >= minKey && e.key <= maxKey);
  }

  public count(): number {
    return this.entries.length;
  }

  public getMinKey(): string | undefined {
    return this.entries.length > 0 ? this.entries[0].key : undefined;
  }

  public getMaxKey(): string | undefined {
    return this.entries.length > 0 ? this.entries[this.entries.length - 1].key : undefined;
  }
}
