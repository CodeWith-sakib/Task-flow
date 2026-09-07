/**
 * WAL Checkpoint Coordinator.
 * Coordinates periodic fuzzy checkpointing, flushing in-memory dirty tables,
 * taking snapshot metadata, and pruning obsolete WAL segments.
 */

import { SegmentedWALManager } from './SegmentedWALManager';

export interface CheckpointInfo {
  checkpointId: string;
  lsn: number;
  timestamp: number;
  activeTransactions: number[];
}

export class WALCheckpointCoordinator {
  private walManager: SegmentedWALManager;
  private lastCheckpoint: CheckpointInfo | null = null;
  private checkpointHistory: CheckpointInfo[] = [];

  constructor(walManager: SegmentedWALManager) {
    this.walManager = walManager;
  }

  public async triggerCheckpoint(activeTxIds: number[] = []): Promise<CheckpointInfo> {
    const lsn = this.walManager.append(0, 'CHECKPOINT');

    const checkpoint: CheckpointInfo = {
      checkpointId: `chk-${Date.now()}-${lsn}`,
      lsn,
      timestamp: Date.now(),
      activeTransactions: [...activeTxIds],
    };

    this.lastCheckpoint = checkpoint;
    this.checkpointHistory.push(checkpoint);

    // Prune closed segments older than checkpoint LSN
    this.walManager.truncateBeforeLsn(lsn);

    return checkpoint;
  }

  public getLastCheckpoint(): CheckpointInfo | null {
    return this.lastCheckpoint;
  }

  public getHistory(): CheckpointInfo[] {
    return [...this.checkpointHistory];
  }
}
