import { ExpressionNode, SelectStatementNode } from '../parser/ASTNodes';

export type LogicalPlanType =
  | 'LogicalScan'
  | 'LogicalFilter'
  | 'LogicalProject'
  | 'LogicalAggregate'
  | 'LogicalSort'
  | 'LogicalLimit';

export interface LogicalPlanNode {
  type: LogicalPlanType;
  children: LogicalPlanNode[];
}

export interface LogicalScanNode extends LogicalPlanNode {
  type: 'LogicalScan';
  tableName: string;
}

export interface LogicalFilterNode extends LogicalPlanNode {
  type: 'LogicalFilter';
  predicate: ExpressionNode;
}

export interface LogicalProjectNode extends LogicalPlanNode {
  type: 'LogicalProject';
  selectors: any[];
}

export interface LogicalAggregateNode extends LogicalPlanNode {
  type: 'LogicalAggregate';
  groupByExpressions: ExpressionNode[];
  aggregations: { func: string; expression?: ExpressionNode; alias: string }[];
  having?: ExpressionNode;
}

export interface LogicalSortNode extends LogicalPlanNode {
  type: 'LogicalSort';
  orderBy: { expression: ExpressionNode; direction: 'ASC' | 'DESC' }[];
}

export interface LogicalLimitNode extends LogicalPlanNode {
  type: 'LogicalLimit';
  limit: number;
  offset?: number;
}

/**
 * QueryPlanner translates a syntactic SelectStatement AST into an initial Logical Query Plan.
 */
export class QueryPlanner {
  public static createPlan(ast: SelectStatementNode): LogicalPlanNode {
    // 1. Base Scan
    let currentPlan: LogicalPlanNode = {
      type: 'LogicalScan',
      tableName: ast.from,
      children: []
    } as LogicalScanNode;

    // 2. Filter (WHERE)
    if (ast.where) {
      currentPlan = {
        type: 'LogicalFilter',
        predicate: ast.where,
        children: [currentPlan]
      } as LogicalFilterNode;
    }

    // 3. Aggregation (GROUP BY)
    if (ast.groupBy) {
      currentPlan = {
        type: 'LogicalAggregate',
        groupByExpressions: ast.groupBy.expressions,
        aggregations: [],
        having: ast.groupBy.having,
        children: [currentPlan]
      } as LogicalAggregateNode;
    }

    // 4. Projection (SELECT items)
    currentPlan = {
      type: 'LogicalProject',
      selectors: ast.selectors,
      children: [currentPlan]
    } as LogicalProjectNode;

    // 5. Sort (ORDER BY)
    if (ast.orderBy && ast.orderBy.length > 0) {
      currentPlan = {
        type: 'LogicalSort',
        orderBy: ast.orderBy.map(o => ({ expression: o.expression, direction: o.direction })),
        children: [currentPlan]
      } as LogicalSortNode;
    }

    // 6. Limit & Offset
    if (ast.limit) {
      currentPlan = {
        type: 'LogicalLimit',
        limit: ast.limit.limit,
        offset: ast.limit.offset,
        children: [currentPlan]
      } as LogicalLimitNode;
    }

    return currentPlan;
  }
}
