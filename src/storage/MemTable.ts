export interface MemTableEntry<T = unknown> {
  key: string;
  value: T;
  deleted?: boolean;
  timestamp: number;
}

export class MemTable<T = unknown> {
  private entries: Map<string, MemTableEntry<T>> = new Map();
  private maxByteSize: number;
  private currentByteSize: number = 0;

  constructor(maxByteSize: number = 10 * 1024 * 1024) {
    this.maxByteSize = maxByteSize;
  }

  public set(key: string, value: T): void {
    const serialized = JSON.stringify(value);
    const entrySize = Buffer.byteLength(key, 'utf8') + Buffer.byteLength(serialized, 'utf8');

    const existing = this.entries.get(key);
    if (existing) {
      const oldSize = Buffer.byteLength(key, 'utf8') + Buffer.byteLength(JSON.stringify(existing.value), 'utf8');
      this.currentByteSize -= oldSize;
    }

    const entry: MemTableEntry<T> = {
      key,
      value,
      deleted: false,
      timestamp: Date.now()
    };

    this.entries.set(key, entry);
    this.currentByteSize += entrySize;
  }

  public get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry || entry.deleted) {
      return undefined;
    }
    return entry.value;
  }

  public has(key: string): boolean {
    const entry = this.entries.get(key);
    return !!entry && !entry.deleted;
  }

  public delete(key: string): boolean {
    const existing = this.entries.get(key);
    if (!existing || existing.deleted) {
      return false;
    }

    const entrySize = Buffer.byteLength(key, 'utf8');
    this.entries.set(key, {
      key,
      value: null as unknown as T,
      deleted: true,
      timestamp: Date.now()
    });
    this.currentByteSize += entrySize;
    return true;
  }

  public scan(startKey?: string, endKey?: string): MemTableEntry<T>[] {
    const sortedKeys = Array.from(this.entries.keys()).sort();
    const results: MemTableEntry<T>[] = [];

    for (const key of sortedKeys) {
      if (startKey && key < startKey) continue;
      if (endKey && key > endKey) break;

      const entry = this.entries.get(key);
      if (entry && !entry.deleted) {
        results.push(entry);
      }
    }

    return results;
  }

  public size(): number {
    let count = 0;
    for (const entry of this.entries.values()) {
      if (!entry.deleted) count++;
    }
    return count;
  }

  public getByteSize(): number {
    return this.currentByteSize;
  }

  public isFull(): boolean {
    return this.currentByteSize >= this.maxByteSize;
  }

  public flush(): MemTableEntry<T>[] {
    const entries = this.scan();
    this.entries.clear();
    this.currentByteSize = 0;
    return entries;
  }

  public clear(): void {
    this.entries.clear();
    this.currentByteSize = 0;
  }
}
