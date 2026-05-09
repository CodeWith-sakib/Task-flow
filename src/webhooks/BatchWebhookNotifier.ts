export class BatchWebhookNotifier {
  private pending: Array<Record<string, unknown>> = [];
  private maxBatch: number;

  constructor(maxBatch: number = 20) {
    this.maxBatch = maxBatch;
  }

  public enqueue(event: Record<string, unknown>): boolean {
    this.pending.push(event);
    return this.pending.length >= this.maxBatch;
  }

  public flush(): Array<Record<string, unknown>> {
    const batch = this.pending;
    this.pending = [];
    return batch;
  }

  public size(): number {
    return this.pending.length;
  }
}
