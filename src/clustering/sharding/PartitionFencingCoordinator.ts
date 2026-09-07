export interface PartitionFence {
  partitionId: number;
  epoch: number;
  leaderNodeId: string;
  fencedAt: number;
}

/**
 * PartitionFencingCoordinator prevents split-brain partition writes by enforcing epoch fences.
 */
export class PartitionFencingCoordinator {
  private partitionFences: Map<number, PartitionFence> = new Map();

  public acquireLeadership(partitionId: number, leaderNodeId: string): PartitionFence {
    const existing = this.partitionFences.get(partitionId);
    const epoch = existing ? existing.epoch + 1 : 1;

    const fence: PartitionFence = {
      partitionId,
      epoch,
      leaderNodeId,
      fencedAt: Date.now()
    };

    this.partitionFences.set(partitionId, fence);
    return fence;
  }

  public validateWrite(partitionId: number, claimedEpoch: number, writerNodeId: string): boolean {
    const fence = this.partitionFences.get(partitionId);
    if (!fence) return true;

    return fence.epoch === claimedEpoch && fence.leaderNodeId === writerNodeId;
  }

  public getFence(partitionId: number): PartitionFence | undefined {
    return this.partitionFences.get(partitionId);
  }
}
