import { createTestService } from '../setup';
import { TaskStatus } from '../../src/types';

describe('Task Lifecycle Integration', () => {
  it('should complete a full task lifecycle', async () => {
    const service = createTestService();

    // Register a handler
    service.registerHandler('process_data', async (payload: any) => {
      return { processed: true, data: payload };
    });

    // Create task
    const task = await service.createTask({
      type: 'process_data',
      payload: { value: 42 },
      maxRetries: 2,
    });

    // Task is auto-enqueued when not scheduled
    expect(task.status).toBe(TaskStatus.PENDING);
    expect(task.retryCount).toBe(0);

    // Simulate task execution success
    const result = await service.processTaskResult(task.id, true, { processed: true });

    expect(result?.status).toBe(TaskStatus.SUCCESS);
    expect(result?.result).toEqual({ processed: true });
  });

  it('should handle task failure with retry', async () => {
    const service = createTestService();

    const task = await service.createTask({
      type: 'failing_task',
      payload: { id: 1 },
      maxRetries: 2,
    });

    const taskId = task.id;

    // First failure - should retry
    const afterFirstFailure = await service.processTaskResult(
      taskId,
      false,
      undefined,
      'Connection timeout'
    );

    expect(afterFirstFailure?.status).toBe(TaskStatus.PENDING);
    expect(afterFirstFailure?.retryCount).toBe(1);
    expect(afterFirstFailure?.error).toBe('Connection timeout');
    expect(afterFirstFailure?.scheduledAt).not.toBeNull();
  });

  it('should mark task as failed after max retries', async () => {
    const service = createTestService();

    const task = await service.createTask({
      type: 'test',
      payload: {},
      maxRetries: 1,
    });

    // First failure
    await service.processTaskResult(task.id, false, undefined, 'Error 1');

    // Get updated task
    const updated1 = await service.getTask(task.id);
    expect(updated1?.status).toBe(TaskStatus.PENDING);
    expect(updated1?.retryCount).toBe(1);

    // Second failure - retryCount (1) is >= maxRetries (1), so it transitions to FAILED
    const final = await service.processTaskResult(task.id, false, undefined, 'Error 2');

    expect(final?.status).toBe(TaskStatus.FAILED);
    expect(final?.retryCount).toBe(1);
  });

  it('should handle scheduled task execution', async () => {
    const service = createTestService();

    const futureTime = new Date(Date.now() + 5000);
    const task = await service.createTask({
      type: 'scheduled',
      payload: { action: 'remind' },
      scheduledAt: futureTime,
    });

    // Task should remain PENDING when scheduled for future
    const retrieved = await service.getTask(task.id);
    expect(retrieved?.status).toBe(TaskStatus.PENDING);
    expect(retrieved?.scheduledAt).toEqual(futureTime);
  });
});
