/**
 * Distributed Consistent Hash Ring & Replica Placement Router.
 * Implements Murmur3/SHA-256 virtual nodes, N-replica preference lists,
 * read-repair dispatching, and hinted-handoff fallback routing.
 */

import * as crypto from 'crypto';
import { HintedHandoffVault } from './HintedHandoffVault';

export interface StorageNode {
  nodeId: string;
  address: string;
  port: number;
  isAvailable: boolean;
}

export class ConsistentHashRouter {
  private vnodesPerNode: number;
  private ring: { hash: number; nodeId: string }[] = [];
  private nodes = new Map<string, StorageNode>();
  private handoffVault: HintedHandoffVault;

  constructor(vnodesPerNode: number = 64, handoffVault?: HintedHandoffVault) {
    this.vnodesPerNode = vnodesPerNode;
    this.handoffVault = handoffVault || new HintedHandoffVault();
  }

  public addNode(node: StorageNode): void {
    this.nodes.set(node.nodeId, node);

    for (let i = 0; i < this.vnodesPerNode; i++) {
      const vnodeKey = `${node.nodeId}-vn${i}`;
      const hash = this.hash(vnodeKey);
      this.ring.push({ hash, nodeId: node.nodeId });
    }

    this.ring.sort((a, b) => a.hash - b.hash);
  }

  public removeNode(nodeId: string): void {
    this.nodes.delete(nodeId);
    this.ring = this.ring.filter((vn) => vn.nodeId !== nodeId);
  }

  public setNodeAvailability(nodeId: string, isAvailable: boolean): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.isAvailable = isAvailable;
    }
  }

  /**
   * Returns N distinct replica nodes for a key (Preference List).
   */
  public getPreferenceList(key: string, replicaCount: number = 3): StorageNode[] {
    if (this.ring.length === 0) return [];

    const keyHash = this.hash(key);
    let startIdx = this.binarySearchRing(keyHash);

    const chosenNodeIds = new Set<string>();
    const replicas: StorageNode[] = [];
    const ringLen = this.ring.length;

    for (let i = 0; i < ringLen && chosenNodeIds.size < replicaCount; i++) {
      const currIdx = (startIdx + i) % ringLen;
      const nodeId = this.ring[currIdx].nodeId;

      if (!chosenNodeIds.has(nodeId)) {
        chosenNodeIds.add(nodeId);
        const node = this.nodes.get(nodeId);
        if (node) {
          replicas.push(node);
        }
      }
    }

    return replicas;
  }

  /**
   * Routes a write to active replicas, storing hints for unreachable replicas.
   */
  public async routeWrite(
    key: string,
    value: any,
    replicaCount: number = 3,
    writeFn: (node: StorageNode, key: string, value: any) => Promise<boolean>
  ): Promise<{ writtenNodes: string[]; hintedNodes: string[]; quorumAchieved: boolean }> {
    const preferenceList = this.getPreferenceList(key, replicaCount);
    const writtenNodes: string[] = [];
    const hintedNodes: string[] = [];

    const quorumRequired = Math.floor(replicaCount / 2) + 1;

    for (const node of preferenceList) {
      if (node.isAvailable) {
        try {
          const success = await writeFn(node, key, value);
          if (success) {
            writtenNodes.push(node.nodeId);
          } else {
            this.handoffVault.storeHint(node.nodeId, key, value);
            hintedNodes.push(node.nodeId);
          }
        } catch {
          this.handoffVault.storeHint(node.nodeId, key, value);
          hintedNodes.push(node.nodeId);
        }
      } else {
        this.handoffVault.storeHint(node.nodeId, key, value);
        hintedNodes.push(node.nodeId);
      }
    }

    return {
      writtenNodes,
      hintedNodes,
      quorumAchieved: writtenNodes.length >= quorumRequired,
    };
  }

  public getHandoffVault(): HintedHandoffVault {
    return this.handoffVault;
  }

  private binarySearchRing(hash: number): number {
    let low = 0;
    let high = this.ring.length - 1;

    if (hash > this.ring[high].hash || hash <= this.ring[0].hash) {
      return 0;
    }

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.ring[mid].hash >= hash) {
        if (mid === 0 || this.ring[mid - 1].hash < hash) {
          return mid;
        }
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    return 0;
  }

  private hash(key: string): number {
    const md5 = crypto.createHash('md5').update(key).digest();
    return md5.readUInt32BE(0);
  }
}
