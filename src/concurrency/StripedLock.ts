export class StripedLock {
  private stripes: Array<Promise<void>> = [];
  private numStripes: number;

  constructor(numStripes: number = 16) {
    this.numStripes = numStripes;
    this.stripes = new Array(numStripes).fill(Promise.resolve());
  }

  private getStripeIndex(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % this.numStripes;
  }

  public async runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const idx = this.getStripeIndex(key);
    const prev = this.stripes[idx];

    let release: () => void;
    const next = new Promise<void>(resolve => {
      release = resolve;
    });
    this.stripes[idx] = next;

    await prev;
    try {
      return await fn();
    } finally {
      release!();
    }
  }
}
