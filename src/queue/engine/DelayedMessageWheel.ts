export interface DelayedMessage<T = any> {
  id: string;
  payload: T;
  deliverAt: number;
  roundsRemaining: number;
}

/**
 * DelayedMessageWheel stores future-scheduled messages in a circular bucket wheel with round tracking.
 */
export class DelayedMessageWheel<T = any> {
  private wheelSize: number;
  private tickIntervalMs: number;
  private buckets: DelayedMessage<T>[][];
  private currentBucketIdx: number = 0;
  private messageMap: Map<string, { bucketIdx: number; msg: DelayedMessage<T> }> = new Map();

  constructor(wheelSize: number = 60, tickIntervalMs: number = 1000) {
    this.wheelSize = wheelSize;
    this.tickIntervalMs = tickIntervalMs;
    this.buckets = Array.from({ length: wheelSize }, () => []);
  }

  public schedule(id: string, payload: T, delayMs: number): DelayedMessage<T> {
    const deliverAt = Date.now() + Math.max(0, delayMs);
    const ticks = Math.max(1, Math.floor(delayMs / this.tickIntervalMs));
    const roundsRemaining = Math.floor(ticks / this.wheelSize);
    const bucketIdx = (this.currentBucketIdx + (ticks % this.wheelSize)) % this.wheelSize;

    const msg: DelayedMessage<T> = {
      id,
      payload,
      deliverAt,
      roundsRemaining
    };

    this.buckets[bucketIdx].push(msg);
    this.messageMap.set(id, { bucketIdx, msg });
    return msg;
  }

  public cancel(id: string): boolean {
    const entry = this.messageMap.get(id);
    if (!entry) return false;

    const bucket = this.buckets[entry.bucketIdx];
    const idx = bucket.findIndex(m => m.id === id);
    if (idx !== -1) {
      bucket.splice(idx, 1);
    }
    this.messageMap.delete(id);
    return true;
  }

  public advance(): T[] {
    const readyMessages: T[] = [];
    const currentBucket = this.buckets[this.currentBucketIdx];
    const remainingInBucket: DelayedMessage<T>[] = [];

    for (const msg of currentBucket) {
      if (msg.roundsRemaining <= 0) {
        readyMessages.push(msg.payload);
        this.messageMap.delete(msg.id);
      } else {
        msg.roundsRemaining--;
        remainingInBucket.push(msg);
      }
    }

    this.buckets[this.currentBucketIdx] = remainingInBucket;
    this.currentBucketIdx = (this.currentBucketIdx + 1) % this.wheelSize;

    return readyMessages;
  }

  public size(): number {
    return this.messageMap.size;
  }
}
