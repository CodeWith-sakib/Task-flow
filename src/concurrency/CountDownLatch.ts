export class CountDownLatch {
  private count: number;
  private waiters: Array<() => void> = [];

  constructor(count: number) {
    this.count = count;
  }

  public countDown(): void {
    if (this.count > 0) {
      this.count--;
      if (this.count === 0) {
        const toNotify = [...this.waiters];
        this.waiters = [];
        toNotify.forEach(resolve => resolve());
      }
    }
  }

  public async await(): Promise<void> {
    if (this.count <= 0) return;
    return new Promise(resolve => this.waiters.push(resolve));
  }

  public getCount(): number {
    return this.count;
  }
}
