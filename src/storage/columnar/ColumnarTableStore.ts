/**
 * Hybrid Row-Buffer & Columnar Segment Table Store.
 * Ingests rows into an in-memory buffer and flushes full segments to compressed columnar chunks,
 * providing fast write ingestion with vectorized columnar query scans.
 */

import { ColumnarChunkWriter, ColumnDataType, ColumnChunk } from './ColumnarChunkWriter';
import { ColumnarChunkReader } from './ColumnarChunkReader';

export interface ColumnarSegment {
  segmentId: number;
  rowCount: number;
  columns: Map<string, ColumnChunk>;
}

export class ColumnarTableStore {
  private schema: Record<string, ColumnDataType>;
  private segmentSize: number;
  private rowBuffer: Record<string, any>[] = [];
  private segments: ColumnarSegment[] = [];
  private nextSegmentId = 1;
  private writer = new ColumnarChunkWriter();
  private reader = new ColumnarChunkReader();

  constructor(schema: Record<string, ColumnDataType>, segmentSize: number = 1000) {
    this.schema = schema;
    this.segmentSize = segmentSize;
  }

  public insertRow(row: Record<string, any>): void {
    this.rowBuffer.push({ ...row });
    if (this.rowBuffer.length >= this.segmentSize) {
      this.flushSegment();
    }
  }

  public insertBatch(rows: Record<string, any>[]): void {
    for (const r of rows) {
      this.insertRow(r);
    }
  }

  public flushSegment(): void {
    if (this.rowBuffer.length === 0) return;

    const rowCount = this.rowBuffer.length;
    const chunkMap = this.writer.writeChunk(this.rowBuffer, this.schema);

    const segment: ColumnarSegment = {
      segmentId: this.nextSegmentId++,
      rowCount,
      columns: chunkMap,
    };

    this.segments.push(segment);
    this.rowBuffer = [];
  }

  /**
   * Scans specified columns across all flushed columnar segments and buffered rows.
   */
  public scan(projectedColumns: string[] = []): Record<string, any>[] {
    const results: Record<string, any>[] = [];
    const colsToProject = projectedColumns.length > 0 ? projectedColumns : Object.keys(this.schema);

    // 1. Scan flushed columnar segments
    for (const seg of this.segments) {
      const decodedCols = new Map<string, any[]>();

      for (const col of colsToProject) {
        const chunk = seg.columns.get(col);
        if (chunk) {
          decodedCols.set(col, this.reader.decodeColumn(chunk));
        }
      }

      for (let i = 0; i < seg.rowCount; i++) {
        const row: Record<string, any> = {};
        for (const col of colsToProject) {
          const colData = decodedCols.get(col);
          row[col] = colData ? colData[i] : null;
        }
        results.push(row);
      }
    }

    // 2. Scan active row buffer
    for (const r of this.rowBuffer) {
      const row: Record<string, any> = {};
      for (const col of colsToProject) {
        row[col] = r[col] ?? null;
      }
      results.push(row);
    }

    return results;
  }

  public getSegmentCount(): number {
    return this.segments.length;
  }

  public getTotalRowCount(): number {
    const flushedRows = this.segments.reduce((acc, s) => acc + s.rowCount, 0);
    return flushedRows + this.rowBuffer.length;
  }
}
