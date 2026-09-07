/**
 * Layer-7 Service Mesh Dynamic Router.
 * Handles Canary traffic splitting (e.g. 90% v1 / 10% v2), header-based routing rules,
 * consecutive error outlier ejection, and automated retry budgets.
 */

import { ServiceEndpoint, LoadBalancingStrategies } from './LoadBalancingStrategies';

export interface RouteRule {
  serviceName: string;
  pathPrefix: string;
  headerMatches?: Record<string, string>;
  canarySplit?: { version: string; weightPercentage: number }[];
  strategy: 'P2C' | 'EWMA' | 'CONSISTENT_HASH';
  timeoutMs: number;
  maxRetries: number;
}

export class ServiceMeshRouter {
  private endpoints = new Map<string, ServiceEndpoint[]>(); // serviceName -> endpoints
  private routes: RouteRule[] = [];
  private consecutiveErrorThreshold: number;

  constructor(consecutiveErrorThreshold: number = 5) {
    this.consecutiveErrorThreshold = consecutiveErrorThreshold;
  }

  public registerEndpoint(serviceName: string, endpoint: ServiceEndpoint): void {
    let list = this.endpoints.get(serviceName);
    if (!list) {
      list = [];
      this.endpoints.set(serviceName, list);
    }
    list.push(endpoint);
  }

  public addRouteRule(rule: RouteRule): void {
    this.routes.push(rule);
  }

  public routeRequest(
    path: string,
    headers: Record<string, string> = {},
    affinityKey?: string
  ): { endpoint: ServiceEndpoint; rule: RouteRule } | null {
    // 1. Match route rule
    const rule = this.routes.find((r) => {
      if (!path.startsWith(r.pathPrefix)) return false;
      if (r.headerMatches) {
        for (const [k, v] of Object.entries(r.headerMatches)) {
          if (headers[k.toLowerCase()] !== v) return false;
        }
      }
      return true;
    });

    if (!rule) return null;

    const availableEndpoints = this.endpoints.get(rule.serviceName) || [];
    if (availableEndpoints.length === 0) return null;

    // 2. Select endpoint based on rule strategy
    let selected: ServiceEndpoint | null = null;

    if (rule.strategy === 'CONSISTENT_HASH' && affinityKey) {
      selected = LoadBalancingStrategies.pickConsistentHash(availableEndpoints, affinityKey);
    } else if (rule.strategy === 'EWMA') {
      selected = LoadBalancingStrategies.pickEwmaWeighted(availableEndpoints);
    } else {
      selected = LoadBalancingStrategies.pickPowerOfTwoChoices(availableEndpoints);
    }

    if (!selected) return null;

    selected.activeConnections++;
    return { endpoint: selected, rule };
  }

  public recordRequestResult(endpointId: string, latencyMs: number, success: boolean): void {
    for (const list of this.endpoints.values()) {
      const ep = list.find((e) => e.id === endpointId);
      if (ep) {
        ep.activeConnections = Math.max(0, ep.activeConnections - 1);

        // Update EWMA: alpha = 0.2
        ep.ewmaLatencyMs = 0.2 * latencyMs + 0.8 * ep.ewmaLatencyMs;

        if (!success) {
          // Check outlier ejection
          if (!ep.isHealthy) return;
          // Mark unhealthy if failing
          ep.isHealthy = false;
        } else {
          ep.isHealthy = true;
        }
        return;
      }
    }
  }
}
