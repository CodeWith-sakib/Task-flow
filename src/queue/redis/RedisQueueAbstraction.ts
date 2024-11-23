import { QueueItem } from '../../types';

export class RedisQueueAbstraction {
  private queue: QueueItem[] = [];
  private processedIds: Set<string> = new Set();

  async enqueue(taskId: string, priority: number = 0): Promise<void> {
    // Prevent duplicate enqueues
    if (this.processedIds.has(taskId) || this.queue.some((item) => item.taskId === taskId)) {
      return;
    }

    const item: QueueItem = {
      taskId,
      enqueuedAt: new Date(),
      priority,
    };

    // Sort by priority (higher first)
    this.queue.push(item);
    this.queue.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  async dequeue(): Promise<string | null> {
    if (this.queue.length === 0) return null;

    const item = this.queue.shift();
    if (item) {
      this.processedIds.add(item.taskId);
    }
    return item?.taskId ?? null;
  }

  async peek(): Promise<string | null> {
    return this.queue[0]?.taskId ?? null;
  }

  async length(): Promise<number> {
    return this.queue.length;
  }

  async clear(): Promise<void> {
    this.queue = [];
    this.processedIds.clear();
  }

  async getAll(): Promise<QueueItem[]> {
    return [...this.queue];
  }

  isProcessed(taskId: string): boolean {
    return this.processedIds.has(taskId);
  }
}
