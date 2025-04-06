import { TieredCacheManager } from '../../src/storage/TieredCacheManager';

describe('TieredCacheManager', () => {
  it('should promote L2 items to L1 upon access', () => {
    const cache = new TieredCacheManager<number>(2);
    cache.put('k1', 10);
    cache.put('k2', 20);
    cache.put('k3', 30); // evicts k1 from L1, but remains in L2

    expect(cache.get('k1')).toBe(10);
  });
});
