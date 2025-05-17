export interface DelayedItem<T> {
  id: string;
  item: T;
  executeAt: number;
}

export class DelayQueue<T> {
  private queue: DelayedItem<T>[] = [];

  public offer(id: string, item: T, delayMs: number, fromTime: number = Date.now()): void {
    const executeAt = fromTime + delayMs;
    this.queue.push({ id, item, executeAt });
    this.queue.sort((a, b) => a.executeAt - b.executeAt);
  }

  public pollReady(now: number = Date.now()): T[] {
    const ready: T[] = [];
    while (this.queue.length > 0 && this.queue[0].executeAt <= now) {
      const el = this.queue.shift()!;
      ready.push(el.item);
    }
    return ready;
  }

  public peek(): DelayedItem<T> | undefined {
    return this.queue[0];
  }

  public size(): number {
    return this.queue.length;
  }

  public clear(): void {
    this.queue = [];
  }
}
