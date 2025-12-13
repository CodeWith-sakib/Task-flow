import { ThreadSafeQueue } from '../../src/concurrency/ThreadSafeQueue';

describe('ThreadSafeQueue', () => {
  it('should reject offers when capacity is reached', () => {
    const q = new ThreadSafeQueue<number>(2);
    expect(q.offer(1)).toBe(true);
    expect(q.offer(2)).toBe(true);
    expect(q.offer(3)).toBe(false);

    expect(q.poll()).toBe(1);
    expect(q.offer(3)).toBe(true);
  });
});
