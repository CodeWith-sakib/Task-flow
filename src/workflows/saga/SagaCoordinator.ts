import { SagaStepDefinition, SagaStepId, SagaStepState, SagaStepStatus } from './SagaStep';

export enum SagaStatus {
  NOT_STARTED = 'NOT_STARTED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  COMPENSATING = 'COMPENSATING',
  COMPENSATED = 'COMPENSATED',
  FAILED = 'FAILED'
}

export interface SagaExecutionResult {
  sagaId: string;
  status: SagaStatus;
  stepStates: Record<SagaStepId, SagaStepState>;
  error?: string;
  durationMs: number;
}

/**
 * SagaCoordinator orchestrates distributed sagas using the backward-recovery compensation pattern.
 * When a forward step encounters a fatal error, all completed compensable steps are executed in reverse order.
 */
export class SagaCoordinator {
  public readonly sagaId: string;
  private steps: SagaStepDefinition[] = [];
  private stepStates: Map<SagaStepId, SagaStepState> = new Map();
  private status: SagaStatus = SagaStatus.NOT_STARTED;
  private context: Record<string, any> = {};

  constructor(sagaId: string, initialContext: Record<string, any> = {}) {
    this.sagaId = sagaId;
    this.context = { ...initialContext };
  }

  public addStep<TIn, TOut>(step: SagaStepDefinition<TIn, TOut>): this {
    if (this.status !== SagaStatus.NOT_STARTED) {
      throw new Error(`Cannot add step to saga in status ${this.status}`);
    }

    this.steps.push(step);
    this.stepStates.set(step.id, {
      id: step.id,
      name: step.name,
      status: SagaStepStatus.PENDING,
      input: step.input,
      output: null
    });

    return this;
  }

  public async execute(): Promise<SagaExecutionResult> {
    const startTime = Date.now();
    this.status = SagaStatus.RUNNING;

    const completedSteps: SagaStepDefinition[] = [];

    for (const step of this.steps) {
      const state = this.stepStates.get(step.id)!;
      state.status = SagaStepStatus.EXECUTING;

      try {
        const output = await this.executeWithTimeout(
          step.action.execute(step.input, this.context),
          step.timeoutMs ?? 30000
        );

        state.status = SagaStepStatus.COMPLETED;
        state.output = output;
        state.executedAt = Date.now();
        completedSteps.push(step);

        // Store step output into shared context
        this.context[step.id] = output;
      } catch (err: any) {
        state.status = SagaStepStatus.FAILED;
        state.error = err.message || String(err);

        // Trigger rollback / compensation
        await this.compensate(completedSteps);

        return {
          sagaId: this.sagaId,
          status: this.status,
          stepStates: this.getStepStatesRecord(),
          error: `Saga failed at step '${step.id}': ${state.error}`,
          durationMs: Date.now() - startTime
        };
      }
    }

    this.status = SagaStatus.COMPLETED;
    return {
      sagaId: this.sagaId,
      status: this.status,
      stepStates: this.getStepStatesRecord(),
      durationMs: Date.now() - startTime
    };
  }

  private async compensate(completedSteps: SagaStepDefinition[]): Promise<void> {
    this.status = SagaStatus.COMPENSATING;
    let allCompensated = true;

    // Compensate in reverse order (LIFO)
    for (let i = completedSteps.length - 1; i >= 0; i--) {
      const step = completedSteps[i];
      const state = this.stepStates.get(step.id)!;

      if (step.action.compensate) {
        state.status = SagaStepStatus.COMPENSATING;
        try {
          await step.action.compensate(step.input, state.output, this.context);
          state.status = SagaStepStatus.COMPENSATED;
          state.compensatedAt = Date.now();
        } catch (compErr: any) {
          state.status = SagaStepStatus.COMPENSATION_FAILED;
          state.error = `Compensation error: ${compErr.message || String(compErr)}`;
          allCompensated = false;
        }
      }
    }

    this.status = allCompensated ? SagaStatus.COMPENSATED : SagaStatus.FAILED;
  }

  private getStepStatesRecord(): Record<SagaStepId, SagaStepState> {
    const record: Record<SagaStepId, SagaStepState> = {};
    for (const [id, s] of this.stepStates.entries()) {
      record[id] = { ...s };
    }
    return record;
  }

  private async executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Saga step timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timer!);
    }
  }
}
