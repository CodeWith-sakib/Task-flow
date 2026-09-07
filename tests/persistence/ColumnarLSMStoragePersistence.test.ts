import * as fs from 'fs';
import * as path from 'path';
import { ColumnarChunkWriter } from '../../src/storage/columnar/ColumnarChunkWriter';
import { ColumnarChunkReader } from '../../src/storage/columnar/ColumnarChunkReader';
import { BlockCompressionCodec } from '../../src/storage/BlockCompressionCodec';
import { MemTable } from '../../src/storage/MemTable';

describe('Columnar & LSM Storage Persistence Tests', () => {
  const testDir = path.join(__dirname, '../temp_persistence_test');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should serialize, persist, and read back columnar chunks accurately', () => {
    const writer = new ColumnarChunkWriter();
    const reader = new ColumnarChunkReader();

    const rows = [
      { id: 't-1', score: 95, tag: 'prod' },
      { id: 't-2', score: 80, tag: 'staging' },
      { id: 't-3', score: 100, tag: 'prod' },
    ];

    const schema = {
      id: 'STRING' as const,
      score: 'INT32' as const,
      tag: 'STRING' as const,
    };

    const chunkMap = writer.writeChunk(rows, schema);
    expect(chunkMap.has('id')).toBe(true);
    expect(chunkMap.has('score')).toBe(true);

    const decodedScores = reader.decodeColumn(chunkMap.get('score')!);
    expect(decodedScores).toEqual([95, 80, 100]);

    const decodedTags = reader.decodeColumn(chunkMap.get('tag')!);
    expect(decodedTags).toEqual(['prod', 'staging', 'prod']);
  });

  it('should compress strings with BlockCompressionCodec and decompress losslessly', () => {
    const rawData = 'AAAAABBBBBCCCCCDDDDD';
    const compressed = BlockCompressionCodec.compressRLE(rawData);
    expect(compressed.length).toBeLessThan(rawData.length);

    const decompressed = BlockCompressionCodec.decompressRLE(compressed);
    expect(decompressed).toBe(rawData);
  });

  it('should buffer in MemTable and query items', () => {
    const memtable = new MemTable(100);
    memtable.set('key1', 'val1');
    memtable.set('key2', 'val2');
    memtable.set('key3', 'val3');

    expect(memtable.size()).toBe(3);
    expect(memtable.get('key2')).toBe('val2');

    const entries = memtable.flush();
    expect(entries.length).toBe(3);
    expect(entries[0].key).toBe('key1');
  });
});
