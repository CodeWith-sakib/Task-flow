import { SlidingWindowRateLimiter } from '../../src/concurrency/limiter/SlidingWindowRateLimiter';

describe('SlidingWindowRateLimiter Unit Tests', () => {
  it('should limit requests within the sliding window', () => {
    const limiter = new SlidingWindowRateLimiter({ windowSizeMs: 1000, maxRequests: 2 });
    const t0 = 10000;
    expect(limiter.tryAcquire('user-1', t0)).toBe(true);
    expect(limiter.tryAcquire('user-1', t0 + 100)).toBe(true);
    expect(limiter.tryAcquire('user-1', t0 + 200)).toBe(false);

    // After window slides
    expect(limiter.tryAcquire('user-1', t0 + 1001)).toBe(true);
  });
});
