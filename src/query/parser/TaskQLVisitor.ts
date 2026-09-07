/**
 * AST Visitor and Walker interface for TaskQL syntax trees.
 * Provides hierarchical traversal, node inspection, and transformation hooks.
 */

import {
  ASTNode,
  SelectStatementNode,
  FieldSelectorNode,
  WildcardSelectorNode,
  BinaryExpressionNode,
  UnaryExpressionNode,
  LiteralNode,
  IdentifierNode,
  FunctionCallNode,
  InExpressionNode,
  BetweenExpressionNode,
  OrderByItemNode,
  GroupByClauseNode,
  LimitClauseNode,
} from './ASTNodes';

export interface TaskQLVisitor<R = void, C = any> {
  visitSelectStatement?(node: SelectStatementNode, context?: C): R;
  visitFieldSelector?(node: FieldSelectorNode, context?: C): R;
  visitWildcardSelector?(node: WildcardSelectorNode, context?: C): R;
  visitBinaryExpression?(node: BinaryExpressionNode, context?: C): R;
  visitUnaryExpression?(node: UnaryExpressionNode, context?: C): R;
  visitLiteral?(node: LiteralNode, context?: C): R;
  visitIdentifier?(node: IdentifierNode, context?: C): R;
  visitFunctionCall?(node: FunctionCallNode, context?: C): R;
  visitInExpression?(node: InExpressionNode, context?: C): R;
  visitBetweenExpression?(node: BetweenExpressionNode, context?: C): R;
  visitOrderByItem?(node: OrderByItemNode, context?: C): R;
  visitGroupByClause?(node: GroupByClauseNode, context?: C): R;
  visitLimitClause?(node: LimitClauseNode, context?: C): R;
}

export class TaskQLASTWalker {
  public static walk<R, C>(node: ASTNode, visitor: TaskQLVisitor<R, C>, context?: C): R | undefined {
    switch (node.type) {
      case 'SelectStatement': {
        const stmt = node as SelectStatementNode;
        const res = visitor.visitSelectStatement?.(stmt, context);
        for (const selector of stmt.selectors) {
          TaskQLASTWalker.walk(selector, visitor, context);
        }
        if (stmt.where) {
          TaskQLASTWalker.walk(stmt.where, visitor, context);
        }
        if (stmt.groupBy) {
          TaskQLASTWalker.walk(stmt.groupBy, visitor, context);
        }
        if (stmt.orderBy) {
          for (const item of stmt.orderBy) {
            TaskQLASTWalker.walk(item, visitor, context);
          }
        }
        if (stmt.limit) {
          TaskQLASTWalker.walk(stmt.limit, visitor, context);
        }
        return res;
      }

      case 'FieldSelector': {
        const sel = node as FieldSelectorNode;
        const res = visitor.visitFieldSelector?.(sel, context);
        TaskQLASTWalker.walk(sel.expression, visitor, context);
        return res;
      }

      case 'WildcardSelector':
        return visitor.visitWildcardSelector?.(node as WildcardSelectorNode, context);

      case 'BinaryExpression': {
        const bin = node as BinaryExpressionNode;
        const res = visitor.visitBinaryExpression?.(bin, context);
        TaskQLASTWalker.walk(bin.left, visitor, context);
        TaskQLASTWalker.walk(bin.right, visitor, context);
        return res;
      }

      case 'UnaryExpression': {
        const un = node as UnaryExpressionNode;
        const res = visitor.visitUnaryExpression?.(un, context);
        TaskQLASTWalker.walk(un.argument, visitor, context);
        return res;
      }

      case 'Literal':
        return visitor.visitLiteral?.(node as LiteralNode, context);

      case 'Identifier':
        return visitor.visitIdentifier?.(node as IdentifierNode, context);

      case 'FunctionCall': {
        const fn = node as FunctionCallNode;
        const res = visitor.visitFunctionCall?.(fn, context);
        for (const arg of fn.arguments) {
          TaskQLASTWalker.walk(arg, visitor, context);
        }
        return res;
      }

      case 'InExpression': {
        const inNode = node as InExpressionNode;
        const res = visitor.visitInExpression?.(inNode, context);
        TaskQLASTWalker.walk(inNode.expression, visitor, context);
        for (const val of inNode.values) {
          TaskQLASTWalker.walk(val, visitor, context);
        }
        return res;
      }

      case 'BetweenExpression': {
        const bet = node as BetweenExpressionNode;
        const res = visitor.visitBetweenExpression?.(bet, context);
        TaskQLASTWalker.walk(bet.expression, visitor, context);
        TaskQLASTWalker.walk(bet.lower, visitor, context);
        TaskQLASTWalker.walk(bet.upper, visitor, context);
        return res;
      }

      case 'OrderByItem': {
        const ord = node as OrderByItemNode;
        const res = visitor.visitOrderByItem?.(ord, context);
        TaskQLASTWalker.walk(ord.expression, visitor, context);
        return res;
      }

      case 'GroupByClause': {
        const grp = node as GroupByClauseNode;
        const res = visitor.visitGroupByClause?.(grp, context);
        for (const expr of grp.expressions) {
          TaskQLASTWalker.walk(expr, visitor, context);
        }
        if (grp.having) {
          TaskQLASTWalker.walk(grp.having, visitor, context);
        }
        return res;
      }

      case 'LimitClause':
        return visitor.visitLimitClause?.(node as LimitClauseNode, context);

      default:
        return undefined;
    }
  }
}
