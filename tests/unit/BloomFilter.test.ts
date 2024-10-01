import { BloomFilter } from '../../src/storage/index/BloomFilter';

describe('BloomFilter Unit Tests', () => {
  it('should accurately test membership and maintain low false positive rate', () => {
    const filter = new BloomFilter(100, 0.01);
    expect(filter.has('task-1')).toBe(false);

    filter.add('task-1');
    filter.add('task-2');

    expect(filter.has('task-1')).toBe(true);
    expect(filter.has('task-2')).toBe(true);
    expect(filter.has('task-not-present')).toBe(false);

    filter.clear();
    expect(filter.has('task-1')).toBe(false);
  });
});
