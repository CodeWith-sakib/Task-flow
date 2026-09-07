/**
 * Checkpoint Storage Adapter.
 * Handles serialization, cryptographic CRC32 verification, and persistence
 * of incremental workflow checkpoints and snapshot compaction records.
 */

import * as zlib from 'zlib';
import { StateDeltaFrame } from './IncrementalCheckpointer';

export interface SerializedCheckpoint {
  workflowId: string;
  version: number;
  compressedPayload: Buffer;
  crc32: number;
}

export class CheckpointStorageAdapter {
  private checkpoints = new Map<string, SerializedCheckpoint>();

  public saveCheckpoint(workflowId: string, version: number, frames: StateDeltaFrame[]): SerializedCheckpoint {
    const jsonStr = JSON.stringify(frames);
    const compressed = zlib.gzipSync(Buffer.from(jsonStr, 'utf-8'));
    const crc32 = this.computeCrc32(compressed);

    const record: SerializedCheckpoint = {
      workflowId,
      version,
      compressedPayload: compressed,
      crc32,
    };

    this.checkpoints.set(`${workflowId}:${version}`, record);
    return record;
  }

  public loadCheckpoint(workflowId: string, version: number): StateDeltaFrame[] | null {
    const record = this.checkpoints.get(`${workflowId}:${version}`);
    if (!record) return null;

    const computedCrc = this.computeCrc32(record.compressedPayload);
    if (computedCrc !== record.crc32) {
      throw new Error(`CRC32 integrity error on checkpoint ${workflowId}:${version}`);
    }

    const decompressed = zlib.gunzipSync(record.compressedPayload);
    return JSON.parse(decompressed.toString('utf-8'));
  }

  private computeCrc32(buf: Buffer): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      let byte = buf[i];
      crc = (crc >>> 8) ^ this.crcTable[(crc ^ byte) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  private crcTable: Uint32Array = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c;
    }
    return table;
  })();
}
