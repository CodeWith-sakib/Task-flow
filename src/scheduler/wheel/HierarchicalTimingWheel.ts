export interface TimerTask<T = any> {
  id: string;
  delayMs: number;
  deadline: number;
  payload: T;
  callback: (payload: T) => void;
}

/**
 * TimingWheelLevel represents one circular tier in the timing wheel hierarchy.
 */
class TimingWheelTier {
  public tickMs: number;
  public wheelSize: number;
  public interval: number;
  public currentTime: number;
  public buckets: Set<TimerTask>[];
  public overflowWheel: TimingWheelTier | null = null;

  constructor(tickMs: number, wheelSize: number, currentTime: number) {
    this.tickMs = tickMs;
    this.wheelSize = wheelSize;
    this.interval = tickMs * wheelSize;
    this.currentTime = currentTime - (currentTime % tickMs);
    this.buckets = Array.from({ length: wheelSize }, () => new Set());
  }

  public add(task: TimerTask): boolean {
    if (task.deadline < this.currentTime + this.tickMs) {
      // Already expired in this tier
      return false;
    } else if (task.deadline < this.currentTime + this.interval) {
      // Fits in this wheel tier
      const virtualId = Math.floor(task.deadline / this.tickMs);
      const bucketIdx = virtualId % this.wheelSize;
      this.buckets[bucketIdx].add(task);
      return true;
    } else {
      // Delegate to higher overflow wheel
      if (!this.overflowWheel) {
        this.overflowWheel = new TimingWheelTier(this.interval, this.wheelSize, this.currentTime);
      }
      return this.overflowWheel.add(task);
    }
  }

  public advanceClock(time: number, expiredCollector: TimerTask[]): void {
    while (time >= this.currentTime + this.tickMs) {
      this.currentTime += this.tickMs;
      const virtualId = Math.floor(this.currentTime / this.tickMs);
      const bucketIdx = virtualId % this.wheelSize;
      const bucket = this.buckets[bucketIdx];

      for (const task of bucket) {
        if (task.deadline <= time) {
          expiredCollector.push(task);
        } else {
          this.add(task);
        }
      }
      bucket.clear();

      if (this.overflowWheel) {
        this.overflowWheel.advanceClock(this.currentTime, expiredCollector);
      }
    }
  }
}

/**
 * HierarchicalTimingWheel provides O(1) timer insertion and cascading timer expiration
 * across arbitrary delays using hierarchical wheel tiers.
 */
export class HierarchicalTimingWheel<T = any> {
  private rootTier: TimingWheelTier;
  private taskMap: Map<string, TimerTask<T>> = new Map();

  constructor(baseTickMs: number = 10, wheelSize: number = 60, startTime: number = Date.now()) {
    this.rootTier = new TimingWheelTier(baseTickMs, wheelSize, startTime);
  }

  public schedule(id: string, delayMs: number, payload: T, callback: (payload: T) => void): TimerTask<T> {
    const deadline = Date.now() + Math.max(0, delayMs);
    const task: TimerTask<T> = {
      id,
      delayMs,
      deadline,
      payload,
      callback
    };

    this.taskMap.set(id, task);
    const added = this.rootTier.add(task);
    if (!added) {
      // Immediate execution
      setImmediate(() => callback(payload));
      this.taskMap.delete(id);
    }

    return task;
  }

  public cancel(id: string): boolean {
    return this.taskMap.delete(id);
  }

  public tick(currentTime: number = Date.now()): TimerTask<T>[] {
    const expired: TimerTask[] = [];
    this.rootTier.advanceClock(currentTime, expired);

    const validExpired: TimerTask<T>[] = [];
    for (const t of expired) {
      if (this.taskMap.has(t.id)) {
        this.taskMap.delete(t.id);
        t.callback(t.payload);
        validExpired.push(t);
      }
    }

    return validExpired;
  }

  public pendingCount(): number {
    return this.taskMap.size;
  }
}
