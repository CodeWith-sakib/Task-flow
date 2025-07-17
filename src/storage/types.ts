import { Task, TaskStatus } from '../types';

export interface TaskQueryFilter {
  status?: TaskStatus | TaskStatus[];
  type?: string | string[];
  priorityMin?: number;
  priorityMax?: number;
  scheduledBefore?: Date;
  scheduledAfter?: Date;
  createdBefore?: Date;
  createdAfter?: Date;
  tags?: string[];
  limit?: number;
  offset?: number;
  cursor?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'scheduledAt';
  sortOrder?: 'asc' | 'desc';
}

export interface TaskQueryResult {
  tasks: Task[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface StorageStats {
  totalTasks: number;
  countsByStatus: Record<TaskStatus, number>;
  oldestPendingTaskAgeMs?: number;
  averageExecutionTimeMs?: number;
}

export interface StorageTransaction {
  id: string;
  createTask(task: Task): Promise<void>;
  updateTask(id: string, updates: Partial<Task>): Promise<Task | null>;
  deleteTask(id: string): Promise<boolean>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface PersistentStorageEngine {
  init(): Promise<void>;
  close(): Promise<void>;
  createTask(task: Task): Promise<Task>;
  getTask(id: string): Promise<Task | null>;
  updateTask(id: string, updates: Partial<Task>): Promise<Task | null>;
  deleteTask(id: string): Promise<boolean>;
  queryTasks(filter: TaskQueryFilter): Promise<TaskQueryResult>;
  getStats(): Promise<StorageStats>;
  beginTransaction(): Promise<StorageTransaction>;
  compact?(): Promise<void>;
}
