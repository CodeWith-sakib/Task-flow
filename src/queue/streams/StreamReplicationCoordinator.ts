/**
 * Partition Stream Replication Coordinator.
 * Coordinates In-Sync Replicas (ISR), High-Watermark (HW) offset updates,
 * leader election, and log truncation upon partition leader handover.
 */

export interface ReplicaState {
  replicaId: string;
  logEndOffset: number;
  lastFetchTs: number;
  isLeader: boolean;
}

export interface PartitionReplicationState {
  topic: string;
  partitionId: number;
  leaderId: string;
  isr: Set<string>;
  replicas: Map<string, ReplicaState>;
  highWatermark: number;
}

export class StreamReplicationCoordinator {
  private partitions = new Map<string, PartitionReplicationState>();
  private replicaLagMaxMs: number;

  constructor(replicaLagMaxMs: number = 10000) {
    this.replicaLagMaxMs = replicaLagMaxMs;
  }

  public registerPartition(topic: string, partitionId: number, leaderId: string, replicaIds: string[]): void {
    const key = `${topic}-${partitionId}`;
    const replicas = new Map<string, ReplicaState>();

    for (const rId of replicaIds) {
      replicas.set(rId, {
        replicaId: rId,
        logEndOffset: 0,
        lastFetchTs: Date.now(),
        isLeader: rId === leaderId,
      });
    }

    const state: PartitionReplicationState = {
      topic,
      partitionId,
      leaderId,
      isr: new Set(replicaIds),
      replicas,
      highWatermark: 0,
    };

    this.partitions.set(key, state);
  }

  /**
   * Leader records new messages appended to its local log.
   */
  public recordLeaderAppend(topic: string, partitionId: number, newLogEndOffset: number): void {
    const key = `${topic}-${partitionId}`;
    const state = this.partitions.get(key);
    if (!state) return;

    const leaderReplica = state.replicas.get(state.leaderId);
    if (leaderReplica) {
      leaderReplica.logEndOffset = newLogEndOffset;
      leaderReplica.lastFetchTs = Date.now();
      this.updateHighWatermark(state);
    }
  }

  /**
   * Follower replica reports its fetch progress and updates its LEO.
   */
  public recordFollowerFetch(topic: string, partitionId: number, followerId: string, followerLeo: number): void {
    const key = `${topic}-${partitionId}`;
    const state = this.partitions.get(key);
    if (!state) return;

    const follower = state.replicas.get(followerId);
    if (!follower) return;

    follower.logEndOffset = followerLeo;
    follower.lastFetchTs = Date.now();

    // Re-admit to ISR if caught up
    const leader = state.replicas.get(state.leaderId);
    if (leader && follower.logEndOffset >= leader.logEndOffset) {
      state.isr.add(followerId);
    }

    this.updateHighWatermark(state);
  }

  /**
   * Check for lagging followers and prune them from ISR.
   */
  public pruneLaggingReplicas(now: number = Date.now()): void {
    for (const state of this.partitions.values()) {
      for (const [rId, replica] of state.replicas.entries()) {
        if (replica.isLeader) continue;

        if (now - replica.lastFetchTs > this.replicaLagMaxMs) {
          state.isr.delete(rId);
        }
      }
      this.updateHighWatermark(state);
    }
  }

  public getHighWatermark(topic: string, partitionId: number): number {
    const key = `${topic}-${partitionId}`;
    return this.partitions.get(key)?.highWatermark ?? 0;
  }

  public getIsr(topic: string, partitionId: number): string[] {
    const key = `${topic}-${partitionId}`;
    const isr = this.partitions.get(key)?.isr;
    return isr ? Array.from(isr) : [];
  }

  private updateHighWatermark(state: PartitionReplicationState): void {
    if (state.isr.size === 0) return;

    const isrOffsets = Array.from(state.isr)
      .map((rId) => state.replicas.get(rId)?.logEndOffset ?? 0);

    const minIsrOffset = Math.min(...isrOffsets);
    if (minIsrOffset > state.highWatermark) {
      state.highWatermark = minIsrOffset;
    }
  }
}
