import { PriorityPartitionedQueue } from '../../src/queue/PriorityPartitionedQueue';

describe('PriorityPartitionedQueue', () => {
  it('should prioritize tasks within the same partition', () => {
    const q = new PriorityPartitionedQueue<string>();
    q.push('tenant-A', 1, 'low-prio');
    q.push('tenant-A', 10, 'high-prio');
    q.push('tenant-B', 5, 'tenant-B-task');

    expect(q.popPartition('tenant-A')).toBe('high-prio');
    expect(q.popPartition('tenant-A')).toBe('low-prio');
    expect(q.popPartition('tenant-B')).toBe('tenant-B-task');
  });
});
