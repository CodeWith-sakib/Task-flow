import { v4 as uuidv4 } from 'uuid';
import {
  EnqueueOptions,
  IQueue,
  QueueMessage,
  QueueMetrics,
} from '../types';
import { DeadLetterQueue } from '../dlq/DeadLetterQueue';

export class VisibilityQueue implements IQueue {
  private queue: QueueMessage[] = [];
  private inflight: Map<string, QueueMessage> = new Map(); // taskId -> message
  private processedTaskIds: Set<string> = new Set();
  private dlq: DeadLetterQueue;
  private defaultVisibilityTimeoutMs: number;
  private defaultMaxDeliveries: number;
  private totalProcessedCount: number = 0;

  constructor(
    dlq?: DeadLetterQueue,
    defaultVisibilityTimeoutMs: number = 30000,
    defaultMaxDeliveries: number = 3
  ) {
    this.dlq = dlq || new DeadLetterQueue();
    this.defaultVisibilityTimeoutMs = defaultVisibilityTimeoutMs;
    this.defaultMaxDeliveries = defaultMaxDeliveries;
  }

  async enqueue(
    taskId: string,
    priority: number = 0,
    options?: EnqueueOptions
  ): Promise<string> {
    // Prevent duplicate enqueue if already in queue or currently in flight
    const existingInQueue = this.queue.some(m => m.taskId === taskId);
    if (existingInQueue || this.inflight.has(taskId)) {
      return taskId;
    }

    const now = Date.now();
    const delayMs = options?.delayMs ?? 0;
    const message: QueueMessage = {
      id: uuidv4(),
      taskId,
      priority: options?.priority ?? priority,
      enqueuedAt: new Date(now),
      visibleAfter: new Date(now + delayMs),
      deliveryCount: 0,
      maxDeliveries: options?.maxDeliveries ?? this.defaultMaxDeliveries,
      visibilityTimeoutMs: options?.visibilityTimeoutMs ?? this.defaultVisibilityTimeoutMs,
      metadata: options?.metadata,
    };

    this.queue.push(message);
    this.sortQueue();
    return message.id;
  }

  private sortQueue(): void {
    // Sort descending by priority (higher priority first), then ascending by visibleAfter
    this.queue.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.visibleAfter.getTime() - b.visibleAfter.getTime();
    });
  }

  async dequeue(): Promise<string | null> {
    const now = Date.now();

    // First check any expired inflight messages
    this.checkVisibilityExpirations(now);

    for (let i = 0; i < this.queue.length; i++) {
      const msg = this.queue[i];
      if (msg.visibleAfter.getTime() <= now) {
        // Remove from pending queue
        this.queue.splice(i, 1);

        msg.deliveryCount++;
        msg.visibleAfter = new Date(now + msg.visibilityTimeoutMs);
        this.inflight.set(msg.taskId, msg);

        return msg.taskId;
      }
    }

    return null;
  }

  async ack(taskId: string): Promise<boolean> {
    if (this.inflight.has(taskId)) {
      this.inflight.delete(taskId);
      this.processedTaskIds.add(taskId);
      this.totalProcessedCount++;
      return true;
    }
    // Also remove from pending queue if present
    const idx = this.queue.findIndex(m => m.taskId === taskId);
    if (idx !== -1) {
      this.queue.splice(idx, 1);
      this.processedTaskIds.add(taskId);
      this.totalProcessedCount++;
      return true;
    }
    return false;
  }

  async nack(taskId: string, requeue: boolean = true): Promise<boolean> {
    const msg = this.inflight.get(taskId) || this.queue.find(m => m.taskId === taskId);
    if (!msg) return false;

    this.inflight.delete(taskId);
    const queueIdx = this.queue.findIndex(m => m.taskId === taskId);
    if (queueIdx !== -1) {
      this.queue.splice(queueIdx, 1);
    }

    if (requeue && msg.deliveryCount < msg.maxDeliveries) {
      // Re-enqueue immediately
      msg.visibleAfter = new Date();
      this.queue.push(msg);
      this.sortQueue();
      return true;
    } else {
      // Route to Dead Letter Queue
      await this.dlq.push(
        taskId,
        msg,
        `Exceeded maximum deliveries (${msg.deliveryCount}/${msg.maxDeliveries})`
      );
      return false;
    }
  }

  checkVisibilityExpirations(currentTimeMs: number = Date.now()): void {
    for (const [taskId, msg] of Array.from(this.inflight.entries())) {
      if (msg.visibleAfter.getTime() <= currentTimeMs) {
        this.inflight.delete(taskId);
        if (msg.deliveryCount >= msg.maxDeliveries) {
          this.dlq.push(
            taskId,
            msg,
            `Visibility timeout expired after ${msg.deliveryCount} attempts`
          );
        } else {
          // Re-queue for immediate delivery attempt
          msg.visibleAfter = new Date(0);
          this.queue.push(msg);
        }
      }
    }
    this.sortQueue();
  }

  async size(): Promise<number> {
    return this.queue.length;
  }

  async clear(): Promise<void> {
    this.queue = [];
    this.inflight.clear();
    this.processedTaskIds.clear();
    await this.dlq.purge();
  }

  getDLQ(): DeadLetterQueue {
    return this.dlq;
  }

  async getMetrics(): Promise<QueueMetrics> {
    const now = Date.now();
    const delayed = this.queue.filter(m => m.visibleAfter.getTime() > now).length;
    return {
      size: this.queue.length,
      inflight: this.inflight.size,
      delayed,
      deadLettered: this.dlq.size(),
      totalProcessed: this.totalProcessedCount,
    };
  }
}
