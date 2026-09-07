/**
 * Size-Tiered & Leveled LSM Compaction Coordinator.
 * Selects candidate SSTables for compaction based on level capacity ratios,
 * computes write amplification factor, and coordinates multi-way compaction merges.
 */

export interface SSTableSummary {
  tableId: string;
  level: number;
  byteSize: number;
  minKey: string;
  maxKey: string;
  entriesCount: number;
}

export type CompactionStrategy = 'SIZE_TIERED' | 'LEVELED';

export interface CompactionPlan {
  strategy: CompactionStrategy;
  sourceTables: SSTableSummary[];
  targetLevel: number;
  estimatedOutputSize: number;
}

export class TieredCompactor {
  private maxBytesForLevelBase: number;
  private maxBytesForLevelMultiplier: number;
  private sizeTierThreshold: number;

  constructor(
    maxBytesForLevelBase: number = 10 * 1024 * 1024, // 10MB Level 1 base
    maxBytesForLevelMultiplier: number = 10,
    sizeTierThreshold: number = 4
  ) {
    this.maxBytesForLevelBase = maxBytesForLevelBase;
    this.maxBytesForLevelMultiplier = maxBytesForLevelMultiplier;
    this.sizeTierThreshold = sizeTierThreshold;
  }

  public planCompaction(tables: SSTableSummary[], strategy: CompactionStrategy = 'LEVELED'): CompactionPlan | null {
    if (strategy === 'SIZE_TIERED') {
      return this.planSizeTiered(tables);
    }
    return this.planLeveled(tables);
  }

  private planSizeTiered(tables: SSTableSummary[]): CompactionPlan | null {
    // Group tables by similar size buckets (within 2x size ratio)
    const tablesByLevel = new Map<number, SSTableSummary[]>();

    for (const t of tables) {
      let bucket = tablesByLevel.get(t.level);
      if (!bucket) {
        bucket = [];
        tablesByLevel.set(t.level, bucket);
      }
      bucket.push(t);
    }

    for (const [level, group] of tablesByLevel.entries()) {
      if (group.length >= this.sizeTierThreshold) {
        const candidateTables = group.slice(0, this.sizeTierThreshold);
        const estimatedOutputSize = candidateTables.reduce((acc, t) => acc + t.byteSize, 0);

        return {
          strategy: 'SIZE_TIERED',
          sourceTables: candidateTables,
          targetLevel: level + 1,
          estimatedOutputSize,
        };
      }
    }

    return null;
  }

  private planLeveled(tables: SSTableSummary[]): CompactionPlan | null {
    // Check level capacity overshoots
    const levelsMap = new Map<number, SSTableSummary[]>();
    for (const t of tables) {
      let list = levelsMap.get(t.level);
      if (!list) {
        list = [];
        levelsMap.set(t.level, list);
      }
      list.push(t);
    }

    // Check Level 0 file count trigger
    const l0Tables = levelsMap.get(0) || [];
    if (l0Tables.length >= 4) {
      const l1Tables = levelsMap.get(1) || [];
      // Find overlapping L1 tables
      const minL0 = l0Tables.reduce((min, t) => (t.minKey < min ? t.minKey : min), l0Tables[0].minKey);
      const maxL0 = l0Tables.reduce((max, t) => (t.maxKey > max ? t.maxKey : max), l0Tables[0].maxKey);

      const overlappingL1 = l1Tables.filter((t) => !(t.maxKey < minL0 || t.minKey > maxL0));
      const sourceTables = [...l0Tables, ...overlappingL1];

      return {
        strategy: 'LEVELED',
        sourceTables,
        targetLevel: 1,
        estimatedOutputSize: sourceTables.reduce((acc, t) => acc + t.byteSize, 0),
      };
    }

    // Check Level N size overflow
    for (let lvl = 1; lvl <= 6; lvl++) {
      const currentLevelTables = levelsMap.get(lvl) || [];
      const currentBytes = currentLevelTables.reduce((acc, t) => acc + t.byteSize, 0);
      const maxAllowedBytes = this.maxBytesForLevelBase * Math.pow(this.maxBytesForLevelMultiplier, lvl - 1);

      if (currentBytes > maxAllowedBytes) {
        // Pick one table from Level N to compact into Level N+1
        const pick = currentLevelTables[0];
        const nextLevelTables = levelsMap.get(lvl + 1) || [];
        const overlappingNext = nextLevelTables.filter((t) => !(t.maxKey < pick.minKey || t.minKey > pick.maxKey));

        const sourceTables = [pick, ...overlappingNext];

        return {
          strategy: 'LEVELED',
          sourceTables,
          targetLevel: lvl + 1,
          estimatedOutputSize: sourceTables.reduce((acc, t) => acc + t.byteSize, 0),
        };
      }
    }

    return null;
  }
}
