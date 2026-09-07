/**
 * Rule-Based Query Plan Optimizer for TaskQL.
 * Applies transformation rules to optimize logical query trees:
 * 1. Constant Folding & Arithmetic Simplification
 * 2. Limit Pushdown & Normalization
 * 3. Redundant Filter Elimination
 * 4. Selector Deduplication
 */

import {
  ExpressionNode,
  SelectStatementNode,
  BinaryExpressionNode,
  UnaryExpressionNode,
  LiteralNode,
} from '../parser/ASTNodes';

export interface OptimizationRule {
  name: string;
  apply(ast: SelectStatementNode): SelectStatementNode;
}

export class RuleBasedOptimizer {
  private rules: OptimizationRule[] = [];

  constructor() {
    this.registerDefaultRules();
  }

  public registerRule(rule: OptimizationRule): void {
    this.rules.push(rule);
  }

  public optimize(ast: SelectStatementNode): SelectStatementNode {
    let currentAst = JSON.parse(JSON.stringify(ast)) as SelectStatementNode;

    for (const rule of this.rules) {
      currentAst = rule.apply(currentAst);
    }

    return currentAst;
  }

  private registerDefaultRules(): void {
    // Rule 1: Constant Folding
    this.registerRule({
      name: 'ConstantFolding',
      apply: (ast: SelectStatementNode): SelectStatementNode => {
        if (ast.where) {
          ast.where = this.foldConstants(ast.where);
        }
        return ast;
      },
    });

    // Rule 2: Limit Normalization
    this.registerRule({
      name: 'LimitNormalization',
      apply: (ast: SelectStatementNode): SelectStatementNode => {
        if (ast.limit) {
          if (ast.limit.limit < 0) {
            ast.limit.limit = 0;
          }
          if (ast.limit.offset !== undefined && ast.limit.offset < 0) {
            ast.limit.offset = 0;
          }
        }
        return ast;
      },
    });

    // Rule 3: Redundant Filter Elimination (e.g. TRUE AND expr -> expr)
    this.registerRule({
      name: 'RedundantFilterElimination',
      apply: (ast: SelectStatementNode): SelectStatementNode => {
        if (ast.where) {
          ast.where = this.simplifyLogicalExpressions(ast.where);
        }
        return ast;
      },
    });

    // Rule 4: Selector Deduplication
    this.registerRule({
      name: 'SelectorDeduplication',
      apply: (ast: SelectStatementNode): SelectStatementNode => {
        if (ast.selectors && ast.selectors.length > 1) {
          const seen = new Set<string>();
          ast.selectors = ast.selectors.filter((s: any) => {
            const repr = JSON.stringify(s);
            if (seen.has(repr)) return false;
            seen.add(repr);
            return true;
          });
        }
        return ast;
      },
    });
  }

  private foldConstants(node: ExpressionNode): ExpressionNode {
    if (node.type === 'BinaryExpression') {
      const binNode = node as BinaryExpressionNode;
      const leftFolded = this.foldConstants(binNode.left);
      const rightFolded = this.foldConstants(binNode.right);

      if (leftFolded.type === 'Literal' && rightFolded.type === 'Literal') {
        const lVal = (leftFolded as LiteralNode).value;
        const rVal = (rightFolded as LiteralNode).value;

        switch (binNode.operator) {
          case '+':
            return { type: 'Literal', value: Number(lVal) + Number(rVal), raw: String(Number(lVal) + Number(rVal)) } as LiteralNode;
          case '-':
            return { type: 'Literal', value: Number(lVal) - Number(rVal), raw: String(Number(lVal) - Number(rVal)) } as LiteralNode;
          case '*':
            return { type: 'Literal', value: Number(lVal) * Number(rVal), raw: String(Number(lVal) * Number(rVal)) } as LiteralNode;
          case '/':
            return {
              type: 'Literal',
              value: Number(rVal) !== 0 ? Number(lVal) / Number(rVal) : null,
              raw: String(Number(rVal) !== 0 ? Number(lVal) / Number(rVal) : 'null'),
            } as LiteralNode;
          case '=':
            return { type: 'Literal', value: lVal === rVal, raw: String(lVal === rVal) } as LiteralNode;
          case '!=':
            return { type: 'Literal', value: lVal !== rVal, raw: String(lVal !== rVal) } as LiteralNode;
          case '>':
            return { type: 'Literal', value: (lVal as any) > (rVal as any), raw: String((lVal as any) > (rVal as any)) } as LiteralNode;
          case '>=':
            return { type: 'Literal', value: (lVal as any) >= (rVal as any), raw: String((lVal as any) >= (rVal as any)) } as LiteralNode;
          case '<':
            return { type: 'Literal', value: (lVal as any) < (rVal as any), raw: String((lVal as any) < (rVal as any)) } as LiteralNode;
          case '<=':
            return { type: 'Literal', value: (lVal as any) <= (rVal as any), raw: String((lVal as any) <= (rVal as any)) } as LiteralNode;
          case 'AND':
            return { type: 'Literal', value: Boolean(lVal) && Boolean(rVal), raw: String(Boolean(lVal) && Boolean(rVal)) } as LiteralNode;
          case 'OR':
            return { type: 'Literal', value: Boolean(lVal) || Boolean(rVal), raw: String(Boolean(lVal) || Boolean(rVal)) } as LiteralNode;
        }
      }

      const res: BinaryExpressionNode = {
        ...binNode,
        left: leftFolded,
        right: rightFolded,
      };
      return res;
    }

    if (node.type === 'UnaryExpression') {
      const unaryNode = node as UnaryExpressionNode;
      const argFolded = this.foldConstants(unaryNode.argument);

      if (argFolded.type === 'Literal') {
        const val = (argFolded as LiteralNode).value;
        if (unaryNode.operator === 'NOT') {
          return { type: 'Literal', value: !val, raw: String(!val) } as LiteralNode;
        }
        if (unaryNode.operator === '-') {
          return { type: 'Literal', value: -Number(val), raw: String(-Number(val)) } as LiteralNode;
        }
      }

      const res: UnaryExpressionNode = {
        ...unaryNode,
        argument: argFolded,
      };
      return res;
    }

    return node;
  }

  private simplifyLogicalExpressions(node: ExpressionNode): ExpressionNode {
    if (node.type === 'BinaryExpression') {
      const binNode = node as BinaryExpressionNode;
      const left = this.simplifyLogicalExpressions(binNode.left);
      const right = this.simplifyLogicalExpressions(binNode.right);

      if (binNode.operator === 'AND') {
        if (left.type === 'Literal' && (left as LiteralNode).value === true) return right;
        if (right.type === 'Literal' && (right as LiteralNode).value === true) return left;
        if (left.type === 'Literal' && (left as LiteralNode).value === false) return { type: 'Literal', value: false, raw: 'false' } as LiteralNode;
        if (right.type === 'Literal' && (right as LiteralNode).value === false) return { type: 'Literal', value: false, raw: 'false' } as LiteralNode;
      }

      if (binNode.operator === 'OR') {
        if (left.type === 'Literal' && (left as LiteralNode).value === true) return { type: 'Literal', value: true, raw: 'true' } as LiteralNode;
        if (right.type === 'Literal' && (right as LiteralNode).value === true) return { type: 'Literal', value: true, raw: 'true' } as LiteralNode;
        if (left.type === 'Literal' && (left as LiteralNode).value === false) return right;
        if (right.type === 'Literal' && (right as LiteralNode).value === false) return left;
      }

      const res: BinaryExpressionNode = {
        ...binNode,
        left,
        right,
      };
      return res;
    }

    return node;
  }
}
