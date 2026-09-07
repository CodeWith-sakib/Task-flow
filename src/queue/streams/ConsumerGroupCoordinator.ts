import {
  ConsumerGroupState,
  GroupMember,
  IPartitionAssignor,
  PartitionId,
  TopicName
} from './types';
import { RangeAssignor } from '../partitioning/RangeAssignor';

export interface JoinGroupResponse {
  memberId: string;
  generationId: number;
  leaderId: string;
  members: { memberId: string; topics: TopicName[] }[];
  state: ConsumerGroupState;
}

export interface SyncGroupResponse {
  partitions: { topic: TopicName; partition: PartitionId }[];
  generationId: number;
}

/**
 * ConsumerGroupCoordinator implements the server-side Kafka-style consumer group protocol
 * coordinating dynamic membership, heartbeats, rebalance state machines, and generation fences.
 */
export class ConsumerGroupCoordinator {
  public readonly groupId: string;
  private state: ConsumerGroupState = ConsumerGroupState.EMPTY;
  private generationId: number = 0;
  private leaderId: string | null = null;
  private members: Map<string, GroupMember> = new Map();
  private assignments: Map<string, { topic: TopicName; partition: PartitionId }[]> = new Map();
  private assignor: IPartitionAssignor;
  private topics: Map<TopicName, number>;
  private sessionTimeoutCheckTimer: NodeJS.Timeout | null = null;

  constructor(groupId: string, topics: Map<TopicName, number>, assignor?: IPartitionAssignor) {
    this.groupId = groupId;
    this.topics = topics;
    this.assignor = assignor ?? new RangeAssignor();
  }

  public joinGroup(
    clientId: string,
    clientHost: string,
    topics: TopicName[],
    existingMemberId?: string
  ): JoinGroupResponse {
    const memberId = existingMemberId || `${clientId}-${Math.random().toString(36).substring(2, 9)}`;

    const member: GroupMember = {
      memberId,
      clientId,
      clientHost,
      sessionTimeoutMs: 10000,
      rebalanceTimeoutMs: 15000,
      topics,
      assignedPartitions: [],
      lastHeartbeat: Date.now()
    };

    this.members.set(memberId, member);

    if (this.leaderId === null || !this.members.has(this.leaderId)) {
      this.leaderId = memberId;
    }

    this.state = ConsumerGroupState.PREPARING_REBALANCE;
    this.generationId++;

    const memberList = Array.from(this.members.values()).map(m => ({
      memberId: m.memberId,
      topics: m.topics
    }));

    return {
      memberId,
      generationId: this.generationId,
      leaderId: this.leaderId,
      members: memberList,
      state: this.state
    };
  }

  public syncGroup(
    memberId: string,
    generationId: number,
    leaderAssignments?: Map<string, { topic: TopicName; partition: PartitionId }[]>
  ): SyncGroupResponse {
    if (generationId !== this.generationId) {
      throw new Error(`Illegal generation ID ${generationId} (current: ${this.generationId})`);
    }

    if (!this.members.has(memberId)) {
      throw new Error(`Unknown member ID: ${memberId}`);
    }

    if (memberId === this.leaderId && leaderAssignments) {
      this.assignments = leaderAssignments;
      this.state = ConsumerGroupState.STABLE;
    } else if (this.state !== ConsumerGroupState.STABLE) {
      // Auto-compute assignments if not supplied by leader
      this.assignments = this.assignor.assign(this.members, this.topics);
      this.state = ConsumerGroupState.STABLE;
    }

    const assigned = this.assignments.get(memberId) || [];
    const member = this.members.get(memberId)!;
    member.assignedPartitions = assigned;

    return {
      partitions: assigned,
      generationId: this.generationId
    };
  }

  public heartbeat(memberId: string, generationId: number): boolean {
    if (generationId !== this.generationId) {
      return false;
    }

    const member = this.members.get(memberId);
    if (!member) return false;

    member.lastHeartbeat = Date.now();
    return true;
  }

  public leaveGroup(memberId: string): void {
    if (this.members.delete(memberId)) {
      this.assignments.delete(memberId);
      if (this.leaderId === memberId) {
        this.leaderId = this.members.keys().next().value ?? null;
      }
      if (this.members.size === 0) {
        this.state = ConsumerGroupState.EMPTY;
      } else {
        this.state = ConsumerGroupState.PREPARING_REBALANCE;
        this.generationId++;
      }
    }
  }

  public checkHeartbeats(): void {
    const now = Date.now();
    for (const [memberId, member] of this.members.entries()) {
      if (now - member.lastHeartbeat > member.sessionTimeoutMs) {
        this.leaveGroup(memberId);
      }
    }
  }

  public getState(): ConsumerGroupState {
    return this.state;
  }

  public getGenerationId(): number {
    return this.generationId;
  }

  public getMembers(): GroupMember[] {
    return Array.from(this.members.values());
  }

  public getLeaderId(): string | null {
    return this.leaderId;
  }
}
