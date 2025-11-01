export class WorkStealingPool<T> {
  private workerDeques: Map<string, T[]> = new Map();

  public registerWorker(workerId: string): void {
    if (!this.workerDeques.has(workerId)) {
      this.workerDeques.set(workerId, []);
    }
  }

  public pushTask(workerId: string, task: T): void {
    const deque = this.workerDeques.get(workerId);
    if (deque) deque.push(task);
  }

  public popTask(workerId: string): T | undefined {
    const deque = this.workerDeques.get(workerId);
    if (deque && deque.length > 0) {
      return deque.pop(); // LIFO for local worker
    }
    // Steal FIFO from busiest other worker
    let busiestWorker: string | null = null;
    let maxLen = 0;
    for (const [id, d] of this.workerDeques.entries()) {
      if (id !== workerId && d.length > maxLen) {
        maxLen = d.length;
        busiestWorker = id;
      }
    }
    if (busiestWorker && maxLen > 0) {
      return this.workerDeques.get(busiestWorker)!.shift(); // FIFO steal
    }
    return undefined;
  }
}
