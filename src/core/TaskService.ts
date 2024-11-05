import { Task, TaskStatus, CreateTaskRequest, TaskPayload } from '../types';
import { Database } from '../storage/db';
import { Queue } from '../queue/redis';
import { EventEmitter, TaskEvent } from '../events/EventEmitter';
import { StateTransitioner } from './state/StateTransitioner';
import { RetryManager } from './retry/RetryManager';
import { TaskScheduler } from './scheduler/TaskScheduler';
import { TaskHandlerRegistry } from './lifecycle/TaskHandlerRegistry';

export class TaskService {
  constructor(
    private db: Database,
    private queue: Queue,
    private eventEmitter: EventEmitter,
    private stateTransitioner: StateTransitioner,
    private retryManager: RetryManager,
    private scheduler: TaskScheduler,
    private handlerRegistry: TaskHandlerRegistry
  ) {}

  async createTask(request: CreateTaskRequest): Promise<Task> {
    const task = await this.db.createTask(request);

    await this.eventEmitter.emit(TaskEvent.CREATED, {
      taskId: task.id,
      data: { task },
    });

    // Auto-enqueue if not scheduled
    if (!task.scheduledAt) {
      await this.enqueueTask(task.id);
    }

    return task;
  }

  async getTask(id: string): Promise<Task | null> {
    return this.db.getTask(id);
  }

  async enqueueTask(taskId: string, priority: number = 0): Promise<void> {
    const task = await this.db.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    await this.queue.enqueue(taskId, priority);

    await this.updateTaskStatus(taskId, TaskStatus.QUEUED);
  }

  async updateTaskStatus(taskId: string, newStatus: TaskStatus): Promise<Task | null> {
    const task = await this.db.getTask(taskId);
    if (!task) return null;

    if (!this.stateTransitioner.canTransition(task.status, newStatus)) {
      throw new Error(
        `Invalid transition from ${task.status} to ${newStatus} for task ${taskId}`
      );
    }

    const updated = await this.db.updateTask(taskId, { status: newStatus });
    return updated;
  }

  async processTaskResult(
    taskId: string,
    success: boolean,
    result?: any,
    error?: string
  ): Promise<Task | null> {
    const task = await this.db.getTask(taskId);
    if (!task) return null;

    if (success) {
      const updated = await this.db.updateTask(taskId, {
        status: TaskStatus.SUCCESS,
        result,
      });

      if (updated) {
        await this.eventEmitter.emit(TaskEvent.COMPLETED, {
          taskId,
          data: { result },
        });
      }

      return updated;
    } else {
      // Handle failure
      if (this.retryManager.canRetry(task)) {
        const nextRetryTime = this.retryManager.getRetryScheduleTime(task);
        const incrementedTask = this.retryManager.incrementRetryCount(task);

        const updated = await this.db.updateTask(taskId, {
          retryCount: incrementedTask.retryCount,
          scheduledAt: nextRetryTime,
          status: TaskStatus.PENDING,
          error,
        });

        if (updated) {
          await this.eventEmitter.emit(TaskEvent.RETRYING, {
            taskId,
            data: { retryCount: incrementedTask.retryCount, error },
          });
        }

        return updated;
      } else {
        // Max retries exceeded
        const updated = await this.db.updateTask(taskId, {
          status: TaskStatus.FAILED,
          error,
        });

        if (updated) {
          await this.eventEmitter.emit(TaskEvent.FAILED, {
            taskId,
            data: { error },
          });
        }

        return updated;
      }
    }
  }

  async getAllTasks(): Promise<Task[]> {
    return this.db.getAllTasks();
  }

  async getTasksByStatus(status: TaskStatus): Promise<Task[]> {
    return this.db.getTasksByStatus(status);
  }

  registerHandler(taskType: string, handler: (payload: TaskPayload) => Promise<any>): void {
    this.handlerRegistry.register(taskType, handler);
  }

  getHandlerRegistry(): TaskHandlerRegistry {
    return this.handlerRegistry;
  }
}
