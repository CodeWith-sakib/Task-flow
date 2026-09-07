import { MerkleAuditTree } from '../../src/security/audit/MerkleAuditTree';
import { ConsistencyProofVerifier } from '../../src/security/audit/ConsistencyProofVerifier';
import { MacaroonManager } from '../../src/security/auth/MacaroonManager';

describe('Security & Validation Property Fuzzing Tests', () => {
  let seed = 9999;
  function pseudoRandom() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }

  it('should verify all leaf inclusion proofs across randomly sized Merkle trees', () => {
    const verifier = new ConsistencyProofVerifier();

    for (let trial = 0; trial < 10; trial++) {
      const tree = new MerkleAuditTree();
      const numLeaves = 1 + Math.floor(pseudoRandom() * 20);

      for (let i = 0; i < numLeaves; i++) {
        tree.append({
          id: `rec-${trial}-${i}`,
          timestamp: 1000 + i,
          actor: `actor-${i % 3}`,
          action: `action-${i % 5}`,
          payloadHash: `hash-${i}`,
        });
      }

      const rootHash = tree.getRootHash();
      expect(tree.size()).toBe(numLeaves);

      for (let i = 0; i < numLeaves; i++) {
        const proof = tree.getInclusionProof(i);
        expect(verifier.verifyInclusion(proof, rootHash)).toBe(true);
      }
    }
  });

  it('should evaluate chained Macaroon caveats under arbitrary predicate permutations', () => {
    const mgr = new MacaroonManager('fuzz-macaroon-seed');
    let mac = mgr.create('token-fuzz-1');

    mac = mgr.addFirstPartyCaveat(mac, 'role = admin');
    mac = mgr.addFirstPartyCaveat(mac, 'region = us-east');
    mac = mgr.addFirstPartyCaveat(mac, 'tier = gold');

    // All match
    expect(mgr.verify(mac, { role: 'admin', region: 'us-east', tier: 'gold' })).toBe(true);

    // One mismatch
    expect(mgr.verify(mac, { role: 'admin', region: 'us-west', tier: 'gold' })).toBe(false);
    expect(mgr.verify(mac, { role: 'viewer', region: 'us-east', tier: 'gold' })).toBe(false);
    expect(mgr.verify(mac, { role: 'admin', region: 'us-east', tier: 'silver' })).toBe(false);
  });
});
