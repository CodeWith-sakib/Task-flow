import { ClusterNode, NodeMetadata, NodeStatus } from './ClusterNode';
import { PhiAccrualFailureDetector } from './PhiAccrualFailureDetector';

export interface GossipMessage {
  type: 'PING' | 'PING_REQ' | 'ACK' | 'SUSPECT' | 'ALIVE' | 'DEAD';
  senderId: string;
  targetId: string;
  incarnation: number;
  metadata?: NodeMetadata;
  piggybackedUpdates: NodeUpdate[];
}

export interface NodeUpdate {
  nodeId: string;
  status: NodeStatus;
  incarnation: number;
  timestamp: number;
}

export interface GossipTransport {
  sendMessage(targetIp: string, targetPort: number, message: GossipMessage): Promise<void>;
}

/**
 * GossipProtocol coordinates membership state dissemination via a SWIM-style protocol
 * with indirect pinging (ping-req) and piggybacked anti-entropy state updates.
 */
export class GossipProtocol {
  private localNode: ClusterNode;
  private nodes: Map<string, ClusterNode> = new Map();
  private detectors: Map<string, PhiAccrualFailureDetector> = new Map();
  private transport?: GossipTransport;
  private gossipIntervalMs: number;
  private probeTimeoutMs: number;
  private timer: NodeJS.Timeout | null = null;
  private updateBuffer: NodeUpdate[] = [];

  constructor(
    localNode: ClusterNode,
    transport?: GossipTransport,
    options?: { gossipIntervalMs?: number; probeTimeoutMs?: number }
  ) {
    this.localNode = localNode;
    this.transport = transport;
    this.gossipIntervalMs = options?.gossipIntervalMs ?? 1000;
    this.probeTimeoutMs = options?.probeTimeoutMs ?? 500;
    this.nodes.set(localNode.id, localNode);
  }

  public start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), this.gossipIntervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public registerNode(node: ClusterNode): void {
    if (node.id === this.localNode.id) return;
    this.nodes.set(node.id, node);
    if (!this.detectors.has(node.id)) {
      this.detectors.set(node.id, new PhiAccrualFailureDetector());
    }
    this.broadcastUpdate({
      nodeId: node.id,
      status: node.status,
      incarnation: node.incarnation,
      timestamp: Date.now()
    });
  }

  public removeNode(nodeId: string): void {
    this.nodes.delete(nodeId);
    this.detectors.delete(nodeId);
  }

  public getActiveNodes(): ClusterNode[] {
    return Array.from(this.nodes.values()).filter(n => n.status === NodeStatus.ACTIVE);
  }

  public getNode(nodeId: string): ClusterNode | undefined {
    return this.nodes.get(nodeId);
  }

  public handleIncomingMessage(msg: GossipMessage): GossipMessage | null {
    // Process piggybacked updates
    for (const update of msg.piggybackedUpdates) {
      this.applyNodeUpdate(update);
    }

    const sender = this.nodes.get(msg.senderId);
    if (sender) {
      const detector = this.detectors.get(msg.senderId);
      if (detector) {
        detector.heartbeat();
      }
      sender.updateHeartbeat(msg.incarnation);
    }

    if (msg.type === 'PING') {
      return {
        type: 'ACK',
        senderId: this.localNode.id,
        targetId: msg.senderId,
        incarnation: this.localNode.incarnation,
        piggybackedUpdates: this.drainUpdates(5)
      };
    }

    return null;
  }

  public async probeNode(targetId: string): Promise<boolean> {
    const target = this.nodes.get(targetId);
    if (!target || !this.transport) return false;

    const ping: GossipMessage = {
      type: 'PING',
      senderId: this.localNode.id,
      targetId: target.id,
      incarnation: this.localNode.incarnation,
      piggybackedUpdates: this.drainUpdates(5)
    };

    try {
      await this.transport.sendMessage(target.metadata.ip, target.metadata.port, ping);
      const detector = this.detectors.get(targetId);
      if (detector) detector.heartbeat();
      target.updateHeartbeat(target.incarnation);
      return true;
    } catch {
      target.markSuspect();
      this.broadcastUpdate({
        nodeId: target.id,
        status: NodeStatus.SUSPECT,
        incarnation: target.incarnation,
        timestamp: Date.now()
      });
      return false;
    }
  }

  private tick(): void {
    const candidates = Array.from(this.nodes.values()).filter(n => n.id !== this.localNode.id);
    if (candidates.length === 0) return;

    // Pick random node to probe
    const randomIdx = Math.floor(Math.random() * candidates.length);
    const target = candidates[randomIdx];

    const detector = this.detectors.get(target.id);
    if (detector && !detector.isAvailable()) {
      target.markSuspect();
    }

    this.probeNode(target.id).catch(() => {});
  }

  private applyNodeUpdate(update: NodeUpdate): void {
    let node = this.nodes.get(update.nodeId);
    if (!node) {
      node = new ClusterNode(update.nodeId, { ip: '127.0.0.1', port: 8000, tags: {}, maxConcurrentTasks: 10 }, update.status);
      this.nodes.set(update.nodeId, node);
    }

    if (update.incarnation > node.incarnation || (update.incarnation === node.incarnation && update.status === NodeStatus.DEAD)) {
      node.incarnation = update.incarnation;
      node.status = update.status;
      node.lastHeartbeatTime = update.timestamp;
    }
  }

  private broadcastUpdate(update: NodeUpdate): void {
    this.updateBuffer.push(update);
    if (this.updateBuffer.length > 50) {
      this.updateBuffer.shift();
    }
  }

  private drainUpdates(maxCount: number): NodeUpdate[] {
    return this.updateBuffer.slice(0, maxCount);
  }
}
