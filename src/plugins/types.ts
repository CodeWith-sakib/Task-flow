import { Task, CreateTaskRequest, TaskStatus } from '../types';

export interface TaskFlowPlugin {
  name: string;
  version: string;
  init?(): Promise<void>;
  beforeCreateTask?(request: CreateTaskRequest): Promise<CreateTaskRequest>;
  afterCreateTask?(task: Task): Promise<void>;
  beforeExecuteTask?(task: Task): Promise<Task>;
  afterExecuteTask?(task: Task, success: boolean, result?: any, error?: string): Promise<void>;
  onStateTransition?(task: Task, fromStatus: TaskStatus, toStatus: TaskStatus): Promise<void>;
  destroy?(): Promise<void>;
}
