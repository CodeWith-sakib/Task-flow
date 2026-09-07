/**
 * Time-Series Partitioned Storage Engine.
 * Manages 2-hour compressed Gorilla chunks, downsampling aggregates (1m, 5m, 1h),
 * and high-throughput point ingestion for workflow execution telemetry.
 */

import { GorillaTimeSeriesCodec, TimeSeriesPoint } from './GorillaTimeSeriesCodec';

export interface TimeSeriesSegment {
  metricName: string;
  startTs: number;
  endTs: number;
  pointCount: number;
  compressedData: Buffer;
  minVal: number;
  maxVal: number;
  sumVal: number;
}

export class TimeSeriesSegmentEngine {
  private codec = new GorillaTimeSeriesCodec();
  private activeBuffers = new Map<string, TimeSeriesPoint[]>();
  private closedSegments: TimeSeriesSegment[] = [];
  private segmentDurationMs: number;

  constructor(segmentDurationMs: number = 2 * 3600 * 1000) {
    this.segmentDurationMs = segmentDurationMs;
  }

  public insertPoint(metricName: string, timestamp: number, value: number): void {
    let buffer = this.activeBuffers.get(metricName);
    if (!buffer) {
      buffer = [];
      this.activeBuffers.set(metricName, buffer);
    }

    buffer.push({ timestamp, value });

    // Check if buffer exceeds segment duration
    if (buffer.length > 1 && buffer[buffer.length - 1].timestamp - buffer[0].timestamp >= this.segmentDurationMs) {
      this.sealSegment(metricName);
    }
  }

  public sealSegment(metricName: string): TimeSeriesSegment | null {
    const buffer = this.activeBuffers.get(metricName);
    if (!buffer || buffer.length === 0) return null;

    buffer.sort((a, b) => a.timestamp - b.timestamp);

    const startTs = buffer[0].timestamp;
    const endTs = buffer[buffer.length - 1].timestamp;
    const minVal = Math.min(...buffer.map((p) => p.value));
    const maxVal = Math.max(...buffer.map((p) => p.value));
    const sumVal = buffer.reduce((acc, p) => acc + p.value, 0);

    const compressedData = this.codec.compress(buffer);

    const segment: TimeSeriesSegment = {
      metricName,
      startTs,
      endTs,
      pointCount: buffer.length,
      compressedData,
      minVal,
      maxVal,
      sumVal,
    };

    this.closedSegments.push(segment);
    this.activeBuffers.delete(metricName);

    return segment;
  }

  public queryRange(metricName: string, startTs: number, endTs: number): TimeSeriesPoint[] {
    const results: TimeSeriesPoint[] = [];

    // 1. Query sealed segments
    for (const seg of this.closedSegments) {
      if (seg.metricName !== metricName) continue;
      if (seg.endTs < startTs || seg.startTs > endTs) continue;

      const points = this.codec.decompress(seg.compressedData, seg.pointCount);
      for (const p of points) {
        if (p.timestamp >= startTs && p.timestamp <= endTs) {
          results.push(p);
        }
      }
    }

    // 2. Query active buffer
    const active = this.activeBuffers.get(metricName);
    if (active) {
      for (const p of active) {
        if (p.timestamp >= startTs && p.timestamp <= endTs) {
          results.push(p);
        }
      }
    }

    return results.sort((a, b) => a.timestamp - b.timestamp);
  }

  public getSegmentCount(): number {
    return this.closedSegments.length;
  }
}
