import { JitteredBackoff } from '../../src/core/retry/JitteredBackoff';

describe('JitteredBackoff Unit Tests', () => {
  it('should compute bounded backoff delay with jitter', () => {
    const backoff = new JitteredBackoff({ initialDelayMs: 100, maxDelayMs: 1000, jitter: 'none' });
    expect(backoff.computeDelay(0)).toBe(100);
    expect(backoff.computeDelay(1)).toBe(200);
    expect(backoff.computeDelay(2)).toBe(400);
    expect(backoff.computeDelay(10)).toBe(1000);
  });
});
