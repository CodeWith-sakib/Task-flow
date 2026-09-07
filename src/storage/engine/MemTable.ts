import { EntryType, IIterator, StorageRecord } from './types';
import { SkipList } from './SkipList';

export interface MemTableStats {
  recordCount: number;
  byteSize: number;
  capacityBytes: number;
  utilizationPct: number;
}

/**
 * MemTable wraps an in-memory SkipList with concurrency controls,
 * byte size bounds, flush readiness detection, and sequence number filtering.
 */
export class MemTable<V = any> {
  private skipList: SkipList<V>;
  private capacityBytes: number;
  private isReadOnly: boolean = false;

  constructor(capacityBytes: number = 4 * 1024 * 1024) { // Default 4MB
    this.capacityBytes = capacityBytes;
    this.skipList = new SkipList<V>();
  }

  public put(key: string, value: V, sequence: number, timestamp: number = Date.now()): void {
    if (this.isReadOnly) {
      throw new Error('Cannot write to read-only MemTable');
    }

    const record: StorageRecord<V> = {
      key,
      value,
      sequence,
      type: EntryType.PUT,
      timestamp
    };

    this.skipList.insert(record);
  }

  public delete(key: string, sequence: number, timestamp: number = Date.now()): void {
    if (this.isReadOnly) {
      throw new Error('Cannot write to read-only MemTable');
    }

    const record: StorageRecord<V> = {
      key,
      value: null,
      sequence,
      type: EntryType.DELETE,
      timestamp
    };

    this.skipList.insert(record);
  }

  public get(key: string, maxSequence: number = Number.MAX_SAFE_INTEGER): StorageRecord<V> | null {
    return this.skipList.find(key, maxSequence);
  }

  public iterator(): IIterator<string, StorageRecord<V>> {
    return this.skipList.iterator();
  }

  public isFull(): boolean {
    return this.skipList.byteSize() >= this.capacityBytes;
  }

  public freeze(): void {
    this.isReadOnly = true;
  }

  public isFrozen(): boolean {
    return this.isReadOnly;
  }

  public getStats(): MemTableStats {
    const byteSize = this.skipList.byteSize();
    return {
      recordCount: this.skipList.size(),
      byteSize,
      capacityBytes: this.capacityBytes,
      utilizationPct: this.capacityBytes > 0 ? (byteSize / this.capacityBytes) * 100 : 0
    };
  }

  public clear(): void {
    this.skipList.clear();
    this.isReadOnly = false;
  }
}
