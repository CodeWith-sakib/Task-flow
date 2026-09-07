import { MerkleAuditTree } from '../../src/security/audit/MerkleAuditTree';
import { PasetoTokenManager } from '../../src/security/auth/PasetoTokenManager';
import { MacaroonManager } from '../../src/security/auth/MacaroonManager';
import { DataRetentionEngine } from '../../src/governance/policy/DataRetentionEngine';
import { LeakyBucketRateLimiter } from '../../src/concurrency/ratelimit/LeakyBucketRateLimiter';

describe('Security & Governance Boundary Conditions', () => {
  describe('MerkleAuditTree boundary checks', () => {
    it('should compute valid root hash for empty tree and single leaf', () => {
      const tree = new MerkleAuditTree();
      expect(tree.size()).toBe(0);
      expect(tree.getRootHash().length).toBe(64);

      tree.append({ id: '1', timestamp: 100, actor: 'bot', action: 'ping', payloadHash: 'abc' });
      expect(tree.size()).toBe(1);
      expect(tree.getRootHash().length).toBe(64);
      expect(tree.getInclusionProof(0).treeSize).toBe(1);
    });

    it('should throw out of bounds error for invalid leaf index', () => {
      const tree = new MerkleAuditTree();
      expect(() => tree.getInclusionProof(0)).toThrow();
      expect(() => tree.getInclusionProof(-1)).toThrow();
    });
  });

  describe('PasetoTokenManager boundary checks', () => {
    it('should reject expired tokens or tampered payloads', () => {
      const mgr = new PasetoTokenManager('test-secret-key-32-characters!!');
      // negative TTL -> expired in the past
      const token = mgr.sign('user-1', -10);
      expect(() => mgr.verify(token)).toThrow();

      // Tampered token
      const validToken = mgr.sign('user-1', 3600);
      const tamperedToken = validToken.slice(0, -5) + 'AAAAA';
      expect(() => mgr.verify(tamperedToken)).toThrow();
    });
  });

  describe('MacaroonManager boundary checks', () => {
    it('should verify macaroon with zero caveats against any context', () => {
      const mgr = new MacaroonManager('macaroon-seed-key');
      const mac = mgr.create('token-0');
      expect(mgr.verify(mac, {})).toBe(true);
      expect(mgr.verify(mac, { arbitrary: 123 })).toBe(true);
    });

    it('should reject tampered signature', () => {
      const mgr = new MacaroonManager('macaroon-seed-key');
      const mac = mgr.create('token-0');
      const tampered = { ...mac, signature: '0000000000000000' };
      expect(mgr.verify(tampered, {})).toBe(false);
    });
  });

  describe('DataRetentionEngine boundary checks', () => {
    it('should respect legalHold flag and preserve record tier regardless of age', () => {
      const engine = new DataRetentionEngine();
      const record = {
        id: 'hold-1',
        tenantId: 'tenant-1',
        workflowType: 'payment',
        createdAt: Date.now() - 1000 * 86400000, // 1000 days old
        lastAccessedAt: Date.now() - 1000 * 86400000,
        currentTier: 'HOT' as const,
        legalHold: true,
      };

      const decision = engine.evaluateRecord(record);
      expect(decision.nextTier).toBe('HOT');
      expect(decision.actionRequired).toBe(false);
    });
  });

  describe('LeakyBucketRateLimiter boundary checks', () => {
    it('should handle zero tokens requested gracefully', () => {
      const limiter = new LeakyBucketRateLimiter(10, 5);
      const res = limiter.tryAcquire(0);
      expect(res.allowed).toBe(true);
    });

    it('should reject request when cost exceeds maximum capacity', () => {
      const limiter = new LeakyBucketRateLimiter(5, 5);
      const res = limiter.tryAcquire(10);
      expect(res.allowed).toBe(false);
    });
  });
});
