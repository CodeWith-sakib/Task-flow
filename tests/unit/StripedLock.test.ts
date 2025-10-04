import { StripedLock } from '../../src/concurrency/StripedLock';

describe('StripedLock', () => {
  it('should serialize executions on the same key', async () => {
    const lock = new StripedLock(4);
    const order: number[] = [];

    const p1 = lock.runExclusive('k1', async () => {
      await new Promise(r => setTimeout(r, 20));
      order.push(1);
    });
    const p2 = lock.runExclusive('k1', async () => {
      order.push(2);
    });

    await Promise.all([p1, p2]);
    expect(order).toEqual([1, 2]);
  });
});
