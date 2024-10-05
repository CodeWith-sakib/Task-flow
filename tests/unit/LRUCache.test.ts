import { LRUCache } from '../../src/storage/cache/LRUCache';

describe('LRUCache Unit Tests', () => {
  it('should maintain capacity by evicting least recently used items', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(1); // 'a' accessed, 'b' is now oldest
    cache.set('c', 3); // should evict 'b'
    expect(cache.has('b')).toBe(false);
    expect(cache.has('a')).toBe(true);
    expect(cache.has('c')).toBe(true);
  });
});
