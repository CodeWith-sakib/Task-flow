import { SoftwareTransactionalMemory } from '../../src/concurrency/stm/SoftwareTransactionalMemory';
import { TransactionalRef } from '../../src/concurrency/stm/TransactionalRef';
import { LeakyBucketRateLimiter } from '../../src/concurrency/ratelimit/LeakyBucketRateLimiter';
import { CSPChannel } from '../../src/concurrency/channel/CSPChannel';

describe('Concurrency & Rate Limiting Fuzzing Tests', () => {
  it('should maintain balance invariants under highly concurrent randomized STM transfers', async () => {
    const stm = new SoftwareTransactionalMemory();
    const accounts = Array.from({ length: 5 }, () => new TransactionalRef(1000));
    const initialTotal = 5000;

    const transfers = Array.from({ length: 50 }, async (_, i) => {
      const fromIdx = i % 5;
      const toIdx = (i + 1) % 5;
      const amount = (i % 10) + 1;

      return stm.atomically((tx) => {
        const fromBal = tx.get(accounts[fromIdx]);
        const toBal = tx.get(accounts[toIdx]);
        tx.set(accounts[fromIdx], fromBal - amount);
        tx.set(accounts[toIdx], toBal + amount);
      });
    });

    await Promise.all(transfers);

    const total = accounts.reduce((acc, a) => acc + a.getRawValue(), 0);
    expect(total).toBe(initialTotal);
  });

  it('should prevent burst overflows under randomized rate limiter traffic', () => {
    const limiter = new LeakyBucketRateLimiter(20, 100);
    let allowedCount = 0;
    let rejectedCount = 0;

    for (let i = 0; i < 100; i++) {
      const res = limiter.tryAcquire(1);
      if (res.allowed) {
        allowedCount++;
      } else {
        rejectedCount++;
      }
    }

    expect(allowedCount).toBeLessThanOrEqual(20);
    expect(rejectedCount).toBeGreaterThan(0);
  });

  it('should reliably deliver all messages through buffered CSP channels without loss', async () => {
    const ch = new CSPChannel<number>(100);
    const count = 50;

    for (let i = 0; i < count; i++) {
      await ch.send(i);
    }

    const received: number[] = [];
    for (let i = 0; i < count; i++) {
      const val = await ch.receive();
      if (val !== undefined) received.push(val);
    }

    expect(received.length).toBe(count);
    expect(received[0]).toBe(0);
    expect(received[count - 1]).toBe(count - 1);
  });
});
