export interface WorkflowCheckpointData {
  workflowId: string;
  lastCompletedStep: string;
  stepOutputs: Record<string, unknown>;
  timestamp: number;
}

export class WorkflowStateCheckpoint {
  private checkpoints: Map<string, WorkflowCheckpointData> = new Map();

  public saveCheckpoint(workflowId: string, lastCompletedStep: string, stepOutputs: Record<string, unknown>): void {
    this.checkpoints.set(workflowId, {
      workflowId,
      lastCompletedStep,
      stepOutputs: JSON.parse(JSON.stringify(stepOutputs)),
      timestamp: Date.now()
    });
  }

  public getCheckpoint(workflowId: string): WorkflowCheckpointData | undefined {
    return this.checkpoints.get(workflowId);
  }

  public clearCheckpoint(workflowId: string): void {
    this.checkpoints.delete(workflowId);
  }
}
