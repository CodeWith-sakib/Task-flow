export type SagaStepId = string;

export enum SagaStepStatus {
  PENDING = 'PENDING',
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  COMPENSATING = 'COMPENSATING',
  COMPENSATED = 'COMPENSATED',
  COMPENSATION_FAILED = 'COMPENSATION_FAILED'
}

export interface ISagaAction<TInput = any, TOutput = any> {
  execute(input: TInput, context: Record<string, any>): Promise<TOutput>;
  compensate?(input: TInput, output: TOutput | null, context: Record<string, any>): Promise<void>;
}

export interface SagaStepDefinition<TInput = any, TOutput = any> {
  id: SagaStepId;
  name: string;
  action: ISagaAction<TInput, TOutput>;
  input: TInput;
  isPivot?: boolean;
  timeoutMs?: number;
}

export interface SagaStepState {
  id: SagaStepId;
  name: string;
  status: SagaStepStatus;
  input: any;
  output: any | null;
  error?: string;
  executedAt?: number;
  compensatedAt?: number;
}
