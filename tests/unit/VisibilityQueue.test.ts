import { VisibilityQueue } from '../../src/queue/visibility/VisibilityQueue';
import { DeadLetterQueue } from '../../src/queue/dlq/DeadLetterQueue';

describe('VisibilityQueue & DeadLetterQueue', () => {
  let queue: VisibilityQueue;
  let dlq: DeadLetterQueue;

  beforeEach(() => {
    dlq = new DeadLetterQueue();
    queue = new VisibilityQueue(dlq, 500, 2); // 500ms visibility timeout, max 2 deliveries
  });

  it('should dequeue tasks respecting priority order', async () => {
    await queue.enqueue('low_prio', 1);
    await queue.enqueue('high_prio', 10);
    await queue.enqueue('med_prio', 5);

    const first = await queue.dequeue();
    const second = await queue.dequeue();
    const third = await queue.dequeue();

    expect(first).toBe('high_prio');
    expect(second).toBe('med_prio');
    expect(third).toBe('low_prio');
  });

  it('should acknowledge in-flight tasks and remove them permanently', async () => {
    await queue.enqueue('task_1', 1);
    const dequeued = await queue.dequeue();
    expect(dequeued).toBe('task_1');

    const metricsBeforeAck = await queue.getMetrics();
    expect(metricsBeforeAck.inflight).toBe(1);

    const ackSuccess = await queue.ack('task_1');
    expect(ackSuccess).toBe(true);

    const metricsAfterAck = await queue.getMetrics();
    expect(metricsAfterAck.inflight).toBe(0);
    expect(metricsAfterAck.totalProcessed).toBe(1);
  });

  it('should route to DeadLetterQueue when max deliveries exceeded on nack', async () => {
    await queue.enqueue('poison_pill', 5, { maxDeliveries: 1 });

    const taskId = await queue.dequeue();
    expect(taskId).toBe('poison_pill');

    // Nack with maxDeliveries=1 should route to DLQ
    const requeued = await queue.nack('poison_pill', true);
    expect(requeued).toBe(false);

    expect(dlq.size()).toBe(1);
    const dlqItems = await dlq.list();
    expect(dlqItems.items[0].taskId).toBe('poison_pill');
    expect(dlqItems.items[0].failureReason).toContain('Exceeded maximum deliveries');
  });

  it('should replay dead-lettered tasks back into target queue', async () => {
    await queue.enqueue('failed_task', 2, { maxDeliveries: 1 });
    await queue.dequeue();
    await queue.nack('failed_task', false);

    expect(dlq.size()).toBe(1);
    const dlqItem = (await dlq.list()).items[0];

    const replayed = await dlq.replay(dlqItem.id, async (id, prio) => {
      await queue.enqueue(id, prio);
    });

    expect(replayed).toBe(true);
    expect(dlq.size()).toBe(0);

    const dequeuedAgain = await queue.dequeue();
    expect(dequeuedAgain).toBe('failed_task');
  });

  it('should redeliver tasks after visibility timeout expires', async () => {
    queue = new VisibilityQueue(dlq, 50, 3); // 50ms visibility
    await queue.enqueue('retry_me', 1);

    const first = await queue.dequeue();
    expect(first).toBe('retry_me');

    // Queue is empty because task is in-flight
    expect(await queue.dequeue()).toBeNull();

    // Advance time past visibility timeout
    queue.checkVisibilityExpirations(Date.now() + 100);

    // Should now be dequeuable again
    const redelivery = await queue.dequeue();
    expect(redelivery).toBe('retry_me');
  });
});
