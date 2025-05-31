export interface PartitionTask<T> {
  partitionKey: string;
  priority: number;
  payload: T;
}

export class PriorityPartitionedQueue<T> {
  private partitions: Map<string, PartitionTask<T>[]> = new Map();

  public push(partitionKey: string, priority: number, payload: T): void {
    let p = this.partitions.get(partitionKey);
    if (!p) {
      p = [];
      this.partitions.set(partitionKey, p);
    }
    p.push({ partitionKey, priority, payload });
    p.sort((a, b) => b.priority - a.priority); // Highest priority first
  }

  public popPartition(partitionKey: string): T | undefined {
    const p = this.partitions.get(partitionKey);
    if (!p || p.length === 0) return undefined;
    return p.shift()!.payload;
  }

  public partitionSize(partitionKey: string): number {
    return this.partitions.get(partitionKey)?.length ?? 0;
  }
}
