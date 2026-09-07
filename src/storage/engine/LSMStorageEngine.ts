import { EntryType, IIterator, LSMOptions, SSTableMetadata, StorageRecord } from './types';
import { MemTable } from './MemTable';
import { SSTableReader } from './SSTableReader';
import { SSTableWriter } from './SSTableWriter';
import { TwoQueueCache } from './TwoQueueCache';
import { BlockReader } from './BlockReader';
import { LeveledCompactor } from './LeveledCompactor';

export interface LSMStats {
  memtableRecords: number;
  memtableBytes: number;
  immutableCount: number;
  levels: Record<number, { tableCount: number; totalBytes: number }>;
  blockCacheStats: { hits: number; misses: number; hitRatio: number };
  sequenceNumber: number;
}

/**
 * LSMStorageEngine provides a complete Log-Structured Merge-tree storage engine
 * featuring concurrent active/immutable MemTables, multi-level SSTables, Bloom filters,
 * 2Q block caching, snapshot isolation, and background leveled compaction.
 */
export class LSMStorageEngine {
  private options: Required<LSMOptions>;
  private activeMemtable: MemTable;
  private immutableMemtables: MemTable[] = [];
  private levels: Map<number, SSTableReader[]> = new Map();
  private blockCache: TwoQueueCache<string, BlockReader>;
  private compactor: LeveledCompactor;
  private sequenceNumber: number = 0;
  private nextFileNumber: number = 1;
  private isCompacting: boolean = false;

  constructor(options: LSMOptions) {
    this.options = {
      dbPath: options.dbPath,
      memtableCapacityBytes: options.memtableCapacityBytes ?? 4 * 1024 * 1024,
      blockSizeBytes: options.blockSizeBytes ?? 4096,
      restartInterval: options.restartInterval ?? 16,
      blockCacheSizeBytes: options.blockCacheSizeBytes ?? 1000,
      maxLevels: options.maxLevels ?? 7,
      l0CompactionThreshold: options.l0CompactionThreshold ?? 4,
      maxBytesForLevelBase: options.maxBytesForLevelBase ?? 10 * 1024 * 1024,
      levelMultiplier: options.levelMultiplier ?? 10,
      syncWalOnWrite: options.syncWalOnWrite ?? false
    };

    this.activeMemtable = new MemTable(this.options.memtableCapacityBytes);
    this.blockCache = new TwoQueueCache(this.options.blockCacheSizeBytes);
    this.compactor = new LeveledCompactor(
      this.options.maxLevels,
      this.options.l0CompactionThreshold,
      this.options.maxBytesForLevelBase,
      this.options.levelMultiplier,
      this.nextFileNumber
    );

    for (let i = 0; i < this.options.maxLevels; i++) {
      this.levels.set(i, []);
    }
  }

  public put(key: string, value: any): number {
    this.sequenceNumber++;
    this.activeMemtable.put(key, value, this.sequenceNumber);

    if (this.activeMemtable.isFull()) {
      this.freezeAndFlush();
    }

    return this.sequenceNumber;
  }

  public delete(key: string): number {
    this.sequenceNumber++;
    this.activeMemtable.delete(key, this.sequenceNumber);

    if (this.activeMemtable.isFull()) {
      this.freezeAndFlush();
    }

    return this.sequenceNumber;
  }

  public get(key: string, snapshotSeq?: number): any | null {
    const maxSeq = snapshotSeq ?? this.sequenceNumber;

    // 1. Search active MemTable
    const activeRec = this.activeMemtable.get(key, maxSeq);
    if (activeRec) {
      return activeRec.type === EntryType.DELETE ? null : activeRec.value;
    }

    // 2. Search immutable MemTables (newest to oldest)
    for (let i = this.immutableMemtables.length - 1; i >= 0; i--) {
      const immRec = this.immutableMemtables[i].get(key, maxSeq);
      if (immRec) {
        return immRec.type === EntryType.DELETE ? null : immRec.value;
      }
    }

    // 3. Search Level 0 SSTables (newest to oldest)
    const l0Tables = this.levels.get(0) || [];
    for (let i = l0Tables.length - 1; i >= 0; i--) {
      const rec = l0Tables[i].get(key, maxSeq);
      if (rec) {
        return rec.type === EntryType.DELETE ? null : rec.value;
      }
    }

    // 4. Search Level 1..N SSTables (disjoint key ranges)
    for (let level = 1; level < this.options.maxLevels; level++) {
      const tables = this.levels.get(level) || [];
      for (const table of tables) {
        const rec = table.get(key, maxSeq);
        if (rec) {
          return rec.type === EntryType.DELETE ? null : rec.value;
        }
      }
    }

    return null;
  }

  public scan(prefix: string = '', limit: number = 100): { key: string; value: any }[] {
    const recordsMap: Map<string, StorageRecord> = new Map();

    // Scan MemTable
    const memIter = this.activeMemtable.iterator();
    while (memIter.isValid()) {
      const rec = memIter.value();
      if (!prefix || rec.key.startsWith(prefix)) {
        recordsMap.set(rec.key, rec);
      }
      memIter.next();
    }

    // Scan Immutable MemTables
    for (const imm of this.immutableMemtables) {
      const immIter = imm.iterator();
      while (immIter.isValid()) {
        const rec = immIter.value();
        if (!prefix || rec.key.startsWith(prefix)) {
          const existing = recordsMap.get(rec.key);
          if (!existing || rec.sequence > existing.sequence) {
            recordsMap.set(rec.key, rec);
          }
        }
        immIter.next();
      }
    }

    // Scan SSTables
    for (let l = 0; l < this.options.maxLevels; l++) {
      for (const table of this.levels.get(l) || []) {
        for (const rec of table.readAllRecords()) {
          if (!prefix || rec.key.startsWith(prefix)) {
            const existing = recordsMap.get(rec.key);
            if (!existing || rec.sequence > existing.sequence) {
              recordsMap.set(rec.key, rec);
            }
          }
        }
      }
    }

    const results: { key: string; value: any }[] = [];
    const sortedKeys = Array.from(recordsMap.keys()).sort();

    for (const key of sortedKeys) {
      if (results.length >= limit) break;
      const rec = recordsMap.get(key)!;
      if (rec.type !== EntryType.DELETE && rec.value !== null) {
        results.push({ key: rec.key, value: rec.value });
      }
    }

    return results;
  }

  public flush(): void {
    this.freezeAndFlush();
  }

  public triggerCompaction(): boolean {
    if (this.isCompacting) return false;
    const task = this.compactor.pickCompaction(this.levels);
    if (!task) return false;

    this.isCompacting = true;
    try {
      const isBottom = task.level + 1 === this.options.maxLevels - 1;
      const { newTables } = this.compactor.runCompaction(task, isBottom);

      // Replace old tables with new tables
      const currentLevelTables = this.levels.get(task.level) || [];
      const nextLevelTables = this.levels.get(task.level + 1) || [];

      const remainingL = currentLevelTables.filter(t => !task.inputTablesL.includes(t));
      const remainingLPlus1 = nextLevelTables.filter(t => !task.inputTablesLPlus1.includes(t));

      const newReaders = newTables.map(t => new SSTableReader(t.buffer, t.metadata, this.blockCache));

      this.levels.set(task.level, remainingL);
      this.levels.set(task.level + 1, [...remainingLPlus1, ...newReaders]);
      return true;
    } finally {
      this.isCompacting = false;
    }
  }

  public getStats(): LSMStats {
    const levelsStats: Record<number, { tableCount: number; totalBytes: number }> = {};
    for (let l = 0; l < this.options.maxLevels; l++) {
      const tables = this.levels.get(l) || [];
      levelsStats[l] = {
        tableCount: tables.length,
        totalBytes: tables.reduce((acc, t) => acc + t.metadata.fileSize, 0)
      };
    }

    return {
      memtableRecords: this.activeMemtable.getStats().recordCount,
      memtableBytes: this.activeMemtable.getStats().byteSize,
      immutableCount: this.immutableMemtables.length,
      levels: levelsStats,
      blockCacheStats: this.blockCache.getStats(),
      sequenceNumber: this.sequenceNumber
    };
  }

  private freezeAndFlush(): void {
    if (this.activeMemtable.getStats().recordCount === 0) return;

    this.activeMemtable.freeze();
    this.immutableMemtables.push(this.activeMemtable);
    this.activeMemtable = new MemTable(this.options.memtableCapacityBytes);

    const flushingMem = this.immutableMemtables.shift();
    if (!flushingMem) return;

    const writer = new SSTableWriter(this.nextFileNumber++, 0, this.options.blockSizeBytes);
    const iter = flushingMem.iterator();

    while (iter.isValid()) {
      writer.add(iter.value());
      iter.next();
    }

    const { buffer, metadata } = writer.finish();
    const reader = new SSTableReader(buffer, metadata, this.blockCache);

    const l0Tables = this.levels.get(0) || [];
    l0Tables.push(reader);
    this.levels.set(0, l0Tables);

    if (l0Tables.length >= this.options.l0CompactionThreshold) {
      this.triggerCompaction();
    }
  }
}
