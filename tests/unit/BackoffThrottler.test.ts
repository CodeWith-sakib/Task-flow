import { BackoffThrottler } from '../../src/concurrency/BackoffThrottler';

describe('BackoffThrottler', () => {
  it('should exponentially increase delay on consecutive failures', () => {
    const throttler = new BackoffThrottler(100, 1000);
    expect(throttler.getCurrentDelay()).toBe(0);

    expect(throttler.recordFailure()).toBe(100);
    expect(throttler.recordFailure()).toBe(200);
    expect(throttler.recordFailure()).toBe(400);

    throttler.recordSuccess();
    expect(throttler.getCurrentDelay()).toBe(0);
  });
});
