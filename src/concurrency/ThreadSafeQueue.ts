export class ThreadSafeQueue<T> {
  private items: T[] = [];
  private capacity: number;

  constructor(capacity: number = 100) {
    this.capacity = capacity;
  }

  public offer(item: T): boolean {
    if (this.items.length >= this.capacity) {
      return false;
    }
    this.items.push(item);
    return true;
  }

  public poll(): T | undefined {
    return this.items.shift();
  }

  public size(): number {
    return this.items.length;
  }
}
