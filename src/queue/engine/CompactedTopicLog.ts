export interface CompactedRecord<V = any> {
  key: string;
  value: V | null; // null represents tombstone
  offset: number;
  timestamp: number;
}

/**
 * CompactedTopicLog maintains an append-only topic log with background log compaction,
 * retaining only the most recent non-tombstone record for each key.
 */
export class CompactedTopicLog<V = any> {
  private log: CompactedRecord<V>[] = [];
  private keyIndex: Map<string, number> = new Map(); // key -> latest offset
  private nextOffset: number = 0;
  private minCompactionLag: number;

  constructor(minCompactionLag: number = 50) {
    this.minCompactionLag = minCompactionLag;
  }

  public append(key: string, value: V | null): number {
    const offset = this.nextOffset++;
    const record: CompactedRecord<V> = {
      key,
      value,
      offset,
      timestamp: Date.now()
    };

    this.log.push(record);
    this.keyIndex.set(key, offset);

    if (this.log.length >= this.minCompactionLag * 2) {
      this.compact();
    }

    return offset;
  }

  public get(key: string): V | null {
    const latestOffset = this.keyIndex.get(key);
    if (latestOffset === undefined) return null;

    const record = this.log.find(r => r.offset === latestOffset);
    return record ? record.value : null;
  }

  public compact(): number {
    const activeKeys = new Map<string, CompactedRecord<V>>();

    for (const record of this.log) {
      if (record.value === null) {
        // Tombstone deletes key
        activeKeys.delete(record.key);
      } else {
        activeKeys.set(record.key, record);
      }
    }

    const beforeCount = this.log.length;
    this.log = Array.from(activeKeys.values()).sort((a, b) => a.offset - b.offset);

    // Rebuild index
    this.keyIndex.clear();
    for (const r of this.log) {
      this.keyIndex.set(r.key, r.offset);
    }

    return beforeCount - this.log.length;
  }

  public readFrom(startOffset: number, limit: number = 100): CompactedRecord<V>[] {
    return this.log.filter(r => r.offset >= startOffset).slice(0, limit);
  }

  public size(): number {
    return this.log.length;
  }
}
