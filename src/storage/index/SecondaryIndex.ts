import { Task, TaskStatus } from '../../types';

export class SecondaryIndex {
  private statusIndex: Map<TaskStatus, Set<string>> = new Map();
  private typeIndex: Map<string, Set<string>> = new Map();
  private priorityIndex: Map<number, Set<string>> = new Map();
  private taskToMetadata: Map<string, { status: TaskStatus; type: string; priority: number; scheduledAt: number | null }> = new Map();

  constructor() {
    for (const status of Object.values(TaskStatus)) {
      this.statusIndex.set(status, new Set<string>());
    }
  }

  index(task: Task): void {
    // If previously indexed, unindex first to prevent stale references
    this.unindex(task.id);

    const priority = task.priority ?? 0;
    const scheduledAtTime = task.scheduledAt ? new Date(task.scheduledAt).getTime() : null;

    // Status index
    let statusSet = this.statusIndex.get(task.status);
    if (!statusSet) {
      statusSet = new Set<string>();
      this.statusIndex.set(task.status, statusSet);
    }
    statusSet.add(task.id);

    // Type index
    let typeSet = this.typeIndex.get(task.type);
    if (!typeSet) {
      typeSet = new Set<string>();
      this.typeIndex.set(task.type, typeSet);
    }
    typeSet.add(task.id);

    // Priority index
    let prioSet = this.priorityIndex.get(priority);
    if (!prioSet) {
      prioSet = new Set<string>();
      this.priorityIndex.set(priority, prioSet);
    }
    prioSet.add(task.id);

    this.taskToMetadata.set(task.id, {
      status: task.status,
      type: task.type,
      priority,
      scheduledAt: scheduledAtTime,
    });
  }

  unindex(taskId: string): void {
    const prev = this.taskToMetadata.get(taskId);
    if (!prev) return;

    this.statusIndex.get(prev.status)?.delete(taskId);
    this.typeIndex.get(prev.type)?.delete(taskId);
    this.priorityIndex.get(prev.priority)?.delete(taskId);
    this.taskToMetadata.delete(taskId);
  }

  getByStatus(status: TaskStatus): Set<string> {
    return new Set(this.statusIndex.get(status) ?? []);
  }

  getByType(type: string): Set<string> {
    return new Set(this.typeIndex.get(type) ?? []);
  }

  getByPriorityRange(minPriority: number, maxPriority: number): Set<string> {
    const result = new Set<string>();
    for (const [priority, ids] of this.priorityIndex.entries()) {
      if (priority >= minPriority && priority <= maxPriority) {
        for (const id of ids) {
          result.add(id);
        }
      }
    }
    return result;
  }

  countByStatus(): Record<TaskStatus, number> {
    const counts: Record<string, number> = {};
    for (const status of Object.values(TaskStatus)) {
      counts[status] = this.statusIndex.get(status)?.size ?? 0;
    }
    return counts as Record<TaskStatus, number>;
  }

  clear(): void {
    this.statusIndex.clear();
    for (const status of Object.values(TaskStatus)) {
      this.statusIndex.set(status, new Set<string>());
    }
    this.typeIndex.clear();
    this.priorityIndex.clear();
    this.taskToMetadata.clear();
  }
}
