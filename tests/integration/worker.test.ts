import { createTestService } from '../setup';
import { TaskStatus } from '../../src/types';

describe('Worker Integration', () => {
  it('should process multiple tasks sequentially', async () => {
    const service = createTestService();
    const results: string[] = [];

    // Register handler that records processing order
    service.registerHandler('track', async (payload: any) => {
      results.push(`task_${payload.id}`);
      return { id: payload.id };
    });

    // Create multiple tasks
    const task1 = await service.createTask({
      type: 'track',
      payload: { id: 1 },
    });

    const task2 = await service.createTask({
      type: 'track',
      payload: { id: 2 },
    });

    // Manually execute tasks (simulating worker)
    const handler = service.getHandlerRegistry();
    await handler.executeHandler('track', { id: 1 });
    await handler.executeHandler('track', { id: 2 });

    expect(results).toEqual(['task_1', 'task_2']);
  });

  it('should handle handler not found gracefully', async () => {
    const service = createTestService();

    const task = await service.createTask({
      type: 'unknown_type',
      payload: {},
    });

    const registry = service.getHandlerRegistry();

    await expect(async () => {
      await registry.executeHandler('unknown_type', {});
    }).rejects.toThrow('No handler registered for task type: unknown_type');
  });

  it('should track task status changes through lifecycle', async () => {
    const service = createTestService();

    // Create task with scheduled time so it's not auto-enqueued
    const futureTime = new Date(Date.now() + 10000);
    const task = await service.createTask({
      type: 'test',
      payload: {},
      scheduledAt: futureTime,
    });

    // Get task and verify initial state (PENDING because scheduled)
    let current = await service.getTask(task.id);
    expect(current?.status).toBe(TaskStatus.PENDING);

    // Manually update to queued
    current = await service.updateTaskStatus(task.id, TaskStatus.QUEUED);
    expect(current?.status).toBe(TaskStatus.QUEUED);

    // Process as success
    current = await service.processTaskResult(task.id, true, { success: true });
    expect(current?.status).toBe(TaskStatus.SUCCESS);
  });

  it('should handle multiple retries with increasing delays', async () => {
    const service = createTestService();

    const task = await service.createTask({
      type: 'flaky',
      payload: { attempt: 0 },
      maxRetries: 3,
    });

    let current = await service.getTask(task.id);
    const initialScheduled = current?.scheduledAt;

    // First failure
    let result = await service.processTaskResult(task.id, false, undefined, 'Error 1');
    expect(result?.retryCount).toBe(1);
    expect(result?.status).toBe(TaskStatus.PENDING);

    let firstRetryTime = result?.scheduledAt?.getTime() || 0;

    // Second failure (should have longer delay)
    result = await service.processTaskResult(task.id, false, undefined, 'Error 2');
    expect(result?.retryCount).toBe(2);

    let secondRetryTime = result?.scheduledAt?.getTime() || 0;

    // Verify backoff increased
    const firstDelay = firstRetryTime - Date.now();
    const secondDelay = secondRetryTime - Date.now();

    // Second delay should be roughly 2x first delay (exponential backoff)
    expect(secondDelay).toBeGreaterThan(firstDelay);
  });
});
