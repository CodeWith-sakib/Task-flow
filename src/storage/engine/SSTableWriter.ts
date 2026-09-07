import { BlockHandle, SSTableMetadata, StorageRecord, TableFooter } from './types';
import { BlockBuilder } from './BlockBuilder';
import { BloomFilter } from '../index/BloomFilter';
import { computeCRC32 } from '../wal/crc32';

export const SSTABLE_MAGIC = '0xdb4775248b80fb57';

/**
 * SSTableWriter packages sorted key-value pairs into a LevelDB-compatible SSTable format
 * consisting of Data Blocks, Filter Block, Index Block, and a 48-byte Trailer Footer.
 */
export class SSTableWriter {
  private fileNumber: number;
  private level: number;
  private blockSize: number;
  private dataBlockBuilder: BlockBuilder;
  private indexBlockBuilder: BlockBuilder;
  private bloomFilter: BloomFilter;

  private blocks: Buffer[] = [];
  private currentOffset: number = 0;
  private lastKey: string = '';
  private smallestKey: string = '';
  private largestKey: string = '';
  private smallestSeq: number = Number.MAX_SAFE_INTEGER;
  private largestSeq: number = 0;
  private entryCount: number = 0;
  private isClosed: boolean = false;

  constructor(fileNumber: number, level: number = 0, blockSize: number = 4096) {
    this.fileNumber = fileNumber;
    this.level = level;
    this.blockSize = blockSize;
    this.dataBlockBuilder = new BlockBuilder();
    this.indexBlockBuilder = new BlockBuilder();
    this.bloomFilter = new BloomFilter(10000, 3);
  }

  public add(record: StorageRecord): void {
    if (this.isClosed) throw new Error('Cannot add to closed SSTableWriter');

    if (this.entryCount === 0) {
      this.smallestKey = record.key;
    }
    this.largestKey = record.key;
    this.smallestSeq = Math.min(this.smallestSeq, record.sequence);
    this.largestSeq = Math.max(this.largestSeq, record.sequence);

    const valBuffer = Buffer.from(JSON.stringify({
      value: record.value,
      sequence: record.sequence,
      type: record.type,
      timestamp: record.timestamp
    }), 'utf8');

    this.dataBlockBuilder.add(record.key, valBuffer);
    this.bloomFilter.add(record.key);
    this.lastKey = record.key;
    this.entryCount++;

    if (this.dataBlockBuilder.estimatedSize() >= this.blockSize) {
      this.flushDataBlock();
    }
  }

  public finish(): { buffer: Buffer; metadata: SSTableMetadata } {
    if (this.isClosed) throw new Error('SSTableWriter already finished');

    if (!this.dataBlockBuilder.isEmpty()) {
      this.flushDataBlock();
    }

    // Write Filter Block
    const filterData = Buffer.from(JSON.stringify(this.bloomFilter.getFilter()), 'utf8');
    const filterHandle: BlockHandle = {
      offset: this.currentOffset,
      size: filterData.length
    };
    this.writeBlock(filterData);

    // Write Metaindex Block (points to filter block)
    const metaBlockBuilder = new BlockBuilder();
    const filterHandleBuf = Buffer.alloc(8);
    filterHandleBuf.writeUInt32BE(filterHandle.offset, 0);
    filterHandleBuf.writeUInt32BE(filterHandle.size, 4);
    metaBlockBuilder.add('filter.bloom', filterHandleBuf);
    const metaBlockData = metaBlockBuilder.finish();
    const metaHandle: BlockHandle = {
      offset: this.currentOffset,
      size: metaBlockData.length
    };
    this.writeBlock(metaBlockData);

    // Write Index Block
    const indexBlockData = this.indexBlockBuilder.finish();
    const indexHandle: BlockHandle = {
      offset: this.currentOffset,
      size: indexBlockData.length
    };
    this.writeBlock(indexBlockData);

    // Write Footer (48 bytes: metaindex_handle(8) + index_handle(8) + padding(24) + magic(8))
    const footerBuf = Buffer.alloc(48);
    footerBuf.writeUInt32BE(metaHandle.offset, 0);
    footerBuf.writeUInt32BE(metaHandle.size, 4);
    footerBuf.writeUInt32BE(indexHandle.offset, 8);
    footerBuf.writeUInt32BE(indexHandle.size, 12);
    footerBuf.writeBigUInt64BE(BigInt(SSTABLE_MAGIC), 40);
    this.blocks.push(footerBuf);
    this.currentOffset += 48;

    this.isClosed = true;
    const finalBuffer = Buffer.concat(this.blocks);

    const metadata: SSTableMetadata = {
      fileNumber: this.fileNumber,
      fileSize: finalBuffer.length,
      smallestKey: this.smallestKey,
      largestKey: this.largestKey,
      smallestSeq: this.smallestSeq === Number.MAX_SAFE_INTEGER ? 0 : this.smallestSeq,
      largestSeq: this.largestSeq,
      level: this.level,
      path: `sstable_${this.fileNumber}.sst`
    };

    return { buffer: finalBuffer, metadata };
  }

  private flushDataBlock(): void {
    const blockData = this.dataBlockBuilder.finish();
    const blockHandle: BlockHandle = {
      offset: this.currentOffset,
      size: blockData.length
    };
    this.writeBlock(blockData);

    const handleBuf = Buffer.alloc(8);
    handleBuf.writeUInt32BE(blockHandle.offset, 0);
    handleBuf.writeUInt32BE(blockHandle.size, 4);
    this.indexBlockBuilder.add(this.lastKey, handleBuf);

    this.dataBlockBuilder.reset();
  }

  private writeBlock(block: Buffer): void {
    const checksum = computeCRC32(block.toString('binary'));
    const trailer = Buffer.alloc(5);
    trailer.writeUInt8(0, 0); // Uncompressed
    trailer.writeUInt32BE(checksum, 1);

    this.blocks.push(block, trailer);
    this.currentOffset += block.length + 5;
  }
}
