export type JitterStrategy = 'none' | 'full' | 'equal' | 'decorrelated';

export interface BackoffConfig {
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  jitter: JitterStrategy;
}

export class JitteredBackoff {
  private config: BackoffConfig;

  constructor(config?: Partial<BackoffConfig>) {
    this.config = {
      initialDelayMs: config?.initialDelayMs ?? 100,
      maxDelayMs: config?.maxDelayMs ?? 30000,
      multiplier: config?.multiplier ?? 2,
      jitter: config?.jitter ?? 'full',
    };
  }

  computeDelay(attempt: number, previousDelay?: number): number {
    const base = Math.min(
      this.config.maxDelayMs,
      this.config.initialDelayMs * Math.pow(this.config.multiplier, attempt)
    );

    switch (this.config.jitter) {
      case 'full':
        return Math.floor(Math.random() * base);
      case 'equal':
        return Math.floor(base / 2 + Math.random() * (base / 2));
      case 'decorrelated':
        const prev = previousDelay ?? this.config.initialDelayMs;
        return Math.floor(Math.min(this.config.maxDelayMs, Math.random() * (prev * 3 - this.config.initialDelayMs) + this.config.initialDelayMs));
      case 'none':
      default:
        return Math.floor(base);
    }
  }
}
