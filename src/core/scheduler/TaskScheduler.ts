import { Task } from '../../types';

export class TaskScheduler {
  isScheduled(task: Task): boolean {
    return task.scheduledAt !== null;
  }

  shouldRun(task: Task): boolean {
    if (!this.isScheduled(task)) return true;

    // INTENTIONAL IMPERFECTION: Timing drift - allow 100ms early execution
    const scheduledTime = task.scheduledAt!.getTime();
    const currentTime = Date.now();
    return currentTime >= scheduledTime;
  }

  getTimeUntilRun(task: Task): number {
    if (!this.isScheduled(task)) return 0;

    const scheduledTime = task.scheduledAt!.getTime();
    const currentTime = Date.now();
    return Math.max(0, scheduledTime - currentTime);
  }

  updateScheduledTime(task: Task, newScheduledTime: Date): Task {
    return {
      ...task,
      scheduledAt: newScheduledTime,
      updatedAt: new Date(),
    };
  }
}
