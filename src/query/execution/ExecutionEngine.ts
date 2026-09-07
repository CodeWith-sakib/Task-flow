import { SelectStatementNode } from '../parser/ASTNodes';
import { TaskQLParser } from '../parser/TaskQLParser';
import {
  AvgAccumulator,
  CountAccumulator,
  IAggregateAccumulator,
  MaxAccumulator,
  MinAccumulator,
  SumAccumulator
} from './AggregationFunctions';

/**
 * ExecutionEngine executes parsed TaskQL queries against arbitrary JavaScript objects/records.
 */
export class ExecutionEngine {
  public static executeQuery(query: string, dataSources: Record<string, any[]>): any[] {
    const ast = TaskQLParser.parse(query);
    const engine = new ExecutionEngine(dataSources);
    return engine.execute(ast);
  }

  private dataSources: Record<string, any[]>;

  constructor(dataSources: Record<string, any[]>) {
    this.dataSources = dataSources;
  }

  public execute(ast: SelectStatementNode): any[] {
    const sourceTable = this.dataSources[ast.from];
    if (!sourceTable) {
      throw new Error(`Table '${ast.from}' not found in data sources`);
    }

    // 1. Scan
    let rows = [...sourceTable];

    // 2. Filter (WHERE)
    if (ast.where) {
      rows = rows.filter(row => this.evaluateExpression(ast.where!, row));
    }

    // 3. Group By & Aggregations
    if (ast.groupBy) {
      rows = this.executeGroupBy(rows, ast);
    } else {
      // 4. Project (SELECT items)
      rows = rows.map(row => this.projectRow(row, ast.selectors));
    }

    // 5. Sort (ORDER BY)
    if (ast.orderBy && ast.orderBy.length > 0) {
      rows = this.executeSort(rows, ast.orderBy);
    }

    // 6. Limit & Offset
    if (ast.limit) {
      const offset = ast.limit.offset || 0;
      rows = rows.slice(offset, offset + ast.limit.limit);
    }

    return rows;
  }

  private evaluateExpression(expr: any, row: any): any {
    if (!expr) return null;

    if (expr.type === 'Literal') {
      return expr.value;
    }

    if (expr.type === 'Identifier') {
      return this.resolveField(row, expr.name);
    }

    if (expr.type === 'UnaryExpression') {
      const val = this.evaluateExpression(expr.argument, row);
      if (expr.operator === 'NOT') return !val;
      if (expr.operator === '-') return -val;
    }

    if (expr.type === 'BinaryExpression') {
      const left = this.evaluateExpression(expr.left, row);
      const right = this.evaluateExpression(expr.right, row);

      switch (expr.operator) {
        case '=': return left === right;
        case '!=': return left !== right;
        case '<': return left < right;
        case '<=': return left <= right;
        case '>': return left > right;
        case '>=': return left >= right;
        case 'AND': return Boolean(left && right);
        case 'OR': return Boolean(left || right);
        case 'LIKE': return typeof left === 'string' && this.matchLike(left, String(right));
        case '+': return Number(left) + Number(right);
        case '-': return Number(left) - Number(right);
        case '*': return Number(left) * Number(right);
        case '/': return Number(right) !== 0 ? Number(left) / Number(right) : null;
        default: return null;
      }
    }

    if (expr.type === 'InExpression') {
      const val = this.evaluateExpression(expr.expression, row);
      const list = expr.values.map((v: any) => this.evaluateExpression(v, row));
      return list.includes(val);
    }

    if (expr.type === 'BetweenExpression') {
      const val = this.evaluateExpression(expr.expression, row);
      const lower = this.evaluateExpression(expr.lower, row);
      const upper = this.evaluateExpression(expr.upper, row);
      return val >= lower && val <= upper;
    }

    return null;
  }

  private projectRow(row: any, selectors: any[]): any {
    if (selectors.length === 1 && selectors[0].type === 'WildcardSelector') {
      return { ...row };
    }

    const output: Record<string, any> = {};
    for (const sel of selectors) {
      if (sel.type === 'FieldSelector') {
        const val = this.evaluateExpression(sel.expression, row);
        const key = sel.alias || (sel.expression.name ? sel.expression.name : 'col');
        output[key] = val;
      }
    }

    return output;
  }

  private executeGroupBy(rows: any[], ast: SelectStatementNode): any[] {
    const groups = new Map<string, any[]>();

    for (const row of rows) {
      const groupKey = ast.groupBy!.expressions
        .map(expr => String(this.evaluateExpression(expr, row)))
        .join(':::');

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(row);
    }

    const aggregatedRows: any[] = [];

    for (const groupRows of groups.values()) {
      const sample = groupRows[0];
      const outputRow: Record<string, any> = {};

      for (const sel of ast.selectors) {
        if (sel.type === 'FieldSelector') {
          if (sel.expression.type === 'FunctionCall') {
            const fnExpr = sel.expression as any;
            const funcName = fnExpr.name.toUpperCase();
            const acc = this.createAccumulator(funcName);
            for (const r of groupRows) {
              const argVal = fnExpr.arguments.length > 0 && fnExpr.arguments[0].type !== 'WildcardSelector'
                ? this.evaluateExpression(fnExpr.arguments[0], r)
                : 1;
              acc.step(argVal);
            }
            const key = sel.alias || `${funcName.toLowerCase()}_result`;
            outputRow[key] = acc.result();
          } else {
            const val = this.evaluateExpression(sel.expression, sample);
            const idExpr = sel.expression as any;
            const key = sel.alias || (idExpr.name ? idExpr.name : 'col');
            outputRow[key] = val;
          }
        }
      }

      aggregatedRows.push(outputRow);
    }

    return aggregatedRows;
  }

  private executeSort(rows: any[], orderBy: any[]): any[] {
    return [...rows].sort((a, b) => {
      for (const item of orderBy) {
        const valA = this.evaluateExpression(item.expression, a);
        const valB = this.evaluateExpression(item.expression, b);

        if (valA !== valB) {
          const comparison = valA < valB ? -1 : 1;
          return item.direction === 'DESC' ? -comparison : comparison;
        }
      }
      return 0;
    });
  }

  private resolveField(row: any, path: string): any {
    if (!row || !path) return undefined;
    const parts = path.split('.');
    let current = row;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    return current;
  }

  private matchLike(str: string, pattern: string): boolean {
    const regexStr = '^' + pattern.replace(/%/g, '.*').replace(/_/g, '.') + '$';
    return new RegExp(regexStr, 'i').test(str);
  }

  private createAccumulator(funcName: string): IAggregateAccumulator {
    switch (funcName) {
      case 'COUNT': return new CountAccumulator();
      case 'SUM': return new SumAccumulator();
      case 'AVG': return new AvgAccumulator();
      case 'MIN': return new MinAccumulator();
      case 'MAX': return new MaxAccumulator();
      default: return new CountAccumulator();
    }
  }
}
