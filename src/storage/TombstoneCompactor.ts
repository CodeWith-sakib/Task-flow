export interface CompactableRecord {
  key: string;
  isTombstone: boolean;
  timestamp: number;
}

export class TombstoneCompactor {
  private retentionMs: number;

  constructor(retentionMs: number = 86400000) {
    this.retentionMs = retentionMs;
  }

  public compact<T extends CompactableRecord>(records: T[], now: number = Date.now()): { retained: T[]; purgedCount: number } {
    const retained: T[] = [];
    let purgedCount = 0;

    for (const record of records) {
      if (record.isTombstone) {
        const age = now - record.timestamp;
        if (age >= this.retentionMs) {
          purgedCount++;
          continue;
        }
      }
      retained.push(record);
    }

    return { retained, purgedCount };
  }

  public shouldPurge(record: CompactableRecord, now: number = Date.now()): boolean {
    if (!record.isTombstone) return false;
    return (now - record.timestamp) >= this.retentionMs;
  }
}
