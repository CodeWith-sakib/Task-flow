import { ConsistentHashRing } from '../../src/utils/ConsistentHashRing';

describe('ConsistentHashRing', () => {
  it('should distribute keys across nodes predictably', () => {
    const ring = new ConsistentHashRing(5);
    ring.addNode('node1');
    ring.addNode('node2');

    const assigned = ring.getNode('my-task-key');
    expect(['node1', 'node2']).toContain(assigned);
  });
});
