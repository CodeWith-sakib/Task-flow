export class AsyncResourcePool<T> {
  private available: T[] = [];
  private inUse: Set<T> = new Set();
  private factory: () => Promise<T>;
  private maxCapacity: number;

  constructor(factory: () => Promise<T>, maxCapacity: number = 10) {
    this.factory = factory;
    this.maxCapacity = maxCapacity;
  }

  public async acquire(): Promise<T> {
    if (this.available.length > 0) {
      const res = this.available.pop()!;
      this.inUse.add(res);
      return res;
    }
    if (this.inUse.size < this.maxCapacity) {
      const res = await this.factory();
      this.inUse.add(res);
      return res;
    }
    throw new Error('Resource pool exhausted');
  }

  public release(resource: T): void {
    if (this.inUse.has(resource)) {
      this.inUse.delete(resource);
      this.available.push(resource);
    }
  }

  public size(): number {
    return this.inUse.size + this.available.length;
  }
}
