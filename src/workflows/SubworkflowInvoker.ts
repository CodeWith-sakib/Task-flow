export class SubworkflowInvoker {
  public static createChildContext(parentContext: Record<string, unknown>, childInputs: Record<string, unknown>): Record<string, unknown> {
    return {
      ...parentContext,
      ...childInputs,
      _isSubworkflow: true,
      _invokedAt: Date.now()
    };
  }
}
