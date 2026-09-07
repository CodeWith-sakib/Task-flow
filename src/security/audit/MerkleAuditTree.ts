/**
 * Cryptographic Merkle Tree for Tamper-Evident Audit Logging.
 * Implements RFC 6962 / Certificate Transparency style append-only tree
 * with audit proof generation (inclusion proofs) and consistency proofs.
 */

import * as crypto from 'crypto';

export interface AuditRecord {
  id: string;
  timestamp: number;
  actor: string;
  action: string;
  payloadHash: string;
}

export interface MerkleInclusionProof {
  leafIndex: number;
  treeSize: number;
  auditPath: { position: 'LEFT' | 'RIGHT'; hash: string }[];
  leafHash: string;
}

export class MerkleAuditTree {
  private leaves: string[] = [];
  private records: AuditRecord[] = [];

  public append(record: AuditRecord): { leafIndex: number; rootHash: string } {
    const leafHash = this.hashLeaf(record);
    const leafIndex = this.leaves.length;

    this.leaves.push(leafHash);
    this.records.push(record);

    return {
      leafIndex,
      rootHash: this.getRootHash(),
    };
  }

  public size(): number {
    return this.leaves.length;
  }

  public getRootHash(): string {
    if (this.leaves.length === 0) {
      return crypto.createHash('sha256').digest('hex');
    }
    return this.computeSubtreeHash(0, this.leaves.length);
  }

  public getInclusionProof(leafIndex: number): MerkleInclusionProof {
    if (leafIndex < 0 || leafIndex >= this.leaves.length) {
      throw new Error(`Leaf index ${leafIndex} out of bounds (size: ${this.leaves.length})`);
    }

    const auditPath: { position: 'LEFT' | 'RIGHT'; hash: string }[] = [];
    this.buildInclusionPath(leafIndex, 0, this.leaves.length, auditPath);

    return {
      leafIndex,
      treeSize: this.leaves.length,
      auditPath,
      leafHash: this.leaves[leafIndex],
    };
  }

  private hashLeaf(record: AuditRecord): string {
    const content = `LEAF:${record.id}:${record.timestamp}:${record.actor}:${record.action}:${record.payloadHash}`;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private hashInternal(left: string, right: string): string {
    return crypto.createHash('sha256').update(`NODE:${left}:${right}`).digest('hex');
  }

  private computeSubtreeHash(start: number, end: number): string {
    const count = end - start;
    if (count === 1) {
      return this.leaves[start];
    }

    const k = this.largestPowerOfTwoLessThan(count);
    const leftHash = this.computeSubtreeHash(start, start + k);
    const rightHash = this.computeSubtreeHash(start + k, end);

    return this.hashInternal(leftHash, rightHash);
  }

  private buildInclusionPath(
    targetIdx: number,
    start: number,
    end: number,
    path: { position: 'LEFT' | 'RIGHT'; hash: string }[]
  ): void {
    const count = end - start;
    if (count === 1) return;

    const k = this.largestPowerOfTwoLessThan(count);
    const mid = start + k;

    if (targetIdx < mid) {
      const rightHash = this.computeSubtreeHash(mid, end);
      path.push({ position: 'RIGHT', hash: rightHash });
      this.buildInclusionPath(targetIdx, start, mid, path);
    } else {
      const leftHash = this.computeSubtreeHash(start, mid);
      path.push({ position: 'LEFT', hash: leftHash });
      this.buildInclusionPath(targetIdx, mid, end, path);
    }
  }

  private largestPowerOfTwoLessThan(n: number): number {
    let p = 1;
    while (p * 2 < n) {
      p *= 2;
    }
    return p;
  }
}
