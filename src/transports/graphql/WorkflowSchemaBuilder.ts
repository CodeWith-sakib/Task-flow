/**
 * Dynamic GraphQL Schema Builder for TaskFlow-Engine.
 * Generates type definitions and field resolvers for querying workflows,
 * tasks, queue metrics, and cluster node statuses.
 */

export interface GraphQLFieldDefinition {
  name: string;
  type: string;
  args?: Record<string, string>;
  resolve: (parent: any, args: any, context: any) => Promise<any> | any;
}

export interface GraphQLTypeDefinition {
  name: string;
  fields: Record<string, GraphQLFieldDefinition>;
}

export class WorkflowSchemaBuilder {
  private types = new Map<string, GraphQLTypeDefinition>();
  private queries = new Map<string, GraphQLFieldDefinition>();
  private mutations = new Map<string, GraphQLFieldDefinition>();

  public registerType(typeDef: GraphQLTypeDefinition): void {
    this.types.set(typeDef.name, typeDef);
  }

  public registerQuery(field: GraphQLFieldDefinition): void {
    this.queries.set(field.name, field);
  }

  public registerMutation(field: GraphQLFieldDefinition): void {
    this.mutations.set(field.name, field);
  }

  public getQueries(): Map<string, GraphQLFieldDefinition> {
    return this.queries;
  }

  public getMutations(): Map<string, GraphQLFieldDefinition> {
    return this.mutations;
  }

  public getType(name: string): GraphQLTypeDefinition | undefined {
    return this.types.get(name);
  }

  public generateSchemaSDL(): string {
    const lines: string[] = [];

    // Types
    for (const [name, typeDef] of this.types.entries()) {
      lines.push(`type ${name} {`);
      for (const [fName, field] of Object.entries(typeDef.fields)) {
        lines.push(`  ${fName}: ${field.type}`);
      }
      lines.push('}\n');
    }

    // Query root
    lines.push('type Query {');
    for (const [name, query] of this.queries.entries()) {
      const argsStr = query.args
        ? '(' +
          Object.entries(query.args)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ') +
          ')'
        : '';
      lines.push(`  ${name}${argsStr}: ${query.type}`);
    }
    lines.push('}\n');

    // Mutation root
    if (this.mutations.size > 0) {
      lines.push('type Mutation {');
      for (const [name, mut] of this.mutations.entries()) {
        const argsStr = mut.args
          ? '(' +
            Object.entries(mut.args)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ') +
            ')'
          : '';
        lines.push(`  ${name}${argsStr}: ${mut.type}`);
      }
      lines.push('}\n');
    }

    return lines.join('\n');
  }
}
