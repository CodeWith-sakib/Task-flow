export interface PoolTask<T = any, R = any> {
  id: string;
  fn: (payload: T) => Promise<R>;
  payload: T;
  resolve: (res: R) => void;
  reject: (err: any) => void;
  affinityWorkerId?: number;
}

/**
 * WorkStealingWorkerPool provides thread/worker execution with per-worker work queues
 * and work-stealing when a worker becomes idle to maximize throughput.
 */
export class WorkStealingWorkerPool {
  private workerCount: number;
  private workerQueues: PoolTask[][];
  private isRunning: boolean = false;
  private activeWorkers: Set<number> = new Set();
  private completedTasks: number = 0;
  private failedTasks: number = 0;

  constructor(workerCount: number = 4) {
    this.workerCount = Math.max(1, workerCount);
    this.workerQueues = Array.from({ length: this.workerCount }, () => []);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    for (let i = 0; i < this.workerCount; i++) {
      this.runWorkerLoop(i);
    }
  }

  public stop(): void {
    this.isRunning = false;
  }

  public submit<T, R>(fn: (payload: T) => Promise<R>, payload: T, affinityWorkerId?: number): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      const task: PoolTask<T, R> = {
        id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        fn,
        payload,
        resolve,
        reject,
        affinityWorkerId
      };

      let targetWorker = 0;
      if (affinityWorkerId !== undefined && affinityWorkerId >= 0 && affinityWorkerId < this.workerCount) {
        targetWorker = affinityWorkerId;
      } else {
        // Enqueue to shortest worker queue
        let minLen = this.workerQueues[0].length;
        for (let i = 1; i < this.workerCount; i++) {
          if (this.workerQueues[i].length < minLen) {
            minLen = this.workerQueues[i].length;
            targetWorker = i;
          }
        }
      }

      this.workerQueues[targetWorker].push(task);
    });
  }

  public getStats(): {
    workerCount: number;
    activeWorkers: number;
    queuedTasks: number;
    completedTasks: number;
    failedTasks: number;
  } {
    const queuedTasks = this.workerQueues.reduce((acc, q) => acc + q.length, 0);
    return {
      workerCount: this.workerCount,
      activeWorkers: this.activeWorkers.size,
      queuedTasks,
      completedTasks: this.completedTasks,
      failedTasks: this.failedTasks
    };
  }

  private async runWorkerLoop(workerId: number): Promise<void> {
    while (this.isRunning) {
      let task = this.workerQueues[workerId].shift();

      // If own queue is empty, attempt work stealing from peers
      if (!task) {
        task = this.stealWork(workerId);
      }

      if (task) {
        this.activeWorkers.add(workerId);
        try {
          const result = await task.fn(task.payload);
          this.completedTasks++;
          task.resolve(result);
        } catch (err) {
          this.failedTasks++;
          task.reject(err);
        } finally {
          this.activeWorkers.delete(workerId);
        }
      } else {
        // Yield to event loop
        await new Promise(r => setImmediate(r));
      }
    }
  }

  private stealWork(idleWorkerId: number): PoolTask | undefined {
    let busiestWorker = -1;
    let maxLen = 0;

    for (let i = 0; i < this.workerCount; i++) {
      if (i !== idleWorkerId && this.workerQueues[i].length > maxLen) {
        maxLen = this.workerQueues[i].length;
        busiestWorker = i;
      }
    }

    if (busiestWorker !== -1 && maxLen > 1) {
      // Steal task from tail of busiest worker's queue (LIFO steal)
      return this.workerQueues[busiestWorker].pop();
    }

    return undefined;
  }
}
