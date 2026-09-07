import { PasetoTokenManager } from '../../src/security/auth/PasetoTokenManager';
import { DynamicPermissionEvaluator } from '../../src/security/rbac/DynamicPermissionEvaluator';
import { RoleHierarchyTree } from '../../src/security/rbac/RoleHierarchyTree';

describe('Security Breach & Authorization Error Handling Tests', () => {
  it('should throw explicit format error on malformed or manipulated token header', () => {
    const mgr = new PasetoTokenManager('super-secret-key-32-chars-long!');

    expect(() => mgr.verify('invalid.token.structure')).toThrow(/Invalid PASETO token header/);
    expect(() => mgr.verify('v1.local.somedata')).toThrow(/Invalid PASETO token header/);
  });

  it('should prevent cross-tenant resource access and return explicit rejection reason', () => {
    const hierarchy = new RoleHierarchyTree();
    hierarchy.defineRole('admin', ['*']);

    const evaluator = new DynamicPermissionEvaluator(hierarchy);

    const crossTenantDecision = evaluator.isAuthorized(
      { userId: 'user-tenant-a', tenantId: 'tenant-a', roles: ['admin'], attributes: {} },
      'read',
      { resourceId: 'res-99', tenantId: 'tenant-b', resourceType: 'tasks' }
    );

    expect(crossTenantDecision.allowed).toBe(false);
    expect(crossTenantDecision.reason).toContain('Cross-tenant access violation');
  });

  it('should return failure reason when role lacks required permission', () => {
    const hierarchy = new RoleHierarchyTree();
    hierarchy.defineRole('viewer', ['tasks:read']);

    const evaluator = new DynamicPermissionEvaluator(hierarchy);

    const unauthorizedDecision = evaluator.isAuthorized(
      { userId: 'u-1', tenantId: 'tenant-1', roles: ['viewer'], attributes: {} },
      'delete',
      { resourceId: 'res-1', tenantId: 'tenant-1', resourceType: 'tasks' }
    );

    expect(unauthorizedDecision.allowed).toBe(false);
    expect(unauthorizedDecision.reason).toContain('Missing required permission');
  });
});
