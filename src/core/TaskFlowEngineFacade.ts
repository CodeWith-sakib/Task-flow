import { MemTable } from '../storage/MemTable';
import { DelayQueue } from '../queue/DelayQueue';
import { AtomicCounter } from '../concurrency/AtomicCounter';

export class TaskFlowEngineFacade {
  private memTable = new MemTable<unknown>();
  private delayQueue = new DelayQueue<unknown>();
  private processedCounter = new AtomicCounter();

  public submitTask(id: string, payload: unknown, delayMs: number = 0): void {
    if (delayMs > 0) {
      this.delayQueue.offer(id, payload, delayMs);
    } else {
      this.memTable.set(id, payload);
    }
  }

  public processTask(id: string): unknown | undefined {
    const val = this.memTable.get(id);
    if (val !== undefined) {
      this.memTable.delete(id);
      this.processedCounter.incrementAndGet();
      return val;
    }
    return undefined;
  }

  public getProcessedCount(): number {
    return this.processedCounter.get();
  }
}
