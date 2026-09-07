import { Offset, StreamRecord } from './types';
import { OffsetIndex } from './OffsetIndex';
import { computeCRC32 } from '../../storage/wal/crc32';

/**
 * PartitionSegment stores an immutable append-only chunk of stream records,
 * paired with an OffsetIndex for fast offset lookup.
 */
export class PartitionSegment {
  public readonly baseOffset: Offset;
  public readonly maxBytes: number;
  private index: OffsetIndex;
  private records: StreamRecord[] = [];
  private positions: number[] = [];
  private currentBytes: number = 0;
  private lastIndexOffset: number = 0;
  private indexIntervalBytes: number = 4096;

  constructor(baseOffset: Offset, maxBytes: number = 10 * 1024 * 1024, indexIntervalBytes: number = 4096) {
    this.baseOffset = baseOffset;
    this.maxBytes = maxBytes;
    this.indexIntervalBytes = indexIntervalBytes;
    this.index = new OffsetIndex(baseOffset);
  }

  public append(record: StreamRecord): Offset {
    const rawVal = JSON.stringify(record.value);
    const checksum = computeCRC32(rawVal);
    const enrichedRecord: StreamRecord = {
      ...record,
      checksum
    };

    const recordBytes = Buffer.byteLength(rawVal, 'utf8') + 32;
    const recordPosition = this.currentBytes;

    if (this.currentBytes - this.lastIndexOffset >= this.indexIntervalBytes || this.records.length === 0) {
      this.index.append(enrichedRecord.offset, recordPosition);
      this.lastIndexOffset = this.currentBytes;
    }

    this.records.push(enrichedRecord);
    this.positions.push(recordPosition);
    this.currentBytes += recordBytes;

    return enrichedRecord.offset;
  }

  public read(startOffset: Offset, maxCount: number = 100): StreamRecord[] {
    if (this.records.length === 0) return [];
    const indexEntry = this.index.lookup(startOffset);

    let startIdx = 0;
    if (indexEntry) {
      startIdx = this.records.findIndex(r => r.offset >= startOffset);
      if (startIdx === -1) return [];
    }

    return this.records.slice(startIdx, startIdx + maxCount);
  }

  public getRecordByOffset(offset: Offset): StreamRecord | null {
    const records = this.read(offset, 1);
    return (records.length > 0 && records[0].offset === offset) ? records[0] : null;
  }

  public isFull(): boolean {
    return this.currentBytes >= this.maxBytes || this.index.isFull();
  }

  public sizeBytes(): number {
    return this.currentBytes;
  }

  public recordCount(): number {
    return this.records.length;
  }

  public getNextOffset(): Offset {
    return this.records.length > 0 ? this.records[this.records.length - 1].offset + 1 : this.baseOffset;
  }
}
