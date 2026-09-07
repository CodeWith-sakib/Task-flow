export interface FencingToken {
  epoch: number;
  sequence: number;
  holderId: string;
  issuedAt: number;
  signature: string;
}

/**
 * SplitBrainGuard prevents dual-primary execution in partitioned clusters by issuing monotonically
 * increasing fencing tokens and validating majority quorum before mutation authorization.
 */
export class SplitBrainGuard {
  private currentEpoch: number = 0;
  private currentSequence: number = 0;
  private activeToken: FencingToken | null = null;
  private secretKey: string;

  constructor(initialEpoch: number = 1, secretKey: string = 'taskflow-cluster-guard-secret') {
    this.currentEpoch = initialEpoch;
    this.secretKey = secretKey;
  }

  public issueToken(holderId: string, activeNodeCount: number, totalClusterSize: number): FencingToken {
    const quorum = Math.floor(totalClusterSize / 2) + 1;
    if (activeNodeCount < quorum) {
      throw new Error(`Quorum not met: ${activeNodeCount}/${totalClusterSize} active nodes (need ${quorum}). Split-brain prevention active.`);
    }

    this.currentSequence++;
    const issuedAt = Date.now();
    const signature = this.generateSignature(this.currentEpoch, this.currentSequence, holderId, issuedAt);

    const token: FencingToken = {
      epoch: this.currentEpoch,
      sequence: this.currentSequence,
      holderId,
      issuedAt,
      signature
    };

    this.activeToken = token;
    return token;
  }

  public validateToken(token: FencingToken): boolean {
    if (!token) return false;
    if (token.epoch < this.currentEpoch) return false;
    if (token.sequence < this.currentSequence && token.epoch === this.currentEpoch) {
      if (this.activeToken && this.activeToken.sequence > token.sequence) {
        return false;
      }
    }

    const expectedSignature = this.generateSignature(token.epoch, token.sequence, token.holderId, token.issuedAt);
    return expectedSignature === token.signature;
  }

  public advanceEpoch(newEpoch?: number): number {
    this.currentEpoch = newEpoch ?? (this.currentEpoch + 1);
    this.currentSequence = 0;
    this.activeToken = null;
    return this.currentEpoch;
  }

  public getCurrentEpoch(): number {
    return this.currentEpoch;
  }

  public getActiveToken(): FencingToken | null {
    return this.activeToken ? { ...this.activeToken } : null;
  }

  private generateSignature(epoch: number, sequence: number, holderId: string, issuedAt: number): string {
    const raw = `${epoch}:${sequence}:${holderId}:${issuedAt}:${this.secretKey}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}
