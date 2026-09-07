/**
 * Cluster Member State Coordinator.
 * Coordinates heartbeat timers, failure detection probes, network partition handling,
 * and dynamic node joining/leaving lifecycle events.
 */

import { SwimMembershipProtocol, SwimMember } from './SwimMembershipProtocol';

export class MemberStateCoordinator {
  private protocol: SwimMembershipProtocol;
  private probeTimer: NodeJS.Timeout | null = null;
  private suspicionTimer: NodeJS.Timeout | null = null;

  constructor(localNodeId: string) {
    this.protocol = new SwimMembershipProtocol(localNodeId);
  }

  public getProtocol(): SwimMembershipProtocol {
    return this.protocol;
  }

  public join(seedNode: { nodeId: string; address: string; port: number }): void {
    this.protocol.registerMember({
      nodeId: seedNode.nodeId,
      address: seedNode.address,
      port: seedNode.port,
      status: 'ALIVE',
      incarnation: 0,
      lastStateChangeTs: Date.now(),
    });
  }

  public leave(): void {
    this.stop();
  }

  public startProbing(probeIntervalMs: number = 1000): void {
    if (this.probeTimer) return;

    this.probeTimer = setInterval(() => {
      const activeMembers = this.protocol.getActiveMembers();
      if (activeMembers.length === 0) return;

      const randomTarget = activeMembers[Math.floor(Math.random() * activeMembers.length)];
      this.protocol.createPing(randomTarget.nodeId);
    }, probeIntervalMs);

    this.suspicionTimer = setInterval(() => {
      this.protocol.checkSuspectTimeouts();
    }, 500);

    if (this.probeTimer.unref) this.probeTimer.unref();
    if (this.suspicionTimer.unref) this.suspicionTimer.unref();
  }

  public stop(): void {
    if (this.probeTimer) {
      clearInterval(this.probeTimer);
      this.probeTimer = null;
    }
    if (this.suspicionTimer) {
      clearInterval(this.suspicionTimer);
      this.suspicionTimer = null;
    }
  }
}
