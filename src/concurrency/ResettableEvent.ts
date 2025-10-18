export class ResettableEvent {
  private isSignaled: boolean;
  private waiters: Array<() => void> = [];

  constructor(initiallySignaled: boolean = false) {
    this.isSignaled = initiallySignaled;
  }

  public set(): void {
    this.isSignaled = true;
    const toNotify = [...this.waiters];
    this.waiters = [];
    toNotify.forEach(w => w());
  }

  public reset(): void {
    this.isSignaled = false;
  }

  public async wait(): Promise<void> {
    if (this.isSignaled) return;
    return new Promise(resolve => this.waiters.push(resolve));
  }

  public isSet(): boolean {
    return this.isSignaled;
  }
}
