import { v4 as uuidv4 } from 'uuid';
import { Task, TaskStatus, CreateTaskRequest } from '../../types';
import { WALStorageEngine } from '../wal/WALStorageEngine';
import { TaskQueryFilter, TaskQueryResult, StorageStats } from '../types';

export class WALDatabaseAdapter {
  private engine: WALStorageEngine;

  constructor(baseDir?: string) {
    this.engine = new WALStorageEngine(baseDir || './data/wal');
  }

  async init(): Promise<void> {
    await this.engine.init();
  }

  async close(): Promise<void> {
    await this.engine.close();
  }

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

    return this.engine.createTask(task);
  }

  async getTask(id: string): Promise<Task | null> {
    return this.engine.getTask(id);
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
    return this.engine.updateTask(id, updates);
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.engine.deleteTask(id);
  }

  async getAllTasks(): Promise<Task[]> {
    const res = await this.engine.queryTasks({ limit: 10000 });
    return res.tasks;
  }

  async getTasksByStatus(status: TaskStatus): Promise<Task[]> {
    const res = await this.engine.queryTasks({ status, limit: 10000 });
    return res.tasks;
  }

  async queryTasks(filter: TaskQueryFilter): Promise<TaskQueryResult> {
    return this.engine.queryTasks(filter);
  }

  async getStats(): Promise<StorageStats> {
    return this.engine.getStats();
  }

  async clear(): Promise<void> {
    await this.engine.compact();
  }
}
