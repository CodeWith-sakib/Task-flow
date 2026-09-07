import { SwimMembershipProtocol } from '../../src/clustering/membership/SwimMembershipProtocol';
import { ConsistentHashRouter } from '../../src/storage/distributed/ConsistentHashRouter';
import { LoadBalancingStrategies } from '../../src/clustering/mesh/LoadBalancingStrategies';
import { MultiPaxosNode } from '../../src/consensus/paxos/MultiPaxosNode';

describe('Clustering & Consensus Boundary Conditions', () => {
  describe('SwimMembershipProtocol boundary checks', () => {
    it('should handle zero members gracefully', () => {
      const swim = new SwimMembershipProtocol('isolated-node', 1000);
      expect(swim.getAllMembers().length).toBe(0);
      expect(swim.getActiveMembers().length).toBe(0);
      expect(swim.getMember('non-existent')).toBeUndefined();
    });

    it('should generate valid PING structure for target node', () => {
      const swim = new SwimMembershipProtocol('node-1', 1000);
      const ping = swim.createPing('node-2');
      expect(ping.sourceNodeId).toBe('node-1');
      expect(ping.targetNodeId).toBe('node-2');
      expect(ping.type).toBe('PING');
      expect(ping.seqNumber).toBeGreaterThan(0);
    });
  });

  describe('ConsistentHashRouter boundary checks', () => {
    it('should return empty preference list when no nodes exist in ring', () => {
      const router = new ConsistentHashRouter(16);
      expect(router.getPreferenceList('task-key-1', 3)).toEqual([]);
    });

    it('should return available node when requested replicas exceed node count', () => {
      const router = new ConsistentHashRouter(16);
      router.addNode({ nodeId: 'single-node', address: '127.0.0.1', port: 9000, isAvailable: true });

      const prefList = router.getPreferenceList('task-key-1', 5);
      expect(prefList.length).toBe(1);
      expect(prefList[0].nodeId).toBe('single-node');
    });

    it('should return all assigned replica nodes in preference list', () => {
      const router = new ConsistentHashRouter(16);
      router.addNode({ nodeId: 'node-1', address: '127.0.0.1', port: 9000, isAvailable: true });
      router.addNode({ nodeId: 'node-2', address: '127.0.0.1', port: 9001, isAvailable: false });

      const prefList = router.getPreferenceList('task-key-1', 2);
      expect(prefList.length).toBe(2);
      expect(prefList.map((n) => n.nodeId)).toContain('node-1');
      expect(prefList.map((n) => n.nodeId)).toContain('node-2');
    });
  });

  describe('LoadBalancingStrategies boundary checks', () => {
    it('should return null when endpoint list is empty or all unhealthy', () => {
      expect(LoadBalancingStrategies.pickPowerOfTwoChoices([])).toBeNull();

      const unhealthy = [
        { id: '1', address: '1.1.1.1', port: 80, weight: 1, activeConnections: 0, ewmaLatencyMs: 10, isHealthy: false },
      ];
      expect(LoadBalancingStrategies.pickPowerOfTwoChoices(unhealthy)).toBeNull();
    });

    it('should return the only endpoint when single healthy endpoint is available', () => {
      const endpoints = [
        { id: '1', address: '1.1.1.1', port: 80, weight: 1, activeConnections: 0, ewmaLatencyMs: 10, isHealthy: true },
        { id: '2', address: '1.1.1.2', port: 80, weight: 1, activeConnections: 5, ewmaLatencyMs: 10, isHealthy: false },
      ];
      const picked = LoadBalancingStrategies.pickPowerOfTwoChoices(endpoints);
      expect(picked?.id).toBe('1');
    });
  });

  describe('MultiPaxosNode boundary checks', () => {
    it('should handle sequential prepare rounds monotonically', () => {
      const node = new MultiPaxosNode({ nodeId: 'paxos-boundary-1', peers: ['paxos-boundary-2'] });
      const p1 = node.prepareLeadership();
      const p2 = node.prepareLeadership();
      expect(p2.proposal.round).toBeGreaterThan(p1.proposal.round);
    });
  });
});
