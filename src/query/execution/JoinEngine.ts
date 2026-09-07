/**
 * Relational and Stream Join Engine for TaskQL.
 * Implements Hash Join, Nested Loop Join, and Merge Join algorithms
 * supporting INNER, LEFT_OUTER, RIGHT_OUTER, FULL_OUTER, CROSS, LEFT_SEMI, and LEFT_ANTI join types.
 */

export type JoinType =
  | 'INNER'
  | 'LEFT_OUTER'
  | 'RIGHT_OUTER'
  | 'FULL_OUTER'
  | 'CROSS'
  | 'LEFT_SEMI'
  | 'LEFT_ANTI';

export type JoinAlgorithm = 'HASH' | 'NESTED_LOOP' | 'MERGE';

export interface JoinCondition {
  leftKey: string;
  rightKey: string;
}

export interface JoinPlan {
  type: JoinType;
  algorithm?: JoinAlgorithm;
  conditions: JoinCondition[];
  leftAlias?: string;
  rightAlias?: string;
}

export class JoinEngine {
  /**
   * Joins two row datasets based on specified JoinPlan.
   */
  public execute(
    leftRows: Record<string, any>[],
    rightRows: Record<string, any>[],
    plan: JoinPlan
  ): Record<string, any>[] {
    if (plan.type === 'CROSS' || plan.conditions.length === 0) {
      return this.crossJoin(leftRows, rightRows, plan.leftAlias, plan.rightAlias);
    }

    const algo = plan.algorithm || (leftRows.length * rightRows.length > 500 ? 'HASH' : 'NESTED_LOOP');

    switch (algo) {
      case 'HASH':
        return this.hashJoin(leftRows, rightRows, plan);
      case 'MERGE':
        return this.mergeJoin(leftRows, rightRows, plan);
      case 'NESTED_LOOP':
      default:
        return this.nestedLoopJoin(leftRows, rightRows, plan);
    }
  }

  private hashJoin(
    leftRows: Record<string, any>[],
    rightRows: Record<string, any>[],
    plan: JoinPlan
  ): Record<string, any>[] {
    const results: Record<string, any>[] = [];
    const hashTable = new Map<string, Record<string, any>[]>();

    // Build phase on right dataset
    for (const rRow of rightRows) {
      const key = this.extractCompositeKey(rRow, plan.conditions.map((c) => c.rightKey));
      let bucket = hashTable.get(key);
      if (!bucket) {
        bucket = [];
        hashTable.set(key, bucket);
      }
      bucket.push(rRow);
    }

    const matchedRightKeys = new Set<string>();

    // Probe phase on left dataset
    for (const lRow of leftRows) {
      const key = this.extractCompositeKey(lRow, plan.conditions.map((c) => c.leftKey));
      const matches = hashTable.get(key);

      if (plan.type === 'LEFT_SEMI') {
        if (matches && matches.length > 0) {
          results.push(this.formatOutputRow(lRow, null, plan.leftAlias, plan.rightAlias));
        }
        continue;
      }

      if (plan.type === 'LEFT_ANTI') {
        if (!matches || matches.length === 0) {
          results.push(this.formatOutputRow(lRow, null, plan.leftAlias, plan.rightAlias));
        }
        continue;
      }

      if (matches && matches.length > 0) {
        matchedRightKeys.add(key);
        for (const rRow of matches) {
          results.push(this.formatOutputRow(lRow, rRow, plan.leftAlias, plan.rightAlias));
        }
      } else if (plan.type === 'LEFT_OUTER' || plan.type === 'FULL_OUTER') {
        results.push(this.formatOutputRow(lRow, null, plan.leftAlias, plan.rightAlias));
      }
    }

    // Right / Full outer remaining unmatched right rows
    if (plan.type === 'RIGHT_OUTER' || plan.type === 'FULL_OUTER') {
      for (const rRow of rightRows) {
        const key = this.extractCompositeKey(rRow, plan.conditions.map((c) => c.rightKey));
        if (!matchedRightKeys.has(key)) {
          results.push(this.formatOutputRow(null, rRow, plan.leftAlias, plan.rightAlias));
        }
      }
    }

    return results;
  }

  private nestedLoopJoin(
    leftRows: Record<string, any>[],
    rightRows: Record<string, any>[],
    plan: JoinPlan
  ): Record<string, any>[] {
    const results: Record<string, any>[] = [];
    const matchedRightIndices = new Set<number>();

    for (const lRow of leftRows) {
      let matched = false;

      for (let rIdx = 0; rIdx < rightRows.length; rIdx++) {
        const rRow = rightRows[rIdx];
        if (this.evalConditions(lRow, rRow, plan.conditions)) {
          matched = true;
          matchedRightIndices.add(rIdx);

          if (plan.type === 'LEFT_SEMI') {
            results.push(this.formatOutputRow(lRow, null, plan.leftAlias, plan.rightAlias));
            break;
          }

          if (plan.type !== 'LEFT_ANTI') {
            results.push(this.formatOutputRow(lRow, rRow, plan.leftAlias, plan.rightAlias));
          }
        }
      }

      if (!matched) {
        if (plan.type === 'LEFT_ANTI') {
          results.push(this.formatOutputRow(lRow, null, plan.leftAlias, plan.rightAlias));
        } else if (plan.type === 'LEFT_OUTER' || plan.type === 'FULL_OUTER') {
          results.push(this.formatOutputRow(lRow, null, plan.leftAlias, plan.rightAlias));
        }
      }
    }

    if (plan.type === 'RIGHT_OUTER' || plan.type === 'FULL_OUTER') {
      for (let rIdx = 0; rIdx < rightRows.length; rIdx++) {
        if (!matchedRightIndices.has(rIdx)) {
          results.push(this.formatOutputRow(null, rightRows[rIdx], plan.leftAlias, plan.rightAlias));
        }
      }
    }

    return results;
  }

  private mergeJoin(
    leftRows: Record<string, any>[],
    rightRows: Record<string, any>[],
    plan: JoinPlan
  ): Record<string, any>[] {
    if (plan.conditions.length === 0) {
      return this.crossJoin(leftRows, rightRows, plan.leftAlias, plan.rightAlias);
    }

    const firstCond = plan.conditions[0];
    const leftSorted = [...leftRows].sort((a, b) => this.compareValues(a[firstCond.leftKey], b[firstCond.leftKey]));
    const rightSorted = [...rightRows].sort((a, b) => this.compareValues(a[firstCond.rightKey], b[firstCond.rightKey]));

    const results: Record<string, any>[] = [];
    let l = 0;
    let r = 0;

    while (l < leftSorted.length && r < rightSorted.length) {
      const leftVal = leftSorted[l][firstCond.leftKey];
      const rightVal = rightSorted[r][firstCond.rightKey];
      const cmp = this.compareValues(leftVal, rightVal);

      if (cmp === 0) {
        // Collect all duplicates on right
        let rEnd = r;
        while (rEnd < rightSorted.length && this.compareValues(leftVal, rightSorted[rEnd][firstCond.rightKey]) === 0) {
          rEnd++;
        }

        for (let i = r; i < rEnd; i++) {
          if (this.evalConditions(leftSorted[l], rightSorted[i], plan.conditions)) {
            results.push(this.formatOutputRow(leftSorted[l], rightSorted[i], plan.leftAlias, plan.rightAlias));
          }
        }
        l++;
      } else if (cmp < 0) {
        if (plan.type === 'LEFT_OUTER' || plan.type === 'FULL_OUTER') {
          results.push(this.formatOutputRow(leftSorted[l], null, plan.leftAlias, plan.rightAlias));
        }
        l++;
      } else {
        if (plan.type === 'RIGHT_OUTER' || plan.type === 'FULL_OUTER') {
          results.push(this.formatOutputRow(null, rightSorted[r], plan.leftAlias, plan.rightAlias));
        }
        r++;
      }
    }

    while (l < leftSorted.length && (plan.type === 'LEFT_OUTER' || plan.type === 'FULL_OUTER')) {
      results.push(this.formatOutputRow(leftSorted[l++], null, plan.leftAlias, plan.rightAlias));
    }

    while (r < rightSorted.length && (plan.type === 'RIGHT_OUTER' || plan.type === 'FULL_OUTER')) {
      results.push(this.formatOutputRow(null, rightSorted[r++], plan.leftAlias, plan.rightAlias));
    }

    return results;
  }

  private crossJoin(
    leftRows: Record<string, any>[],
    rightRows: Record<string, any>[],
    leftAlias?: string,
    rightAlias?: string
  ): Record<string, any>[] {
    const results: Record<string, any>[] = [];
    for (const l of leftRows) {
      for (const r of rightRows) {
        results.push(this.formatOutputRow(l, r, leftAlias, rightAlias));
      }
    }
    return results;
  }

  private evalConditions(lRow: Record<string, any>, rRow: Record<string, any>, conditions: JoinCondition[]): boolean {
    for (const cond of conditions) {
      if (lRow[cond.leftKey] !== rRow[cond.rightKey]) return false;
    }
    return true;
  }

  private extractCompositeKey(row: Record<string, any>, keys: string[]): string {
    return keys.map((k) => String(row[k] ?? '__NULL__')).join('::');
  }

  private compareValues(a: any, b: any): number {
    if (a === b) return 0;
    if (a === null || a === undefined) return -1;
    if (b === null || b === undefined) return 1;
    return a < b ? -1 : 1;
  }

  private formatOutputRow(
    lRow: Record<string, any> | null,
    rRow: Record<string, any> | null,
    leftAlias?: string,
    rightAlias?: string
  ): Record<string, any> {
    const out: Record<string, any> = {};

    if (lRow) {
      for (const [k, v] of Object.entries(lRow)) {
        const key = leftAlias ? `${leftAlias}.${k}` : k;
        out[key] = v;
      }
    }

    if (rRow) {
      for (const [k, v] of Object.entries(rRow)) {
        const key = rightAlias ? `${rightAlias}.${k}` : k;
        out[key] = v;
      }
    }

    return out;
  }
}
