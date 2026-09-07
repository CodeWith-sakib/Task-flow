import { TaskQLLexer, Token, TokenType } from './TaskQLLexer';
import {
  BetweenExpressionNode,
  BinaryExpressionNode,
  BinaryOperator,
  ExpressionNode,
  FieldSelectorNode,
  FunctionCallNode,
  GroupByClauseNode,
  IdentifierNode,
  InExpressionNode,
  LimitClauseNode,
  LiteralNode,
  OrderByItemNode,
  SelectStatementNode,
  UnaryExpressionNode,
  WildcardSelectorNode
} from './ASTNodes';

/**
 * TaskQLParser parses token streams into strongly-typed SQL AST structures using recursive descent.
 */
export class TaskQLParser {
  private tokens: Token[] = [];
  private pos: number = 0;

  public static parse(query: string): SelectStatementNode {
    const lexer = new TaskQLLexer(query);
    const tokens = lexer.tokenize();
    const parser = new TaskQLParser(tokens);
    return parser.parseSelect();
  }

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  public parseSelect(): SelectStatementNode {
    this.consumeKeyword('SELECT');
    const selectors = this.parseSelectors();

    this.consumeKeyword('FROM');
    const fromTable = this.consumeIdentifierOrKeyword();

    let where: ExpressionNode | undefined;
    if (this.matchKeyword('WHERE')) {
      where = this.parseExpression();
    }

    let groupBy: GroupByClauseNode | undefined;
    if (this.matchKeyword('GROUP')) {
      this.consumeKeyword('BY');
      const expressions = [this.parseExpression()];
      while (this.matchPunctuation(',')) {
        expressions.push(this.parseExpression());
      }
      let having: ExpressionNode | undefined;
      if (this.matchKeyword('HAVING')) {
        having = this.parseExpression();
      }
      groupBy = {
        type: 'GroupByClause',
        expressions,
        having
      };
    }

    let orderBy: OrderByItemNode[] | undefined;
    if (this.matchKeyword('ORDER')) {
      this.consumeKeyword('BY');
      orderBy = [this.parseOrderByItem()];
      while (this.matchPunctuation(',')) {
        orderBy.push(this.parseOrderByItem());
      }
    }

    let limit: LimitClauseNode | undefined;
    if (this.matchKeyword('LIMIT')) {
      const limitVal = parseInt(this.consumeNumber(), 10);
      let offsetVal: number | undefined;
      if (this.matchKeyword('OFFSET')) {
        offsetVal = parseInt(this.consumeNumber(), 10);
      }
      limit = {
        type: 'LimitClause',
        limit: limitVal,
        offset: offsetVal
      };
    }

    return {
      type: 'SelectStatement',
      selectors,
      from: fromTable,
      where,
      groupBy,
      orderBy,
      limit
    };
  }

  private parseSelectors(): (FieldSelectorNode | WildcardSelectorNode)[] {
    const selectors: (FieldSelectorNode | WildcardSelectorNode)[] = [];

    if (this.matchOperator('*')) {
      selectors.push({ type: 'WildcardSelector' });
      return selectors;
    }

    selectors.push(this.parseFieldSelector());
    while (this.matchPunctuation(',')) {
      selectors.push(this.parseFieldSelector());
    }

    return selectors;
  }

  private parseFieldSelector(): FieldSelectorNode {
    const expr = this.parseExpression();
    let alias: string | undefined;

    if (this.matchKeyword('AS')) {
      alias = this.consumeIdentifierOrKeyword();
    } else if (this.current().type === TokenType.IDENTIFIER && !this.isClauseKeyword(this.current().value)) {
      alias = this.consumeIdentifierOrKeyword();
    }

    return {
      type: 'FieldSelector',
      expression: expr,
      alias
    };
  }

  private parseOrderByItem(): OrderByItemNode {
    const expr = this.parseExpression();
    let direction: 'ASC' | 'DESC' = 'ASC';

    if (this.matchKeyword('DESC')) {
      direction = 'DESC';
    } else if (this.matchKeyword('ASC')) {
      direction = 'ASC';
    }

    return {
      type: 'OrderByItem',
      expression: expr,
      direction
    };
  }

  private parseExpression(): ExpressionNode {
    return this.parseOr();
  }

  private parseOr(): ExpressionNode {
    let left = this.parseAnd();
    while (this.matchKeyword('OR')) {
      const right = this.parseAnd();
      left = {
        type: 'BinaryExpression',
        operator: 'OR',
        left,
        right
      } as BinaryExpressionNode;
    }
    return left;
  }

  private parseAnd(): ExpressionNode {
    let left = this.parseComparison();
    while (this.matchKeyword('AND')) {
      const right = this.parseComparison();
      left = {
        type: 'BinaryExpression',
        operator: 'AND',
        left,
        right
      } as BinaryExpressionNode;
    }
    return left;
  }

  private parseComparison(): ExpressionNode {
    let left = this.parseAddition();

    if (this.matchKeyword('IN')) {
      this.consumePunctuation('(');
      const values = [this.parseExpression()];
      while (this.matchPunctuation(',')) {
        values.push(this.parseExpression());
      }
      this.consumePunctuation(')');
      return {
        type: 'InExpression',
        expression: left,
        values,
        negated: false
      } as InExpressionNode;
    }

    if (this.matchKeyword('BETWEEN')) {
      const lower = this.parseAddition();
      this.consumeKeyword('AND');
      const upper = this.parseAddition();
      return {
        type: 'BetweenExpression',
        expression: left,
        lower,
        upper,
        negated: false
      } as BetweenExpressionNode;
    }

    const currentToken = this.current();
    if (
      (currentToken.type === TokenType.OPERATOR && ['=', '!=', '<', '<=', '>', '>='].includes(currentToken.value)) ||
      (currentToken.type === TokenType.KEYWORD && ['LIKE', 'ILIKE'].includes(currentToken.value))
    ) {
      const op = currentToken.value as BinaryOperator;
      this.advance();
      const right = this.parseAddition();
      return {
        type: 'BinaryExpression',
        operator: op,
        left,
        right
      } as BinaryExpressionNode;
    }

    return left;
  }

  private parseAddition(): ExpressionNode {
    let left = this.parseMultiplication();
    while (this.current().type === TokenType.OPERATOR && (this.current().value === '+' || this.current().value === '-')) {
      const op = this.current().value as BinaryOperator;
      this.advance();
      const right = this.parseMultiplication();
      left = {
        type: 'BinaryExpression',
        operator: op,
        left,
        right
      } as BinaryExpressionNode;
    }
    return left;
  }

  private parseMultiplication(): ExpressionNode {
    let left = this.parseUnary();
    while (this.current().type === TokenType.OPERATOR && (this.current().value === '*' || this.current().value === '/' || this.current().value === '%')) {
      const op = this.current().value as BinaryOperator;
      this.advance();
      const right = this.parseUnary();
      left = {
        type: 'BinaryExpression',
        operator: op,
        left,
        right
      } as BinaryExpressionNode;
    }
    return left;
  }

  private parseUnary(): ExpressionNode {
    if (this.matchKeyword('NOT')) {
      const arg = this.parseUnary();
      return {
        type: 'UnaryExpression',
        operator: 'NOT',
        argument: arg
      } as UnaryExpressionNode;
    }
    if (this.matchOperator('-')) {
      const arg = this.parseUnary();
      return {
        type: 'UnaryExpression',
        operator: '-',
        argument: arg
      } as UnaryExpressionNode;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ExpressionNode {
    const token = this.current();

    if (token.type === TokenType.NUMBER) {
      this.advance();
      const val = token.value.includes('.') ? parseFloat(token.value) : parseInt(token.value, 10);
      return { type: 'Literal', value: val, raw: token.value } as LiteralNode;
    }

    if (token.type === TokenType.STRING) {
      this.advance();
      return { type: 'Literal', value: token.value, raw: `'${token.value}'` } as LiteralNode;
    }

    if (token.type === TokenType.BOOLEAN) {
      this.advance();
      return { type: 'Literal', value: token.value === 'true', raw: token.value } as LiteralNode;
    }

    if (token.type === TokenType.NULL) {
      this.advance();
      return { type: 'Literal', value: null, raw: 'null' } as LiteralNode;
    }

    if (token.type === TokenType.IDENTIFIER || token.type === TokenType.KEYWORD) {
      const name = token.value;
      this.advance();

      // Check function call
      if (this.matchPunctuation('(')) {
        const args: ExpressionNode[] = [];
        if (!this.checkPunctuation(')')) {
          if (this.matchOperator('*')) {
            args.push({ type: 'WildcardSelector' } as any);
          } else {
            args.push(this.parseExpression());
            while (this.matchPunctuation(',')) {
              args.push(this.parseExpression());
            }
          }
        }
        this.consumePunctuation(')');
        return {
          type: 'FunctionCall',
          name: name.toUpperCase(),
          arguments: args
        } as FunctionCallNode;
      }

      return { type: 'Identifier', name } as IdentifierNode;
    }

    if (this.matchPunctuation('(')) {
      const expr = this.parseExpression();
      this.consumePunctuation(')');
      return expr;
    }

    throw new Error(`Unexpected token ${token.type} ('${token.value}') at line ${token.line}, col ${token.column}`);
  }

  private current(): Token {
    return this.tokens[this.pos] || { type: TokenType.EOF, value: '', line: 0, column: 0 };
  }

  private advance(): void {
    if (this.pos < this.tokens.length) {
      this.pos++;
    }
  }

  private matchKeyword(kw: string): boolean {
    if (this.current().type === TokenType.KEYWORD && this.current().value.toUpperCase() === kw.toUpperCase()) {
      this.advance();
      return true;
    }
    return false;
  }

  private matchOperator(op: string): boolean {
    if (this.current().type === TokenType.OPERATOR && this.current().value === op) {
      this.advance();
      return true;
    }
    return false;
  }

  private matchPunctuation(p: string): boolean {
    if (this.current().type === TokenType.PUNCTUATION && this.current().value === p) {
      this.advance();
      return true;
    }
    return false;
  }

  private checkPunctuation(p: string): boolean {
    return this.current().type === TokenType.PUNCTUATION && this.current().value === p;
  }

  private consumeKeyword(kw: string): void {
    if (!this.matchKeyword(kw)) {
      const token = this.current();
      throw new Error(`Expected keyword '${kw}', got ${token.type} ('${token.value}') at line ${token.line}`);
    }
  }

  private consumePunctuation(p: string): void {
    if (!this.matchPunctuation(p)) {
      const token = this.current();
      throw new Error(`Expected punctuation '${p}', got ${token.type} ('${token.value}') at line ${token.line}`);
    }
  }

  private consumeIdentifierOrKeyword(): string {
    const token = this.current();
    if (token.type === TokenType.IDENTIFIER || token.type === TokenType.KEYWORD) {
      this.advance();
      return token.value;
    }
    throw new Error(`Expected identifier, got ${token.type} ('${token.value}') at line ${token.line}`);
  }

  private consumeNumber(): string {
    const token = this.current();
    if (token.type === TokenType.NUMBER) {
      this.advance();
      return token.value;
    }
    throw new Error(`Expected number, got ${token.type} ('${token.value}') at line ${token.line}`);
  }

  private isClauseKeyword(val: string): boolean {
    return ['FROM', 'WHERE', 'GROUP', 'HAVING', 'ORDER', 'LIMIT', 'OFFSET'].includes(val.toUpperCase());
  }
}
