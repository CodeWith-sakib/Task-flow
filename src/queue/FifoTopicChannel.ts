export class FifoTopicChannel<T> {
  private channels: Map<string, T[]> = new Map();

  public send(partitionKey: string, message: T): void {
    let list = this.channels.get(partitionKey);
    if (!list) {
      list = [];
      this.channels.set(partitionKey, list);
    }
    list.push(message);
  }

  public receive(partitionKey: string): T | undefined {
    const list = this.channels.get(partitionKey);
    if (!list || list.length === 0) return undefined;
    return list.shift();
  }

  public getDepth(partitionKey: string): number {
    return this.channels.get(partitionKey)?.length ?? 0;
  }
}
