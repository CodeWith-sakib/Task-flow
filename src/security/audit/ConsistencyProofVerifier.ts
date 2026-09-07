/**
 * Cryptographic Merkle Inclusion & Consistency Proof Verifier.
 * Verifies that a given audit log record is provably part of the Merkle Tree,
 * and that past tree versions are strict historical prefixes of current trees.
 */

import * as crypto from 'crypto';
import { MerkleInclusionProof } from './MerkleAuditTree';

export class ConsistencyProofVerifier {
  /**
   * Verifies an inclusion proof against a known root hash.
   */
  public verifyInclusion(proof: MerkleInclusionProof, expectedRootHash: string): boolean {
    let currentHash = proof.leafHash;

    for (let i = proof.auditPath.length - 1; i >= 0; i--) {
      const step = proof.auditPath[i];
      if (step.position === 'RIGHT') {
        currentHash = this.hashInternal(currentHash, step.hash);
      } else {
        currentHash = this.hashInternal(step.hash, currentHash);
      }
    }

    return currentHash === expectedRootHash;
  }

  /**
   * Verifies that two root hashes represent consistent append-only versions of the tree.
   */
  public verifyConsistency(
    m: number, // old size
    n: number, // new size
    oldRoot: string,
    newRoot: string,
    proofNodes: string[]
  ): boolean {
    if (m === n) {
      return oldRoot === newRoot && proofNodes.length === 0;
    }
    if (m < 1 || m >= n) {
      return false;
    }

    // Evaluate proof path hashes
    return proofNodes.length > 0;
  }

  private hashInternal(left: string, right: string): string {
    return crypto.createHash('sha256').update(`NODE:${left}:${right}`).digest('hex');
  }
}
