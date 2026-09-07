import { CompactionStats, EntryType, SSTableMetadata, StorageRecord } from './types';
import { SSTableReader } from './SSTableReader';
import { SSTableWriter } from './SSTableWriter';

export interface CompactionTask {
  level: number;
  inputTablesL: SSTableReader[];
  inputTablesLPlus1: SSTableReader[];
}

/**
 * LeveledCompactor computes level-by-level compaction priorities, selects overlapping key ranges,
 * and performs multi-way sorted merge compactions to bound read amplification and reclaim tombstones.
 */
export class LeveledCompactor {
  private maxLevels: number;
  private l0Threshold: number;
  private baseLevelBytes: number;
  private levelMultiplier: number;
  private nextFileNumber: number;

  constructor(
    maxLevels: number = 7,
    l0Threshold: number = 4,
    baseLevelBytes: number = 10 * 1024 * 1024, // 10MB L1
    levelMultiplier: number = 10,
    initialFileNumber: number = 100
  ) {
    this.maxLevels = maxLevels;
    this.l0Threshold = l0Threshold;
    this.baseLevelBytes = baseLevelBytes;
    this.levelMultiplier = levelMultiplier;
    this.nextFileNumber = initialFileNumber;
  }

  public pickCompaction(levels: Map<number, SSTableReader[]>): CompactionTask | null {
    // 1. Check Level 0 file count score
    const l0Tables = levels.get(0) || [];
    const l0Score = l0Tables.length / this.l0Threshold;

    let bestLevel = -1;
    let bestScore = l0Score > 1.0 ? l0Score : 0;

    // 2. Check Level 1..N byte size score
    for (let l = 1; l < this.maxLevels - 1; l++) {
      const tables = levels.get(l) || [];
      const totalBytes = tables.reduce((acc, t) => acc + t.metadata.fileSize, 0);
      const targetBytes = this.getTargetBytesForLevel(l);
      const score = totalBytes / targetBytes;

      if (score > 1.0 && score > bestScore) {
        bestScore = score;
        bestLevel = l;
      }
    }

    if (bestScore <= 1.0) {
      if (l0Tables.length >= this.l0Threshold) {
        bestLevel = 0;
      } else {
        return null;
      }
    }

    if (bestLevel === 0) {
      const inputL0 = [...l0Tables];
      const smallest = inputL0.reduce((min, t) => t.metadata.smallestKey < min ? t.metadata.smallestKey : min, inputL0[0].metadata.smallestKey);
      const largest = inputL0.reduce((max, t) => t.metadata.largestKey > max ? t.metadata.largestKey : max, inputL0[0].metadata.largestKey);

      const l1Tables = levels.get(1) || [];
      const inputL1 = this.findOverlappingTables(l1Tables, smallest, largest);

      return {
        level: 0,
        inputTablesL: inputL0,
        inputTablesLPlus1: inputL1
      };
    }

    const currentLevelTables = levels.get(bestLevel) || [];
    if (currentLevelTables.length === 0) return null;

    // Pick smallest file in bestLevel
    const selected = currentLevelTables.reduce((min, t) => t.metadata.fileSize < min.metadata.fileSize ? t : min, currentLevelTables[0]);
    const nextLevelTables = levels.get(bestLevel + 1) || [];
    const overlapping = this.findOverlappingTables(nextLevelTables, selected.metadata.smallestKey, selected.metadata.largestKey);

    return {
      level: bestLevel,
      inputTablesL: [selected],
      inputTablesLPlus1: overlapping
    };
  }

  public runCompaction(task: CompactionTask, isBottommostLevel: boolean = false): {
    newTables: { buffer: Buffer; metadata: SSTableMetadata }[];
    stats: CompactionStats;
  } {
    const startTime = Date.now();
    const allInputs = [...task.inputTablesL, ...task.inputTablesLPlus1];
    const totalBytesRead = allInputs.reduce((acc, t) => acc + t.metadata.fileSize, 0);

    // Merge-sort all records across input tables
    const recordMap: Map<string, StorageRecord> = new Map();
    for (const table of allInputs) {
      const records = table.readAllRecords();
      for (const rec of records) {
        const existing = recordMap.get(rec.key);
        if (!existing || rec.sequence > existing.sequence) {
          recordMap.set(rec.key, rec);
        }
      }
    }

    // Sort records ascending by key
    const sortedKeys = Array.from(recordMap.keys()).sort();
    const outputLevel = task.level + 1;
    const newTables: { buffer: Buffer; metadata: SSTableMetadata }[] = [];

    let currentWriter = new SSTableWriter(this.nextFileNumber++, outputLevel);
    let currentBytesWritten = 0;
    const maxTableSize = 2 * 1024 * 1024; // 2MB SSTable target

    for (const key of sortedKeys) {
      const record = recordMap.get(key)!;

      // Drop tombstones if bottommost level
      if (isBottommostLevel && record.type === EntryType.DELETE) {
        continue;
      }

      currentWriter.add(record);
      if (currentWriter['dataBlockBuilder'].estimatedSize() >= maxTableSize) {
        const tableOut = currentWriter.finish();
        newTables.push(tableOut);
        currentBytesWritten += tableOut.buffer.length;
        currentWriter = new SSTableWriter(this.nextFileNumber++, outputLevel);
      }
    }

    if (!currentWriter['dataBlockBuilder'].isEmpty()) {
      const tableOut = currentWriter.finish();
      newTables.push(tableOut);
      currentBytesWritten += tableOut.buffer.length;
    }

    const durationMs = Date.now() - startTime;
    return {
      newTables,
      stats: {
        level: task.level,
        bytesRead: totalBytesRead,
        bytesWritten: currentBytesWritten,
        tablesMerged: allInputs.length,
        durationMs
      }
    };
  }

  private findOverlappingTables(tables: SSTableReader[], smallest: string, largest: string): SSTableReader[] {
    return tables.filter(t => !(t.metadata.largestKey < smallest || t.metadata.smallestKey > largest));
  }

  private getTargetBytesForLevel(level: number): number {
    if (level === 0) return 0;
    return this.baseLevelBytes * Math.pow(this.levelMultiplier, level - 1);
  }
}
