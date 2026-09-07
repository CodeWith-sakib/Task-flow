/**
 * Dynamic Priority Aging Manager.
 * Gradually elevates the effective priority of tasks waiting in lower-priority queues
 * based on waiting duration to eliminate queue starvation under sustained peak load.
 */

export interface AgedTask {
  taskId: string;
  basePriority: number; // 0 (highest) to 9 (lowest)
  effectivePriority: number;
  enqueuedAt: number;
  lastPromotedAt: number;
}

export class PriorityAgingManager {
  private agingIntervalMs: number;
  private priorityBoostStep: number;
  private tasks = new Map<string, AgedTask>();

  constructor(agingIntervalMs: number = 5000, priorityBoostStep: number = 1) {
    this.agingIntervalMs = agingIntervalMs;
    this.priorityBoostStep = priorityBoostStep;
  }

  public registerTask(taskId: string, basePriority: number): AgedTask {
    const task: AgedTask = {
      taskId,
      basePriority: Math.max(0, Math.min(9, basePriority)),
      effectivePriority: Math.max(0, Math.min(9, basePriority)),
      enqueuedAt: Date.now(),
      lastPromotedAt: Date.now(),
    };

    this.tasks.set(taskId, task);
    return task;
  }

  public completeTask(taskId: string): void {
    this.tasks.delete(taskId);
  }

  public evaluateAging(now: number = Date.now()): { promotedTaskIds: string[] } {
    const promotedTaskIds: string[] = [];

    for (const task of this.tasks.values()) {
      if (task.effectivePriority > 0) {
        const timeSincePromotion = now - task.lastPromotedAt;
        if (timeSincePromotion >= this.agingIntervalMs) {
          task.effectivePriority = Math.max(0, task.effectivePriority - this.priorityBoostStep);
          task.lastPromotedAt = now;
          promotedTaskIds.push(task.taskId);
        }
      }
    }

    return { promotedTaskIds };
  }

  public getEffectivePriority(taskId: string): number | undefined {
    return this.tasks.get(taskId)?.effectivePriority;
  }
}
