export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  cooldownMs: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount: number = 0;
  private lastStateChange: number = Date.now();
  private failureThreshold: number;
  private cooldownMs: number;

  constructor(options?: Partial<CircuitBreakerOptions>) {
    this.failureThreshold = options?.failureThreshold ?? 3;
    this.cooldownMs = options?.cooldownMs ?? 10000;
  }

  canExecute(): boolean {
    const now = Date.now();

    if (this.state === 'OPEN') {
      if (now - this.lastStateChange >= this.cooldownMs) {
        this.state = 'HALF_OPEN';
        this.lastStateChange = now;
        return true;
      }
      return false;
    }

    return true; // CLOSED or HALF_OPEN
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.lastStateChange = Date.now();
  }

  recordFailure(): void {
    this.failureCount++;
    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.lastStateChange = Date.now();
    }
  }

  getState(): CircuitState {
    // If OPEN and cooldown elapsed, check if transition to HALF_OPEN is due
    if (this.state === 'OPEN' && Date.now() - this.lastStateChange >= this.cooldownMs) {
      return 'HALF_OPEN';
    }
    return this.state;
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastStateChange = Date.now();
  }
}
