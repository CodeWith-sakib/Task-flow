import { AsyncSemaphore } from './AsyncSemaphore';

export class AsyncMutex {
  private semaphore: AsyncSemaphore = new AsyncSemaphore(1);

  async acquire(): Promise<() => void> {
    return this.semaphore.acquire();
  }

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }

  isLocked(): boolean {
    return this.semaphore.getAvailable() === 0;
  }
}
