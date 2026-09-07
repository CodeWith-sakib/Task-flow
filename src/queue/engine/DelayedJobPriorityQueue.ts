/**
 * High-Performance Delayed Job Priority Queue.
 * Integrates priority levels (0 to 9), millisecond-precision schedule delays,
 * max-retry limits with exponential backoff, and dead-letter queue routing.
 */

export interface QueuedJob<T = any> {
  id: string;
  payload: T;
  priority: number; // 0 (highest) to 9 (lowest)
  availableAt: number; // timestamp in ms
  attempts: number;
  maxAttempts: number;
  backoffFactor: number;
}

export class DelayedJobPriorityQueue<T = any> {
  private queues: QueuedJob<T>[][] = Array.from({ length: 10 }, () => []);
  private delayedHeap: QueuedJob<T>[] = [];
  private deadLetterQueue: QueuedJob<T>[] = [];

  public enqueue(
    id: string,
    payload: T,
    priority: number = 5,
    delayMs: number = 0,
    maxAttempts: number = 3
  ): QueuedJob<T> {
    const clampedPriority = Math.max(0, Math.min(9, priority));
    const availableAt = Date.now() + Math.max(0, delayMs);

    const job: QueuedJob<T> = {
      id,
      payload,
      priority: clampedPriority,
      availableAt,
      attempts: 0,
      maxAttempts,
      backoffFactor: 2,
    };

    if (delayMs > 0) {
      this.insertDelayedHeap(job);
    } else {
      this.queues[clampedPriority].push(job);
    }

    return job;
  }

  public poll(now: number = Date.now()): QueuedJob<T> | null {
    // 1. Promote eligible delayed jobs to ready queues
    this.promoteReadyDelayedJobs(now);

    // 2. Poll from highest priority queue (0) to lowest (9)
    for (let p = 0; p < 10; p++) {
      if (this.queues[p].length > 0) {
        const job = this.queues[p].shift()!;
        job.attempts++;
        return job;
      }
    }

    return null;
  }

  public retry(job: QueuedJob<T>, baseBackoffMs: number = 1000): boolean {
    if (job.attempts >= job.maxAttempts) {
      this.deadLetterQueue.push(job);
      return false; // routed to DLQ
    }

    const backoffMs = baseBackoffMs * Math.pow(job.backoffFactor, job.attempts - 1);
    job.availableAt = Date.now() + backoffMs;
    this.insertDelayedHeap(job);
    return true;
  }

  public getDeadLetterQueue(): QueuedJob<T>[] {
    return [...this.deadLetterQueue];
  }

  public size(): number {
    const readyCount = this.queues.reduce((acc, q) => acc + q.length, 0);
    return readyCount + this.delayedHeap.length;
  }

  private promoteReadyDelayedJobs(now: number): void {
    while (this.delayedHeap.length > 0 && this.delayedHeap[0].availableAt <= now) {
      const job = this.extractMinDelayedHeap();
      this.queues[job.priority].push(job);
    }
  }

  private insertDelayedHeap(job: QueuedJob<T>): void {
    this.delayedHeap.push(job);
    let idx = this.delayedHeap.length - 1;

    while (idx > 0) {
      const parentIdx = Math.floor((idx - 1) / 2);
      if (this.delayedHeap[idx].availableAt >= this.delayedHeap[parentIdx].availableAt) {
        break;
      }
      const tmp = this.delayedHeap[idx];
      this.delayedHeap[idx] = this.delayedHeap[parentIdx];
      this.delayedHeap[parentIdx] = tmp;
      idx = parentIdx;
    }
  }

  private extractMinDelayedHeap(): QueuedJob<T> {
    const min = this.delayedHeap[0];
    const end = this.delayedHeap.pop()!;

    if (this.delayedHeap.length > 0) {
      this.delayedHeap[0] = end;
      let idx = 0;
      const length = this.delayedHeap.length;

      while (true) {
        let leftIdx = 2 * idx + 1;
        let rightIdx = 2 * idx + 2;
        let smallest = idx;

        if (leftIdx < length && this.delayedHeap[leftIdx].availableAt < this.delayedHeap[smallest].availableAt) {
          smallest = leftIdx;
        }
        if (rightIdx < length && this.delayedHeap[rightIdx].availableAt < this.delayedHeap[smallest].availableAt) {
          smallest = rightIdx;
        }
        if (smallest === idx) break;

        const tmp = this.delayedHeap[idx];
        this.delayedHeap[idx] = this.delayedHeap[smallest];
        this.delayedHeap[smallest] = tmp;
        idx = smallest;
      }
    }

    return min;
  }
}
