import { BlockHandle, SSTableMetadata, StorageRecord, TableFooter } from './types';
import { BlockReader } from './BlockReader';
import { BloomFilter } from '../index/BloomFilter';
import { TwoQueueCache } from './TwoQueueCache';
import { SSTABLE_MAGIC } from './SSTableWriter';

/**
 * SSTableReader decodes SSTable files, uses Bloom filter rejection, parses the index block,
 * queries data blocks, and caches hot blocks in a TwoQueueCache.
 */
export class SSTableReader {
  private buffer: Buffer;
  public readonly metadata: SSTableMetadata;
  private footer: TableFooter;
  private indexEntries: { key: string; handle: BlockHandle }[] = [];
  private bloomFilter: BloomFilter | null = null;
  private blockCache?: TwoQueueCache<string, BlockReader>;

  constructor(buffer: Buffer, metadata: SSTableMetadata, blockCache?: TwoQueueCache<string, BlockReader>) {
    this.buffer = buffer;
    this.metadata = metadata;
    this.blockCache = blockCache;
    this.footer = this.readFooter();
    this.readIndexBlock();
    this.readFilterBlock();
  }

  public get(targetKey: string, maxSequence: number = Number.MAX_SAFE_INTEGER): StorageRecord | null {
    if (this.bloomFilter && !this.bloomFilter.has(targetKey)) {
      return null;
    }

    if (targetKey < this.metadata.smallestKey || targetKey > this.metadata.largestKey) {
      return null;
    }

    // Binary search over index block to find data block that could contain targetKey
    let left = 0;
    let right = this.indexEntries.length - 1;
    let targetHandle: BlockHandle | null = null;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const entry = this.indexEntries[mid];

      if (entry.key >= targetKey) {
        targetHandle = entry.handle;
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    if (!targetHandle) {
      return null;
    }

    const blockReader = this.getDataBlock(targetHandle);
    const rawVal = blockReader.find(targetKey);
    if (!rawVal) return null;

    try {
      const parsed = JSON.parse(rawVal.toString('utf8'));
      if (parsed.sequence <= maxSequence) {
        return {
          key: targetKey,
          value: parsed.value,
          sequence: parsed.sequence,
          type: parsed.type,
          timestamp: parsed.timestamp
        };
      }
    } catch {
      return null;
    }

    return null;
  }

  public readAllRecords(): StorageRecord[] {
    const records: StorageRecord[] = [];
    for (const idxEntry of this.indexEntries) {
      const block = this.getDataBlock(idxEntry.handle);
      const entries = block.readAllEntries();
      for (const e of entries) {
        try {
          const parsed = JSON.parse(e.value.toString('utf8'));
          records.push({
            key: e.key,
            value: parsed.value,
            sequence: parsed.sequence,
            type: parsed.type,
            timestamp: parsed.timestamp
          });
        } catch {
          // Skip malformed record
        }
      }
    }
    return records;
  }

  private getDataBlock(handle: BlockHandle): BlockReader {
    const cacheKey = `${this.metadata.fileNumber}:${handle.offset}`;
    if (this.blockCache && this.blockCache.has(cacheKey)) {
      return this.blockCache.get(cacheKey)!;
    }

    const blockData = this.buffer.slice(handle.offset, handle.offset + handle.size);
    const reader = new BlockReader(blockData);

    if (this.blockCache) {
      this.blockCache.put(cacheKey, reader);
    }
    return reader;
  }

  private readFooter(): TableFooter {
    if (this.buffer.length < 48) {
      throw new Error('Invalid SSTable: file smaller than footer size');
    }

    const footerOffset = this.buffer.length - 48;
    const metaOffset = this.buffer.readUInt32BE(footerOffset);
    const metaSize = this.buffer.readUInt32BE(footerOffset + 4);
    const idxOffset = this.buffer.readUInt32BE(footerOffset + 8);
    const idxSize = this.buffer.readUInt32BE(footerOffset + 12);
    const magic = '0x' + this.buffer.readBigUInt64BE(footerOffset + 40).toString(16);

    if (magic !== SSTABLE_MAGIC) {
      throw new Error(`Corrupted SSTable footer magic: ${magic}`);
    }

    return {
      metaindexHandle: { offset: metaOffset, size: metaSize },
      indexHandle: { offset: idxOffset, size: idxSize },
      magicNumber: magic
    };
  }

  private readIndexBlock(): void {
    const blockData = this.buffer.slice(this.footer.indexHandle.offset, this.footer.indexHandle.offset + this.footer.indexHandle.size);
    const reader = new BlockReader(blockData);
    const rawEntries = reader.readAllEntries();

    this.indexEntries = rawEntries.map(e => {
      const offset = e.value.readUInt32BE(0);
      const size = e.value.readUInt32BE(4);
      return {
        key: e.key,
        handle: { offset, size }
      };
    });
  }

  private readFilterBlock(): void {
    if (this.footer.metaindexHandle.size === 0) return;
    try {
      const metaData = this.buffer.slice(this.footer.metaindexHandle.offset, this.footer.metaindexHandle.offset + this.footer.metaindexHandle.size);
      const metaReader = new BlockReader(metaData);
      const filterHandleRaw = metaReader.find('filter.bloom');
      if (filterHandleRaw) {
        const fOffset = filterHandleRaw.readUInt32BE(0);
        const fSize = filterHandleRaw.readUInt32BE(4);
        const filterData = this.buffer.slice(fOffset, fOffset + fSize);
        const parsedFilter = JSON.parse(filterData.toString('utf8'));
        const filter = new BloomFilter();
        filter.setFilter(parsedFilter);
        this.bloomFilter = filter;
      }
    } catch {
      // Bloom filter missing or malformed; fallback to index scan
    }
  }
}
