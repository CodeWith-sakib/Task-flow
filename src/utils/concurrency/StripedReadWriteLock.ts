import { ReadWriteLock } from '../../concurrency/semaphore/ReadWriteLock';
import { MurmurHash3 } from '../MurmurHash3';

/**
 * StripedReadWriteLock partitions a key space across N independent ReadWriteLock stripes
 * to dramatically decrease lock contention in high-throughput concurrent workloads.
 */
export class StripedReadWriteLock {
  private stripes: ReadWriteLock[];
  private stripeCount: number;

  constructor(stripeCount: number = 64) {
    this.stripeCount = stripeCount;
    this.stripes = Array.from({ length: stripeCount }, () => new ReadWriteLock());
  }

  public async readLock(key: string): Promise<() => void> {
    const stripe = this.getStripe(key);
    return stripe.readLock();
  }

  public async writeLock(key: string): Promise<() => void> {
    const stripe = this.getStripe(key);
    return stripe.writeLock();
  }

  public async writeLockAll(): Promise<() => void> {
    const unlockFns: (() => void)[] = [];
    for (const stripe of this.stripes) {
      const unlock = await stripe.writeLock();
      unlockFns.push(unlock);
    }

    let released = false;
    return () => {
      if (!released) {
        released = true;
        for (const unlock of unlockFns) {
          unlock();
        }
      }
    };
  }

  private getStripe(key: string): ReadWriteLock {
    const hash = MurmurHash3.hash32(key, 0x12345678);
    const index = Math.abs(hash) % this.stripeCount;
    return this.stripes[index];
  }
}
