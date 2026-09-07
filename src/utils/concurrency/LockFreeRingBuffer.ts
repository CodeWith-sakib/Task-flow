/**
 * LockFreeRingBuffer implements a single-producer single/multi-consumer circular buffer
 * with power-of-two capacity bitmasking and zero heap allocations during steady state.
 */
export class LockFreeRingBuffer<T = any> {
  private buffer: (T | null)[];
  private capacity: number;
  private mask: number;
  private head: number = 0; // Write index
  private tail: number = 0; // Read index

  constructor(requestedCapacity: number = 1024) {
    // Round up to nearest power of 2
    let cap = 1;
    while (cap < requestedCapacity) {
      cap <<= 1;
    }
    this.capacity = cap;
    this.mask = cap - 1;
    this.buffer = new Array(cap).fill(null);
  }

  public offer(item: T): boolean {
    if (this.isFull()) {
      return false;
    }

    const index = this.head & this.mask;
    this.buffer[index] = item;
    this.head++;
    return true;
  }

  public poll(): T | null {
    if (this.isEmpty()) {
      return null;
    }

    const index = this.tail & this.mask;
    const item = this.buffer[index];
    this.buffer[index] = null;
    this.tail++;
    return item;
  }

  public peek(): T | null {
    if (this.isEmpty()) return null;
    return this.buffer[this.tail & this.mask];
  }

  public isFull(): boolean {
    return (this.head - this.tail) >= this.capacity;
  }

  public isEmpty(): boolean {
    return this.head === this.tail;
  }

  public size(): number {
    return this.head - this.tail;
  }

  public getCapacity(): number {
    return this.capacity;
  }

  public clear(): void {
    this.buffer.fill(null);
    this.head = 0;
    this.tail = 0;
  }
}
