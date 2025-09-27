import { TaskStatus } from '../types';

export enum WorkflowStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface WorkflowStep {
  id: string;
  name?: string;
  taskType: string;
  payload?: Record<string, any> | ((ctx: Record<string, any>) => Record<string, any>);
  dependsOn?: string[];
  when?: (ctx: Record<string, any>) => boolean;
  compensationType?: string; // Saga compensation handler
  maxRetries?: number;
  priority?: number;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: number;
  steps: WorkflowStep[];
  timeoutMs?: number;
}

export interface StepExecutionState {
  stepId: string;
  status: TaskStatus;
  taskId?: string;
  output?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: WorkflowStatus;
  stepStates: Map<string, StepExecutionState>;
  context: Record<string, any>;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}
