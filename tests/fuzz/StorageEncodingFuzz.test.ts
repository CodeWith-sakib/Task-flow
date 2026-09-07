import { GorillaTimeSeriesCodec } from '../../src/storage/timeseries/GorillaTimeSeriesCodec';
import { BPlusTreeIndex } from '../../src/storage/indexing/BPlusTreeIndex';
import { BitmapIndex } from '../../src/storage/indexing/BitmapIndex';

describe('Storage & Encoding Property-Based Fuzzing Tests', () => {
  let seed = 12345;
  function pseudoRandom() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }

  it('should losslessly compress and decompress randomized time series streams', () => {
    const codec = new GorillaTimeSeriesCodec();

    for (let trial = 0; trial < 20; trial++) {
      const length = 5 + Math.floor(pseudoRandom() * 30);
      const points: { timestamp: number; value: number }[] = [];
      let currentTs = 1700000000;

      for (let i = 0; i < length; i++) {
        currentTs += 1 + Math.floor(pseudoRandom() * 10);
        const val = (pseudoRandom() - 0.5) * 10000;
        points.push({ timestamp: currentTs, value: val });
      }

      const compressed = codec.compress(points);
      expect(compressed.length).toBeGreaterThan(0);

      const decompressed = codec.decompress(compressed, points.length);
      expect(decompressed.length).toBe(points.length);

      for (let i = 0; i < points.length; i++) {
        expect(decompressed[i].timestamp).toBe(points[i].timestamp);
        expect(decompressed[i].value).toBeCloseTo(points[i].value, 4);
      }
    }
  });

  it('should maintain invariants in BPlusTree under randomized insertions and deletions', () => {
    const tree = new BPlusTreeIndex<number, string>(4);
    const referenceMap = new Map<number, string>();

    // 100 random operations
    for (let op = 0; op < 100; op++) {
      const key = Math.floor(pseudoRandom() * 50);
      const isInsert = pseudoRandom() > 0.3;

      if (isInsert) {
        const val = `val-${key}-${op}`;
        tree.insert(key, val);
        referenceMap.set(key, val);
      } else {
        tree.delete(key);
        referenceMap.delete(key);
      }

      expect(tree.size()).toBe(referenceMap.size);
    }

    // Verify all keys match
    for (const [k, v] of referenceMap.entries()) {
      expect(tree.get(k)).toBe(v);
    }
  });

  it('should compute consistent bitwise operations on randomized bitmap attributes', () => {
    const bitmap = new BitmapIndex();
    const entityIds: string[] = [];

    for (let i = 0; i < 50; i++) {
      const id = `ent-${i}`;
      entityIds.push(id);
      bitmap.indexEntity(id, {
        tier: pseudoRandom() > 0.5 ? 'gold' : 'silver',
        active: pseudoRandom() > 0.5 ? 'true' : 'false',
      });
    }

    const goldEntities = bitmap.queryEquals('tier', 'gold');
    const activeEntities = bitmap.queryEquals('active', 'true');
    const goldAndActive = bitmap.queryAnd([
      { attribute: 'tier', value: 'gold' },
      { attribute: 'active', value: 'true' },
    ]);

    for (const id of goldAndActive) {
      expect(goldEntities).toContain(id);
      expect(activeEntities).toContain(id);
    }
  });
});
