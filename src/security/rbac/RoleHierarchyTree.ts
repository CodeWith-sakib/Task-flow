/**
 * Hierarchical Role Inheritance Tree (DAG).
 * Resolves transitive role inheritance and compiles effective permissions sets
 * (e.g. SuperAdmin -> Admin -> Operator -> Viewer).
 */

export interface RoleNode {
  name: string;
  directPermissions: Set<string>;
  parentRoles: Set<string>; // roles this role inherits from
}

export class RoleHierarchyTree {
  private roles = new Map<string, RoleNode>();

  public defineRole(roleName: string, directPermissions: string[] = [], inheritedRoles: string[] = []): void {
    const role: RoleNode = {
      name: roleName,
      directPermissions: new Set(directPermissions),
      parentRoles: new Set(inheritedRoles),
    };
    this.roles.set(roleName, role);
  }

  public getEffectivePermissions(roleName: string): Set<string> {
    const effective = new Set<string>();
    const visited = new Set<string>();

    const traverse = (currentRoleName: string) => {
      if (visited.has(currentRoleName)) return;
      visited.add(currentRoleName);

      const node = this.roles.get(currentRoleName);
      if (!node) return;

      for (const p of node.directPermissions) {
        effective.add(p);
      }

      for (const parent of node.parentRoles) {
        traverse(parent);
      }
    };

    traverse(roleName);
    return effective;
  }

  public hasPermission(roleNames: string[], permission: string): boolean {
    for (const r of roleNames) {
      const perms = this.getEffectivePermissions(r);
      if (perms.has(permission) || perms.has('*')) {
        return true;
      }
    }
    return false;
  }
}
