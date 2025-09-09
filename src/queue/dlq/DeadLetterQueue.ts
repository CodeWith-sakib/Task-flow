import { v4 as uuidv4 } from 'uuid';
import { DeadLetterItem, QueueMessage } from '../types';

export class DeadLetterQueue {
  private items: Map<string, DeadLetterItem> = new Map();

  async push(
    taskId: string,
    message: QueueMessage,
    reason: string
  ): Promise<DeadLetterItem> {
    const item: DeadLetterItem = {
      id: `dlq_${uuidv4()}`,
      taskId,
      originalMessage: message,
      failureReason: reason,
      deadLetteredAt: new Date(),
      retryAttempts: message.deliveryCount,
    };

    this.items.set(item.id, item);
    return item;
  }

  async get(id: string): Promise<DeadLetterItem | null> {
    return this.items.get(id) ?? null;
  }

  async list(limit: number = 50, offset: number = 0): Promise<{ items: DeadLetterItem[]; total: number }> {
    const all = Array.from(this.items.values()).sort(
      (a, b) => b.deadLetteredAt.getTime() - a.deadLetteredAt.getTime()
    );
    return {
      items: all.slice(offset, offset + limit),
      total: all.length,
    };
  }

  async replay(
    id: string,
    requeueFn: (taskId: string, priority: number) => Promise<any>
  ): Promise<boolean> {
    const item = this.items.get(id);
    if (!item) return false;

    await requeueFn(item.taskId, item.originalMessage.priority);
    this.items.delete(id);
    return true;
  }

  async replayAll(
    requeueFn: (taskId: string, priority: number) => Promise<any>
  ): Promise<number> {
    const all = Array.from(this.items.values());
    let replayed = 0;
    for (const item of all) {
      await requeueFn(item.taskId, item.originalMessage.priority);
      this.items.delete(item.id);
      replayed++;
    }
    return replayed;
  }

  async purge(): Promise<number> {
    const count = this.items.size;
    this.items.clear();
    return count;
  }

  size(): number {
    return this.items.size;
  }
}
