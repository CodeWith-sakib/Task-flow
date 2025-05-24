export class BatchQueueConsumer<T> {
  private items: T[] = [];

  public enqueueAll(newItems: T[]): void {
    this.items.push(...newItems);
  }

  public consumeBatch(maxBatchSize: number): T[] {
    const batchSize = Math.min(maxBatchSize, this.items.length);
    return this.items.splice(0, batchSize);
  }

  public remaining(): number {
    return this.items.length;
  }
}
