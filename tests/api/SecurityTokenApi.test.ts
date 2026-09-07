import { PasetoTokenManager } from '../../src/security/auth/PasetoTokenManager';
import { MacaroonManager } from '../../src/security/auth/MacaroonManager';
import { RoleHierarchyTree } from '../../src/security/rbac/RoleHierarchyTree';
import { DynamicPermissionEvaluator } from '../../src/security/rbac/DynamicPermissionEvaluator';

describe('Security & Auth API Endpoints', () => {
  it('should mint and authenticate requests using PASETO bearer tokens', () => {
    const paseto = new PasetoTokenManager('api-master-secret-32-characters!');
    const token = paseto.sign('usr-881', 3600, { role: 'operator', tenantId: 'tenant-1' });

    expect(token.startsWith('v4.local.')).toBe(true);

    const authContext = paseto.verify(token);
    expect(authContext.sub).toBe('usr-881');
    expect(authContext.claims?.role).toBe('operator');
  });

  it('should verify Macaroon delegation tokens on incoming API calls', () => {
    const macaroonMgr = new MacaroonManager('macaroon-api-secret-key-12345');
    let mac = macaroonMgr.create('req-session-01');
    mac = macaroonMgr.addFirstPartyCaveat(mac, 'method = GET');

    expect(macaroonMgr.verify(mac, { method: 'GET' })).toBe(true);
    expect(macaroonMgr.verify(mac, { method: 'POST' })).toBe(false);
  });

  it('should enforce role-based access control policies on API actions', () => {
    const hierarchy = new RoleHierarchyTree();
    hierarchy.defineRole('reader', ['tasks:read']);
    hierarchy.defineRole('admin', ['tasks:read', 'tasks:write', 'tasks:delete'], ['reader']);

    const evaluator = new DynamicPermissionEvaluator(hierarchy);

    const userCanRead = evaluator.isAuthorized(
      { userId: 'u-1', tenantId: 'tenant-1', roles: ['reader'], attributes: {} },
      'read',
      { resourceId: 'r-1', tenantId: 'tenant-1', resourceType: 'tasks' }
    );
    expect(userCanRead.allowed).toBe(true);

    const userCanDelete = evaluator.isAuthorized(
      { userId: 'u-1', tenantId: 'tenant-1', roles: ['reader'], attributes: {} },
      'delete',
      { resourceId: 'r-1', tenantId: 'tenant-1', resourceType: 'tasks' }
    );
    expect(userCanDelete.allowed).toBe(false);
  });
});
