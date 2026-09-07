export interface RoleDefinition {
  name: string;
  parents?: string[];
  permissions: Set<string>;
}

/**
 * HierarchicalRoleMatrix implements Role-Based Access Control with transitive role inheritance,
 * permission set closure computation, and multi-tenant domain partitioning.
 */
export class HierarchicalRoleMatrix {
  private roles: Map<string, RoleDefinition> = new Map();
  private userRoles: Map<string, Set<string>> = new Map(); // `${tenantId}:${userId}` -> roles

  public defineRole(name: string, permissions: string[], parents: string[] = []): void {
    this.roles.set(name, {
      name,
      parents,
      permissions: new Set(permissions)
    });
  }

  public assignRole(tenantId: string, userId: string, role: string): void {
    if (!this.roles.has(role)) {
      throw new Error(`Cannot assign undefined role: '${role}'`);
    }

    const key = `${tenantId}:${userId}`;
    if (!this.userRoles.has(key)) {
      this.userRoles.set(key, new Set());
    }
    this.userRoles.get(key)!.add(role);
  }

  public revokeRole(tenantId: string, userId: string, role: string): void {
    const key = `${tenantId}:${userId}`;
    this.userRoles.get(key)?.delete(role);
  }

  public getEffectivePermissions(tenantId: string, userId: string): Set<string> {
    const key = `${tenantId}:${userId}`;
    const directRoles = this.userRoles.get(key) || new Set();
    const effectivePerms = new Set<string>();
    const visitedRoles = new Set<string>();

    for (const role of directRoles) {
      this.collectPermissions(role, effectivePerms, visitedRoles);
    }

    return effectivePerms;
  }

  public hasPermission(tenantId: string, userId: string, requiredPermission: string): boolean {
    const perms = this.getEffectivePermissions(tenantId, userId);
    if (perms.has('*') || perms.has(requiredPermission)) {
      return true;
    }

    // Check wildcard scopes (e.g. 'task:*' matches 'task:execute')
    if (requiredPermission.includes(':')) {
      const scope = requiredPermission.split(':')[0] + ':*';
      if (perms.has(scope)) {
        return true;
      }
    }

    return false;
  }

  private collectPermissions(roleName: string, collector: Set<string>, visited: Set<string>): void {
    if (visited.has(roleName)) return;
    visited.add(roleName);

    const role = this.roles.get(roleName);
    if (!role) return;

    for (const perm of role.permissions) {
      collector.add(perm);
    }

    if (role.parents) {
      for (const parent of role.parents) {
        this.collectPermissions(parent, collector, visited);
      }
    }
  }
}
