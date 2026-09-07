/**
 * Window Function Execution Engine for TaskQL.
 * Supports OVER (PARTITION BY ... ORDER BY ... [ROWS/RANGE BETWEEN ...])
 * Computes ROW_NUMBER, RANK, DENSE_RANK, NTILE, LAG, LEAD, FIRST_VALUE, LAST_VALUE, SUM, AVG, MIN, MAX, COUNT.
 */

export interface WindowSpec {
  partitionBy?: string[];
  orderBy?: { field: string; direction: 'ASC' | 'DESC' }[];
  frame?: {
    type: 'ROWS' | 'RANGE';
    start: { kind: 'UNBOUNDED_PRECEDING' | 'PRECEDING' | 'CURRENT_ROW' | 'FOLLOWING'; offset?: number };
    end: { kind: 'UNBOUNDED_FOLLOWING' | 'PRECEDING' | 'CURRENT_ROW' | 'FOLLOWING'; offset?: number };
  };
}

export type WindowFunctionType =
  | 'ROW_NUMBER'
  | 'RANK'
  | 'DENSE_RANK'
  | 'NTILE'
  | 'LAG'
  | 'LEAD'
  | 'FIRST_VALUE'
  | 'LAST_VALUE'
  | 'SUM'
  | 'AVG'
  | 'MIN'
  | 'MAX'
  | 'COUNT';

export interface WindowInvocation {
  functionType: WindowFunctionType;
  args?: (string | number)[];
  outputField: string;
  spec: WindowSpec;
}

export class WindowFunctionExecutor {
  /**
   * Evaluates a set of window function invocations against a dataset.
   */
  public execute(rows: Record<string, any>[], invocations: WindowInvocation[]): Record<string, any>[] {
    if (rows.length === 0 || invocations.length === 0) {
      return rows.map((r) => ({ ...r }));
    }

    let result = rows.map((r) => ({ ...r }));

    for (const invocation of invocations) {
      result = this.executeSingleWindow(result, invocation);
    }

    return result;
  }

  private executeSingleWindow(rows: Record<string, any>[], invocation: WindowInvocation): Record<string, any>[] {
    const { functionType, args = [], outputField, spec } = invocation;

    // 1. Partition rows
    const partitions = this.partitionRows(rows, spec.partitionBy || []);

    const outputRows: Record<string, any>[] = [];

    // 2. Process each partition independently
    for (const partition of partitions) {
      // Sort partition if orderBy is provided
      if (spec.orderBy && spec.orderBy.length > 0) {
        this.sortPartition(partition, spec.orderBy);
      }

      const partitionLen = partition.length;

      for (let i = 0; i < partitionLen; i++) {
        const row = partition[i];
        let val: any = null;

        switch (functionType) {
          case 'ROW_NUMBER':
            val = i + 1;
            break;

          case 'RANK':
            val = this.computeRank(partition, i, spec.orderBy || []);
            break;

          case 'DENSE_RANK':
            val = this.computeDenseRank(partition, i, spec.orderBy || []);
            break;

          case 'NTILE': {
            const numBuckets = Number(args[0]) || 1;
            val = Math.floor((i * numBuckets) / partitionLen) + 1;
            break;
          }

          case 'LAG': {
            const field = String(args[0]);
            const offset = Number(args[1] ?? 1);
            const defaultVal = args[2] ?? null;
            const targetIdx = i - offset;
            val = targetIdx >= 0 ? partition[targetIdx][field] : defaultVal;
            break;
          }

          case 'LEAD': {
            const field = String(args[0]);
            const offset = Number(args[1] ?? 1);
            const defaultVal = args[2] ?? null;
            const targetIdx = i + offset;
            val = targetIdx < partitionLen ? partition[targetIdx][field] : defaultVal;
            break;
          }

          case 'FIRST_VALUE': {
            const field = String(args[0]);
            const frameRows = this.getFrameRows(partition, i, spec);
            val = frameRows.length > 0 ? frameRows[0][field] : null;
            break;
          }

          case 'LAST_VALUE': {
            const field = String(args[0]);
            const frameRows = this.getFrameRows(partition, i, spec);
            val = frameRows.length > 0 ? frameRows[frameRows.length - 1][field] : null;
            break;
          }

          case 'SUM': {
            const field = String(args[0]);
            const frameRows = this.getFrameRows(partition, i, spec);
            val = frameRows.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
            break;
          }

          case 'AVG': {
            const field = String(args[0]);
            const frameRows = this.getFrameRows(partition, i, spec);
            if (frameRows.length === 0) {
              val = null;
            } else {
              const sum = frameRows.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
              val = sum / frameRows.length;
            }
            break;
          }

          case 'MIN': {
            const field = String(args[0]);
            const frameRows = this.getFrameRows(partition, i, spec);
            if (frameRows.length === 0) {
              val = null;
            } else {
              val = frameRows.reduce((min, r) => {
                const v = r[field];
                return min === null || v < min ? v : min;
              }, null);
            }
            break;
          }

          case 'MAX': {
            const field = String(args[0]);
            const frameRows = this.getFrameRows(partition, i, spec);
            if (frameRows.length === 0) {
              val = null;
            } else {
              val = frameRows.reduce((max, r) => {
                const v = r[field];
                return max === null || v > max ? v : max;
              }, null);
            }
            break;
          }

          case 'COUNT': {
            const frameRows = this.getFrameRows(partition, i, spec);
            val = frameRows.length;
            break;
          }
        }

        row[outputField] = val;
        outputRows.push(row);
      }
    }

    return outputRows;
  }

  private partitionRows(rows: Record<string, any>[], partitionFields: string[]): Record<string, any>[][] {
    if (partitionFields.length === 0) {
      return [rows.map((r) => ({ ...r }))];
    }

    const map = new Map<string, Record<string, any>[]>();

    for (const row of rows) {
      const key = partitionFields.map((f) => String(row[f] ?? 'null')).join(':::');
      let bucket = map.get(key);
      if (!bucket) {
        bucket = [];
        map.set(key, bucket);
      }
      bucket.push({ ...row });
    }

    return Array.from(map.values());
  }

  private sortPartition(rows: Record<string, any>[], orderBy: { field: string; direction: 'ASC' | 'DESC' }[]): void {
    rows.sort((a, b) => {
      for (const order of orderBy) {
        const valA = a[order.field];
        const valB = b[order.field];
        if (valA === valB) continue;
        if (valA === null || valA === undefined) return order.direction === 'ASC' ? -1 : 1;
        if (valB === null || valB === undefined) return order.direction === 'ASC' ? 1 : -1;

        if (valA < valB) return order.direction === 'ASC' ? -1 : 1;
        if (valA > valB) return order.direction === 'ASC' ? 1 : -1;
      }
      return 0;
    });
  }

  private computeRank(
    rows: Record<string, any>[],
    index: number,
    orderBy: { field: string; direction: 'ASC' | 'DESC' }[]
  ): number {
    if (index === 0) return 1;
    const current = rows[index];
    const prev = rows[index - 1];

    if (this.areRowsEqualForOrder(current, prev, orderBy)) {
      return this.computeRank(rows, index - 1, orderBy);
    }
    return index + 1;
  }

  private computeDenseRank(
    rows: Record<string, any>[],
    index: number,
    orderBy: { field: string; direction: 'ASC' | 'DESC' }[]
  ): number {
    if (index === 0) return 1;
    let rank = 1;
    for (let i = 1; i <= index; i++) {
      if (!this.areRowsEqualForOrder(rows[i], rows[i - 1], orderBy)) {
        rank++;
      }
    }
    return rank;
  }

  private areRowsEqualForOrder(
    a: Record<string, any>,
    b: Record<string, any>,
    orderBy: { field: string; direction: 'ASC' | 'DESC' }[]
  ): boolean {
    for (const order of orderBy) {
      if (a[order.field] !== b[order.field]) return false;
    }
    return true;
  }

  private getFrameRows(
    partition: Record<string, any>[],
    currentIndex: number,
    spec: WindowSpec
  ): Record<string, any>[] {
    // Default frame: UNBOUNDED PRECEDING to CURRENT ROW (if ORDER BY exists), or full partition (if no ORDER BY)
    if (!spec.frame) {
      if (spec.orderBy && spec.orderBy.length > 0) {
        return partition.slice(0, currentIndex + 1);
      }
      return partition;
    }

    let startIdx = 0;
    let endIdx = partition.length - 1;

    // Resolve start boundary
    switch (spec.frame.start.kind) {
      case 'UNBOUNDED_PRECEDING':
        startIdx = 0;
        break;
      case 'CURRENT_ROW':
        startIdx = currentIndex;
        break;
      case 'PRECEDING':
        startIdx = Math.max(0, currentIndex - (spec.frame.start.offset || 0));
        break;
      case 'FOLLOWING':
        startIdx = Math.min(partition.length - 1, currentIndex + (spec.frame.start.offset || 0));
        break;
    }

    // Resolve end boundary
    switch (spec.frame.end.kind) {
      case 'UNBOUNDED_FOLLOWING':
        endIdx = partition.length - 1;
        break;
      case 'CURRENT_ROW':
        endIdx = currentIndex;
        break;
      case 'PRECEDING':
        endIdx = Math.max(0, currentIndex - (spec.frame.end.offset || 0));
        break;
      case 'FOLLOWING':
        endIdx = Math.min(partition.length - 1, currentIndex + (spec.frame.end.offset || 0));
        break;
    }

    if (startIdx > endIdx) {
      return [];
    }

    return partition.slice(startIdx, endIdx + 1);
  }
}
