import { SwimMembershipProtocol } from '../../src/clustering/membership/SwimMembershipProtocol';
import { MultiPaxosNode } from '../../src/consensus/paxos/MultiPaxosNode';
import { ConsistentHashRouter } from '../../src/storage/distributed/ConsistentHashRouter';
import { ServiceMeshRouter } from '../../src/clustering/mesh/ServiceMeshRouter';
import { AntiEntropyStateSync } from '../../src/clustering/gossip/AntiEntropyStateSync';

describe('Clustering & Consensus Integration Tests', () => {
  it('should maintain cluster membership and gossip health via SWIM protocol', () => {
    const nodeA = new SwimMembershipProtocol('node-A', 5000);

    nodeA.registerMember({
      nodeId: 'node-B',
      address: '127.0.0.1',
      port: 8002,
      status: 'ALIVE',
      incarnation: 1,
      lastStateChangeTs: Date.now(),
    });
    nodeA.registerMember({
      nodeId: 'node-C',
      address: '127.0.0.1',
      port: 8003,
      status: 'ALIVE',
      incarnation: 1,
      lastStateChangeTs: Date.now(),
    });

    expect(nodeA.getActiveMembers().length).toBe(2);

    const ping = nodeA.createPing('node-B');
    expect(ping.type).toBe('PING');
    expect(ping.targetNodeId).toBe('node-B');
  });

  it('should handle Paxos prepare and promise across MultiPaxosNode instances', () => {
    const paxos1 = new MultiPaxosNode({ nodeId: 'paxos-1', peers: ['paxos-2', 'paxos-3'] });
    const { proposal } = paxos1.prepareLeadership();
    expect(proposal.nodeId).toBe('paxos-1');
    expect(proposal.round).toBe(1);

    const reply = paxos1.handlePrepare(1, proposal);
    expect(reply.promised).toBe(true);
  });

  it('should route keys across consistent hash ring and service mesh', () => {
    const router = new ConsistentHashRouter(64);
    router.addNode({ nodeId: 'worker-1', address: '10.0.0.1', port: 9001, isAvailable: true });
    router.addNode({ nodeId: 'worker-2', address: '10.0.0.2', port: 9002, isAvailable: true });
    router.addNode({ nodeId: 'worker-3', address: '10.0.0.3', port: 9003, isAvailable: true });

    const prefList = router.getPreferenceList('task-10029', 2);
    expect(prefList.length).toBe(2);
    expect(prefList[0].nodeId).toBeDefined();

    const mesh = new ServiceMeshRouter();
    mesh.registerEndpoint('task-service', {
      id: 'ep-1',
      address: '10.0.0.1',
      port: 9000,
      weight: 1,
      activeConnections: 0,
      ewmaLatencyMs: 12,
      isHealthy: true,
    });
    mesh.addRouteRule({
      serviceName: 'task-service',
      pathPrefix: '/tasks',
      strategy: 'P2C',
      timeoutMs: 5000,
      maxRetries: 3,
    });

    const route = mesh.routeRequest('/tasks/submit');
    expect(route).toBeDefined();
    expect(route?.endpoint.address).toBe('10.0.0.1');
  });

  it('should reconcile anti-entropy state digests between nodes', () => {
    const syncA = new AntiEntropyStateSync();
    const syncB = new AntiEntropyStateSync();

    syncA.put('user:101', 1, 'active');
    syncB.put('user:101', 2, 'suspended');

    const digestsA = syncA.generateDigests(2);
    const diff = syncB.findDifferences(digestsA);
    expect(diff.missingOrStaleKeys).toContain('user:101');
  });
});
