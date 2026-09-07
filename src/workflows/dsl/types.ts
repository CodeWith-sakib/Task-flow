/**
 * Workflow DSL domain types and schemas.
 */

export type StepId = string;
export type WorkflowId = string;

export enum StepActionType {
  TASK = 'TASK',
  SUBWORKFLOW = 'SUBWORKFLOW',
  BRANCH = 'BRANCH',
  PARALLEL = 'PARALLEL',
  WAIT_FOR_EVENT = 'WAIT_FOR_EVENT',
  PASS = 'PASS',
  FAIL = 'FAIL'
}

export interface RetryConfig {
  maxAttempts: number;
  initialIntervalMs: number;
  backoffMultiplier: number;
  maxIntervalMs: number;
  nonRetryableErrors?: string[];
}

export interface CompensationConfig {
  action: string;
  parameters?: Record<string, any>;
  timeoutMs?: number;
  ignoreFailure?: boolean;
}

export interface StepDefinition {
  id: StepId;
  name: string;
  type: StepActionType;
  action?: string;
  parameters?: Record<string, any>;
  dependencies?: StepId[];
  condition?: string; // CEL / Boolean expression
  branches?: { condition: string; nextStep: StepId }[];
  parallelSteps?: StepId[];
  compensation?: CompensationConfig;
  retry?: RetryConfig;
  timeoutMs?: number;
  isPivot?: boolean;
}

export interface WorkflowDefinition {
  id: WorkflowId;
  name: string;
  version: number;
  description?: string;
  steps: StepDefinition[];
  inputSchema?: Record<string, any>;
  outputMapping?: Record<string, any>;
  defaultTimeoutMs?: number;
}

export interface WorkflowContext {
  workflowId: WorkflowId;
  instanceId: string;
  input: Record<string, any>;
  stepOutputs: Record<StepId, any>;
  variables: Record<string, any>;
  startTime: number;
}
