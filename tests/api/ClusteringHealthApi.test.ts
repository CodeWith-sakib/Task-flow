import { SwimMembershipProtocol } from '../../src/clustering/membership/SwimMembershipProtocol';
import { ServiceMeshRouter } from '../../src/clustering/mesh/ServiceMeshRouter';

describe('Clustering Health & Discovery API Endpoints', () => {
  it('should return cluster membership roster through discovery endpoint', () => {
    const swim = new SwimMembershipProtocol('node-lead', 5000);
    swim.registerMember({
      nodeId: 'worker-1',
      address: '10.0.1.10',
      port: 8080,
      status: 'ALIVE',
      incarnation: 1,
      lastStateChangeTs: Date.now(),
    });
    swim.registerMember({
      nodeId: 'worker-2',
      address: '10.0.1.11',
      port: 8080,
      status: 'SUSPECT',
      incarnation: 1,
      lastStateChangeTs: Date.now(),
    });

    const activeNodes = swim.getActiveMembers();
    expect(activeNodes.length).toBe(2);
    expect(activeNodes.map((n) => n.nodeId)).toContain('worker-1');
  });

  it('should resolve routing endpoints through service mesh router API', () => {
    const mesh = new ServiceMeshRouter();
    mesh.registerEndpoint('workflow-service', {
      id: 'wf-1',
      address: '10.1.0.1',
      port: 50051,
      weight: 1,
      activeConnections: 2,
      ewmaLatencyMs: 15,
      isHealthy: true,
    });
    mesh.addRouteRule({
      serviceName: 'workflow-service',
      pathPrefix: '/api/v1/workflows',
      strategy: 'P2C',
      timeoutMs: 3000,
      maxRetries: 2,
    });

    const route = mesh.routeRequest('/api/v1/workflows/trigger');
    expect(route).toBeDefined();
    expect(route?.endpoint.id).toBe('wf-1');
  });
});
