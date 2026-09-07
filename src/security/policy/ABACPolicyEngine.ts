export type Effect = 'ALLOW' | 'DENY';

export interface PolicyRule {
  id: string;
  description?: string;
  effect: Effect;
  actions: string[]; // e.g. ['task:create', 'task:*', '*']
  resources: string[]; // e.g. ['tenant:123:tasks:*', '*']
  conditions?: {
    field: string; // e.g. 'subject.tenantId', 'resource.owner', 'env.ip'
    operator: 'EQUALS' | 'NOT_EQUALS' | 'IN' | 'CONTAINS' | 'LESS_THAN' | 'GREATER_THAN';
    value: any;
  }[];
}

export interface AccessRequest {
  subject: {
    id: string;
    roles: string[];
    tenantId: string;
    attributes?: Record<string, any>;
  };
  resource: {
    type: string;
    id: string;
    owner?: string;
    tenantId?: string;
    attributes?: Record<string, any>;
  };
  action: string;
  environment?: {
    ip?: string;
    time?: number;
    isEmergency?: boolean;
    attributes?: Record<string, any>;
  };
}

/**
 * ABACPolicyEngine enforces fine-grained Attribute-Based Access Control policies
 * with Deny-Overrides resolution and condition tree evaluation.
 */
export class ABACPolicyEngine {
  private policies: PolicyRule[] = [];

  public addPolicy(policy: PolicyRule): void {
    this.policies.push(policy);
  }

  public evaluate(request: AccessRequest): { allowed: boolean; matchedRuleId?: string; reason?: string } {
    let hasExplicitAllow = false;
    let matchingAllowRuleId: string | undefined;

    for (const policy of this.policies) {
      if (!this.matchesAction(policy.actions, request.action)) {
        continue;
      }

      const resourcePattern = `${request.resource.type}:${request.resource.id}`;
      if (!this.matchesResource(policy.resources, resourcePattern)) {
        continue;
      }

      if (policy.conditions && !this.evaluateConditions(policy.conditions, request)) {
        continue;
      }

      if (policy.effect === 'DENY') {
        return {
          allowed: false,
          matchedRuleId: policy.id,
          reason: `Explicit DENY by policy '${policy.id}'`
        };
      }

      if (policy.effect === 'ALLOW') {
        hasExplicitAllow = true;
        matchingAllowRuleId = policy.id;
      }
    }

    if (hasExplicitAllow) {
      return {
        allowed: true,
        matchedRuleId: matchingAllowRuleId
      };
    }

    return {
      allowed: false,
      reason: 'Implicit default DENY: no matching ALLOW policy found'
    };
  }

  private matchesAction(patterns: string[], action: string): boolean {
    return patterns.some(pattern => {
      if (pattern === '*' || pattern === action) return true;
      if (pattern.endsWith(':*')) {
        const prefix = pattern.slice(0, -2);
        return action.startsWith(prefix);
      }
      return false;
    });
  }

  private matchesResource(patterns: string[], resource: string): boolean {
    return patterns.some(pattern => {
      if (pattern === '*' || pattern === resource) return true;
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        return resource.startsWith(prefix);
      }
      return false;
    });
  }

  private evaluateConditions(conditions: NonNullable<PolicyRule['conditions']>, request: AccessRequest): boolean {
    for (const cond of conditions) {
      const actualVal = this.resolveField(cond.field, request);
      if (!this.checkCondition(actualVal, cond.operator, cond.value)) {
        return false;
      }
    }
    return true;
  }

  private resolveField(path: string, request: AccessRequest): any {
    const parts = path.split('.');
    let current: any = request;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    return current;
  }

  private checkCondition(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'EQUALS':
        return actual === expected;
      case 'NOT_EQUALS':
        return actual !== expected;
      case 'IN':
        return Array.isArray(expected) && expected.includes(actual);
      case 'CONTAINS':
        return typeof actual === 'string' && actual.includes(String(expected));
      case 'LESS_THAN':
        return Number(actual) < Number(expected);
      case 'GREATER_THAN':
        return Number(actual) > Number(expected);
      default:
        return false;
    }
  }
}
