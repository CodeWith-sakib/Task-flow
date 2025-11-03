import { LeaseManager } from '../../src/concurrency/lease/LeaseManager';

describe('LeaseManager (Concurrency)', () => {
  let leaseManager: LeaseManager;

  beforeEach(() => {
    leaseManager = new LeaseManager();
  });

  it('should acquire a lease with a unique monotonically increasing fencing token', () => {
    const l1 = leaseManager.acquireLease('task_lock_1', 'worker_A', 1000);
    expect(l1).not.toBeNull();
    expect(l1?.holderId).toBe('worker_A');
    expect(l1?.fenceToken).toBe(1);

    // Another worker fails to acquire while lease is active
    const l2 = leaseManager.acquireLease('task_lock_1', 'worker_B', 1000);
    expect(l2).toBeNull();
  });

  it('should renew an active lease only with the correct fence token', () => {
    const lease = leaseManager.acquireLease('res_1', 'worker_A', 1000)!;

    // Wrong fence token fails
    const invalidRenew = leaseManager.renewLease('res_1', 'worker_A', 9999, 2000);
    expect(invalidRenew).toBe(false);

    // Correct fence token succeeds
    const validRenew = leaseManager.renewLease('res_1', 'worker_A', lease.fenceToken, 2000);
    expect(validRenew).toBe(true);
    expect(lease.renewCount).toBe(1);
  });

  it('should release a lease and allow another worker to acquire a higher fence token', () => {
    const l1 = leaseManager.acquireLease('res_1', 'worker_A', 5000)!;
    const released = leaseManager.releaseLease('res_1', 'worker_A', l1.fenceToken);
    expect(released).toBe(true);

    const l2 = leaseManager.acquireLease('res_1', 'worker_B', 5000)!;
    expect(l2).not.toBeNull();
    expect(l2.holderId).toBe('worker_B');
    expect(l2.fenceToken).toBeGreaterThan(l1.fenceToken);
  });
});
