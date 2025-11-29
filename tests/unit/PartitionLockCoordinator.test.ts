import { PartitionLockCoordinator } from '../../src/concurrency/PartitionLockCoordinator';

describe('PartitionLockCoordinator', () => {
  it('should lock and release partitions correctly', () => {
    const coordinator = new PartitionLockCoordinator();
    expect(coordinator.acquirePartition('part-1', 'worker-A')).toBe(true);
    expect(coordinator.acquirePartition('part-1', 'worker-B')).toBe(false);

    expect(coordinator.releasePartition('part-1', 'worker-A')).toBe(true);
    expect(coordinator.acquirePartition('part-1', 'worker-B')).toBe(true);
  });
});
