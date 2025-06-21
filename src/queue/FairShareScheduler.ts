export class FairShareScheduler<T> {
  private queues: Map<string, T[]> = new Map();
  private tenantOrder: string[] = [];
  private pointer: number = 0;

  public enqueue(tenantId: string, item: T): void {
    if (!this.queues.has(tenantId)) {
      this.queues.set(tenantId, []);
      this.tenantOrder.push(tenantId);
    }
    this.queues.get(tenantId)!.push(item);
  }

  public scheduleNext(): { tenantId: string; item: T } | undefined {
    if (this.tenantOrder.length === 0) return undefined;

    const start = this.pointer;
    for (let i = 0; i < this.tenantOrder.length; i++) {
      const idx = (start + i) % this.tenantOrder.length;
      const tenantId = this.tenantOrder[idx];
      const q = this.queues.get(tenantId);

      if (q && q.length > 0) {
        this.pointer = (idx + 1) % this.tenantOrder.length;
        return { tenantId, item: q.shift()! };
      }
    }
    return undefined;
  }
}
