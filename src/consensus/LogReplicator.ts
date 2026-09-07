import { AppendEntriesArgs, AppendEntriesReply, LogIndex, NodeId, PeerState, Term } from './types';
import { RaftLog } from './RaftLog';

export interface ReplicatorCallbacks {
  sendAppendEntries: (peerId: NodeId, args: AppendEntriesArgs) => Promise<AppendEntriesReply>;
  onCommitAdvanced: (newCommitIndex: LogIndex) => void;
  onStepDown: (newTerm: Term) => void;
}

/**
 * LogReplicator orchestrates parallel log replication pipelines to follower peers,
 * manages nextIndex and matchIndex progressions, pipelines batches, and computes quorum commits.
 */
export class LogReplicator {
  private leaderId: NodeId;
  private peers: Map<NodeId, PeerState> = new Map();
  private callbacks: ReplicatorCallbacks;
  private maxBatchSize: number;

  constructor(
    leaderId: NodeId,
    peerIds: NodeId[],
    lastLogIndex: LogIndex,
    callbacks: ReplicatorCallbacks,
    maxBatchSize: number = 100
  ) {
    this.leaderId = leaderId;
    this.callbacks = callbacks;
    this.maxBatchSize = maxBatchSize;

    for (const peerId of peerIds) {
      this.peers.set(peerId, {
        id: peerId,
        nextIndex: lastLogIndex + 1,
        matchIndex: 0,
        lastActivity: Date.now(),
        inFlight: false
      });
    }
  }

  public getPeerState(peerId: NodeId): PeerState | undefined {
    return this.peers.get(peerId);
  }

  public getPeerStates(): PeerState[] {
    return Array.from(this.peers.values());
  }

  public async replicateToPeer(peerId: NodeId, term: Term, log: RaftLog): Promise<boolean> {
    const peer = this.peers.get(peerId);
    if (!peer || peer.inFlight) {
      return false;
    }

    peer.inFlight = true;
    try {
      const prevLogIndex = peer.nextIndex - 1;
      const prevLogTerm = log.getTermForIndex(prevLogIndex) ?? 0;
      const entries = log.getEntriesFrom(peer.nextIndex, this.maxBatchSize);

      const args: AppendEntriesArgs = {
        term,
        leaderId: this.leaderId,
        prevLogIndex,
        prevLogTerm,
        entries,
        leaderCommit: log.getCommitIndex()
      };

      const reply = await this.callbacks.sendAppendEntries(peerId, args);
      peer.lastActivity = Date.now();

      if (reply.term > term) {
        this.callbacks.onStepDown(reply.term);
        return false;
      }

      if (reply.success) {
        peer.matchIndex = reply.matchIndex;
        peer.nextIndex = reply.matchIndex + 1;
        this.checkAndUpdateCommitIndex(term, log);
        return true;
      } else {
        if (reply.conflictIndex !== undefined) {
          peer.nextIndex = Math.max(1, reply.conflictIndex);
        } else {
          peer.nextIndex = Math.max(1, peer.nextIndex - 1);
        }
        return false;
      }
    } finally {
      peer.inFlight = false;
    }
  }

  public async replicateAll(term: Term, log: RaftLog): Promise<number> {
    const promises: Promise<boolean>[] = [];
    for (const peerId of this.peers.keys()) {
      promises.push(this.replicateToPeer(peerId, term, log));
    }

    const results = await Promise.allSettled(promises);
    return results.filter(r => r.status === 'fulfilled' && r.value).length;
  }

  public checkAndUpdateCommitIndex(currentTerm: Term, log: RaftLog): void {
    const matchIndexes = Array.from(this.peers.values()).map(p => p.matchIndex);
    matchIndexes.push(log.getLastLogIndex()); // Self

    matchIndexes.sort((a, b) => a - b);
    const medianIdx = Math.floor(matchIndexes.length / 2);
    const candidateCommit = matchIndexes[medianIdx];

    if (candidateCommit > log.getCommitIndex()) {
      const entryTerm = log.getTermForIndex(candidateCommit);
      if (entryTerm === currentTerm) {
        log.setCommitIndex(candidateCommit);
        this.callbacks.onCommitAdvanced(candidateCommit);
      }
    }
  }

  public resetPeerProgress(peerId: NodeId, nextIndex: LogIndex, matchIndex: LogIndex = 0): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.nextIndex = nextIndex;
      peer.matchIndex = matchIndex;
      peer.inFlight = false;
    }
  }

  public addPeer(peerId: NodeId, lastLogIndex: LogIndex): void {
    if (!this.peers.has(peerId)) {
      this.peers.set(peerId, {
        id: peerId,
        nextIndex: lastLogIndex + 1,
        matchIndex: 0,
        lastActivity: Date.now(),
        inFlight: false
      });
    }
  }

  public removePeer(peerId: NodeId): void {
    this.peers.delete(peerId);
  }
}
