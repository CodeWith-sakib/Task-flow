import { ClusterNode, NodeStatus } from './ClusterNode';
import { ConsistentHashRing } from '../utils/ConsistentHashRing';

export interface PartitionPlacement {
  partitionId: number;
  primaryNodeId: string;
  replicaNodeIds: string[];
}

/**
 * TopologyManager handles cluster topology awareness, rack-isolated partition placement,
 * consistent hashing assignment, and cluster rebalance planning.
 */
export class TopologyManager {
  private nodes: Map<string, ClusterNode> = new Map();
  private hashRing: ConsistentHashRing;
  private replicationFactor: number;
  private partitionCount: number;

  constructor(partitionCount: number = 32, replicationFactor: number = 2, virtualNodes: number = 100) {
    this.partitionCount = partitionCount;
    this.replicationFactor = replicationFactor;
    this.hashRing = new ConsistentHashRing(virtualNodes);
  }

  public registerNode(node: ClusterNode): void {
    this.nodes.set(node.id, node);
    if (node.status === NodeStatus.ACTIVE) {
      this.hashRing.addNode(node.id);
    }
  }

  public deregisterNode(nodeId: string): void {
    this.nodes.delete(nodeId);
    this.hashRing.removeNode(nodeId);
  }

  public setNodeStatus(nodeId: string, status: NodeStatus): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.status = status;
      if (status === NodeStatus.ACTIVE) {
        this.hashRing.addNode(node.id);
      } else {
        this.hashRing.removeNode(node.id);
      }
    }
  }

  public getPlacements(): PartitionPlacement[] {
    const activeNodes = Array.from(this.nodes.values()).filter(n => n.status === NodeStatus.ACTIVE);
    if (activeNodes.length === 0) return [];

    const placements: PartitionPlacement[] = [];
    for (let p = 0; p < this.partitionCount; p++) {
      const key = `partition-${p}`;
      const primary = this.hashRing.getNode(key);

      const replicas: string[] = [];
      const primaryNode = primary ? this.nodes.get(primary) : undefined;
      const primaryRack = primaryNode?.metadata.rack;

      // Select rack-isolated replicas
      for (const node of activeNodes) {
        if (node.id !== primary && replicas.length < this.replicationFactor - 1) {
          if (primaryRack && node.metadata.rack !== primaryRack) {
            replicas.push(node.id);
          } else if (!primaryRack) {
            replicas.push(node.id);
          }
        }
      }

      placements.push({
        partitionId: p,
        primaryNodeId: primary || activeNodes[0].id,
        replicaNodeIds: replicas
      });
    }

    return placements;
  }

  public getNodeForPartition(partitionId: number): string | null {
    return this.hashRing.getNode(`partition-${partitionId}`) ?? null;
  }

  public computeRebalancePlan(newActiveNodes: string[]): { movingPartitions: number; moves: { partitionId: number; from: string; to: string }[] } {
    const currentPlacements = this.getPlacements();
    const tempRing = new ConsistentHashRing(100);
    for (const id of newActiveNodes) tempRing.addNode(id);

    const moves: { partitionId: number; from: string; to: string }[] = [];
    for (const placement of currentPlacements) {
      const newTarget = tempRing.getNode(`partition-${placement.partitionId}`);
      if (newTarget && newTarget !== placement.primaryNodeId) {
        moves.push({
          partitionId: placement.partitionId,
          from: placement.primaryNodeId,
          to: newTarget
        });
      }
    }

    return {
      movingPartitions: moves.length,
      moves
    };
  }
}
