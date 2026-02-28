import { StepRetryStrategy } from '../../src/workflows/StepRetryStrategy';

describe('StepRetryStrategy', () => {
  it('should correctly match retryable errors and attempt limits', () => {
    const strategy = new StepRetryStrategy(3, ['NetworkError', 'Timeout']);
    expect(strategy.shouldRetry(1, new Error('NetworkError: dropped'))).toBe(true);
    expect(strategy.shouldRetry(1, new Error('InvalidInput'))).toBe(false);
    expect(strategy.shouldRetry(3, new Error('NetworkError: dropped'))).toBe(false);
  });
});
