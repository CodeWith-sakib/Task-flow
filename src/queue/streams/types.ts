/**
 * Stream Queue and Commit-Log domain types and contracts.
 */

export type TopicName = string;
export type PartitionId = number;
export type Offset = number;

export interface StreamRecord<V = any> {
  topic: TopicName;
  partition: PartitionId;
  offset: Offset;
  key?: string;
  value: V;
  timestamp: number;
  headers?: Record<string, string>;
  checksum?: number;
}

export interface TopicConfig {
  name: TopicName;
  partitions: number;
  replicationFactor: number;
  segmentMaxBytes?: number;
  retentionHours?: number;
}

export enum ConsumerGroupState {
  EMPTY = 'EMPTY',
  PREPARING_REBALANCE = 'PREPARING_REBALANCE',
  COMPLETING_REBALANCE = 'COMPLETING_REBALANCE',
  STABLE = 'STABLE',
  DEAD = 'DEAD'
}

export interface GroupMember {
  memberId: string;
  clientId: string;
  clientHost: string;
  sessionTimeoutMs: number;
  rebalanceTimeoutMs: number;
  topics: TopicName[];
  assignedPartitions: { topic: TopicName; partition: PartitionId }[];
  lastHeartbeat: number;
}

export interface PartitionAssignment {
  memberId: string;
  partitions: { topic: TopicName; partition: PartitionId }[];
}

export interface IPartitionAssignor {
  name: string;
  assign(
    members: Map<string, GroupMember>,
    topics: Map<TopicName, number>
  ): Map<string, { topic: TopicName; partition: PartitionId }[]>;
}

export enum TransactionState {
  UNINITIALIZED = 'UNINITIALIZED',
  READY = 'READY',
  IN_TRANSACTION = 'IN_TRANSACTION',
  COMMITTING = 'COMMITTING',
  ABORTING = 'ABORTING'
}
