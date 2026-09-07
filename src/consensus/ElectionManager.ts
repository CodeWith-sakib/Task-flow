import { NodeId, RaftRole, RequestVoteArgs, RequestVoteReply, Term } from './types';
import { RaftLog } from './RaftLog';

export interface ElectionCallbacks {
  onRoleChange: (role: RaftRole, term: Term) => void;
  broadcastRequestVote: (args: RequestVoteArgs) => Promise<Map<NodeId, RequestVoteReply>>;
}

/**
 * ElectionManager controls the leader election lifecycle, randomized timers,
 * pre-vote phase, quorum collection, and term management.
 */
export class ElectionManager {
  private nodeId: NodeId;
  private peers: NodeId[];
  private currentTerm: Term = 0;
  private votedFor: NodeId | null = null;
  private role: RaftRole = RaftRole.FOLLOWER;
  private minTimeoutMs: number;
  private maxTimeoutMs: number;
  private timer: NodeJS.Timeout | null = null;
  private callbacks: ElectionCallbacks;
  private enablePreVote: boolean;
  private lastLeaderContact: number = 0;

  constructor(
    nodeId: NodeId,
    peers: NodeId[],
    callbacks: ElectionCallbacks,
    options?: { minTimeoutMs?: number; maxTimeoutMs?: number; enablePreVote?: boolean }
  ) {
    this.nodeId = nodeId;
    this.peers = peers;
    this.callbacks = callbacks;
    this.minTimeoutMs = options?.minTimeoutMs ?? 150;
    this.maxTimeoutMs = options?.maxTimeoutMs ?? 300;
    this.enablePreVote = options?.enablePreVote ?? true;
  }

  public start(): void {
    this.resetTimer();
  }

  public stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  public getRole(): RaftRole {
    return this.role;
  }

  public getCurrentTerm(): Term {
    return this.currentTerm;
  }

  public getVotedFor(): NodeId | null {
    return this.votedFor;
  }

  public recordLeaderContact(): void {
    this.lastLeaderContact = Date.now();
    this.resetTimer();
  }

  public handleRequestVote(args: RequestVoteArgs, log: RaftLog): RequestVoteReply {
    if (args.term > this.currentTerm) {
      this.stepDown(args.term);
    }

    if (args.term < this.currentTerm) {
      return { term: this.currentTerm, voteGranted: false, isPreVoteReply: args.isPreVote };
    }

    const canVote = this.votedFor === null || this.votedFor === args.candidateId || args.isPreVote;
    const isLogUpToDate = this.isLogUpToDate(args.lastLogIndex, args.lastLogTerm, log);

    if (canVote && isLogUpToDate) {
      if (!args.isPreVote) {
        this.votedFor = args.candidateId;
        this.resetTimer();
      }
      return { term: this.currentTerm, voteGranted: true, isPreVoteReply: args.isPreVote };
    }

    return { term: this.currentTerm, voteGranted: false, isPreVoteReply: args.isPreVote };
  }

  public async triggerElection(log: RaftLog): Promise<boolean> {
    if (this.enablePreVote && this.peers.length > 0) {
      const preVoteWon = await this.runPreVote(log);
      if (!preVoteWon) {
        this.resetTimer();
        return false;
      }
    }

    this.role = RaftRole.CANDIDATE;
    this.currentTerm += 1;
    this.votedFor = this.nodeId;
    this.callbacks.onRoleChange(this.role, this.currentTerm);
    this.resetTimer();

    const totalNodes = this.peers.length + 1;
    const quorum = Math.floor(totalNodes / 2) + 1;
    let votesGranted = 1; // Vote for self

    if (votesGranted >= quorum) {
      this.becomeLeader();
      return true;
    }

    const voteArgs: RequestVoteArgs = {
      term: this.currentTerm,
      candidateId: this.nodeId,
      lastLogIndex: log.getLastLogIndex(),
      lastLogTerm: log.getLastLogTerm(),
      isPreVote: false
    };

    try {
      const replies = await this.callbacks.broadcastRequestVote(voteArgs);
      if (this.role !== RaftRole.CANDIDATE) {
        return false;
      }

      for (const [, reply] of replies) {
        if (reply.term > this.currentTerm) {
          this.stepDown(reply.term);
          return false;
        }
        if (reply.term === this.currentTerm && reply.voteGranted) {
          votesGranted++;
        }
      }

      if (votesGranted >= quorum && this.role === RaftRole.CANDIDATE) {
        this.becomeLeader();
        return true;
      }
    } catch {
      // Election round completed with errors or timeout
    }

    return false;
  }

  public stepDown(newTerm: Term): void {
    this.currentTerm = newTerm;
    this.role = RaftRole.FOLLOWER;
    this.votedFor = null;
    this.callbacks.onRoleChange(this.role, this.currentTerm);
    this.resetTimer();
  }

  private async runPreVote(log: RaftLog): Promise<boolean> {
    this.role = RaftRole.PRE_CANDIDATE;
    const totalNodes = this.peers.length + 1;
    const quorum = Math.floor(totalNodes / 2) + 1;
    let preVotesGranted = 1;

    const preVoteArgs: RequestVoteArgs = {
      term: this.currentTerm + 1,
      candidateId: this.nodeId,
      lastLogIndex: log.getLastLogIndex(),
      lastLogTerm: log.getLastLogTerm(),
      isPreVote: true
    };

    try {
      const replies = await this.callbacks.broadcastRequestVote(preVoteArgs);
      for (const [, reply] of replies) {
        if (reply.term > this.currentTerm) {
          this.stepDown(reply.term);
          return false;
        }
        if (reply.voteGranted) {
          preVotesGranted++;
        }
      }
    } catch {
      return false;
    }

    return preVotesGranted >= quorum;
  }

  private becomeLeader(): void {
    this.role = RaftRole.LEADER;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.callbacks.onRoleChange(this.role, this.currentTerm);
  }

  private isLogUpToDate(candidateLastIndex: number, candidateLastTerm: number, log: RaftLog): boolean {
    const myLastIndex = log.getLastLogIndex();
    const myLastTerm = log.getLastLogTerm();

    if (candidateLastTerm !== myLastTerm) {
      return candidateLastTerm > myLastTerm;
    }
    return candidateLastIndex >= myLastIndex;
  }

  private resetTimer(): void {
    if (this.role === RaftRole.LEADER) return;
    if (this.timer) clearTimeout(this.timer);

    const jitter = Math.floor(Math.random() * (this.maxTimeoutMs - this.minTimeoutMs));
    const delay = this.minTimeoutMs + jitter;

    this.timer = setTimeout(() => {
      // Trigger election tick callback
    }, delay);
  }
}
