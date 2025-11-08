import { DistributedLockSimulator } from '../../src/concurrency/DistributedLockSimulator';

describe('DistributedLockSimulator', () => {
  it('should provide fencing tokens upon successful lock acquisition', () => {
    const sim = new DistributedLockSimulator();
    const res1 = sim.tryLock('resA', 'client1', 5000);
    expect(res1.success).toBe(true);
    expect(res1.token).toBe(1);

    const res2 = sim.tryLock('resA', 'client2', 5000);
    expect(res2.success).toBe(false);

    expect(sim.unlock('resA', 'client1')).toBe(true);
    const res3 = sim.tryLock('resA', 'client2', 5000);
    expect(res3.success).toBe(true);
    expect(res3.token).toBe(2);
  });
});
