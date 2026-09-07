/**
 * Raft Joint Consensus Dynamic Membership Reconfiguration.
 * Implements 2-phase configuration changes using joint consensus ($C_{old,new}$)
 * ensuring safety and quorum availability during cluster node additions and removals.
 */

export interface ClusterConfiguration {
  version: number;
  members: Set<string>;
  isJoint: boolean;
  oldMembers?: Set<string>;
  newMembers?: Set<string>;
}

export class JointConsensusManager {
  private currentConfig: ClusterConfiguration;

  constructor(initialMembers: string[]) {
    this.currentConfig = {
      version: 1,
      members: new Set(initialMembers),
      isJoint: false,
    };
  }

  public getConfig(): ClusterConfiguration {
    return {
      version: this.currentConfig.version,
      members: new Set(this.currentConfig.members),
      isJoint: this.currentConfig.isJoint,
      oldMembers: this.currentConfig.oldMembers ? new Set(this.currentConfig.oldMembers) : undefined,
      newMembers: this.currentConfig.newMembers ? new Set(this.currentConfig.newMembers) : undefined,
    };
  }

  /**
   * Phase 1: Propose joint configuration $C_{old,new}$
   */
  public enterJointConsensus(newMemberList: string[]): ClusterConfiguration {
    if (this.currentConfig.isJoint) {
      throw new Error('Cluster is already undergoing a joint configuration change');
    }

    const oldMembers = new Set(this.currentConfig.members);
    const newMembers = new Set(newMemberList);
    const combinedMembers = new Set([...oldMembers, ...newMembers]);

    this.currentConfig = {
      version: this.currentConfig.version + 1,
      members: combinedMembers,
      isJoint: true,
      oldMembers,
      newMembers,
    };

    return this.getConfig();
  }

  /**
   * Phase 2: Finalize transition to $C_{new}$ after joint config is committed
   */
  public finalizeNewConfiguration(): ClusterConfiguration {
    if (!this.currentConfig.isJoint || !this.currentConfig.newMembers) {
      throw new Error('Cannot finalize: cluster is not in joint consensus');
    }

    this.currentConfig = {
      version: this.currentConfig.version + 1,
      members: new Set(this.currentConfig.newMembers),
      isJoint: false,
    };

    return this.getConfig();
  }

  /**
   * Evaluates if a set of voting nodes satisfies quorum.
   * In joint consensus, requires separate majorities from both $C_{old}$ and $C_{new}$.
   */
  public hasQuorum(voters: Set<string>): boolean {
    if (!this.currentConfig.isJoint) {
      return this.hasMajority(voters, this.currentConfig.members);
    }

    const hasOldMajority = this.hasMajority(voters, this.currentConfig.oldMembers!);
    const hasNewMajority = this.hasMajority(voters, this.currentConfig.newMembers!);

    return hasOldMajority && hasNewMajority;
  }

  private hasMajority(voters: Set<string>, group: Set<string>): boolean {
    if (group.size === 0) return true;
    let matchCount = 0;
    for (const member of group) {
      if (voters.has(member)) {
        matchCount++;
      }
    }
    return matchCount > Math.floor(group.size / 2);
  }
}
