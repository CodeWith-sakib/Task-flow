import { HierarchicalTimingWheel } from '../../src/scheduler/wheel/HierarchicalTimingWheel';
import { PriorityAgingManager } from '../../src/scheduler/priority/PriorityAgingManager';
import { PriorityPartitionedQueue } from '../../src/queue/PriorityPartitionedQueue';
import { FairShareScheduler } from '../../src/queue/FairShareScheduler';
import { LeakyBucketRateLimiter } from '../../src/concurrency/ratelimit/LeakyBucketRateLimiter';
import { CSPChannel } from '../../src/concurrency/channel/CSPChannel';
import { SelectMultiplexer } from '../../src/concurrency/channel/SelectMultiplexer';
import { SoftwareTransactionalMemory } from '../../src/concurrency/stm/SoftwareTransactionalMemory';
import { TransactionalRef } from '../../src/concurrency/stm/TransactionalRef';

describe('Queue, Scheduler & Concurrency Integration Tests', () => {
  it('should schedule and expire tasks precisely across HierarchicalTimingWheel levels', () => {
    const now = Date.now();
    const wheel = new HierarchicalTimingWheel(10, 60, now);
    const expired: string[] = [];

    wheel.schedule('job-1', 20, 'payload-1', () => expired.push('job-1'));
    wheel.schedule('job-2', 50, 'payload-2', () => expired.push('job-2'));

    wheel.tick(now + 30);
    expect(expired).toContain('job-1');
    expect(expired).not.toContain('job-2');

    wheel.tick(now + 70);
    expect(expired).toContain('job-2');
  });

  it('should balance tenants fairly with FairShareScheduler and PriorityAgingManager', () => {
    const scheduler = new FairShareScheduler<string>();
    scheduler.enqueue('tenant-1', 'job-t1-1');
    scheduler.enqueue('tenant-2', 'job-t2-1');

    const aging = new PriorityAgingManager(5000, 1);
    aging.registerTask('job-t1-1', 5);
    const promoted = aging.evaluateAging(Date.now() + 6000);
    expect(promoted.promotedTaskIds).toContain('job-t1-1');

    const first = scheduler.scheduleNext();
    expect(first).toBeDefined();
    expect(first?.tenantId).toBe('tenant-1');
    expect(first?.item).toBe('job-t1-1');
  });

  it('should manage partitioned priority queues with FIFO ordering within priority levels', () => {
    const queue = new PriorityPartitionedQueue<string>();
    queue.push('part-0', 1, 'task-low');
    queue.push('part-0', 10, 'task-high-1');
    queue.push('part-0', 10, 'task-high-2');

    const item1 = queue.popPartition('part-0');
    const item2 = queue.popPartition('part-0');
    const item3 = queue.popPartition('part-0');

    expect(item1).toBe('task-high-1');
    expect(item2).toBe('task-high-2');
    expect(item3).toBe('task-low');
  });

  it('should throttle throughput smoothly using LeakyBucketRateLimiter', () => {
    const limiter = new LeakyBucketRateLimiter(5, 10); // capacity 5, leak rate 10/sec

    expect(limiter.tryAcquire(1).allowed).toBe(true);
    expect(limiter.tryAcquire(1).allowed).toBe(true);
    expect(limiter.tryAcquire(1).allowed).toBe(true);
    expect(limiter.tryAcquire(1).allowed).toBe(true);
    expect(limiter.tryAcquire(1).allowed).toBe(true);
    expect(limiter.tryAcquire(1).allowed).toBe(false); // Capacity full
  });

  it('should communicate through Go-like CSP channels and select multiplexers', async () => {
    const ch1 = new CSPChannel<string>(2);
    const ch2 = new CSPChannel<string>(2);

    await ch1.send('msg-from-ch1');

    const result = await SelectMultiplexer.select([
      { channel: ch1, onReceive: (v) => ({ case: 'ch1', val: v }) },
      { channel: ch2, onReceive: (v) => ({ case: 'ch2', val: v }) },
    ]);

    expect(result.case).toBe('ch1');
    expect(result.val).toBe('msg-from-ch1');
  });

  it('should execute atomic transactions with Software Transactional Memory (STM)', async () => {
    const stm = new SoftwareTransactionalMemory();
    const accountA = new TransactionalRef(100);
    const accountB = new TransactionalRef(50);

    await stm.atomically((tx) => {
      const balA = tx.get(accountA);
      const balB = tx.get(accountB);
      tx.set(accountA, balA - 30);
      tx.set(accountB, balB + 30);
    });

    expect(accountA.getRawValue()).toBe(70);
    expect(accountB.getRawValue()).toBe(80);
  });
});
