/**
 * Dynamic RBAC + ABAC Hybrid Authorization Evaluator.
 * Evaluates access decisions using role hierarchies combined with dynamic contextual attributes
 * (e.g. tenant boundaries, business hours, IP subnets, resource ownership).
 */

import { RoleHierarchyTree } from './RoleHierarchyTree';

export interface AuthorizationSubject {
  userId: string;
  tenantId: string;
  roles: string[];
  attributes: Record<string, any>;
}

export interface AuthorizationResource {
  resourceId: string;
  tenantId: string;
  ownerId?: string;
  resourceType: string;
  attributes?: Record<string, any>;
}

export interface AuthorizationEnvironment {
  ipAddress?: string;
  currentTime?: number;
  allowedTimeRange?: { startHourUtc: number; endHourUtc: number };
}

export class DynamicPermissionEvaluator {
  private roleTree: RoleHierarchyTree;

  constructor(roleTree?: RoleHierarchyTree) {
    this.roleTree = roleTree || new RoleHierarchyTree();
  }

  public getRoleTree(): RoleHierarchyTree {
    return this.roleTree;
  }

  public isAuthorized(
    subject: AuthorizationSubject,
    action: string,
    resource: AuthorizationResource,
    env: AuthorizationEnvironment = {}
  ): { allowed: boolean; reason?: string } {
    // 1. Tenant Boundary Isolation Guard
    if (subject.tenantId !== '*' && resource.tenantId !== '*' && subject.tenantId !== resource.tenantId) {
      return { allowed: false, reason: 'Cross-tenant access violation' };
    }

    // 2. Time-of-day access constraint
    if (env.allowedTimeRange && env.currentTime) {
      const date = new Date(env.currentTime);
      const hour = date.getUTCHours();
      if (hour < env.allowedTimeRange.startHourUtc || hour > env.allowedTimeRange.endHourUtc) {
        return { allowed: false, reason: 'Access outside allowed operating hours' };
      }
    }

    // 3. Resource ownership fast-path
    if (resource.ownerId && resource.ownerId === subject.userId) {
      return { allowed: true };
    }

    // 4. Role-based permission evaluation
    const requiredPermission = `${resource.resourceType}:${action}`;
    const hasPerm = this.roleTree.hasPermission(subject.roles, requiredPermission);

    if (!hasPerm) {
      return { allowed: false, reason: `Missing required permission "${requiredPermission}"` };
    }

    return { allowed: true };
  }
}
