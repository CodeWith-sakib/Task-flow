import { VisibilityQueue } from '../../src/queue/visibility/VisibilityQueue';
import { DeadLetterQueue } from '../../src/queue/dlq/DeadLetterQueue';
import { CronParser } from '../../src/scheduler/cron/CronParser';
import { TokenBucketRateLimiter } from '../../src/concurrency/limiter/TokenBucketRateLimiter';
import { WorkerPoolAutoscaler } from '../../src/concurrency/pool/WorkerPoolAutoscaler';
import { DAGValidator } from '../../src/workflows/dag/DAGValidator';
import { SecondaryIndex } from '../../src/storage/index/SecondaryIndex';
import { Task, TaskStatus } from '../../src/types';

describe('Boundary Conditions & Extreme Input Tests', () => {
  describe('VisibilityQueue boundary checks', () => {
    it('should handle zero visibility timeout (instant visibility on dequeue)', async () => {
      const q = new VisibilityQueue(undefined, 0, 3);
      await q.enqueue('msg-0', 0, { visibilityTimeoutMs: 0 });

      const item1 = await q.dequeue();
      expect(item1).toBe('msg-0');

      // Immediate dequeue again without ACK should re-deliver immediately because timeout is 0
      const item2 = await q.dequeue();
      expect(item2).toBe('msg-0');
    });

    it('should handle empty queue operations gracefully', async () => {
      const q = new VisibilityQueue();
      expect(await q.dequeue()).toBeNull();
      expect(await q.size()).toBe(0);

      // Acking or nacking non-existent task ID should return false
      expect(await q.ack('non-existent-task')).toBe(false);
      expect(await q.nack('non-existent-task')).toBe(false);
    });

    it('should handle max delivery attempts boundary (deliveryCount >= maxDeliveries routes to DLQ)', async () => {
      const dlq = new DeadLetterQueue();
      const q = new VisibilityQueue(dlq, 1000, 1);
      await q.enqueue('dlq-edge', 0, { maxDeliveries: 1 });

      const dequeued = await q.dequeue();
      expect(dequeued).toBe('dlq-edge');

      // Nacking this when deliveryCount == 1 (reached maxDeliveries) should route to DLQ
      const requeued = await q.nack(dequeued!, true);
      expect(requeued).toBe(false);
      expect(await q.size()).toBe(0);
      expect(dlq.size()).toBe(1);

      const dlqListing = await dlq.list(10);
      expect(dlqListing.items.length).toBe(1);
      expect(dlqListing.items[0].taskId).toBe('dlq-edge');
    });
  });

  describe('CronParser boundary checks', () => {
    it('should handle minute 0 and minute 59 boundaries', () => {
      const now = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
      const next = CronParser.getNextRun('0 0 * * *', now);
      expect(next.toISOString()).toBe('2026-01-02T00:00:00.000Z');

      const next59 = CronParser.getNextRun('59 23 * * *', now);
      expect(next59.toISOString()).toBe('2026-01-01T23:59:00.000Z');
    });

    it('should reject out-of-range cron values', () => {
      expect(CronParser.validate('60 * * * *')).toBe(false);
      expect(CronParser.validate('* 24 * * *')).toBe(false);
      expect(CronParser.validate('* * 0 * *')).toBe(false);
      expect(CronParser.validate('* * 32 * *')).toBe(false);
      expect(CronParser.validate('* * * 0 *')).toBe(false);
      expect(CronParser.validate('* * * 13 *')).toBe(false);
      expect(CronParser.validate('* * * * 8')).toBe(false);
    });

    it('should reject malformed cron patterns with bad field counts', () => {
      expect(CronParser.validate('* * *')).toBe(false);
      expect(CronParser.validate('* * * * * *')).toBe(false);
      expect(() => CronParser.getNextRun('* * *')).toThrow('Invalid cron expression format');
    });
  });

  describe('TokenBucketRateLimiter boundary checks', () => {
    it('should reject requests when capacity is zero', () => {
      const limiter = new TokenBucketRateLimiter({ capacity: 0, refillRatePerSec: 10 });
      expect(limiter.tryAcquire(1)).toBe(false);
      expect(limiter.getAvailableTokens()).toBe(0);
    });

    it('should reject requests when cost exceeds total capacity', () => {
      const limiter = new TokenBucketRateLimiter({ capacity: 5, refillRatePerSec: 10 });
      expect(limiter.tryAcquire(6)).toBe(false);
    });

    it('should handle zero tokens requested', () => {
      const limiter = new TokenBucketRateLimiter({ capacity: 5, refillRatePerSec: 1 });
      expect(limiter.tryAcquire(0)).toBe(true);
      expect(limiter.getAvailableTokens()).toBe(5);
    });
  });

  describe('WorkerPoolAutoscaler boundary checks', () => {
    it('should enforce minConcurrency and maxConcurrency clamp boundaries', () => {
      const pool = new WorkerPoolAutoscaler(2, 5, 10);

      // Queue empty -> maintain minimum concurrency (2)
      const decision1 = pool.evaluate({
        queueDepth: 0,
        currentConcurrency: 2,
        activeWorkers: 0,
        minConcurrency: 2,
        maxConcurrency: 5,
        averageTaskDurationMs: 100,
      });
      expect(decision1.targetConcurrency).toBe(2);
      expect(decision1.shouldScale).toBe(false);

      // Huge queue depth -> scale up capped at maxConcurrency (5)
      const decision2 = pool.evaluate({
        queueDepth: 5000,
        currentConcurrency: 2,
        activeWorkers: 2,
        minConcurrency: 2,
        maxConcurrency: 5,
        averageTaskDurationMs: 100,
      });
      expect(decision2.targetConcurrency).toBe(5);
      expect(decision2.shouldScale).toBe(true);
    });
  });

  describe('DAGValidator boundary checks', () => {
    it('should reject empty workflow definitions', () => {
      const result = DAGValidator.validate({
        id: 'empty-dag',
        name: 'Empty',
        version: 1,
        steps: [],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Workflow must contain at least one step');
    });

    it('should validate single-node DAG', () => {
      const result = DAGValidator.validate({
        id: 'single-step',
        name: 'Single',
        version: 1,
        steps: [
          { id: 'step-1', taskType: 'compute', dependsOn: [] },
        ],
      });
      expect(result.valid).toBe(true);
      expect(result.topologicalOrder).toEqual(['step-1']);
    });

    it('should detect self-referencing dependency cycle', () => {
      const result = DAGValidator.validate({
        id: 'self-loop',
        name: 'Loop',
        version: 1,
        steps: [
          { id: 'step-1', taskType: 'compute', dependsOn: ['step-1'] },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes('cycle detected'))).toBe(true);
    });
  });

  describe('SecondaryIndex boundary checks', () => {
    it('should handle empty index queries gracefully', () => {
      const index = new SecondaryIndex();
      expect(Array.from(index.getByStatus(TaskStatus.SUCCESS))).toEqual([]);
      expect(Array.from(index.getByType('unregistered'))).toEqual([]);
      expect(Array.from(index.getByPriorityRange(10, 20))).toEqual([]);
    });

    it('should maintain consistency on indexing and unindexing same task', () => {
      const index = new SecondaryIndex();
      const task: Task = {
        id: 't-bound-1',
        type: 'index_test',
        status: TaskStatus.PENDING,
        priority: 10,
        payload: {},
        retryCount: 0,
        maxRetries: 3,
        scheduledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      index.index(task);
      expect(Array.from(index.getByStatus(TaskStatus.PENDING))).toEqual(['t-bound-1']);
      expect(Array.from(index.getByType('index_test'))).toEqual(['t-bound-1']);

      index.unindex(task.id);
      expect(Array.from(index.getByStatus(TaskStatus.PENDING))).toEqual([]);
      expect(Array.from(index.getByType('index_test'))).toEqual([]);
    });
  });
});
