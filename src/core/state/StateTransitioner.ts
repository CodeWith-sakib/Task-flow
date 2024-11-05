import { TaskStatus } from '../../types';

export class StateTransitioner {
  private validTransitions: Map<TaskStatus, TaskStatus[]> = new Map([
    [TaskStatus.PENDING, [TaskStatus.QUEUED, TaskStatus.PENDING]],
    [TaskStatus.QUEUED, [TaskStatus.RUNNING, TaskStatus.PENDING]],
    [TaskStatus.RUNNING, [TaskStatus.SUCCESS, TaskStatus.FAILED]],
    [TaskStatus.SUCCESS, []],
    [TaskStatus.FAILED, [TaskStatus.QUEUED, TaskStatus.PENDING]],
  ]);

  canTransition(from: TaskStatus, to: TaskStatus): boolean {
    if (from === to) {
      return false;
    }
    const allowed = this.validTransitions.get(from) ?? [];
    return allowed.includes(to);
  }

  getValidTransitions(from: TaskStatus): TaskStatus[] {
    return this.validTransitions.get(from) ?? [];
  }
}
