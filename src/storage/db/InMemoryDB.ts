import { Task, TaskStatus, CreateTaskRequest } from '../../types';
import { v4 as uuidv4 } from 'uuid';

export class InMemoryDB {
  private tasks: Map<string, Task> = new Map();

  async createTask(request: CreateTaskRequest): Promise<Task> {
    const task: Task = {
      id: uuidv4(),
      type: request.type,
      payload: request.payload,
      status: TaskStatus.PENDING,
      retryCount: 0,
      maxRetries: request.maxRetries ?? 3,
      scheduledAt: request.scheduledAt ?? null,
      deadline: request.deadline ?? null,
      priority: request.priority ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.tasks.set(task.id, task);
    return task;
  }

  async getTask(id: string): Promise<Task | null> {
    return this.tasks.get(id) ?? null;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
    const task = this.tasks.get(id);
    if (!task) return null;

    const updated: Task = {
      ...task,
      ...updates,
      updatedAt: new Date(),
    };

    this.tasks.set(id, updated);
    return updated;
  }

  async getAllTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  async getTasksByStatus(status: TaskStatus): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(t => t.status === status);
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.tasks.delete(id);
  }

  async clear(): Promise<void> {
    this.tasks.clear();
  }
}
