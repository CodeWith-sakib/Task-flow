export class AsyncSemaphore {
  private capacity: number;
  private current: number = 0;
  private queue: (() => void)[] = [];

  constructor(capacity: number) {
    if (capacity <= 0) throw new Error('Semaphore capacity must be > 0');
    this.capacity = capacity;
  }

  async acquire(): Promise<() => void> {
    if (this.current < this.capacity) {
      this.current++;
      let released = false;
      return () => {
        if (!released) {
          released = true;
          this.release();
        }
      };
    }

    return new Promise((resolve) => {
      this.queue.push(() => {
        let released = false;
        resolve(() => {
          if (!released) {
            released = true;
            this.release();
          }
        });
      });
    });
  }

  private release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.current--;
    }
  }

  getAvailable(): number {
    return Math.max(0, this.capacity - this.current);
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}
