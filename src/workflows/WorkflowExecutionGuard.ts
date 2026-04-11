export class WorkflowExecutionGuard {
  public static assertRequiredFields(payload: Record<string, unknown>, requiredFields: string[]): void {
    for (const field of requiredFields) {
      if (payload[field] === undefined || payload[field] === null) {
        throw new Error(`Missing required workflow field: ${field}`);
      }
    }
  }
}
