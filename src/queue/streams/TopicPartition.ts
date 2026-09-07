import { Offset, PartitionId, StreamRecord, TopicName } from './types';
import { PartitionSegment } from './PartitionSegment';

/**
 * TopicPartition represents a partitioned commit log maintaining active and sealed segments,
 * high watermarks, LSO (Log Start Offset), and LEO (Log End Offset).
 */
export class TopicPartition {
  public readonly topic: TopicName;
  public readonly partitionId: PartitionId;
  private segments: PartitionSegment[] = [];
  private activeSegment: PartitionSegment;
  private nextOffset: Offset = 0;
  private highWatermark: Offset = 0;
  private segmentMaxBytes: number;

  constructor(topic: TopicName, partitionId: PartitionId, segmentMaxBytes: number = 10 * 1024 * 1024) {
    this.topic = topic;
    this.partitionId = partitionId;
    this.segmentMaxBytes = segmentMaxBytes;
    this.activeSegment = new PartitionSegment(0, segmentMaxBytes);
    this.segments.push(this.activeSegment);
  }

  public append(key: string | undefined, value: any, headers?: Record<string, string>): StreamRecord {
    if (this.activeSegment.isFull()) {
      this.rollSegment();
    }

    const offset = this.nextOffset++;
    const record: StreamRecord = {
      topic: this.topic,
      partition: this.partitionId,
      offset,
      key,
      value,
      timestamp: Date.now(),
      headers
    };

    this.activeSegment.append(record);
    this.highWatermark = offset;
    return record;
  }

  public read(fromOffset: Offset, maxCount: number = 100): StreamRecord[] {
    const results: StreamRecord[] = [];
    for (const segment of this.segments) {
      if (results.length >= maxCount) break;
      const records = segment.read(fromOffset + results.length, maxCount - results.length);
      results.push(...records);
    }
    return results;
  }

  public getLogEndOffset(): Offset {
    return this.nextOffset;
  }

  public getLogStartOffset(): Offset {
    return this.segments.length > 0 ? this.segments[0].baseOffset : 0;
  }

  public getHighWatermark(): Offset {
    return this.highWatermark;
  }

  public updateHighWatermark(hw: Offset): void {
    this.highWatermark = Math.min(Math.max(this.highWatermark, hw), this.nextOffset - 1);
  }

  public getSegmentCount(): number {
    return this.segments.length;
  }

  private rollSegment(): void {
    const newBaseOffset = this.nextOffset;
    this.activeSegment = new PartitionSegment(newBaseOffset, this.segmentMaxBytes);
    this.segments.push(this.activeSegment);
  }
}
