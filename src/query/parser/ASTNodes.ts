/**
 * TaskQL AST node definitions and expression interfaces.
 */

export type ASTNodeType =
  | 'SelectStatement'
  | 'FieldSelector'
  | 'WildcardSelector'
  | 'BinaryExpression'
  | 'UnaryExpression'
  | 'Literal'
  | 'Identifier'
  | 'FunctionCall'
  | 'InExpression'
  | 'BetweenExpression'
  | 'OrderByItem'
  | 'LimitClause'
  | 'GroupByClause';

export interface ASTNode {
  type: ASTNodeType;
  location?: { line: number; column: number };
}

export interface ExpressionNode extends ASTNode {}

export interface LiteralNode extends ExpressionNode {
  type: 'Literal';
  value: string | number | boolean | null;
  raw: string;
}

export interface IdentifierNode extends ExpressionNode {
  type: 'Identifier';
  name: string;
}

export type BinaryOperator =
  | '='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | 'LIKE'
  | 'ILIKE'
  | 'AND'
  | 'OR'
  | '+'
  | '-'
  | '*'
  | '/'
  | '%';

export interface BinaryExpressionNode extends ExpressionNode {
  type: 'BinaryExpression';
  operator: BinaryOperator;
  left: ExpressionNode;
  right: ExpressionNode;
}

export interface UnaryExpressionNode extends ExpressionNode {
  type: 'UnaryExpression';
  operator: 'NOT' | '-';
  argument: ExpressionNode;
}

export interface FunctionCallNode extends ExpressionNode {
  type: 'FunctionCall';
  name: string;
  arguments: ExpressionNode[];
}

export interface InExpressionNode extends ExpressionNode {
  type: 'InExpression';
  expression: ExpressionNode;
  values: ExpressionNode[];
  negated: boolean;
}

export interface BetweenExpressionNode extends ExpressionNode {
  type: 'BetweenExpression';
  expression: ExpressionNode;
  lower: ExpressionNode;
  upper: ExpressionNode;
  negated: boolean;
}

export interface FieldSelectorNode extends ASTNode {
  type: 'FieldSelector';
  expression: ExpressionNode;
  alias?: string;
}

export interface WildcardSelectorNode extends ASTNode {
  type: 'WildcardSelector';
}

export interface OrderByItemNode extends ASTNode {
  type: 'OrderByItem';
  expression: ExpressionNode;
  direction: 'ASC' | 'DESC';
  nulls?: 'FIRST' | 'LAST';
}

export interface GroupByClauseNode extends ASTNode {
  type: 'GroupByClause';
  expressions: ExpressionNode[];
  having?: ExpressionNode;
}

export interface LimitClauseNode extends ASTNode {
  type: 'LimitClause';
  limit: number;
  offset?: number;
}

export interface SelectStatementNode extends ASTNode {
  type: 'SelectStatement';
  selectors: (FieldSelectorNode | WildcardSelectorNode)[];
  from: string;
  where?: ExpressionNode;
  groupBy?: GroupByClauseNode;
  orderBy?: OrderByItemNode[];
  limit?: LimitClauseNode;
}
