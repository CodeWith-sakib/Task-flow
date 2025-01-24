import { SnapshotManager } from '../../src/storage/SnapshotManager';

describe('SnapshotManager', () => {
  it('should create and restore snapshots correctly', () => {
    const manager = new SnapshotManager<{ count: number }>();
    const state = { 'job-1': { count: 10 } };

    manager.createSnapshot('snap-1', state);

    // mutate state
    state['job-1'].count = 20;

    const restored = manager.restoreSnapshot('snap-1');
    expect(restored).toBeDefined();
    expect(restored!['job-1'].count).toBe(10);
  });

  it('should delete and list snapshots', () => {
    const manager = new SnapshotManager<number>();
    manager.createSnapshot('s1', { a: 1 });
    manager.createSnapshot('s2', { b: 2 });

    expect(manager.listSnapshots().length).toBe(2);
    expect(manager.deleteSnapshot('s1')).toBe(true);
    expect(manager.listSnapshots().length).toBe(1);
  });
});
