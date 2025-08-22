import { Task, TaskStatus, CreateTaskRequest } from '../../types';
import { TaskQueryFilter, TaskQueryResult, StorageStats } from '../types';
import { InMemoryDB } from './InMemoryDB';
import { WALDatabaseAdapter } from './WALDatabaseAdapter';

export interface IDatabase {
  createTask(request: CreateTaskRequest): Promise<Task>;
  getTask(id: string): Promise<Task | null>;
  updateTask(id: string, updates: Partial<Task>): Promise<Task | null>;
  getAllTasks(): Promise<Task[]>;
  getTasksByStatus(status: TaskStatus): Promise<Task[]>;
  deleteTask(id: string): Promise<boolean>;
  clear(): Promise<void>;
  queryTasks?(filter: TaskQueryFilter): Promise<TaskQueryResult>;
  getStats?(): Promise<StorageStats>;
}

export class DatabaseFactory {
  static createDatabase(type?: string): IDatabase {
    const dbType = type || process.env.DATABASE_TYPE || 'memory';

    if (dbType === 'memory') {
      return new InMemoryDB();
    }

    if (dbType === 'wal') {
      const adapter = new WALDatabaseAdapter();
      adapter.init().catch(err => console.error('Failed to init WALDatabaseAdapter:', err));
      return adapter;
    }

    throw new Error(`Unsupported database type: ${dbType}`);
  }
}

export type Database = IDatabase;
export { InMemoryDB, WALDatabaseAdapter };
