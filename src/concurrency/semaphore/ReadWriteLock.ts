export class ReadWriteLock {
  private readers: number = 0;
  private writer: boolean = false;
  private readerWaiters: (() => void)[] = [];
  private writerWaiters: (() => void)[] = [];

  async readLock(): Promise<() => void> {
    if (!this.writer && this.writerWaiters.length === 0) {
      this.readers++;
      let released = false;
      return () => {
        if (!released) {
          released = true;
          this.readers--;
          this.dispatchNext();
        }
      };
    }

    return new Promise((resolve) => {
      this.readerWaiters.push(() => {
        this.readers++;
        let released = false;
        resolve(() => {
          if (!released) {
            released = true;
            this.readers--;
            this.dispatchNext();
          }
        });
      });
    });
  }

  async writeLock(): Promise<() => void> {
    if (!this.writer && this.readers === 0) {
      this.writer = true;
      let released = false;
      return () => {
        if (!released) {
          released = true;
          this.writer = false;
          this.dispatchNext();
        }
      };
    }

    return new Promise((resolve) => {
      this.writerWaiters.push(() => {
        this.writer = true;
        let released = false;
        resolve(() => {
          if (!released) {
            released = true;
            this.writer = false;
            this.dispatchNext();
          }
        });
      });
    });
  }

  private dispatchNext(): void {
    if (this.readers === 0 && !this.writer) {
      if (this.writerWaiters.length > 0) {
        const nextWriter = this.writerWaiters.shift()!;
        nextWriter();
      } else {
        while (this.readerWaiters.length > 0) {
          const nextReader = this.readerWaiters.shift()!;
          nextReader();
        }
      }
    }
  }
}
