import { WorkflowContext } from './types';

/**
 * CELInterpreter evaluates Common Expression Language style predicate rules,
 * JSONPath variable extraction, and dynamic template expressions within workflow steps.
 */
export class CELInterpreter {
  public evaluatePredicate(expression: string, context: WorkflowContext): boolean {
    if (!expression || expression.trim() === '' || expression.trim() === 'true') {
      return true;
    }
    if (expression.trim() === 'false') {
      return false;
    }

    try {
      const scope = this.buildEvaluationScope(context);
      const func = new Function('ctx', `with(ctx) { return Boolean(${expression}); }`);
      return Boolean(func(scope));
    } catch {
      // If evaluation fails or syntax is invalid, evaluate to false safely
      return false;
    }
  }

  public evaluateExpression<T = any>(expression: string, context: WorkflowContext): T | null {
    try {
      const scope = this.buildEvaluationScope(context);
      const func = new Function('ctx', `with(ctx) { return (${expression}); }`);
      return func(scope) as T;
    } catch {
      return null;
    }
  }

  public interpolateString(template: string, context: WorkflowContext): string {
    const scope = this.buildEvaluationScope(context);
    return template.replace(/\$\{([^}]+)\}/g, (_, expr) => {
      try {
        const val = this.resolvePath(scope, expr.trim());
        return val !== undefined && val !== null ? String(val) : '';
      } catch {
        return '';
      }
    });
  }

  public resolvePath(target: any, path: string): any {
    if (!target || !path) return undefined;
    const cleanPath = path.startsWith('$.') ? path.substring(2) : path;
    const parts = cleanPath.split('.').flatMap(p => p.split(/\[(\d+)\]/).filter(Boolean));

    let current = target;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    return current;
  }

  private buildEvaluationScope(context: WorkflowContext): Record<string, any> {
    return {
      input: context.input || {},
      steps: context.stepOutputs || {},
      variables: context.variables || {},
      context: {
        instanceId: context.instanceId,
        workflowId: context.workflowId,
        startTime: context.startTime,
        now: Date.now()
      },
      ...context.stepOutputs,
      ...context.variables
    };
  }
}
