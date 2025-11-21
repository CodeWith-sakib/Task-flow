import { CircuitBreaker } from '../../src/webhooks/breaker/CircuitBreaker';

describe('CircuitBreaker', () => {
  it('should start in CLOSED state and allow execution', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 100 });
    expect(breaker.getState()).toBe('CLOSED');
    expect(breaker.canExecute()).toBe(true);
  });

  it('should trip to OPEN when consecutive failures reach threshold', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 100 });

    breaker.recordFailure();
    expect(breaker.getState()).toBe('CLOSED');

    breaker.recordFailure(); // Threshold reached
    expect(breaker.getState()).toBe('OPEN');
    expect(breaker.canExecute()).toBe(false);
  });

  it('should transition to HALF_OPEN after cooldown and close on success', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 50 });

    breaker.recordFailure();
    expect(breaker.getState()).toBe('OPEN');

    // Wait for cooldown
    await new Promise(r => setTimeout(r, 60));

    expect(breaker.canExecute()).toBe(true); // Should transition to HALF_OPEN
    expect(breaker.getState()).toBe('HALF_OPEN');

    // Success in HALF_OPEN resets to CLOSED
    breaker.recordSuccess();
    expect(breaker.getState()).toBe('CLOSED');
  });
});
