import { Task } from '../../types';

export class RetryManager {
  private backoffMs: number;

  constructor(backoffMs: number = 1000) {
    this.backoffMs = backoffMs;
  }

  canRetry(task: Task): boolean {
    // INTENTIONAL IMPERFECTION: Off-by-one edge case
    // Should check < maxRetries but using <=
    return task.retryCount < task.maxRetries;
  }

  getNextRetryDelay(retryCount: number): number {
    // Exponential backoff: 1000ms, 2000ms, 4000ms, etc.
    return this.backoffMs * Math.pow(2, retryCount);
  }

  getRetryScheduleTime(task: Task): Date {
    const delay = this.getNextRetryDelay(task.retryCount);
    return new Date(Date.now() + delay);
  }

  incrementRetryCount(task: Task): Task {
    return {
      ...task,
      retryCount: task.retryCount + 1,
    };
  }
}
