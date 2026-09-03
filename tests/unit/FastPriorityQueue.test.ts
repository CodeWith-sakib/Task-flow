import { FastPriorityQueue } from '../../src/utils/FastPriorityQueue';

describe('FastPriorityQueue', () => {
  it('should pop items in ascending priority order (min-heap)', () => {
    const pq = new FastPriorityQueue<string>();
    pq.push('p3', 3);
    pq.push('p1', 1);
    pq.push('p2', 2);

    expect(pq.pop()).toBe('p1');
    expect(pq.pop()).toBe('p2');
    expect(pq.pop()).toBe('p3');
    expect(pq.pop()).toBeUndefined();
  });
});
