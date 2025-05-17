import { DelayQueue } from '../../src/queue/DelayQueue';

describe('DelayQueue', () => {
  it('should deliver items only after delay elapses', () => {
    const queue = new DelayQueue<string>();
    const now = 1000;
    queue.offer('1', 'first', 500, now);
    queue.offer('2', 'second', 1000, now);

    expect(queue.pollReady(now + 200).length).toBe(0);
    expect(queue.pollReady(now + 600)).toEqual(['first']);
    expect(queue.pollReady(now + 1200)).toEqual(['second']);
  });
});
