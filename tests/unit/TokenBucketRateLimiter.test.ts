import { TokenBucketRateLimiter } from '../../src/concurrency/limiter/TokenBucketRateLimiter';

describe('TokenBucketRateLimiter', () => {
  it('should consume tokens up to capacity and reject when exhausted', () => {
    const limiter = new TokenBucketRateLimiter({
      capacity: 3,
      refillRatePerSec: 1,
      initialTokens: 3,
    });

    expect(limiter.tryAcquire(1)).toBe(true);
    expect(limiter.tryAcquire(1)).toBe(true);
    expect(limiter.tryAcquire(1)).toBe(true);
    // Exhausted
    expect(limiter.tryAcquire(1)).toBe(false);
  });

  it('should refill tokens over time according to rate', async () => {
    const limiter = new TokenBucketRateLimiter({
      capacity: 5,
      refillRatePerSec: 20, // 20 tokens per sec -> 1 token every 50ms
      initialTokens: 0,
    });

    expect(limiter.tryAcquire(1)).toBe(false);

    // Wait 100ms for refill
    await new Promise(r => setTimeout(r, 100));

    expect(limiter.tryAcquire(1)).toBe(true);
  });
});
