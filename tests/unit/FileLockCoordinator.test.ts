import { FileLockCoordinator } from '../../src/storage/FileLockCoordinator';

describe('FileLockCoordinator', () => {
  it('should acquire and release lock for owner', () => {
    const coordinator = new FileLockCoordinator();
    expect(coordinator.tryAcquire('/var/data/wal', 'worker-1')).toBe(true);
    expect(coordinator.isLocked('/var/data/wal')).toBe(true);

    // Another worker cannot acquire
    expect(coordinator.tryAcquire('/var/data/wal', 'worker-2')).toBe(false);

    // Release and re-acquire
    expect(coordinator.release('/var/data/wal', 'worker-1')).toBe(true);
    expect(coordinator.tryAcquire('/var/data/wal', 'worker-2')).toBe(true);
  });

  it('should expire stale locks after TTL', () => {
    const coordinator = new FileLockCoordinator();
    coordinator.tryAcquire('/var/data/tmp', 'worker-1', 10);
    // simulate expiry
    const lock = (coordinator as any).activeLocks.get('/var/data/tmp');
    lock.acquiredAt -= 20;

    expect(coordinator.isLocked('/var/data/tmp')).toBe(false);
    expect(coordinator.tryAcquire('/var/data/tmp', 'worker-2')).toBe(true);
  });
});
