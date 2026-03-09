import { Queue } from '../queue/redis';
import { Database } from '../storage/db';
import { EventEmitter, TaskEvent } from '../events/EventEmitter';
import { TaskScheduler } from '../core/scheduler/TaskScheduler';
import { TaskHandlerRegistry } from '../core/lifecycle/TaskHandlerRegistry';
import { TaskService } from '../core/TaskService';

class WorkerLock {
  private locked: boolean = false;
  private waiting: Array<() => void> = [];

  acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    const resolver = this.waiting.shift();
    if (resolver) {
      resolver();
    } else {
      this.locked = false;
    }
  }
}

export class Worker {
  private running: boolean = false;
  private concurrency: number;
  private timeout: number;
  private activeCount: number = 0;
  private lock: WorkerLock = new WorkerLock();

  constructor(
    private taskService: TaskService,
    private queue: Queue,
    private db: Database,
    private eventEmitter: EventEmitter,
    private scheduler: TaskScheduler,
    private handlerRegistry: TaskHandlerRegistry,
    concurrency: number = 5,
    timeout: number = 30000
  ) {
    this.concurrency = concurrency;
    this.timeout = timeout;
  }

  async start(): Promise<void> {
    this.running = true;
    console.log(`Worker started with concurrency: ${this.concurrency}`);

    while (this.running) {
      if (this.activeCount < this.concurrency) {
        await this.lock.acquire();
        try {
          this.processNextTask();
        } finally {
          this.lock.release();
        }
      }
      await this.sleep(100);
    }
  }

  stop(): void {
    this.running = false;
    console.log('Worker stopping...');
  }

  private async processNextTask(): Promise<void> {
    try {
      const taskId = await this.queue.dequeue();
      if (!taskId) return;

      this.activeCount++;

      const task = await this.db.getTask(taskId);
      if (!task) {
        return;
      }

      if (!this.scheduler.shouldRun(task)) {
        await this.queue.enqueue(taskId, -1);
        return;
      }

      await this.taskService.updateTaskStatus(taskId, 'running' as any);

      await this.eventEmitter.emit(TaskEvent.STARTED, {
        taskId,
        data: { task },
      });

      try {
        const result = await this.executeWithTimeout(
          () => this.handlerRegistry.executeHandler(task.type, task.payload),
          this.timeout
        );

        await this.taskService.processTaskResult(taskId, true, result);
      } catch (error: any) {
        const errorMessage = error?.message || 'Unknown error';
        await this.taskService.processTaskResult(taskId, false, undefined, errorMessage);
      }
    } catch (error) {
      console.error('Worker error:', error);
    } finally {
      this.activeCount--;
    }
  }

  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    let timer: NodeJS.Timeout | null = null;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Task timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      });
      return await Promise.race([fn(), timeoutPromise]);
    } finally {
      if (timer !== null) {
        clearTimeout(timer);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isRunning(): boolean {
    return this.running;
  }

  getActiveCount(): number {
    return this.activeCount;
  }
}