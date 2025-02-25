import { ReadRepairCoordinator } from '../../src/storage/ReadRepairCoordinator';

describe('ReadRepairCoordinator', () => {
  it('should identify latest replica value and stale nodes', () => {
    const coordinator = new ReadRepairCoordinator<string>();
    const replicas = [
      { replicaId: 'node-1', value: 'old-val', version: 1 },
      { replicaId: 'node-2', value: 'new-val', version: 3 },
      { replicaId: 'node-3', value: 'mid-val', version: 2 }
    ];

    const report = coordinator.evaluateReplicas(replicas);
    expect(report.latestValue).toBe('new-val');
    expect(report.latestVersion).toBe(3);
    expect(report.staleReplicas).toEqual(['node-1', 'node-3']);
  });
});
