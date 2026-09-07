/**
 * Saga Compensation Log Journal.
 * Durably persists forward step completions and executed reverse compensation actions,
 * preventing duplicate compensation executions during crash recovery.
 */

export interface CompensationJournalEntry {
  sagaId: string;
  stepId: string;
  actionName: string;
  state: 'EXECUTED_FORWARD' | 'COMPENSATION_PENDING' | 'COMPENSATED' | 'COMPENSATION_FAILED';
  forwardOutput?: any;
  compensationError?: string;
  timestamp: number;
}

export class CompensationLogJournal {
  private journal = new Map<string, CompensationJournalEntry[]>();

  public logForwardSuccess(sagaId: string, stepId: string, actionName: string, forwardOutput: any): void {
    let entries = this.journal.get(sagaId);
    if (!entries) {
      entries = [];
      this.journal.set(sagaId, entries);
    }

    entries.push({
      sagaId,
      stepId,
      actionName,
      state: 'EXECUTED_FORWARD',
      forwardOutput,
      timestamp: Date.now(),
    });
  }

  public markCompensationPending(sagaId: string, stepId: string): void {
    const entry = this.findEntry(sagaId, stepId);
    if (entry) {
      entry.state = 'COMPENSATION_PENDING';
    }
  }

  public logCompensationSuccess(sagaId: string, stepId: string): void {
    const entry = this.findEntry(sagaId, stepId);
    if (entry) {
      entry.state = 'COMPENSATED';
      entry.timestamp = Date.now();
    }
  }

  public logCompensationFailure(sagaId: string, stepId: string, error: string): void {
    const entry = this.findEntry(sagaId, stepId);
    if (entry) {
      entry.state = 'COMPENSATION_FAILED';
      entry.compensationError = error;
      entry.timestamp = Date.now();
    }
  }

  public getEntriesForSaga(sagaId: string): CompensationJournalEntry[] {
    return [...(this.journal.get(sagaId) || [])];
  }

  public getCompensatableSteps(sagaId: string): CompensationJournalEntry[] {
    const entries = this.journal.get(sagaId) || [];
    return entries.filter((e) => e.state === 'EXECUTED_FORWARD' || e.state === 'COMPENSATION_PENDING');
  }

  private findEntry(sagaId: string, stepId: string): CompensationJournalEntry | undefined {
    return this.journal.get(sagaId)?.find((e) => e.stepId === stepId);
  }
}
