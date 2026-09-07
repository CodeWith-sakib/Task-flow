import { MurmurHash3 } from '../../utils/MurmurHash3';

export interface VirtualShard {
  shardId: number;
  assignedNodeId: string;
  backupNodeIds: string[];
}

/**
 * VirtualPartitionManager partitions keys across a fixed space of 1024 virtual shards
 * and maps shards to physical cluster nodes.
 */
export class VirtualPartitionManager {
  private totalShards: number;
  private shardMap: Map<number, VirtualShard> = new Map();
  private activeNodes: Set<string> = new Set();

  constructor(totalShards: number = 1024) {
    this.totalShards = totalShards;
  }

  public setNodes(nodeIds: string[]): void {
    this.activeNodes = new Set(nodeIds);
    if (nodeIds.length === 0) return;

    const sortedNodes = [...nodeIds].sort();

    // Round-robin / consistent distribution of virtual shards
    for (let s = 0; s < this.totalShards; s++) {
      const primaryIdx = s % sortedNodes.length;
      const backupIdx = (primaryIdx + 1) % sortedNodes.length;

      this.shardMap.set(s, {
        shardId: s,
        assignedNodeId: sortedNodes[primaryIdx],
        backupNodeIds: sortedNodes.length > 1 ? [sortedNodes[backupIdx]] : []
      });
    }
  }

  public getShardForKey(key: string): VirtualShard {
    const hash = MurmurHash3.hash32(key, 0x5bd1e995);
    const shardId = Math.abs(hash) % this.totalShards;

    const shard = this.shardMap.get(shardId);
    if (!shard) {
      return {
        shardId,
        assignedNodeId: 'localhost',
        backupNodeIds: []
      };
    }

    return shard;
  }

  public getNodeForKey(key: string): string {
    return this.getShardForKey(key).assignedNodeId;
  }

  public getShardsForNode(nodeId: string): number[] {
    const shards: number[] = [];
    for (const [sId, shard] of this.shardMap.entries()) {
      if (shard.assignedNodeId === nodeId) {
        shards.push(sId);
      }
    }
    return shards;
  }
}
