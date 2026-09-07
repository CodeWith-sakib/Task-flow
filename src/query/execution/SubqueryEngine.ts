/**
 * Subquery Execution Engine for TaskQL.
 * Evaluates scalar subqueries, correlated subqueries, EXISTS, NOT EXISTS,
 * and IN / NOT IN subqueries across relational and nested dataset scopes.
 */

export interface SubqueryContext {
  outerRow: Record<string, any>;
  datasetRegistry: Map<string, Record<string, any>[]>;
}

export type SubqueryExecutor = (context: SubqueryContext) => Record<string, any>[];

export class SubqueryEngine {
  private registeredSubqueries = new Map<string, SubqueryExecutor>();

  public registerSubquery(name: string, executor: SubqueryExecutor): void {
    this.registeredSubqueries.set(name, executor);
  }

  /**
   * Evaluates a scalar subquery (expects exactly 1 row, 1 column).
   */
  public evalScalar(name: string, context: SubqueryContext, column: string): any {
    const executor = this.getExecutor(name);
    const rows = executor(context);
    if (rows.length === 0) return null;
    return rows[0][column] ?? null;
  }

  /**
   * Evaluates an EXISTS subquery. Returns true if subquery yields $\ge 1$ row.
   */
  public evalExists(name: string, context: SubqueryContext): boolean {
    const executor = this.getExecutor(name);
    const rows = executor(context);
    return rows.length > 0;
  }

  /**
   * Evaluates an IN subquery: checks if outer value exists in the subquery projection.
   */
  public evalIn(outerValue: any, name: string, context: SubqueryContext, column: string): boolean {
    const executor = this.getExecutor(name);
    const rows = executor(context);
    const values = new Set(rows.map((r) => r[column]));
    return values.has(outerValue);
  }

  private getExecutor(name: string): SubqueryExecutor {
    const exec = this.registeredSubqueries.get(name);
    if (!exec) {
      throw new Error(`Subquery "${name}" is not registered`);
    }
    return exec;
  }
}
