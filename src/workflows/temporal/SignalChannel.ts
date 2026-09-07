export type SignalHandler<T = any> = (payload: T) => void | Promise<void>;

/**
 * SignalChannel provides asynchronous typed message passing and queries into active workflow instances.
 */
export class SignalChannel<T = any> {
  public readonly name: string;
  private buffer: T[] = [];
  private handlers: SignalHandler<T>[] = [];
  private waiters: ((val: T) => void)[] = [];

  constructor(name: string) {
    this.name = name;
  }

  public send(payload: T): void {
    if (this.waiters.length > 0) {
      const waiter = this.waiters.shift()!;
      waiter(payload);
    } else {
      this.buffer.push(payload);
    }

    for (const handler of this.handlers) {
      try {
        handler(payload);
      } catch {
        // Ignore handler errors
      }
    }
  }

  public async receive(timeoutMs?: number): Promise<T> {
    if (this.buffer.length > 0) {
      return this.buffer.shift()!;
    }

    return new Promise<T>((resolve, reject) => {
      let timer: NodeJS.Timeout | undefined;
      const waiter = (val: T) => {
        if (timer) clearTimeout(timer);
        resolve(val);
      };

      if (timeoutMs && timeoutMs > 0) {
        timer = setTimeout(() => {
          const idx = this.waiters.indexOf(waiter);
          if (idx !== -1) {
            this.waiters.splice(idx, 1);
            reject(new Error(`SignalChannel '${this.name}' receive timed out after ${timeoutMs}ms`));
          }
        }, timeoutMs);
      }

      this.waiters.push(waiter);
    });
  }

  public onSignal(handler: SignalHandler<T>): () => void {
    this.handlers.push(handler);
    return () => {
      const idx = this.handlers.indexOf(handler);
      if (idx !== -1) {
        this.handlers.splice(idx, 1);
      }
    };
  }

  public getBufferedCount(): number {
    return this.buffer.length;
  }

  public clear(): void {
    this.buffer = [];
    this.waiters = [];
  }
}
