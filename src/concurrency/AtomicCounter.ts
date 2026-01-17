export class AtomicCounter {
  private value: number;

  constructor(initial: number = 0) {
    this.value = initial;
  }

  public get(): number {
    return this.value;
  }

  public incrementAndGet(): number {
    return ++this.value;
  }

  public decrementAndGet(): number {
    return --this.value;
  }

  public compareAndSet(expected: number, update: number): boolean {
    if (this.value === expected) {
      this.value = update;
      return true;
    }
    return false;
  }
}
