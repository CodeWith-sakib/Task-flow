/**
 * Columnar Storage Chunk Reader.
 * Decodes compressed columnar chunks, evaluates predicates directly over min/max statistics
 * and dictionary indices, and projects required columns without scanning unused columns.
 */

import * as zlib from 'zlib';
import { ColumnChunk, ColumnDataType } from './ColumnarChunkWriter';

export class ColumnarChunkReader {
  public decodeColumn(chunk: ColumnChunk): any[] {
    const { metadata, data, dictionary } = chunk;

    if (metadata.type === 'STRING') {
      if (metadata.encoding === 'DICTIONARY' && dictionary) {
        const decompressed = zlib.inflateSync(data);
        const results: any[] = [];
        for (let i = 0; i < metadata.rowCount; i++) {
          const idx = decompressed.readUInt16BE(i * 2);
          if (idx === 0xffff) {
            results.push(null);
          } else {
            results.push(dictionary[idx]);
          }
        }
        return results;
      } else {
        const decompressed = zlib.inflateSync(data);
        return JSON.parse(decompressed.toString('utf-8'));
      }
    }

    if (metadata.type === 'INT32') {
      const decompressed = zlib.inflateSync(data);
      const results: (number | null)[] = [];
      for (let i = 0; i < metadata.rowCount; i++) {
        const v = decompressed.readInt32BE(i * 4);
        if (v === -2147483648) {
          results.push(null);
        } else {
          results.push(v);
        }
      }
      return results;
    }

    if (metadata.type === 'FLOAT64') {
      const decompressed = zlib.inflateSync(data);
      const results: (number | null)[] = [];
      for (let i = 0; i < metadata.rowCount; i++) {
        const v = decompressed.readDoubleBE(i * 8);
        if (isNaN(v)) {
          results.push(null);
        } else {
          results.push(v);
        }
      }
      return results;
    }

    if (metadata.type === 'BOOLEAN') {
      const results: boolean[] = [];
      for (let i = 0; i < metadata.rowCount; i++) {
        const byteIdx = Math.floor(i / 8);
        const bitIdx = i % 8;
        const bit = (data[byteIdx] & (1 << bitIdx)) !== 0;
        results.push(bit);
      }
      return results;
    }

    return [];
  }

  /**
   * Can chunk be skipped based on Min/Max statistics without decompressing?
   */
  public canSkipChunk(chunk: ColumnChunk, op: '=' | '>' | '<' | '>=' | '<=', targetValue: any): boolean {
    const { minVal, maxVal } = chunk.metadata;
    if (minVal === null || maxVal === null || minVal === undefined || maxVal === undefined) {
      return false; // cannot skip
    }

    if (op === '=' && (targetValue < minVal || targetValue > maxVal)) {
      return true; // Skip chunk!
    }
    if (op === '>' && targetValue >= maxVal) {
      return true; // Skip chunk!
    }
    if (op === '<' && targetValue <= minVal) {
      return true; // Skip chunk!
    }
    if (op === '>=' && targetValue > maxVal) {
      return true; // Skip chunk!
    }
    if (op === '<=' && targetValue < minVal) {
      return true; // Skip chunk!
    }

    return false;
  }
}
