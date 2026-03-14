export interface CompensationEvent {
  workflowId: string;
  stepName: string;
  action: 'EXECUTED' | 'COMPENSATED' | 'FAILED';
  timestamp: number;
}

export class WorkflowCompensationAuditLog {
  private events: CompensationEvent[] = [];

  public logEvent(workflowId: string, stepName: string, action: 'EXECUTED' | 'COMPENSATED' | 'FAILED'): void {
    this.events.push({
      workflowId,
      stepName,
      action,
      timestamp: Date.now()
    });
  }

  public getWorkflowHistory(workflowId: string): CompensationEvent[] {
    return this.events.filter(e => e.workflowId === workflowId);
  }
}
