import { AdaptiveConcurrencyLimiter } from '../../src/concurrency/AdaptiveConcurrencyLimiter';

describe('AdaptiveConcurrencyLimiter', () => {
  it('should scale limit up on success and down on failures', () => {
    const limiter = new AdaptiveConcurrencyLimiter(10, 2, 20);
    expect(limiter.acquire()).toBe(true);
    limiter.release(true);
    expect(limiter.getLimit()).toBe(11);

    expect(limiter.acquire()).toBe(true);
    limiter.release(false);
    expect(limiter.getLimit()).toBe(7);
  });
});
