import { AtomicCounter } from '../../src/concurrency/AtomicCounter';

describe('AtomicCounter', () => {
  it('should support atomic increment, decrement, and CAS', () => {
    const counter = new AtomicCounter(10);
    expect(counter.incrementAndGet()).toBe(11);
    expect(counter.decrementAndGet()).toBe(10);

    expect(counter.compareAndSet(10, 20)).toBe(true);
    expect(counter.get()).toBe(20);
    expect(counter.compareAndSet(10, 30)).toBe(false);
  });
});
