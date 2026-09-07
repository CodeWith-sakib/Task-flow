/**
 * Consensus module domain types and interfaces.
 * Defines Raft state machine roles, RPC message envelopes, log entry formats,
 * cluster membership transitions, and state machine replication contracts.
 */

export enum RaftRole {
  FOLLOWER = 'FOLLOWER',
  CANDIDATE = 'CANDIDATE',
  LEADER = 'LEADER',
  PRE_CANDIDATE = 'PRE_CANDIDATE'
}

export type NodeId = string;
export type Term = number;
export type LogIndex = number;

export interface LogEntry<T = any> {
  index: LogIndex;
  term: Term;
  command: T;
  timestamp: number;
  checksum?: number;
}

export interface RequestVoteArgs {
  term: Term;
  candidateId: NodeId;
  lastLogIndex: LogIndex;
  lastLogTerm: Term;
  isPreVote?: boolean;
}

export interface RequestVoteReply {
  term: Term;
  voteGranted: boolean;
  isPreVoteReply?: boolean;
}

export interface AppendEntriesArgs<T = any> {
  term: Term;
  leaderId: NodeId;
  prevLogIndex: LogIndex;
  prevLogTerm: Term;
  entries: LogEntry<T>[];
  leaderCommit: LogIndex;
}

export interface AppendEntriesReply {
  term: Term;
  success: boolean;
  matchIndex: LogIndex;
  conflictIndex?: LogIndex;
  conflictTerm?: Term;
}

export interface InstallSnapshotArgs {
  term: Term;
  leaderId: NodeId;
  lastIncludedIndex: LogIndex;
  lastIncludedTerm: Term;
  offset: number;
  data: Buffer;
  done: boolean;
}

export interface InstallSnapshotReply {
  term: Term;
  bytesReceived: number;
  success: boolean;
}

export interface RaftConfig {
  nodeId: NodeId;
  peers: NodeId[];
  minElectionTimeoutMs?: number;
  maxElectionTimeoutMs?: number;
  heartbeatIntervalMs?: number;
  rpcTimeoutMs?: number;
  maxEntriesPerAppend?: number;
  snapshotThreshold?: number;
  enablePreVote?: boolean;
}

export interface PeerState {
  id: NodeId;
  nextIndex: LogIndex;
  matchIndex: LogIndex;
  lastActivity: number;
  inFlight: boolean;
}

export interface ClusterMembership {
  epoch: number;
  nodes: NodeId[];
  leaderId: NodeId | null;
}

export interface IStateMachine<T = any, R = any> {
  apply(entry: LogEntry<T>): Promise<R>;
  createSnapshot(): Promise<Buffer>;
  restoreSnapshot(snapshot: Buffer, lastIndex: LogIndex, lastTerm: Term): Promise<void>;
  getLastAppliedIndex(): LogIndex;
}

export interface IRaftTransport {
  sendRequestVote(target: NodeId, args: RequestVoteArgs): Promise<RequestVoteReply>;
  sendAppendEntries(target: NodeId, args: AppendEntriesArgs): Promise<AppendEntriesReply>;
  sendInstallSnapshot(target: NodeId, args: InstallSnapshotArgs): Promise<InstallSnapshotReply>;
}
