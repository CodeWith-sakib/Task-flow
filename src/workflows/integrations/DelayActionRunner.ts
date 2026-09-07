export interface DelayConfig {
  durationMs: number;
}

/**
 * DelayActionRunner pauses workflow step execution for a specified duration with cancellation support.
 */
export class DelayActionRunner {
  public async delay(config: DelayConfig, cancellationSignal?: { isCancelled: boolean }): Promise<{ elapsedMs: number }> {
    const startTime = Date.now();
    const duration = Math.max(0, config.durationMs);

    if (duration === 0) {
      return { elapsedMs: 0 };
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        clearInterval(checkTimer);
        resolve({ elapsedMs: Date.now() - startTime });
      }, duration);

      const checkTimer = setInterval(() => {
        if (cancellationSignal?.isCancelled) {
          clearTimeout(timer);
          clearInterval(checkTimer);
          reject(new Error('Delay cancelled'));
        }
      }, 50);
    });
  }
}
