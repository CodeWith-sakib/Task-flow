import { RetryManager } from '../../src/core/retry/RetryManager';
import { TaskStatus } from '../../src/types';

describe('RetryManager', () => {
  it('should determine if task can retry', () => {
    const manager = new RetryManager(1000);

    const task = {
      id: 'test',
      type: 'email',
      payload: {},
      status: TaskStatus.FAILED,
      retryCount: 2,
      maxRetries: 3,
      scheduledAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(manager.canRetry(task)).toBe(true);

    task.retryCount = 3;
    expect(manager.canRetry(task)).toBe(false);
  });

  it('should calculate exponential backoff delay', () => {
    const manager = new RetryManager(1000);

    expect(manager.getNextRetryDelay(0)).toBe(1000);
    expect(manager.getNextRetryDelay(1)).toBe(2000);
    expect(manager.getNextRetryDelay(2)).toBe(4000);
    expect(manager.getNextRetryDelay(3)).toBe(8000);
  });

  it('should increment retry count', () => {
    const manager = new RetryManager(1000);

    const task = {
      id: 'test',
      type: 'test',
      payload: {},
      status: TaskStatus.FAILED,
      retryCount: 1,
      maxRetries: 3,
      scheduledAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const incremented = manager.incrementRetryCount(task);

    expect(incremented.retryCount).toBe(2);
  });
});
