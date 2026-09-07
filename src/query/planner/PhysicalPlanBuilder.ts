/**
 * Physical Plan Builder for TaskQL.
 * Translates logical SelectStatement AST nodes into executable Physical Operator Trees:
 * PhysicalScan -> PhysicalFilter -> PhysicalJoin -> PhysicalAggregate -> PhysicalSort -> PhysicalLimit
 */

import { SelectStatementNode } from '../parser/ASTNodes';

export type OperatorType =
  | 'SeqScan'
  | 'IndexScan'
  | 'Filter'
  | 'HashJoin'
  | 'NestedLoopJoin'
  | 'Aggregate'
  | 'Sort'
  | 'Limit'
  | 'Projection';

export interface PhysicalOperator {
  id: string;
  type: OperatorType;
  children: PhysicalOperator[];
  estimatedCost: number;
  estimatedRows: number;
  properties: Record<string, any>;
}

export class PhysicalPlanBuilder {
  private opIdCounter = 0;

  public buildPhysicalPlan(ast: SelectStatementNode, availableIndexes: string[] = []): PhysicalOperator {
    // 1. Base Scan operator
    let root: PhysicalOperator;
    const fromTable = ast.from;

    const hasIndex = availableIndexes.some((idx) => idx.startsWith(`${fromTable}.`));
    if (hasIndex && ast.where) {
      root = this.createOp('IndexScan', [], { table: fromTable, index: availableIndexes[0] }, 10, 50);
    } else {
      root = this.createOp('SeqScan', [], { table: fromTable }, 100, 1000);
    }

    // 2. Filter operator (WHERE)
    if (ast.where) {
      root = this.createOp('Filter', [root], { predicate: ast.where }, root.estimatedCost + 20, Math.floor(root.estimatedRows * 0.3));
    }

    // 3. Aggregate operator (GROUP BY)
    if (ast.groupBy) {
      root = this.createOp(
        'Aggregate',
        [root],
        { groupBy: ast.groupBy.expressions, having: ast.groupBy.having },
        root.estimatedCost + 50,
        Math.floor(root.estimatedRows * 0.1)
      );
    }

    // 4. Projection operator (SELECT columns)
    root = this.createOp('Projection', [root], { selectors: ast.selectors }, root.estimatedCost + 10, root.estimatedRows);

    // 5. Sort operator (ORDER BY)
    if (ast.orderBy && ast.orderBy.length > 0) {
      root = this.createOp('Sort', [root], { orderBy: ast.orderBy }, root.estimatedCost + 40, root.estimatedRows);
    }

    // 6. Limit operator (LIMIT / OFFSET)
    if (ast.limit) {
      root = this.createOp(
        'Limit',
        [root],
        { limit: ast.limit.limit, offset: ast.limit.offset },
        root.estimatedCost + 5,
        Math.min(root.estimatedRows, ast.limit.limit)
      );
    }

    return root;
  }

  public explain(op: PhysicalOperator, indent: string = ''): string[] {
    const lines: string[] = [];
    const props = Object.entries(op.properties)
      .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(', ');

    lines.push(`${indent}-> ${op.type} [cost=${op.estimatedCost}, rows=${op.estimatedRows}] (${props})`);

    for (const child of op.children) {
      lines.push(...this.explain(child, indent + '  '));
    }

    return lines;
  }

  private createOp(
    type: OperatorType,
    children: PhysicalOperator[],
    properties: Record<string, any>,
    cost: number,
    rows: number
  ): PhysicalOperator {
    return {
      id: `op_${++this.opIdCounter}`,
      type,
      children,
      properties,
      estimatedCost: cost,
      estimatedRows: rows,
    };
  }
}
