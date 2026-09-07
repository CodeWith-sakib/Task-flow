/**
 * Raft Snapshot & State Machine Compaction Manager.
 * Handles taking point-in-time state machine snapshots, truncating compacted log entries,
 * chunking snapshots for network streaming, and installing snapshots on lagging peers.
 */

export interface RaftSnapshotMetadata {
  snapshotId: string;
  lastIncludedIndex: number;
  lastIncludedTerm: number;
  createdAt: number;
  byteSize: number;
}

export interface SnapshotChunk {
  snapshotId: string;
  chunkIndex: number;
  totalChunks: number;
  data: Buffer;
  isDone: boolean;
}

export class SnapshotManager {
  private latestSnapshot: { metadata: RaftSnapshotMetadata; data: Buffer } | null = null;
  private chunkSize: number;

  constructor(chunkSize: number = 65536) {
    this.chunkSize = chunkSize;
  }

  public createSnapshot(
    lastIncludedIndex: number,
    lastIncludedTerm: number,
    stateMachineData: Buffer | string
  ): RaftSnapshotMetadata {
    const dataBuf = Buffer.isBuffer(stateMachineData) ? stateMachineData : Buffer.from(stateMachineData, 'utf-8');

    const metadata: RaftSnapshotMetadata = {
      snapshotId: `snap-${lastIncludedTerm}-${lastIncludedIndex}-${Date.now()}`,
      lastIncludedIndex,
      lastIncludedTerm,
      createdAt: Date.now(),
      byteSize: dataBuf.length,
    };

    this.latestSnapshot = {
      metadata,
      data: dataBuf,
    };

    return metadata;
  }

  public getLatestSnapshot(): { metadata: RaftSnapshotMetadata; data: Buffer } | null {
    return this.latestSnapshot;
  }

  public getSnapshotChunks(snapshotId: string): SnapshotChunk[] {
    if (!this.latestSnapshot || this.latestSnapshot.metadata.snapshotId !== snapshotId) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }

    const data = this.latestSnapshot.data;
    const totalChunks = Math.max(1, Math.ceil(data.length / this.chunkSize));
    const chunks: SnapshotChunk[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.chunkSize;
      const end = Math.min(data.length, start + this.chunkSize);
      const chunkBuf = data.slice(start, end);

      chunks.push({
        snapshotId,
        chunkIndex: i,
        totalChunks,
        data: chunkBuf,
        isDone: i === totalChunks - 1,
      });
    }

    return chunks;
  }

  public assembleChunks(chunks: SnapshotChunk[]): Buffer {
    chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
    const buffers = chunks.map((c) => c.data);
    return Buffer.concat(buffers);
  }
}
