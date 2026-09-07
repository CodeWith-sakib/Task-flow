import {
  AppendEntriesArgs,
  AppendEntriesReply,
  IStateMachine,
  NodeId,
  RaftConfig,
  RaftRole,
  RequestVoteArgs,
  RequestVoteReply,
  Term
} from './types';
import { RaftLog } from './RaftLog';
import { ElectionManager } from './ElectionManager';
import { LogReplicator } from './LogReplicator';
import { StateMachineReplicator } from './StateMachineReplicator';

/**
 * RaftNode coordinates the full Raft consensus lifecycle, handling RPCs,
 * command submission, heartbeat loops, leader step-down, and state machine commits.
 */
export class RaftNode<T = any, R = any> {
  private config: RaftConfig;
  private log: RaftLog<T>;
  private electionManager: ElectionManager;
  private replicator: LogReplicator;
  private smReplicator: StateMachineReplicator<T, R>;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private transport?: any;

  constructor(
    config: RaftConfig,
    stateMachine: IStateMachine<T, R>,
    transport?: any
  ) {
    this.config = config;
    this.transport = transport;
    this.log = new RaftLog<T>();

    this.smReplicator = new StateMachineReplicator<T, R>(
      stateMachine,
      this.log,
      config.snapshotThreshold ?? 1000
    );

    this.replicator = new LogReplicator(
      config.nodeId,
      config.peers,
      this.log.getLastLogIndex(),
      {
        sendAppendEntries: async (peerId, args) => {
          if (!this.transport) throw new Error('No transport configured');
          return this.transport.sendAppendEntries(peerId, args);
        },
        onCommitAdvanced: async () => {
          await this.smReplicator.applyCommittedEntries();
        },
        onStepDown: (newTerm) => {
          this.stepDown(newTerm);
        }
      },
      config.maxEntriesPerAppend ?? 100
    );

    this.electionManager = new ElectionManager(
      config.nodeId,
      config.peers,
      {
        onRoleChange: (newRole, term) => {
          this.handleRoleChange(newRole, term);
        },
        broadcastRequestVote: async (args) => {
          const replies = new Map<NodeId, RequestVoteReply>();
          if (!this.transport) return replies;

          const promises = this.config.peers.map(async (peerId) => {
            try {
              const reply = await this.transport.sendRequestVote(peerId, args);
              replies.set(peerId, reply);
            } catch {
              // Ignore network failures for individual peer votes
            }
          });

          await Promise.allSettled(promises);
          return replies;
        }
      },
      {
        minTimeoutMs: config.minElectionTimeoutMs ?? 150,
        maxTimeoutMs: config.maxElectionTimeoutMs ?? 300,
        enablePreVote: config.enablePreVote ?? true
      }
    );
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.electionManager.start();
  }

  public stop(): void {
    this.isRunning = false;
    this.electionManager.stop();
    this.stopHeartbeat();
    this.smReplicator.rejectAllPending(new Error('RaftNode stopped'));
  }

  public getRole(): RaftRole {
    return this.electionManager.getRole();
  }

  public getCurrentTerm(): Term {
    return this.electionManager.getCurrentTerm();
  }

  public getNodeId(): NodeId {
    return this.config.nodeId;
  }

  public isLeader(): boolean {
    return this.getRole() === RaftRole.LEADER;
  }

  public async submitCommand(command: T): Promise<R> {
    if (!this.isLeader()) {
      throw new Error(`Not the leader. Current role: ${this.getRole()}`);
    }

    const entry = this.log.append(this.getCurrentTerm(), command);
    const promise = this.smReplicator.registerPendingCommand(entry.index);

    if (this.config.peers.length === 0) {
      // Single node cluster: commit immediately
      this.log.setCommitIndex(entry.index);
      await this.smReplicator.applyCommittedEntries();
    } else {
      // Trigger replication
      this.replicator.replicateAll(this.getCurrentTerm(), this.log).catch(() => {});
    }

    return promise;
  }

  public handleRequestVote(args: RequestVoteArgs): RequestVoteReply {
    return this.electionManager.handleRequestVote(args, this.log);
  }

  public handleAppendEntries(args: AppendEntriesArgs<T>): AppendEntriesReply {
    if (args.term > this.getCurrentTerm()) {
      this.stepDown(args.term);
    }

    if (args.term < this.getCurrentTerm()) {
      return {
        term: this.getCurrentTerm(),
        success: false,
        matchIndex: 0
      };
    }

    this.electionManager.recordLeaderContact();

    const success = this.log.appendEntries(args.prevLogIndex, args.prevLogTerm, args.entries);
    if (!success) {
      const conflictIndex = Math.min(this.log.getLastLogIndex() + 1, args.prevLogIndex);
      return {
        term: this.getCurrentTerm(),
        success: false,
        matchIndex: 0,
        conflictIndex
      };
    }

    if (args.leaderCommit > this.log.getCommitIndex()) {
      const lastNewIndex = args.entries.length > 0 ? args.entries[args.entries.length - 1].index : args.prevLogIndex;
      this.log.setCommitIndex(Math.min(args.leaderCommit, lastNewIndex));
      this.smReplicator.applyCommittedEntries().catch(() => {});
    }

    return {
      term: this.getCurrentTerm(),
      success: true,
      matchIndex: this.log.getLastLogIndex()
    };
  }

  public stepDown(newTerm: Term): void {
    this.stopHeartbeat();
    this.electionManager.stepDown(newTerm);
    this.smReplicator.rejectAllPending(new Error(`Stepped down to follower at term ${newTerm}`));
  }

  private handleRoleChange(newRole: RaftRole, _term: Term): void {
    if (newRole === RaftRole.LEADER) {
      this.startHeartbeat();
      for (const peer of this.config.peers) {
        this.replicator.resetPeerProgress(peer, this.log.getLastLogIndex() + 1);
      }
      this.replicator.replicateAll(this.getCurrentTerm(), this.log).catch(() => {});
    } else {
      this.stopHeartbeat();
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    const interval = this.config.heartbeatIntervalMs ?? 50;
    this.heartbeatTimer = setInterval(() => {
      if (this.isLeader()) {
        this.replicator.replicateAll(this.getCurrentTerm(), this.log).catch(() => {});
      }
    }, interval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  public getLog(): RaftLog<T> {
    return this.log;
  }
}
