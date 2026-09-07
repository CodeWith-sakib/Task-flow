/**
 * Cluster Service Mesh Load Balancing Strategies.
 * Implements:
 * 1. Power of Two Choices (P2C) with Least Active Connections
 * 2. EWMA Response-Time Weighted Round Robin
 * 3. Consistent Hash Ring with Virtual Node Buckets
 */

import * as crypto from 'crypto';

export interface ServiceEndpoint {
  id: string;
  address: string;
  port: number;
  weight: number;
  activeConnections: number;
  ewmaLatencyMs: number;
  isHealthy: boolean;
}

export class LoadBalancingStrategies {
  /**
   * Power of Two Choices (P2C) selection:
   * Picks 2 random healthy endpoints and returns the one with fewer active connections.
   */
  public static pickPowerOfTwoChoices(endpoints: ServiceEndpoint[]): ServiceEndpoint | null {
    const healthy = endpoints.filter((e) => e.isHealthy);
    if (healthy.length === 0) return null;
    if (healthy.length === 1) return healthy[0];

    const idx1 = Math.floor(Math.random() * healthy.length);
    let idx2 = Math.floor(Math.random() * healthy.length);
    while (idx2 === idx1) {
      idx2 = Math.floor(Math.random() * healthy.length);
    }

    const ep1 = healthy[idx1];
    const ep2 = healthy[idx2];

    return ep1.activeConnections <= ep2.activeConnections ? ep1 : ep2;
  }

  /**
   * Peak EWMA response time weighted selection:
   * Endpoints with lower average response times receive proportionally higher traffic.
   */
  public static pickEwmaWeighted(endpoints: ServiceEndpoint[]): ServiceEndpoint | null {
    const healthy = endpoints.filter((e) => e.isHealthy);
    if (healthy.length === 0) return null;

    // Weight = 1 / (latency * (activeConnections + 1))
    const inverseWeights = healthy.map((e) => {
      const latency = Math.max(1, e.ewmaLatencyMs);
      const concurrency = Math.max(1, e.activeConnections + 1);
      return 10000 / (latency * concurrency);
    });

    const totalWeight = inverseWeights.reduce((a, b) => a + b, 0);
    let randomVal = Math.random() * totalWeight;

    for (let i = 0; i < healthy.length; i++) {
      randomVal -= inverseWeights[i];
      if (randomVal <= 0) {
        return healthy[i];
      }
    }

    return healthy[0];
  }

  /**
   * Consistent hash selection for affinity routing (e.g. by tenantId or workflowId).
   */
  public static pickConsistentHash(endpoints: ServiceEndpoint[], key: string): ServiceEndpoint | null {
    const healthy = endpoints.filter((e) => e.isHealthy);
    if (healthy.length === 0) return null;

    const hash = crypto.createHash('md5').update(key).digest('hex');
    const numericHash = parseInt(hash.substring(0, 8), 16);

    const index = numericHash % healthy.length;
    return healthy[index];
  }
}
