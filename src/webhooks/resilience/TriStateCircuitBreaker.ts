export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
  failureThresholdPct?: number;  // Default 50%
  sampleSize?: number;            // Default 20 calls
  cooldownPeriodMs?: number;      // Default 15000ms
  halfOpenSuccessThreshold?: number; // Default 3 consecutive successes
}

/**
 * TriStateCircuitBreaker implements the Circuit Breaker pattern with Closed, Open,
 * and Half-Open states to protect downstream webhook targets from overwhelming cascading failures.
 */
export class TriStateCircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureThresholdPct: number;
  private sampleSize: number;
  private cooldownPeriodMs: number;
  private halfOpenSuccessThreshold: number;

  private slidingWindow: boolean[] = []; // true = success, false = failure
  private lastStateChangeTime: number = Date.now();
  private halfOpenSuccesses: number = 0;

  constructor(config?: CircuitBreakerConfig) {
    this.failureThresholdPct = config?.failureThresholdPct ?? 50;
    this.sampleSize = config?.sampleSize ?? 20;
    this.cooldownPeriodMs = config?.cooldownPeriodMs ?? 15000;
    this.halfOpenSuccessThreshold = config?.halfOpenSuccessThreshold ?? 3;
  }

  public allowRequest(): boolean {
    const now = Date.now();

    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      if (now - this.lastStateChangeTime >= this.cooldownPeriodMs) {
        this.transitionTo(CircuitState.HALF_OPEN);
        return true;
      }
      return false;
    }

    if (this.state === CircuitState.HALF_OPEN) {
      // In half-open, allow limited test probes
      return true;
    }

    return false;
  }

  public recordSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.halfOpenSuccessThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
      return;
    }

    this.pushWindow(true);
  }

  public recordFailure(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
      return;
    }

    this.pushWindow(false);
    this.evaluateClosedState();
  }

  public getState(): CircuitState {
    // Check if open state has cooled down
    if (this.state === CircuitState.OPEN && Date.now() - this.lastStateChangeTime >= this.cooldownPeriodMs) {
      this.transitionTo(CircuitState.HALF_OPEN);
    }
    return this.state;
  }

  public reset(): void {
    this.state = CircuitState.CLOSED;
    this.slidingWindow = [];
    this.halfOpenSuccesses = 0;
    this.lastStateChangeTime = Date.now();
  }

  private pushWindow(success: boolean): void {
    this.slidingWindow.push(success);
    if (this.slidingWindow.length > this.sampleSize) {
      this.slidingWindow.shift();
    }
  }

  private evaluateClosedState(): void {
    if (this.slidingWindow.length < 5) return; // Minimum warmup sample

    const failures = this.slidingWindow.filter(s => !s).length;
    const failureRate = (failures / this.slidingWindow.length) * 100;

    if (failureRate >= this.failureThresholdPct) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  private transitionTo(newState: CircuitState): void {
    this.state = newState;
    this.lastStateChangeTime = Date.now();
    if (newState === CircuitState.CLOSED) {
      this.slidingWindow = [];
      this.halfOpenSuccesses = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.halfOpenSuccesses = 0;
    }
  }
}
