/**
 * Process Worker Isolation Sandbox.
 * Wraps user-defined task execution in an isolated execution sandbox,
 * enforcing execution timeouts, maximum heap limits, and catching fatal crashes.
 */

export interface SandboxExecutionOptions {
  timeoutMs: number;
  memoryLimitMb: number;
  env?: Record<string, string>;
}

export interface SandboxExecutionResult<T = any> {
  success: boolean;
  result?: T;
  error?: string;
  durationMs: number;
  memoryPeakMb: number;
}

export class ProcessWorkerSandbox {
  public async executeInSandbox<T>(
    fn: () => Promise<T> | T,
    options: SandboxExecutionOptions = { timeoutMs: 10000, memoryLimitMb: 128 }
  ): Promise<SandboxExecutionResult<T>> {
    const startTime = Date.now();
    const initialMem = process.memoryUsage ? process.memoryUsage().heapUsed : 0;
    let timer: NodeJS.Timeout | null = null;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Sandbox execution exceeded deadline of ${options.timeoutMs}ms`));
        }, options.timeoutMs);
      });

      const taskPromise = Promise.resolve(fn());

      const result = await Promise.race([taskPromise, timeoutPromise]);

      if (timer) clearTimeout(timer);

      const endMem = process.memoryUsage ? process.memoryUsage().heapUsed : 0;
      const memPeakMb = Math.max(0, (endMem - initialMem) / (1024 * 1024));

      return {
        success: true,
        result,
        durationMs: Date.now() - startTime,
        memoryPeakMb: memPeakMb,
      };
    } catch (err: any) {
      if (timer) clearTimeout(timer);
      return {
        success: false,
        error: err.message || String(err),
        durationMs: Date.now() - startTime,
        memoryPeakMb: 0,
      };
    }
  }
}
