/**
 * Workflow Query Handler Registry.
 * Enables zero-side-effect, read-only queries against running workflow executions,
 * supporting inspection of internal workflow variables, metrics, and progress.
 */

export type WorkflowQueryHandler = (args: any[]) => any;

export class QueryHandlerRegistry {
  private handlers = new Map<string, Map<string, WorkflowQueryHandler>>();

  public registerHandler(workflowId: string, queryType: string, handler: WorkflowQueryHandler): void {
    let workflowMap = this.handlers.get(workflowId);
    if (!workflowMap) {
      workflowMap = new Map();
      this.handlers.set(workflowId, workflowMap);
    }
    workflowMap.set(queryType, handler);
  }

  public unregisterHandlers(workflowId: string): void {
    this.handlers.delete(workflowId);
  }

  public queryWorkflow(workflowId: string, queryType: string, args: any[] = []): { success: boolean; result?: any; error?: string } {
    const workflowMap = this.handlers.get(workflowId);
    if (!workflowMap) {
      return { success: false, error: `Workflow ${workflowId} not found or has no active query handlers` };
    }

    const handler = workflowMap.get(queryType);
    if (!handler) {
      return { success: false, error: `Query type "${queryType}" not registered for workflow ${workflowId}` };
    }

    try {
      const result = handler(args);
      return { success: true, result };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  }
}
