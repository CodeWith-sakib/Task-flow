/**
 * Advanced Aggregate & Grouping Engine for TaskQL.
 * Supports Hash Grouping, Stream Grouping, Multi-Column GROUP BY,
 * HAVING clause evaluation, ROLLUP, CUBE, and GROUPING SETS.
 */

export type AggregationOp = 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'STDDEV' | 'ARRAY_AGG';

export interface AggregateSpec {
  field: string;
  op: AggregationOp;
  alias: string;
  distinct?: boolean;
}

export interface GroupBySpec {
  keys: string[];
  rollup?: boolean;
  cube?: boolean;
  groupingSets?: string[][];
  aggregates: AggregateSpec[];
  having?: (group: Record<string, any>) => boolean;
}

export class AggregateGroupingEngine {
  public execute(rows: Record<string, any>[], spec: GroupBySpec): Record<string, any>[] {
    if (spec.rollup) {
      return this.executeRollup(rows, spec);
    }
    if (spec.cube) {
      return this.executeCube(rows, spec);
    }
    if (spec.groupingSets && spec.groupingSets.length > 0) {
      return this.executeGroupingSets(rows, spec);
    }

    return this.executeStandardGroupBy(rows, spec.keys, spec.aggregates, spec.having);
  }

  private executeStandardGroupBy(
    rows: Record<string, any>[],
    keys: string[],
    aggregates: AggregateSpec[],
    having?: (group: Record<string, any>) => boolean
  ): Record<string, any>[] {
    const groups = new Map<string, { groupKeys: Record<string, any>; rows: Record<string, any>[] }>();

    for (const row of rows) {
      const groupKeyValues: Record<string, any> = {};
      const keyParts: string[] = [];

      for (const k of keys) {
        const val = row[k];
        groupKeyValues[k] = val;
        keyParts.push(String(val ?? 'NULL'));
      }

      const hashKey = keyParts.join(':::');
      let group = groups.get(hashKey);
      if (!group) {
        group = { groupKeys: groupKeyValues, rows: [] };
        groups.set(hashKey, group);
      }
      group.rows.push(row);
    }

    // Handle global aggregation when keys is empty
    if (keys.length === 0 && groups.size === 0) {
      groups.set('__ALL__', { groupKeys: {}, rows: [] });
    }

    const results: Record<string, any>[] = [];

    for (const group of groups.values()) {
      const outputRow: Record<string, any> = { ...group.groupKeys };

      for (const agg of aggregates) {
        outputRow[agg.alias] = this.computeAggregate(group.rows, agg);
      }

      if (!having || having(outputRow)) {
        results.push(outputRow);
      }
    }

    return results;
  }

  private executeRollup(rows: Record<string, any>[], spec: GroupBySpec): Record<string, any>[] {
    const results: Record<string, any>[] = [];
    const keys = spec.keys;

    // Rollup on [A, B, C] -> Group by [A, B, C], [A, B], [A], []
    for (let len = keys.length; len >= 0; len--) {
      const subKeys = keys.slice(0, len);
      const subResults = this.executeStandardGroupBy(rows, subKeys, spec.aggregates, spec.having);

      // Fill missing keys with null
      for (const r of subResults) {
        for (const k of keys) {
          if (!(k in r)) {
            r[k] = null;
          }
        }
        results.push(r);
      }
    }

    return results;
  }

  private executeCube(rows: Record<string, any>[], spec: GroupBySpec): Record<string, any>[] {
    const keys = spec.keys;
    const powerSet = this.generatePowerSet(keys);
    const results: Record<string, any>[] = [];

    for (const subKeys of powerSet) {
      const subResults = this.executeStandardGroupBy(rows, subKeys, spec.aggregates, spec.having);
      for (const r of subResults) {
        for (const k of keys) {
          if (!(k in r)) {
            r[k] = null;
          }
        }
        results.push(r);
      }
    }

    return results;
  }

  private executeGroupingSets(rows: Record<string, any>[], spec: GroupBySpec): Record<string, any>[] {
    const results: Record<string, any>[] = [];
    const allKeys = Array.from(new Set(spec.groupingSets!.flat()));

    for (const set of spec.groupingSets!) {
      const subResults = this.executeStandardGroupBy(rows, set, spec.aggregates, spec.having);
      for (const r of subResults) {
        for (const k of allKeys) {
          if (!(k in r)) {
            r[k] = null;
          }
        }
        results.push(r);
      }
    }

    return results;
  }

  private computeAggregate(rows: Record<string, any>[], agg: AggregateSpec): any {
    if (agg.op === 'COUNT') {
      if (agg.field === '*') {
        return rows.length;
      }
      const validRows = rows.filter((r) => r[agg.field] !== null && r[agg.field] !== undefined);
      if (agg.distinct) {
        return new Set(validRows.map((r) => r[agg.field])).size;
      }
      return validRows.length;
    }

    let values = rows
      .map((r) => r[agg.field])
      .filter((v) => v !== null && v !== undefined)
      .map(Number)
      .filter((n) => !isNaN(n));

    if (agg.distinct) {
      values = Array.from(new Set(values));
    }

    if (values.length === 0) {
      return null;
    }

    switch (agg.op) {
      case 'SUM':
        return values.reduce((a, b) => a + b, 0);

      case 'AVG':
        return values.reduce((a, b) => a + b, 0) / values.length;

      case 'MIN':
        return Math.min(...values);

      case 'MAX':
        return Math.max(...values);

      case 'STDDEV': {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
      }

      case 'ARRAY_AGG':
        return rows.map((r) => r[agg.field]);
    }
  }

  private generatePowerSet<T>(arr: T[]): T[][] {
    return arr.reduce((subsets, value) => subsets.concat(subsets.map((set) => [value, ...set])), [[]] as T[][]);
  }
}
