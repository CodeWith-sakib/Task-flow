/**
 * Saga Forward Recovery & Compensation Coordinator.
 * Coordinates forward retry policies (with exponential backoff and alternate path routing)
 * versus backward compensation rollback when non-recoverable business errors occur.
 */

import { CompensationLogJournal } from './CompensationLogJournal';

export interface SagaStepDefinition {
  stepId: string;
  name: string;
  forwardAction: (ctx: Record<string, any>) => Promise<any>;
  compensateAction: (ctx: Record<string, any>, forwardOutput: any) => Promise<void>;
  maxRetries?: number;
  retryBackoffMs?: number;
}

export class ForwardRecoveryEngine {
  private journal: CompensationLogJournal;

  constructor(journal?: CompensationLogJournal) {
    this.journal = journal || new CompensationLogJournal();
  }

  public async executeSaga(
    sagaId: string,
    steps: SagaStepDefinition[],
    initialContext: Record<string, any> = {}
  ): Promise<{ status: 'COMPLETED' | 'COMPENSATED' | 'COMPENSATION_FAILED'; context: Record<string, any>; error?: string }> {
    const context = { ...initialContext };
    const executedSteps: { step: SagaStepDefinition; output: any }[] = [];

    // Forward Phase
    for (const step of steps) {
      let attempt = 0;
      const maxRetries = step.maxRetries ?? 2;
      const backoffMs = step.retryBackoffMs ?? 50;
      let success = false;
      let lastErr: any = null;

      while (attempt <= maxRetries && !success) {
        attempt++;
        try {
          const output = await step.forwardAction(context);
          context[step.stepId] = output;
          this.journal.logForwardSuccess(sagaId, step.stepId, step.name, output);
          executedSteps.push({ step, output });
          success = true;
        } catch (err: any) {
          lastErr = err;
          if (attempt <= maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, backoffMs * Math.pow(2, attempt - 1)));
          }
        }
      }

      if (!success) {
        // Forward recovery exhausted; initiate backward compensation rollback
        const compResult = await this.rollbackCompensations(sagaId, executedSteps, context);
        return {
          status: compResult ? 'COMPENSATED' : 'COMPENSATION_FAILED',
          context,
          error: `Step "${step.name}" failed: ${lastErr?.message || String(lastErr)}`,
        };
      }
    }

    return {
      status: 'COMPLETED',
      context,
    };
  }

  private async rollbackCompensations(
    sagaId: string,
    executedSteps: { step: SagaStepDefinition; output: any }[],
    context: Record<string, any>
  ): Promise<boolean> {
    let allSucceeded = true;

    // Compensate in reverse topological order
    for (let i = executedSteps.length - 1; i >= 0; i--) {
      const { step, output } = executedSteps[i];
      this.journal.markCompensationPending(sagaId, step.stepId);

      try {
        await step.compensateAction(context, output);
        this.journal.logCompensationSuccess(sagaId, step.stepId);
      } catch (err: any) {
        this.journal.logCompensationFailure(sagaId, step.stepId, err.message || String(err));
        allSucceeded = false;
      }
    }

    return allSucceeded;
  }
}
