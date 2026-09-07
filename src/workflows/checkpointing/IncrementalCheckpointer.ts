/**
 * Incremental Delta-Based Workflow State Checkpointer.
 * Captures only modified state keys/variables (deltas) between execution steps,
 * reconstructing full state on replay by merging sequential delta frames.
 */

export interface StateDeltaFrame {
  checkpointSeq: number;
  timestamp: number;
  mutatedKeys: Record<string, any>;
  deletedKeys: string[];
}

export class IncrementalCheckpointer {
  private baseState: Record<string, any>;
  private deltaFrames: StateDeltaFrame[] = [];
  private lastCapturedSnapshot: Record<string, any>;
  private seqCounter = 0;

  constructor(initialState: Record<string, any> = {}) {
    this.baseState = JSON.parse(JSON.stringify(initialState));
    this.lastCapturedSnapshot = JSON.parse(JSON.stringify(initialState));
  }

  /**
   * Captures diff between current state and previous snapshot.
   */
  public captureCheckpoint(currentState: Record<string, any>): StateDeltaFrame | null {
    const mutatedKeys: Record<string, any> = {};
    const deletedKeys: string[] = [];

    // Find modified/added keys
    for (const [k, v] of Object.entries(currentState)) {
      if (JSON.stringify(this.lastCapturedSnapshot[k]) !== JSON.stringify(v)) {
        mutatedKeys[k] = v;
      }
    }

    // Find deleted keys
    for (const k of Object.keys(this.lastCapturedSnapshot)) {
      if (!(k in currentState)) {
        deletedKeys.push(k);
      }
    }

    if (Object.keys(mutatedKeys).length === 0 && deletedKeys.length === 0) {
      return null; // no change
    }

    const frame: StateDeltaFrame = {
      checkpointSeq: ++this.seqCounter,
      timestamp: Date.now(),
      mutatedKeys,
      deletedKeys,
    };

    this.deltaFrames.push(frame);
    this.lastCapturedSnapshot = JSON.parse(JSON.stringify(currentState));
    return frame;
  }

  /**
   * Reconstructs full state up to a specific checkpoint sequence.
   */
  public restoreState(targetSeq?: number): Record<string, any> {
    const reconstructed: Record<string, any> = JSON.parse(JSON.stringify(this.baseState));

    for (const frame of this.deltaFrames) {
      if (targetSeq !== undefined && frame.checkpointSeq > targetSeq) break;

      for (const [k, v] of Object.entries(frame.mutatedKeys)) {
        reconstructed[k] = v;
      }
      for (const k of frame.deletedKeys) {
        delete reconstructed[k];
      }
    }

    return reconstructed;
  }

  /**
   * Compacts delta frames into a new base state snapshot.
   */
  public compact(): void {
    this.baseState = this.restoreState();
    this.deltaFrames = [];
  }

  public getDeltaFrameCount(): number {
    return this.deltaFrames.length;
  }
}
