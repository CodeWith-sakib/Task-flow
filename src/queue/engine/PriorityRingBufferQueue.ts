import { LockFreeRingBuffer } from '../../utils/concurrency/LockFreeRingBuffer';

export type PriorityLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7; // 7 = highest priority

/**
 * PriorityRingBufferQueue multiplexes high-throughput lock-free ring buffers across 8 priority tiers.
 */
export class PriorityRingBufferQueue<T = any> {
  private rings: LockFreeRingBuffer<T>[];
  private priorityLevels: number = 8;

  constructor(bufferCapacityPerLevel: number = 1024) {
    this.rings = Array.from({ length: this.priorityLevels }, () => new LockFreeRingBuffer<T>(bufferCapacityPerLevel));
  }

  public enqueue(item: T, priority: PriorityLevel = 3): boolean {
    const p = Math.max(0, Math.min(7, priority));
    return this.rings[p].offer(item);
  }

  public dequeue(): { item: T; priority: PriorityLevel } | null {
    // Scan from highest priority (7) down to lowest (0)
    for (let p = this.priorityLevels - 1; p >= 0; p--) {
      const item = this.rings[p].poll();
      if (item !== null) {
        return { item, priority: p as PriorityLevel };
      }
    }
    return null;
  }

  public size(): number {
    return this.rings.reduce((acc, r) => acc + r.size(), 0);
  }

  public clear(): void {
    for (const r of this.rings) {
      r.clear();
    }
  }
}
