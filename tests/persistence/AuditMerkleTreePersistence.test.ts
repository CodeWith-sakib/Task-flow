import { MerkleAuditTree } from '../../src/security/audit/MerkleAuditTree';
import { ConsistencyProofVerifier } from '../../src/security/audit/ConsistencyProofVerifier';

describe('Audit Merkle Tree Persistence & History Tests', () => {
  it('should maintain immutable audit log history and verifiable inclusion proofs across appended entries', () => {
    const tree = new MerkleAuditTree();
    const records = [
      { id: '1', timestamp: 1000, actor: 'alice', action: 'auth.login', payloadHash: 'hash-a' },
      { id: '2', timestamp: 2000, actor: 'bob', action: 'task.create', payloadHash: 'hash-b' },
      { id: '3', timestamp: 3000, actor: 'charlie', action: 'workflow.run', payloadHash: 'hash-c' },
    ];

    records.forEach((r) => tree.append(r));

    const rootHash = tree.getRootHash();
    expect(tree.size()).toBe(3);

    const verifier = new ConsistencyProofVerifier();
    for (let i = 0; i < 3; i++) {
      const proof = tree.getInclusionProof(i);
      expect(verifier.verifyInclusion(proof, rootHash)).toBe(true);
    }
  });
});
