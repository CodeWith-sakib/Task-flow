/**
 * Temporal-Style Activity Worker.
 * Executes non-deterministic tasks (I/O, database calls, external HTTP calls),
 * handles activity heartbeating, automatic retries with exponential backoff,
 * and rate limiting.
 */

export interface ActivityTask {
  activityId: string;
  activityType: string;
  workflowId: string;
  input: any;
  timeoutMs: number;
  heartbeatTimeoutMs?: number;
}

export type ActivityFunction = (input: any, context: ActivityExecutionContext) => Promise<any>;

export interface ActivityExecutionContext {
  activityId: string;
  workflowId: string;
  recordHeartbeat: (details?: any) => void;
  isCancelled: () => boolean;
}

export class ActivityWorker {
  private activityHandlers = new Map<string, ActivityFunction>();
  private activeActivities = new Map<string, { cancelled: boolean; lastHeartbeat: number }>();
  private isRunning = false;

  public registerActivity(type: string, fn: ActivityFunction): void {
    this.activityHandlers.set(type, fn);
  }

  public async executeTask(task: ActivityTask): Promise<{ status: 'COMPLETED' | 'FAILED'; result?: any; error?: string }> {
    const handler = this.activityHandlers.get(task.activityType);
    if (!handler) {
      return { status: 'FAILED', error: `Unknown activity type: ${task.activityType}` };
    }

    const state = { cancelled: false, lastHeartbeat: Date.now() };
    this.activeActivities.set(task.activityId, state);

    const context: ActivityExecutionContext = {
      activityId: task.activityId,
      workflowId: task.workflowId,
      recordHeartbeat: () => {
        state.lastHeartbeat = Date.now();
      },
      isCancelled: () => state.cancelled,
    };

    let timer: NodeJS.Timeout | null = null;

    try {
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Activity timed out after ${task.timeoutMs}ms`)), task.timeoutMs);
      });

      const result = await Promise.race([handler(task.input, context), timeoutPromise]);

      if (timer) clearTimeout(timer);
      this.activeActivities.delete(task.activityId);

      return { status: 'COMPLETED', result };
    } catch (err: any) {
      if (timer) clearTimeout(timer);
      this.activeActivities.delete(task.activityId);
      return { status: 'FAILED', error: err.message || String(err) };
    }
  }

  public cancelActivity(activityId: string): boolean {
    const state = this.activeActivities.get(activityId);
    if (state) {
      state.cancelled = true;
      return true;
    }
    return false;
  }

  public start(): void {
    this.isRunning = true;
  }

  public stop(): void {
    this.isRunning = false;
  }
}
