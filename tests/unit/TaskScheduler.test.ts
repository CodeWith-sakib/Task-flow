import { TaskScheduler } from '../../src/core/scheduler/TaskScheduler';
import { TaskStatus } from '../../src/types';

describe('TaskScheduler', () => {
  it('should determine if task is scheduled', () => {
    const scheduler = new TaskScheduler();

    const scheduledTask = {
      id: 'test',
      type: 'test',
      payload: {},
      status: TaskStatus.PENDING,
      retryCount: 0,
      maxRetries: 3,
      scheduledAt: new Date(Date.now() + 5000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const unscheduledTask = {
      ...scheduledTask,
      scheduledAt: null,
    };

    expect(scheduler.isScheduled(scheduledTask)).toBe(true);
    expect(scheduler.isScheduled(unscheduledTask)).toBe(false);
  });

  it('should determine if task should run', () => {
    const scheduler = new TaskScheduler();

    // Scheduled for past
    const pastTask = {
      id: 'test',
      type: 'test',
      payload: {},
      status: TaskStatus.PENDING,
      retryCount: 0,
      maxRetries: 3,
      scheduledAt: new Date(Date.now() - 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Scheduled for future
    const futureTask = {
      ...pastTask,
      scheduledAt: new Date(Date.now() + 10000),
    };

    expect(scheduler.shouldRun(pastTask)).toBe(true);
    expect(scheduler.shouldRun(futureTask)).toBe(false);
  });

  it('should not allow early execution for future tasks', () => {
    const scheduler = new TaskScheduler();

    // Scheduled for ~90ms from now
    const task = {
      id: 'test',
      type: 'test',
      payload: {},
      status: TaskStatus.PENDING,
      retryCount: 0,
      maxRetries: 3,
      scheduledAt: new Date(Date.now() + 90),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Should not run early
    expect(scheduler.shouldRun(task)).toBe(false);
  });
});
