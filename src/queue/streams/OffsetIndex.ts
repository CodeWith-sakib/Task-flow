import { Offset } from './types';

export interface IndexEntry {
  offset: Offset;
  position: number;
}

/**
 * OffsetIndex maps logical message offsets to physical byte offsets in the segment log file
 * using an 8-byte entry format (uint32 offset_delta + uint32 physical_pos) and binary search.
 */
export class OffsetIndex {
  private baseOffset: Offset;
  private entries: IndexEntry[] = [];
  private maxEntries: number;

  constructor(baseOffset: Offset, maxEntries: number = 10000) {
    this.baseOffset = baseOffset;
    this.maxEntries = maxEntries;
  }

  public append(offset: Offset, position: number): void {
    if (this.entries.length >= this.maxEntries) {
      throw new Error(`OffsetIndex full: reached max entries ${this.maxEntries}`);
    }
    if (offset < this.baseOffset) {
      throw new Error(`Offset ${offset} is smaller than baseOffset ${this.baseOffset}`);
    }
    if (this.entries.length > 0 && offset <= this.entries[this.entries.length - 1].offset) {
      throw new Error(`Non-monotonic offset: ${offset} <= last offset ${this.entries[this.entries.length - 1].offset}`);
    }

    this.entries.push({ offset, position });
  }

  public lookup(targetOffset: Offset): IndexEntry | null {
    if (this.entries.length === 0) return null;
    if (targetOffset < this.entries[0].offset) return null;

    let left = 0;
    let right = this.entries.length - 1;
    let result = this.entries[0];

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const entry = this.entries[mid];

      if (entry.offset <= targetOffset) {
        result = entry;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return result;
  }

  public isFull(): boolean {
    return this.entries.length >= this.maxEntries;
  }

  public size(): number {
    return this.entries.length;
  }

  public getBaseOffset(): Offset {
    return this.baseOffset;
  }

  public getLastOffset(): Offset {
    return this.entries.length > 0 ? this.entries[this.entries.length - 1].offset : this.baseOffset;
  }
}
