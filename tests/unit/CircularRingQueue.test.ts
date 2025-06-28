import { CircularRingQueue } from '../../src/queue/CircularRingQueue';

describe('CircularRingQueue', () => {
  it('should push, pop, and wrap around cleanly', () => {
    const ring = new CircularRingQueue<number>(3);
    expect(ring.push(1)).toBe(true);
    expect(ring.push(2)).toBe(true);
    expect(ring.push(3)).toBe(true);
    expect(ring.isFull()).toBe(true);
    expect(ring.push(4)).toBe(false);

    expect(ring.pop()).toBe(1);
    expect(ring.push(4)).toBe(true);
    expect(ring.pop()).toBe(2);
    expect(ring.pop()).toBe(3);
    expect(ring.pop()).toBe(4);
    expect(ring.pop()).toBeNull();
  });
});
