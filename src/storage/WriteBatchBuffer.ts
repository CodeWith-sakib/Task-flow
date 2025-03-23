export interface BatchOp<T = unknown> {
  type: 'PUT' | 'DELETE';
  key: string;
  value?: T;
}

export class WriteBatchBuffer<T = unknown> {
  private buffer: BatchOp<T>[] = [];
  private batchLimit: number;

  constructor(batchLimit: number = 100) {
    this.batchLimit = batchLimit;
  }

  public put(key: string, value: T): boolean {
    this.buffer.push({ type: 'PUT', key, value });
    return this.isFull();
  }

  public delete(key: string): boolean {
    this.buffer.push({ type: 'DELETE', key });
    return this.isFull();
  }

  public isFull(): boolean {
    return this.buffer.length >= this.batchLimit;
  }

  public size(): number {
    return this.buffer.length;
  }

  public drain(): BatchOp<T>[] {
    const ops = this.buffer;
    this.buffer = [];
    return ops;
  }
}
