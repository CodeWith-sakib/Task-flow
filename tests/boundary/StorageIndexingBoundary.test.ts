import { BPlusTreeIndex } from '../../src/storage/indexing/BPlusTreeIndex';
import { BitmapIndex } from '../../src/storage/indexing/BitmapIndex';
import { SpatialRTreeIndex } from '../../src/storage/indexing/SpatialRTreeIndex';
import { GorillaTimeSeriesCodec } from '../../src/storage/timeseries/GorillaTimeSeriesCodec';
import { MVCCStorageEngine } from '../../src/storage/versioning/MVCCStorageEngine';
import { ChunkedBlobStore } from '../../src/storage/blob/ChunkedBlobStore';

describe('Storage & Indexing Boundary Conditions', () => {
  describe('BPlusTreeIndex boundary checks', () => {
    it('should handle minimum valid order 3 tree with multiple splits and collapses', () => {
      const tree = new BPlusTreeIndex<number, string>(3);
      for (let i = 1; i <= 20; i++) {
        tree.insert(i, `val-${i}`);
      }

      expect(tree.size()).toBe(20);
      expect(tree.get(1)).toBe('val-1');
      expect(tree.get(20)).toBe('val-20');
      expect(tree.get(999)).toBeUndefined();

      // Range scan empty range
      const emptyRange = tree.rangeScan(100, 200);
      expect(emptyRange.length).toBe(0);

      // Range scan single element
      const singleRange = tree.rangeScan(10, 10);
      expect(singleRange.length).toBe(1);
      expect(singleRange[0].value).toBe('val-10');

      // Delete boundary elements
      expect(tree.delete(1)).toBe(true);
      expect(tree.delete(20)).toBe(true);
      expect(tree.delete(999)).toBe(false);
      expect(tree.size()).toBe(18);
    });

    it('should throw on invalid order less than 3', () => {
      expect(() => new BPlusTreeIndex(2)).toThrow();
    });
  });

  describe('BitmapIndex boundary checks', () => {
    it('should handle queries on non-existent attributes gracefully', () => {
      const bitmap = new BitmapIndex();
      bitmap.indexEntity('e1', { color: 'red' });

      expect(bitmap.queryEquals('missing_attr', 'val')).toEqual([]);
      expect(bitmap.queryAnd([{ attribute: 'missing_attr', value: 'val' }])).toEqual([]);
      expect(bitmap.queryOr([{ attribute: 'missing_attr', value: 'val' }])).toEqual([]);
    });

    it('should handle empty queries and disjoint intersection', () => {
      const bitmap = new BitmapIndex();
      bitmap.indexEntity('e1', { color: 'red', size: 'large' });
      bitmap.indexEntity('e2', { color: 'blue', size: 'small' });

      expect(bitmap.queryAnd([])).toEqual([]);
      expect(bitmap.queryOr([])).toEqual([]);

      // Disjoint AND
      const disjoint = bitmap.queryAnd([
        { attribute: 'color', value: 'red' },
        { attribute: 'color', value: 'blue' },
      ]);
      expect(disjoint).toEqual([]);
    });
  });

  describe('SpatialRTreeIndex boundary checks', () => {
    it('should index zero-width point bounding boxes and query exact coordinates', () => {
      const rtree = new SpatialRTreeIndex<string>(4);
      rtree.insert({ minX: 0, minY: 0, maxX: 0, maxY: 0 }, 'point-1');
      rtree.insert({ minX: 10, minY: 10, maxX: 10, maxY: 10 }, 'point-2');

      const hits = rtree.search({ minX: -1, minY: -1, maxX: 1, maxY: 1 });
      expect(hits).toContain('point-1');
      expect(hits).not.toContain('point-2');
    });
  });

  describe('GorillaTimeSeriesCodec boundary checks', () => {
    it('should handle single-point compression and zero-length inputs', () => {
      const codec = new GorillaTimeSeriesCodec();
      expect(codec.compress([])).toEqual(Buffer.alloc(0));
      expect(codec.decompress(Buffer.alloc(0), 0)).toEqual([]);

      const single = [{ timestamp: 1700000000, value: 3.14159265 }];
      const comp = codec.compress(single);
      const decomp = codec.decompress(comp, 1);
      expect(decomp.length).toBe(1);
      expect(decomp[0].timestamp).toBe(1700000000);
      expect(decomp[0].value).toBeCloseTo(3.14159265, 6);
    });
  });

  describe('MVCCStorageEngine boundary checks', () => {
    it('should handle rollbacks and non-existent key reads', () => {
      const mvcc = new MVCCStorageEngine();
      const tx = mvcc.beginTransaction();

      expect(mvcc.get('missing-key', tx)).toBeUndefined();
      mvcc.put('temp-key', { secret: 123 }, tx);
      expect(mvcc.get('temp-key', tx)).toEqual({ secret: 123 });

      mvcc.abort(tx);

      // Verify not visible after rollback
      const tx2 = mvcc.beginTransaction();
      expect(mvcc.get('temp-key', tx2)).toBeUndefined();
    });
  });

  describe('ChunkedBlobStore boundary checks', () => {
    it('should handle zero-length blob store and chunk retrieval', () => {
      const store = new ChunkedBlobStore(1024);
      const blob = store.storeBlob('blob-empty', Buffer.alloc(0));
      expect(blob.totalSizeBytes).toBe(0);
      expect(blob.chunkHashes.length).toBe(0);

      const retrieved = store.retrieveBlob('blob-empty');
      expect(retrieved?.length).toBe(0);
    });
  });
});
