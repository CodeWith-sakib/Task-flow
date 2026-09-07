import { IStateMachine, LogEntry, LogIndex, Term } from './types';
import { RaftLog } from './RaftLog';

export interface ReplicationStats {
  appliedCount: number;
  lastAppliedIndex: LogIndex;
  lastAppliedTerm: Term;
  snapshotsTaken: number;
  snapshotsRestored: number;
}

/**
 * StateMachineReplicator drives the deterministic execution of committed Raft log
 * entries onto the application state machine with snapshot management.
 */
export class StateMachineReplicator<T = any, R = any> {
  private stateMachine: IStateMachine<T, R>;
  private log: RaftLog<T>;
  private snapshotThreshold: number;
  private isApplying: boolean = false;
  private pendingPromises: Map<LogIndex, { resolve: (val: R) => void; reject: (err: any) => void }> = new Map();
  private stats: ReplicationStats = {
    appliedCount: 0,
    lastAppliedIndex: 0,
    lastAppliedTerm: 0,
    snapshotsTaken: 0,
    snapshotsRestored: 0
  };

  constructor(stateMachine: IStateMachine<T, R>, log: RaftLog<T>, snapshotThreshold: number = 1000) {
    this.stateMachine = stateMachine;
    this.log = log;
    this.snapshotThreshold = snapshotThreshold;
    this.stats.lastAppliedIndex = stateMachine.getLastAppliedIndex();
    this.log.setLastApplied(this.stats.lastAppliedIndex);
  }

  public registerPendingCommand(index: LogIndex): Promise<R> {
    return new Promise((resolve, reject) => {
      this.pendingPromises.set(index, { resolve, reject });
    });
  }

  public async applyCommittedEntries(): Promise<number> {
    if (this.isApplying) return 0;
    this.isApplying = true;

    let applied = 0;
    try {
      while (this.log.getLastApplied() < this.log.getCommitIndex()) {
        const nextIndex = this.log.getLastApplied() + 1;
        const entry = this.log.getEntry(nextIndex);

        if (!entry) {
          break;
        }

        let result: R | undefined;
        let applyError: any;
        try {
          result = await this.stateMachine.apply(entry);
          applied++;
          this.stats.appliedCount++;
          this.stats.lastAppliedIndex = entry.index;
          this.stats.lastAppliedTerm = entry.term;
          this.log.setLastApplied(entry.index);
        } catch (err) {
          applyError = err;
        }

        const pending = this.pendingPromises.get(entry.index);
        if (pending) {
          this.pendingPromises.delete(entry.index);
          if (applyError) {
            pending.reject(applyError);
          } else {
            pending.resolve(result as R);
          }
        }

        if (this.snapshotThreshold > 0 && this.stats.appliedCount % this.snapshotThreshold === 0) {
          await this.triggerSnapshot(entry.index, entry.term);
        }
      }
    } finally {
      this.isApplying = false;
    }

    return applied;
  }

  public async triggerSnapshot(index: LogIndex, term: Term): Promise<Buffer> {
    const snapshotData = await this.stateMachine.createSnapshot();
    this.log.compact(index, term);
    this.stats.snapshotsTaken++;
    return snapshotData;
  }

  public async restoreSnapshot(snapshotData: Buffer, lastIndex: LogIndex, lastTerm: Term): Promise<void> {
    await this.stateMachine.restoreSnapshot(snapshotData, lastIndex, lastTerm);
    this.log.compact(lastIndex, lastTerm);
    this.log.setLastApplied(lastIndex);
    this.stats.lastAppliedIndex = lastIndex;
    this.stats.lastAppliedTerm = lastTerm;
    this.stats.snapshotsRestored++;

    for (const [idx, promise] of this.pendingPromises) {
      if (idx <= lastIndex) {
        this.pendingPromises.delete(idx);
        promise.reject(new Error(`Command at index ${idx} overwritten by snapshot restoration`));
      }
    }
  }

  public getStats(): ReplicationStats {
    return { ...this.stats };
  }

  public rejectAllPending(reason: Error): void {
    for (const [, promise] of this.pendingPromises) {
      promise.reject(reason);
    }
    this.pendingPromises.clear();
  }
}
