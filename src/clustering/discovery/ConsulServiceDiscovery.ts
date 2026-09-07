/**
 * Consul/etcd Compatible Service Discovery Client.
 * Handles service registration, heartbeat TTL passes, catalog synchronization,
 * and health check status tracking for cluster worker instances.
 */

export interface ServiceInstance {
  serviceId: string;
  serviceName: string;
  address: string;
  port: number;
  tags: string[];
  meta: Record<string, string>;
  healthStatus: 'PASSING' | 'WARNING' | 'CRITICAL';
  lastHeartbeatTs: number;
}

export class ConsulServiceDiscovery {
  private services = new Map<string, ServiceInstance>();
  private heartbeatTtlMs: number;

  constructor(heartbeatTtlMs: number = 15000) {
    this.heartbeatTtlMs = heartbeatTtlMs;
  }

  public registerService(instance: Omit<ServiceInstance, 'healthStatus' | 'lastHeartbeatTs'>): void {
    this.services.set(instance.serviceId, {
      ...instance,
      healthStatus: 'PASSING',
      lastHeartbeatTs: Date.now(),
    });
  }

  public deregisterService(serviceId: string): boolean {
    return this.services.delete(serviceId);
  }

  public passHeartbeat(serviceId: string): boolean {
    const s = this.services.get(serviceId);
    if (!s) return false;
    s.lastHeartbeatTs = Date.now();
    s.healthStatus = 'PASSING';
    return true;
  }

  public getPassingInstances(serviceName: string, tag?: string): ServiceInstance[] {
    const now = Date.now();
    const results: ServiceInstance[] = [];

    for (const s of this.services.values()) {
      if (s.serviceName !== serviceName) continue;

      // Check TTL expiry
      if (now - s.lastHeartbeatTs > this.heartbeatTtlMs) {
        s.healthStatus = 'CRITICAL';
        continue;
      }

      if (tag && !s.tags.includes(tag)) continue;

      if (s.healthStatus === 'PASSING') {
        results.push({ ...s });
      }
    }

    return results;
  }

  public getAllServices(): ServiceInstance[] {
    return Array.from(this.services.values());
  }
}
