interface SemaphoreWaiter {
  priority: number;
  permits: number;
  resolve: (release: () => void) => void;
  reject: (err: any) => void;
  timer?: NodeJS.Timeout;
  enqueuedAt: number;
}

/**
 * AsyncPrioritySemaphore provides weighted asynchronous permits with prioritized acquisition,
 * anti-starvation aging, and timeout cancellation.
 */
export class AsyncPrioritySemaphore {
  private capacity: number;
  private availablePermits: number;
  private waiters: SemaphoreWaiter[] = [];

  constructor(capacity: number) {
    this.capacity = capacity;
    this.availablePermits = capacity;
  }

  public async acquire(permits: number = 1, priority: number = 0, timeoutMs?: number): Promise<() => void> {
    if (permits > this.capacity) {
      throw new Error(`Requested permits (${permits}) exceeds semaphore capacity (${this.capacity})`);
    }

    if (this.availablePermits >= permits && this.waiters.length === 0) {
      this.availablePermits -= permits;
      return this.createRelease(permits);
    }

    return new Promise((resolve, reject) => {
      const waiter: SemaphoreWaiter = {
        priority,
        permits,
        resolve,
        reject,
        enqueuedAt: Date.now()
      };

      if (timeoutMs && timeoutMs > 0) {
        waiter.timer = setTimeout(() => {
          const idx = this.waiters.indexOf(waiter);
          if (idx !== -1) {
            this.waiters.splice(idx, 1);
            reject(new Error(`Semaphore acquisition timed out after ${timeoutMs}ms`));
          }
        }, timeoutMs);
      }

      this.waiters.push(waiter);
      this.sortWaiters();
    });
  }

  public getAvailablePermits(): number {
    return this.availablePermits;
  }

  public getWaiterCount(): number {
    return this.waiters.length;
  }

  private createRelease(permits: number): () => void {
    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.availablePermits += permits;
        this.dispatchNext();
      }
    };
  }

  private dispatchNext(): void {
    this.sortWaiters();

    while (this.waiters.length > 0) {
      const head = this.waiters[0];
      if (this.availablePermits >= head.permits) {
        this.waiters.shift();
        if (head.timer) clearTimeout(head.timer);
        this.availablePermits -= head.permits;
        head.resolve(this.createRelease(head.permits));
      } else {
        break;
      }
    }
  }

  private sortWaiters(): void {
    const now = Date.now();
    this.waiters.sort((a, b) => {
      // Priority with aging: +1 priority per 1000ms in queue to prevent starvation
      const ageA = Math.floor((now - a.enqueuedAt) / 1000);
      const ageB = Math.floor((now - b.enqueuedAt) / 1000);
      const effectivePriorityA = a.priority + ageA;
      const effectivePriorityB = b.priority + ageB;

      return effectivePriorityB - effectivePriorityA;
    });
  }
}
