export enum TokenType {
  KEYWORD = 'KEYWORD',
  IDENTIFIER = 'IDENTIFIER',
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  NULL = 'NULL',
  OPERATOR = 'OPERATOR',
  PUNCTUATION = 'PUNCTUATION',
  EOF = 'EOF'
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

const KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT',
  'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET',
  'ASC', 'DESC', 'LIKE', 'ILIKE', 'IN', 'BETWEEN', 'AS',
  'TRUE', 'FALSE', 'NULL'
]);

/**
 * TaskQLLexer tokenizes TaskQL query strings into structured token streams.
 */
export class TaskQLLexer {
  private input: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(input: string) {
    this.input = input;
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.pos < this.input.length) {
      this.skipWhitespace();
      if (this.pos >= this.input.length) break;

      const char = this.input[this.pos];

      if (char === '/' && this.peek() === '*') {
        this.skipBlockComment();
        continue;
      }

      if (char === '-' && this.peek() === '-') {
        this.skipLineComment();
        continue;
      }

      if (char === "'" || char === '"') {
        tokens.push(this.readString());
      } else if (this.isDigit(char)) {
        tokens.push(this.readNumber());
      } else if (this.isAlpha(char) || char === '_' || char === '$') {
        tokens.push(this.readIdentifierOrKeyword());
      } else if (this.isOperatorChar(char)) {
        tokens.push(this.readOperator());
      } else if (this.isPunctuation(char)) {
        tokens.push({
          type: TokenType.PUNCTUATION,
          value: char,
          line: this.line,
          column: this.column
        });
        this.advance();
      } else {
        throw new Error(`Unexpected character '${char}' at line ${this.line}, column ${this.column}`);
      }
    }

    tokens.push({
      type: TokenType.EOF,
      value: '',
      line: this.line,
      column: this.column
    });

    return tokens;
  }

  private readString(): Token {
    const quote = this.input[this.pos];
    const startLine = this.line;
    const startCol = this.column;
    this.advance(); // Skip open quote

    let value = '';
    while (this.pos < this.input.length && this.input[this.pos] !== quote) {
      if (this.input[this.pos] === '\\') {
        this.advance();
        if (this.pos < this.input.length) {
          value += this.input[this.pos];
        }
      } else {
        value += this.input[this.pos];
      }
      this.advance();
    }

    if (this.pos >= this.input.length) {
      throw new Error(`Unterminated string starting at line ${startLine}, column ${startCol}`);
    }

    this.advance(); // Skip close quote
    return {
      type: TokenType.STRING,
      value,
      line: startLine,
      column: startCol
    };
  }

  private readNumber(): Token {
    const startLine = this.line;
    const startCol = this.column;
    let numStr = '';

    while (this.pos < this.input.length && (this.isDigit(this.input[this.pos]) || this.input[this.pos] === '.')) {
      numStr += this.input[this.pos];
      this.advance();
    }

    return {
      type: TokenType.NUMBER,
      value: numStr,
      line: startLine,
      column: startCol
    };
  }

  private readIdentifierOrKeyword(): Token {
    const startLine = this.line;
    const startCol = this.column;
    let id = '';

    while (
      this.pos < this.input.length &&
      (this.isAlphaNumeric(this.input[this.pos]) || this.input[this.pos] === '_' || this.input[this.pos] === '.' || this.input[this.pos] === '$')
    ) {
      id += this.input[this.pos];
      this.advance();
    }

    const upper = id.toUpperCase();
    if (KEYWORDS.has(upper)) {
      if (upper === 'TRUE' || upper === 'FALSE') {
        return { type: TokenType.BOOLEAN, value: id.toLowerCase(), line: startLine, column: startCol };
      }
      if (upper === 'NULL') {
        return { type: TokenType.NULL, value: 'null', line: startLine, column: startCol };
      }
      return { type: TokenType.KEYWORD, value: upper, line: startLine, column: startCol };
    }

    return {
      type: TokenType.IDENTIFIER,
      value: id,
      line: startLine,
      column: startCol
    };
  }

  private readOperator(): Token {
    const startLine = this.line;
    const startCol = this.column;
    let op = this.input[this.pos];
    this.advance();

    // Two-character operators: <=, >=, !=, <>
    if (this.pos < this.input.length) {
      const nextChar = this.input[this.pos];
      const twoChar = op + nextChar;
      if (twoChar === '<=' || twoChar === '>=' || twoChar === '!=' || twoChar === '<>') {
        op = twoChar === '<>' ? '!=' : twoChar;
        this.advance();
      }
    }

    return {
      type: TokenType.OPERATOR,
      value: op,
      line: startLine,
      column: startCol
    };
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length) {
      const char = this.input[this.pos];
      if (char === '\n') {
        this.line++;
        this.column = 1;
        this.pos++;
      } else if (char === ' ' || char === '\t' || char === '\r') {
        this.column++;
        this.pos++;
      } else {
        break;
      }
    }
  }

  private skipLineComment(): void {
    while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
      this.advance();
    }
  }

  private skipBlockComment(): void {
    this.advance(); // /
    this.advance(); // *
    while (this.pos < this.input.length - 1) {
      if (this.input[this.pos] === '*' && this.input[this.pos + 1] === '/') {
        this.advance();
        this.advance();
        return;
      }
      this.advance();
    }
  }

  private advance(): void {
    this.pos++;
    this.column++;
  }

  private peek(): string {
    return this.pos + 1 < this.input.length ? this.input[this.pos + 1] : '';
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }

  private isOperatorChar(char: string): boolean {
    return ['=', '<', '>', '!', '+', '-', '*', '/', '%'].includes(char);
  }

  private isPunctuation(char: string): boolean {
    return [',', '(', ')', ';', ':'].includes(char);
  }
}
