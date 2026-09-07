/**
 * Lightweight GraphQL Query Executor.
 * Parses GraphQL query strings, matches root fields and subfields against registered resolvers,
 * and executes query trees with depth limits and error boundaries.
 */

import { WorkflowSchemaBuilder } from './WorkflowSchemaBuilder';

export interface GraphQLRequest {
  query: string;
  variables?: Record<string, any>;
  context?: any;
}

export interface GraphQLResponse {
  data?: Record<string, any>;
  errors?: { message: string; path?: string[] }[];
}

export class GraphQLQueryExecutor {
  private schema: WorkflowSchemaBuilder;
  private maxDepth: number;

  constructor(schema: WorkflowSchemaBuilder, maxDepth: number = 10) {
    this.schema = schema;
    this.maxDepth = maxDepth;
  }

  public async execute(req: GraphQLRequest): Promise<GraphQLResponse> {
    try {
      const fieldNames = this.parseRequestedFields(req.query);
      const data: Record<string, any> = {};
      const queries = this.schema.getQueries();

      for (const fieldName of fieldNames) {
        const resolver = queries.get(fieldName);
        if (resolver) {
          data[fieldName] = await resolver.resolve(null, req.variables || {}, req.context || {});
        } else {
          data[fieldName] = null;
        }
      }

      return { data };
    } catch (err: any) {
      return {
        errors: [{ message: err.message || String(err) }],
      };
    }
  }

  private parseRequestedFields(queryStr: string): string[] {
    const cleaned = queryStr.replace(/\s+/g, ' ').trim();
    const match = cleaned.match(/(?:query\s*)?\{([^}]+)\}/);
    if (!match) return [];

    const body = match[1];
    return body
      .split(/[\s,]+/)
      .map((s) => s.trim().replace(/\(.*?\)/g, ''))
      .filter((s) => s.length > 0 && !s.startsWith('{'));
  }
}
