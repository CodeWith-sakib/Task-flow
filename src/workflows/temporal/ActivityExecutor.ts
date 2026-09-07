export interface ActivityContext {
  activityId: string;
  workflowId: string;
  attempt: number;
  heartbeat: (details?: any) => void;
  isCancelled: () => boolean;
}

export type ActivityFunction<TIn = any, TOut = any> = (input: TIn, ctx: ActivityContext) => Promise<TOut>;

export interface ActivityExecutionOptions {
  maxAttempts?: number;
  startToCloseTimeoutMs?: number;
  heartbeatTimeoutMs?: number;
  initialIntervalMs?: number;
  backoffMultiplier?: number;
}

/**
 * ActivityExecutor manages activity task invocation with heartbeating, cancellation detection,
 * and retry backoff state machines.
 */
export class ActivityExecutor {
  public async execute<TIn, TOut>(
    activityId: string,
    workflowId: string,
    fn: ActivityFunction<TIn, TOut>,
    input: TIn,
    options?: ActivityExecutionOptions
  ): Promise<TOut> {
    const maxAttempts = options?.maxAttempts ?? 3;
    const startToCloseTimeoutMs = options?.startToCloseTimeoutMs ?? 30000;
    const heartbeatTimeoutMs = options?.heartbeatTimeoutMs ?? 10000;
    const initialInterval = options?.initialIntervalMs ?? 200;
    const multiplier = options?.backoffMultiplier ?? 2.0;

    let lastError: any;
    let lastHeartbeat = Date.now();
    let cancelled = false;

    const ctx: ActivityContext = {
      activityId,
      workflowId,
      attempt: 1,
      heartbeat: (_details) => {
        lastHeartbeat = Date.now();
      },
      isCancelled: () => cancelled
    };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      ctx.attempt = attempt;
      lastHeartbeat = Date.now();

      // Setup heartbeat timeout monitor
      let heartbeatTimer: NodeJS.Timeout | undefined;
      if (heartbeatTimeoutMs > 0) {
        heartbeatTimer = setInterval(() => {
          if (Date.now() - lastHeartbeat > heartbeatTimeoutMs) {
            cancelled = true;
          }
        }, Math.floor(heartbeatTimeoutMs / 2));
      }

      try {
        const result = await this.withTimeout(fn(input, ctx), startToCloseTimeoutMs);
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        return result;
      } catch (err: any) {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        lastError = err;

        if (attempt < maxAttempts) {
          const delay = initialInterval * Math.pow(multiplier, attempt - 1);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    throw new Error(`Activity '${activityId}' failed after ${maxAttempts} attempts: ${lastError?.message || String(lastError)}`);
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Activity execution timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
  }
}
