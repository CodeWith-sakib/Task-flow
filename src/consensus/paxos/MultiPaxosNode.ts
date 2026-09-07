/**
 * Multi-Paxos Consensus Node.
 * Implements Leader Election via Phase 1 (Prepare/Promise) optimization across instance ranges,
 * and high-speed single-round Phase 2 (Accept/Accepted) value replication.
 */

import { PaxosInstanceLog, ProposalNumber } from './PaxosInstanceLog';

export interface MultiPaxosConfig {
  nodeId: string;
  peers: string[];
}

export class MultiPaxosNode<T = any> {
  private config: MultiPaxosConfig;
  private log = new PaxosInstanceLog<T>();
  private currentRound = 0;
  private isLeader = false;
  private nextInstanceId = 1;

  constructor(config: MultiPaxosConfig) {
    this.config = config;
  }

  public getNodeId(): string {
    return this.config.nodeId;
  }

  public isNodeLeader(): boolean {
    return this.isLeader;
  }

  /**
   * Phase 1: Propose leadership across all future instances.
   */
  public prepareLeadership(): { proposal: ProposalNumber } {
    this.currentRound++;
    const proposal: ProposalNumber = {
      round: this.currentRound,
      nodeId: this.config.nodeId,
    };

    return { proposal };
  }

  /**
   * Handles Phase 1 Prepare message from peer.
   */
  public handlePrepare(instanceId: number, proposal: ProposalNumber): { promised: boolean; lastValue: T | null } {
    const res = this.log.promise(instanceId, proposal);
    return {
      promised: res.success,
      lastValue: res.lastAcceptedValue,
    };
  }

  /**
   * Phase 2: Propose value for a specific consensus instance.
   */
  public proposeValue(value: T): { instanceId: number; proposal: ProposalNumber } {
    const instanceId = this.nextInstanceId++;
    const proposal: ProposalNumber = {
      round: this.currentRound,
      nodeId: this.config.nodeId,
    };

    this.log.accept(instanceId, proposal, value);
    return { instanceId, proposal };
  }

  /**
   * Handles Phase 2 Accept message from leader.
   */
  public handleAccept(instanceId: number, proposal: ProposalNumber, value: T): boolean {
    return this.log.accept(instanceId, proposal, value);
  }

  /**
   * Commits an instance value once quorum of Accepts is received.
   */
  public handleCommit(instanceId: number, value: T): void {
    this.log.commit(instanceId, value);
  }

  public getCommittedValue(instanceId: number): T | null {
    return this.log.getInstance(instanceId).committedValue;
  }

  public getLog(): PaxosInstanceLog<T> {
    return this.log;
  }
}
