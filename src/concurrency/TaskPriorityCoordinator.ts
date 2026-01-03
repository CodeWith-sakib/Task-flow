export interface PrioritizedTask {
  id: string;
  basePriority: number;
  enqueuedAt: number;
}

export class TaskPriorityCoordinator {
  private starvationThresholdMs: number;

  constructor(starvationThresholdMs: number = 60000) {
    this.starvationThresholdMs = starvationThresholdMs;
  }

  public calculateEffectivePriority(task: PrioritizedTask, now: number = Date.now()): number {
    const waitTime = now - task.enqueuedAt;
    if (waitTime >= this.starvationThresholdMs) {
      const boost = Math.floor(waitTime / this.starvationThresholdMs) * 10;
      return task.basePriority + boost;
    }
    return task.basePriority;
  }
}
