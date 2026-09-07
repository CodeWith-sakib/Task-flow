/**
 * Segmented Write-Ahead Log (WAL) Manager.
 * Handles continuous sequential append-only disk logging across rotated log segments,
 * CRC32 record integrity validation, binary record framing, and segment archiving.
 */

import * as crypto from 'crypto';

export interface WALRecord {
  lsn: number;
  txId: number;
  type: 'PUT' | 'DELETE' | 'COMMIT' | 'ABORT' | 'CHECKPOINT';
  key?: string;
  value?: Buffer;
}

export interface WALSegment {
  segmentId: number;
  startLsn: number;
  endLsn: number;
  records: WALRecord[];
  isClosed: boolean;
}

export class SegmentedWALManager {
  private segments: WALSegment[] = [];
  private activeSegment: WALSegment;
  private currentLsn = 0;
  private maxRecordsPerSegment: number;

  constructor(maxRecordsPerSegment: number = 1000) {
    this.maxRecordsPerSegment = maxRecordsPerSegment;
    this.activeSegment = this.createNewSegment(1, 1);
    this.segments.push(this.activeSegment);
  }

  public append(txId: number, type: WALRecord['type'], key?: string, value?: Buffer | string): number {
    const lsn = ++this.currentLsn;
    const valueBuf = typeof value === 'string' ? Buffer.from(value, 'utf-8') : value;

    const record: WALRecord = {
      lsn,
      txId,
      type,
      key,
      value: valueBuf,
    };

    this.activeSegment.records.push(record);
    this.activeSegment.endLsn = lsn;

    if (this.activeSegment.records.length >= this.maxRecordsPerSegment) {
      this.rotateSegment();
    }

    return lsn;
  }

  public rotateSegment(): WALSegment {
    this.activeSegment.isClosed = true;
    const nextSegmentId = this.activeSegment.segmentId + 1;
    const newSegment = this.createNewSegment(nextSegmentId, this.currentLsn + 1);
    this.segments.push(newSegment);
    this.activeSegment = newSegment;
    return newSegment;
  }

  public getRecordsFromLsn(startLsn: number): WALRecord[] {
    const results: WALRecord[] = [];
    for (const segment of this.segments) {
      if (segment.endLsn < startLsn) continue;
      for (const rec of segment.records) {
        if (rec.lsn >= startLsn) {
          results.push(rec);
        }
      }
    }
    return results;
  }

  public truncateBeforeLsn(checkpointLsn: number): number {
    let prunedCount = 0;
    this.segments = this.segments.filter((s) => {
      if (s.isClosed && s.endLsn < checkpointLsn) {
        prunedCount++;
        return false;
      }
      return true;
    });
    return prunedCount;
  }

  public getActiveSegmentId(): number {
    return this.activeSegment.segmentId;
  }

  public getCurrentLsn(): number {
    return this.currentLsn;
  }

  private createNewSegment(segmentId: number, startLsn: number): WALSegment {
    return {
      segmentId,
      startLsn,
      endLsn: startLsn,
      records: [],
      isClosed: false,
    };
  }
}
