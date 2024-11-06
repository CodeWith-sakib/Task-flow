import { RingBuffer } from '../../src/queue/ring/RingBuffer';

describe('RingBuffer Unit Tests', () => {
  it('should operate correctly with circular wrap-around', () => {
    const ring = new RingBuffer<number>(3);
    expect(ring.enqueue(1)).toBe(true);
    expect(ring.enqueue(2)).toBe(true);
    expect(ring.enqueue(3)).toBe(true);
    expect(ring.enqueue(4)).toBe(false); // full

    expect(ring.dequeue()).toBe(1);
    expect(ring.enqueue(4)).toBe(true); // wrap around

    expect(ring.dequeue()).toBe(2);
    expect(ring.dequeue()).toBe(3);
    expect(ring.dequeue()).toBe(4);
    expect(ring.dequeue()).toBeUndefined();
  });
});
