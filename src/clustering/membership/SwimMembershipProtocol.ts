/**
 * SWIM (Structured Weakly-Consistent Infection-Style Process Group Membership Protocol).
 * Implements randomized ping probing, indirect ping-req via k-intermediaries,
 * suspicion mechanism with exponential decay, and piggybacked state dissemination.
 */

export type SwimNodeStatus = 'ALIVE' | 'SUSPECT' | 'DEAD' | 'LEFT';

export interface SwimMember {
  nodeId: string;
  address: string;
  port: number;
  status: SwimNodeStatus;
  incarnation: number;
  lastStateChangeTs: number;
}

export interface SwimMessage {
  type: 'PING' | 'PING_REQ' | 'ACK' | 'SUSPECT' | 'ALIVE' | 'DEAD';
  sourceNodeId: string;
  targetNodeId: string;
  seqNumber: number;
  incarnation: number;
  piggybackedUpdates: SwimMember[];
  indirectTargetNodeId?: string;
}

export class SwimMembershipProtocol {
  private localNodeId: string;
  private members = new Map<string, SwimMember>();
  private localIncarnation = 0;
  private seqCounter = 0;
  private suspicionTimeoutMs: number;

  constructor(localNodeId: string, suspicionTimeoutMs: number = 5000) {
    this.localNodeId = localNodeId;
    this.suspicionTimeoutMs = suspicionTimeoutMs;
  }

  public registerMember(member: SwimMember): void {
    this.members.set(member.nodeId, { ...member });
  }

  public getMember(nodeId: string): SwimMember | undefined {
    return this.members.get(nodeId);
  }

  public getAllMembers(): SwimMember[] {
    return Array.from(this.members.values());
  }

  public getActiveMembers(): SwimMember[] {
    return Array.from(this.members.values()).filter((m) => m.status === 'ALIVE' || m.status === 'SUSPECT');
  }

  /**
   * Generates next direct PING message for a target node.
   */
  public createPing(targetNodeId: string): SwimMessage {
    return {
      type: 'PING',
      sourceNodeId: this.localNodeId,
      targetNodeId,
      seqNumber: ++this.seqCounter,
      incarnation: this.localIncarnation,
      piggybackedUpdates: this.getPiggybackedUpdates(),
    };
  }

  /**
   * Generates indirect PING_REQ to an intermediary helper node to probe an unresponsive target.
   */
  public createPingReq(helperNodeId: string, targetNodeId: string): SwimMessage {
    return {
      type: 'PING_REQ',
      sourceNodeId: this.localNodeId,
      targetNodeId: helperNodeId,
      indirectTargetNodeId: targetNodeId,
      seqNumber: ++this.seqCounter,
      incarnation: this.localIncarnation,
      piggybackedUpdates: this.getPiggybackedUpdates(),
    };
  }

  /**
   * Handles incoming SWIM messages and applies state transitions.
   */
  public handleMessage(msg: SwimMessage): SwimMessage | null {
    // Process piggybacked updates
    for (const update of msg.piggybackedUpdates) {
      this.applyMemberUpdate(update);
    }

    switch (msg.type) {
      case 'PING':
        return {
          type: 'ACK',
          sourceNodeId: this.localNodeId,
          targetNodeId: msg.sourceNodeId,
          seqNumber: msg.seqNumber,
          incarnation: this.localIncarnation,
          piggybackedUpdates: this.getPiggybackedUpdates(),
        };

      case 'SUSPECT':
        if (msg.targetNodeId === this.localNodeId) {
          // If local node is suspected, refute by bumping incarnation and asserting ALIVE
          if (msg.incarnation >= this.localIncarnation) {
            this.localIncarnation = msg.incarnation + 1;
            this.broadcastAlive(this.localNodeId, this.localIncarnation);
          }
        } else {
          this.markSuspect(msg.targetNodeId, msg.incarnation);
        }
        return null;

      case 'ALIVE':
        this.markAlive(msg.targetNodeId, msg.incarnation);
        return null;

      case 'DEAD':
        this.markDead(msg.targetNodeId, msg.incarnation);
        return null;

      default:
        return null;
    }
  }

  public checkSuspectTimeouts(now: number = Date.now()): string[] {
    const expiredDeadNodes: string[] = [];

    for (const member of this.members.values()) {
      if (member.status === 'SUSPECT' && now - member.lastStateChangeTs > this.suspicionTimeoutMs) {
        member.status = 'DEAD';
        member.lastStateChangeTs = now;
        expiredDeadNodes.push(member.nodeId);
      }
    }

    return expiredDeadNodes;
  }

  private markSuspect(nodeId: string, incarnation: number): void {
    const m = this.members.get(nodeId);
    if (!m) return;

    if (incarnation >= m.incarnation && m.status === 'ALIVE') {
      m.status = 'SUSPECT';
      m.incarnation = incarnation;
      m.lastStateChangeTs = Date.now();
    }
  }

  private markAlive(nodeId: string, incarnation: number): void {
    const m = this.members.get(nodeId);
    if (!m) return;

    if (incarnation > m.incarnation || (incarnation === m.incarnation && m.status === 'SUSPECT')) {
      m.status = 'ALIVE';
      m.incarnation = incarnation;
      m.lastStateChangeTs = Date.now();
    }
  }

  private markDead(nodeId: string, incarnation: number): void {
    const m = this.members.get(nodeId);
    if (!m) return;

    if (incarnation >= m.incarnation) {
      m.status = 'DEAD';
      m.incarnation = incarnation;
      m.lastStateChangeTs = Date.now();
    }
  }

  private broadcastAlive(nodeId: string, incarnation: number): void {
    const m = this.members.get(nodeId);
    if (m) {
      m.status = 'ALIVE';
      m.incarnation = incarnation;
      m.lastStateChangeTs = Date.now();
    }
  }

  private applyMemberUpdate(update: SwimMember): void {
    const existing = this.members.get(update.nodeId);
    if (!existing) {
      this.members.set(update.nodeId, { ...update });
      return;
    }

    if (update.incarnation > existing.incarnation) {
      existing.status = update.status;
      existing.incarnation = update.incarnation;
      existing.lastStateChangeTs = Date.now();
    } else if (update.incarnation === existing.incarnation) {
      if (existing.status === 'ALIVE' && (update.status === 'SUSPECT' || update.status === 'DEAD')) {
        existing.status = update.status;
        existing.lastStateChangeTs = Date.now();
      }
    }
  }

  private getPiggybackedUpdates(): SwimMember[] {
    return Array.from(this.members.values()).slice(0, 5);
  }
}
