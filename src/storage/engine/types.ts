/**
 * LSM-Tree storage engine domain types, block formats, and iterator contracts.
 */

export enum EntryType {
  PUT = 1,
  DELETE = 2,
  MERGE = 3
}

export interface StorageRecord<V = any> {
  key: string;
  value: V | null;
  sequence: number;
  type: EntryType;
  timestamp: number;
}

export interface BlockHandle {
  offset: number;
  size: number;
}

export interface TableFooter {
  metaindexHandle: BlockHandle;
  indexHandle: BlockHandle;
  magicNumber: string; // '0xdb4775248b80fb57'
}

export interface SSTableMetadata {
  fileNumber: number;
  fileSize: number;
  smallestKey: string;
  largestKey: string;
  smallestSeq: number;
  largestSeq: number;
  level: number;
  path: string;
}

export interface CompactionStats {
  level: number;
  bytesRead: number;
  bytesWritten: number;
  tablesMerged: number;
  durationMs: number;
}

export interface LSMOptions {
  dbPath: string;
  memtableCapacityBytes?: number;
  blockSizeBytes?: number;
  restartInterval?: number;
  blockCacheSizeBytes?: number;
  maxLevels?: number;
  l0CompactionThreshold?: number;
  maxBytesForLevelBase?: number;
  levelMultiplier?: number;
  syncWalOnWrite?: boolean;
}

export interface IIterator<K, V> {
  seekToFirst(): void;
  seekToLast(): void;
  seek(target: K): void;
  next(): void;
  prev(): void;
  isValid(): boolean;
  key(): K;
  value(): V;
}
