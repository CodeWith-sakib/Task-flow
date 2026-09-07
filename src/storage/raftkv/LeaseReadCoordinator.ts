/**
 * Raft Leader Read Lease Coordinator.
 * Enables linearizable local reads on the leader without round-trip quorum
 * by granting bounded time leases validated against cluster heartbeat intervals.
 */

export class LeaseReadCoordinator {
  private leaseDurationMs: number;
  private currentLeaseStartTs: number = 0;
  private currentLeaseHolder: string | null = null;
  private activeAcks = new Set<string>();

  constructor(leaseDurationMs: number = 3000) {
    this.leaseDurationMs = leaseDurationMs;
  }

  public grantLease(leaderId: string, peerAcks: string[], now: number = Date.now()): void {
    this.currentLeaseHolder = leaderId;
    this.currentLeaseStartTs = now;
    this.activeAcks = new Set(peerAcks);
  }

  public isLeaseValid(leaderId: string, quorumSize: number, now: number = Date.now()): boolean {
    if (this.currentLeaseHolder !== leaderId) return false;
    if (this.activeAcks.size < quorumSize) return false;

    return now - this.currentLeaseStartTs < this.leaseDurationMs;
  }

  public renewLease(peerAckNodeId: string): void {
    this.activeAcks.add(peerAckNodeId);
  }

  public revokeLease(): void {
    this.currentLeaseHolder = null;
    this.currentLeaseStartTs = 0;
    this.activeAcks.clear();
  }
}
