import { MerkleAuditTree } from '../../src/security/audit/MerkleAuditTree';
import { ConsistencyProofVerifier } from '../../src/security/audit/ConsistencyProofVerifier';
import { FieldPolicyInterceptor } from '../../src/security/encryption/FieldPolicyInterceptor';
import { PasetoTokenManager } from '../../src/security/auth/PasetoTokenManager';
import { MacaroonManager } from '../../src/security/auth/MacaroonManager';
import { RoleHierarchyTree } from '../../src/security/rbac/RoleHierarchyTree';
import { DynamicPermissionEvaluator } from '../../src/security/rbac/DynamicPermissionEvaluator';
import { DataRetentionEngine } from '../../src/governance/policy/DataRetentionEngine';
import { CostAllocationEngine } from '../../src/governance/billing/CostAllocationEngine';
import { DataLineageTracker } from '../../src/governance/lineage/DataLineageTracker';

describe('Security & Governance Integration Tests', () => {
  it('should build tamper-evident Merkle audit trees and generate verification proofs', () => {
    const tree = new MerkleAuditTree();
    tree.append({ id: '1', timestamp: 100, actor: 'admin', action: 'create_user', payloadHash: 'hash1' });
    tree.append({ id: '2', timestamp: 101, actor: 'admin', action: 'grant_role', payloadHash: 'hash2' });
    tree.append({ id: '3', timestamp: 102, actor: 'system', action: 'run_task', payloadHash: 'hash3' });
    tree.append({ id: '4', timestamp: 103, actor: 'auditor', action: 'export', payloadHash: 'hash4' });

    const rootHash = tree.getRootHash();
    expect(rootHash).toBeDefined();
    expect(rootHash.length).toBe(64);

    const proof = tree.getInclusionProof(2);
    expect(proof).toBeDefined();

    const verifier = new ConsistencyProofVerifier();
    const isValid = verifier.verifyInclusion(proof, rootHash);
    expect(isValid).toBe(true);
  });

  it('should intercept inbound payloads and encrypt sensitive fields per policy', () => {
    const interceptor = new FieldPolicyInterceptor('my-secure-master-key-32-chars!!');
    interceptor.registerPolicy({
      tenantId: 'tenant-alpha',
      encryptedFields: ['ssn'],
      maskedFields: {
        ssn: (v: any) => `***-**-${String(v).slice(-4)}`,
      },
    });

    const record = { id: 'usr-1', name: 'Bob', ssn: '987-65-4321' };
    const secured = interceptor.interceptInbound('tenant-alpha', record);

    expect(secured.name).toBe('Bob');
    expect(secured.ssn).not.toBe('987-65-4321');

    const outbound = interceptor.interceptOutbound('tenant-alpha', secured, ['ADMIN']);
    expect(outbound.ssn).toBe('987-65-4321');
  });

  it('should issue and verify tokens with PASETO and Macaroon caveats', () => {
    const paseto = new PasetoTokenManager('super-secret-key-32-bytes-long!!!');
    const token = paseto.sign('u-123', 3600, { scope: 'workflow:admin' });
    expect(typeof token).toBe('string');

    const verified = paseto.verify(token);
    expect(verified.sub).toBe('u-123');

    const macaroonMgr = new MacaroonManager('macaroon-secret-seed-1234567890');
    let mac = macaroonMgr.create('session-991');
    mac = macaroonMgr.addFirstPartyCaveat(mac, 'action = read');

    expect(macaroonMgr.verify(mac, { action: 'read' })).toBe(true);
    expect(macaroonMgr.verify(mac, { action: 'write' })).toBe(false);
  });

  it('should evaluate RBAC permissions across role hierarchies', () => {
    const hierarchy = new RoleHierarchyTree();
    hierarchy.defineRole('viewer', ['task:read'], []);
    hierarchy.defineRole('editor', ['task:write'], ['viewer']);
    hierarchy.defineRole('admin', ['task:delete'], ['editor']);

    expect(hierarchy.hasPermission(['admin'], 'task:read')).toBe(true);
    expect(hierarchy.hasPermission(['admin'], 'task:write')).toBe(true);
    expect(hierarchy.hasPermission(['admin'], 'task:delete')).toBe(true);
    expect(hierarchy.hasPermission(['editor'], 'task:delete')).toBe(false);
    expect(hierarchy.hasPermission(['viewer'], 'task:write')).toBe(false);

    const evaluator = new DynamicPermissionEvaluator(hierarchy);
    const authDecision = evaluator.isAuthorized(
      { userId: 'u-1', tenantId: 'tenant-1', roles: ['editor'], attributes: {} },
      'write',
      { resourceId: 'res-1', tenantId: 'tenant-1', resourceType: 'task' }
    );
    expect(authDecision.allowed).toBe(true);
  });

  it('should track data lineage and evaluate retention lifecycle tiers', () => {
    const lineage = new DataLineageTracker();
    lineage.recordRun({
      runId: 'run-1',
      job: { namespace: 'default', name: 'etl-job', jobType: 'BATCH' },
      inputs: [{ namespace: 's3', name: 'raw-data' }],
      outputs: [{ namespace: 'dw', name: 'daily-report' }],
      timestamp: Date.now(),
    });

    const upstream = lineage.getUpstreamProvenance('dw:daily-report');
    expect(upstream).toContain('s3:raw-data');

    const retention = new DataRetentionEngine();
    retention.registerPolicy({
      policyId: 'p-1',
      tenantId: 'tenant-1',
      warmTierAfterDays: 7,
      coldTierAfterDays: 30,
      archiveAfterDays: 90,
      purgeAfterDays: 365,
    });

    const record = {
      id: 'rec-1',
      tenantId: 'tenant-1',
      workflowType: 'standard',
      createdAt: Date.now() - 100 * 86400000,
      lastAccessedAt: Date.now() - 100 * 86400000,
      currentTier: 'HOT' as const,
      legalHold: false,
    };

    const evaluation = retention.evaluateRecord(record);
    expect(evaluation.nextTier).toBe('ARCHIVED');
    expect(evaluation.actionRequired).toBe(true);
  });

  it('should allocate costs and generate multi-tenant invoices accurately', () => {
    const costEngine = new CostAllocationEngine({
      computeSecPrice: 0.00002,
      memoryGbHourPrice: 0.004,
    });

    costEngine.recordUsage('tenant-A', { computeMs: 5000, memoryMb: 1024, durationMs: 3600000 });
    const invoiceA = costEngine.generateInvoice('tenant-A');
    expect(invoiceA.totalCost).toBeGreaterThan(0);
  });
});
