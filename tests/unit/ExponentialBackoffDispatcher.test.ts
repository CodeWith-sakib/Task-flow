import { ExponentialBackoffDispatcher } from '../../src/webhooks/ExponentialBackoffDispatcher';

describe('ExponentialBackoffDispatcher', () => {
  it('should double backoff delay on each attempt up to maxMs', () => {
    expect(ExponentialBackoffDispatcher.computeDelay(0, 1000, 5000)).toBe(1000);
    expect(ExponentialBackoffDispatcher.computeDelay(1, 1000, 5000)).toBe(2000);
    expect(ExponentialBackoffDispatcher.computeDelay(2, 1000, 5000)).toBe(4000);
    expect(ExponentialBackoffDispatcher.computeDelay(3, 1000, 5000)).toBe(5000); // capped at max
  });
});
