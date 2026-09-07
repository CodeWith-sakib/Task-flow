/**
 * Multi-Paxos Instance State Machine & Log.
 * Tracks per-instance proposal numbers, promise numbers, accepted proposals,
 * and committed decision values for classic Multi-Paxos consensus.
 */

export interface ProposalNumber {
  round: number;
  nodeId: string;
}

export interface PaxosInstanceState<T = any> {
  instanceId: number;
  promisedProposal: ProposalNumber | null;
  acceptedProposal: ProposalNumber | null;
  acceptedValue: T | null;
  isCommitted: boolean;
  committedValue: T | null;
}

export class PaxosInstanceLog<T = any> {
  private instances = new Map<number, PaxosInstanceState<T>>();

  public getInstance(instanceId: number): PaxosInstanceState<T> {
    let instance = this.instances.get(instanceId);
    if (!instance) {
      instance = {
        instanceId,
        promisedProposal: null,
        acceptedProposal: null,
        acceptedValue: null,
        isCommitted: false,
        committedValue: null,
      };
      this.instances.set(instanceId, instance);
    }
    return instance;
  }

  public promise(instanceId: number, proposal: ProposalNumber): { success: boolean; lastAcceptedProposal: ProposalNumber | null; lastAcceptedValue: T | null } {
    const inst = this.getInstance(instanceId);

    if (inst.promisedProposal && this.compareProposals(proposal, inst.promisedProposal) < 0) {
      return {
        success: false,
        lastAcceptedProposal: inst.acceptedProposal,
        lastAcceptedValue: inst.acceptedValue,
      };
    }

    inst.promisedProposal = proposal;
    return {
      success: true,
      lastAcceptedProposal: inst.acceptedProposal,
      lastAcceptedValue: inst.acceptedValue,
    };
  }

  public accept(instanceId: number, proposal: ProposalNumber, value: T): boolean {
    const inst = this.getInstance(instanceId);

    if (inst.promisedProposal && this.compareProposals(proposal, inst.promisedProposal) < 0) {
      return false;
    }

    inst.promisedProposal = proposal;
    inst.acceptedProposal = proposal;
    inst.acceptedValue = value;
    return true;
  }

  public commit(instanceId: number, value: T): void {
    const inst = this.getInstance(instanceId);
    inst.isCommitted = true;
    inst.committedValue = value;
  }

  public compareProposals(a: ProposalNumber, b: ProposalNumber): number {
    if (a.round !== b.round) return a.round - b.round;
    return a.nodeId.localeCompare(b.nodeId);
  }

  public size(): number {
    return this.instances.size;
  }
}
