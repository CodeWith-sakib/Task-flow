export class ScopedRBACOperator {
  private rolePermissions: Map<string, Set<string>> = new Map([
    ['admin', new Set(['task:read', 'task:write', 'task:delete', 'system:manage'])],
    ['operator', new Set(['task:read', 'task:write'])],
    ['viewer', new Set(['task:read'])]
  ]);

  public hasPermission(role: string, permission: string): boolean {
    const perms = this.rolePermissions.get(role);
    return perms ? perms.has(permission) : false;
  }
}
