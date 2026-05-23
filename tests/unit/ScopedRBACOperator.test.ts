import { ScopedRBACOperator } from '../../src/security/ScopedRBACOperator';

describe('ScopedRBACOperator', () => {
  it('should correctly evaluate role permissions', () => {
    const rbac = new ScopedRBACOperator();
    expect(rbac.hasPermission('admin', 'system:manage')).toBe(true);
    expect(rbac.hasPermission('operator', 'task:write')).toBe(true);
    expect(rbac.hasPermission('viewer', 'task:write')).toBe(false);
    expect(rbac.hasPermission('viewer', 'task:read')).toBe(true);
  });
});
