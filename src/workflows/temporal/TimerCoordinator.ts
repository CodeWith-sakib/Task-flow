export interface DurableTimer {
  timerId: string;
  workflowId: string;
  fireTime: number;
  durationMs: number;
  status: 'PENDING' | 'FIRED' | 'CANCELLED';
  callback?: () => void;
}

/**
 * TimerCoordinator manages durable timers for long-running workflows with sleep, deadline,
 * and cancellation capabilities.
 */
export class TimerCoordinator {
  private timers: Map<string, DurableTimer> = new Map();
  private handleMap: Map<string, NodeJS.Timeout> = new Map();

  public createTimer(timerId: string, workflowId: string, durationMs: number, onFire?: () => void): DurableTimer {
    const fireTime = Date.now() + Math.max(0, durationMs);
    const timer: DurableTimer = {
      timerId,
      workflowId,
      fireTime,
      durationMs,
      status: 'PENDING',
      callback: onFire
    };

    this.timers.set(timerId, timer);

    const handle = setTimeout(() => {
      this.fireTimer(timerId);
    }, Math.max(0, durationMs));

    this.handleMap.set(timerId, handle);
    return timer;
  }

  public cancelTimer(timerId: string): boolean {
    const timer = this.timers.get(timerId);
    if (!timer || timer.status !== 'PENDING') return false;

    timer.status = 'CANCELLED';
    const handle = this.handleMap.get(timerId);
    if (handle) {
      clearTimeout(handle);
      this.handleMap.delete(timerId);
    }
    return true;
  }

  public getTimer(timerId: string): DurableTimer | undefined {
    return this.timers.get(timerId);
  }

  public getPendingTimers(workflowId?: string): DurableTimer[] {
    return Array.from(this.timers.values()).filter(t => {
      if (t.status !== 'PENDING') return false;
      if (workflowId && t.workflowId !== workflowId) return false;
      return true;
    });
  }

  private fireTimer(timerId: string): void {
    const timer = this.timers.get(timerId);
    if (timer && timer.status === 'PENDING') {
      timer.status = 'FIRED';
      this.handleMap.delete(timerId);
      if (timer.callback) {
        try {
          timer.callback();
        } catch {
          // Ignore callback error
        }
      }
    }
  }
}
