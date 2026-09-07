/**
 * Communicating Sequential Processes (CSP) Channel.
 * Implements typed buffered/unbuffered Go-style channels with asynchronous backpressure,
 * FIFO fairness, and graceful channel closing semantics.
 */

export class CSPChannel<T = any> {
  private capacity: number;
  private buffer: T[] = [];
  private sendQueue: { value: T; resolve: () => void }[] = [];
  private recvQueue: { resolve: (val: T | undefined) => void }[] = [];
  private isClosed = false;

  constructor(capacity: number = 0) {
    this.capacity = Math.max(0, capacity);
  }

  public async send(value: T): Promise<boolean> {
    if (this.isClosed) {
      throw new Error('Cannot send on closed CSP channel');
    }

    // 1. Direct handoff to waiting receiver
    if (this.recvQueue.length > 0) {
      const receiver = this.recvQueue.shift()!;
      receiver.resolve(value);
      return true;
    }

    // 2. Buffer space available
    if (this.buffer.length < this.capacity) {
      this.buffer.push(value);
      return true;
    }

    // 3. Block sender until buffer space frees up
    return new Promise<boolean>((resolve) => {
      this.sendQueue.push({
        value,
        resolve: () => resolve(true),
      });
    });
  }

  public async receive(): Promise<T | undefined> {
    // 1. If buffer has items, take from buffer and unblock one waiting sender
    if (this.buffer.length > 0) {
      const val = this.buffer.shift()!;
      if (this.sendQueue.length > 0) {
        const sender = this.sendQueue.shift()!;
        this.buffer.push(sender.value);
        sender.resolve();
      }
      return val;
    }

    // 2. Direct handoff from waiting sender (for unbuffered channel)
    if (this.sendQueue.length > 0) {
      const sender = this.sendQueue.shift()!;
      sender.resolve();
      return sender.value;
    }

    // 3. If closed and empty, return undefined
    if (this.isClosed) {
      return undefined;
    }

    // 4. Block receiver until a value is sent
    return new Promise<T | undefined>((resolve) => {
      this.recvQueue.push({ resolve });
    });
  }

  public close(): void {
    if (this.isClosed) return;
    this.isClosed = true;

    // Drain receivers
    while (this.recvQueue.length > 0) {
      const receiver = this.recvQueue.shift()!;
      receiver.resolve(undefined);
    }
  }

  public length(): number {
    return this.buffer.length;
  }

  public isChannelClosed(): boolean {
    return this.isClosed;
  }
}
