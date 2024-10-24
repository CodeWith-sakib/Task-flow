export interface HeapNode<T> {
  priority: number;
  data: T;
  insertedAt: number;
}

export class PriorityHeap<T> {
  private heap: HeapNode<T>[] = [];
  private sequence: number = 0;

  push(data: T, priority: number): void {
    const node: HeapNode<T> = {
      priority,
      data,
      insertedAt: this.sequence++,
    };
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const bottom = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this.bubbleDown(0);
    }
    return top.data;
  }

  peek(): T | undefined {
    return this.heap[0]?.data;
  }

  size(): number {
    return this.heap.length;
  }

  clear(): void {
    this.heap = [];
    this.sequence = 0;
  }

  private compare(a: HeapNode<T>, b: HeapNode<T>): number {
    if (a.priority !== b.priority) {
      return b.priority - a.priority; // Max-heap: highest priority first
    }
    return a.insertedAt - b.insertedAt; // FIFO for equal priority
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.heap[index], this.heap[parent]) < 0) {
        [this.heap[index], this.heap[parent]] = [this.heap[parent], this.heap[index]];
        index = parent;
      } else {
        break;
      }
    }
  }

  private bubbleDown(index: number): void {
    const length = this.heap.length;
    while (true) {
      let candidate = index;
      const left = 2 * index + 1;
      const right = 2 * index + 2;

      if (left < length && this.compare(this.heap[left], this.heap[candidate]) < 0) {
        candidate = left;
      }
      if (right < length && this.compare(this.heap[right], this.heap[candidate]) < 0) {
        candidate = right;
      }
      if (candidate !== index) {
        [this.heap[index], this.heap[candidate]] = [this.heap[candidate], this.heap[index]];
        index = candidate;
      } else {
        break;
      }
    }
  }
}
