// Task status lifecycle
export enum TaskStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
}

export interface TaskPayload {
  [key: string]: any;
}

export interface Task {
  id: string;
  type: string;
  payload: TaskPayload;
  status: TaskStatus;
  retryCount: number;
  maxRetries: number;
  scheduledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  error?: string;
  result?: any;
}

export interface CreateTaskRequest {
  type: string;
  payload: TaskPayload;
  maxRetries?: number;
  scheduledAt?: Date | null;
  priority?: number;
}

export interface TaskHandler {
  (payload: TaskPayload): Promise<any>;
}

export interface QueueItem {
  taskId: string;
  enqueuedAt: Date;
  priority?: number;
}

export interface WorkerConfig {
  concurrency: number;
  timeout: number;
}

export interface RetryConfig {
  backoffMs: number;
  maxRetries: number;
}
