/**
 * Workflow Query Service.
 * Provides distributed query routing, caching, and state extraction for live workflows.
 */

import { QueryHandlerRegistry } from './QueryHandlerRegistry';
import { WorkflowExecutionEngine } from './WorkflowExecutionEngine';

export interface QueryOptions {
  timeoutMs?: number;
  useCache?: boolean;
}

export class WorkflowQueryService {
  private engine: WorkflowExecutionEngine;
  private queryCache = new Map<string, { result: any; cachedAt: number }>();
  private cacheTtlMs: number;

  constructor(engine: WorkflowExecutionEngine, cacheTtlMs: number = 5000) {
    this.engine = engine;
    this.cacheTtlMs = cacheTtlMs;
  }

  public async query(
    workflowId: string,
    queryType: string,
    args: any[] = [],
    options: QueryOptions = {}
  ): Promise<any> {
    const cacheKey = `${workflowId}:${queryType}:${JSON.stringify(args)}`;

    if (options.useCache) {
      const cached = this.queryCache.get(cacheKey);
      if (cached && Date.now() - cached.cachedAt < this.cacheTtlMs) {
        return cached.result;
      }
    }

    const registry = this.engine.getQueryRegistry();
    const queryResult = registry.queryWorkflow(workflowId, queryType, args);

    if (!queryResult.success) {
      throw new Error(queryResult.error || 'Query failed');
    }

    if (options.useCache) {
      this.queryCache.set(cacheKey, {
        result: queryResult.result,
        cachedAt: Date.now(),
      });
    }

    return queryResult.result;
  }

  public invalidateCache(workflowId?: string): void {
    if (!workflowId) {
      this.queryCache.clear();
      return;
    }

    for (const key of this.queryCache.keys()) {
      if (key.startsWith(`${workflowId}:`)) {
        this.queryCache.delete(key);
      }
    }
  }
}
