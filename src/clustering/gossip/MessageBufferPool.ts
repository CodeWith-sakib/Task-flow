/**
 * Zero-Copy Gossip Message Buffer Pool.
 * Manages reusable byte buffers for high-frequency UDP/TCP gossip packet dissemination,
 * minimizing V8 garbage collector pressure under cluster churn.
 */

export class MessageBufferPool {
  private bufferSize: number;
  private pool: Buffer[] = [];
  private allocatedCount = 0;
  private maxPoolSize: number;

  constructor(bufferSize: number = 4096, maxPoolSize: number = 256) {
    this.bufferSize = bufferSize;
    this.maxPoolSize = maxPoolSize;
  }

  public acquire(): Buffer {
    if (this.pool.length > 0) {
      const buf = this.pool.pop()!;
      buf.fill(0);
      return buf;
    }

    this.allocatedCount++;
    return Buffer.alloc(this.bufferSize);
  }

  public release(buf: Buffer): void {
    if (buf.length !== this.bufferSize) {
      return;
    }

    if (this.pool.length < this.maxPoolSize) {
      this.pool.push(buf);
    }
  }

  public getPoolStats(): { pooled: number; totalAllocated: number; bufferSize: number } {
    return {
      pooled: this.pool.length,
      totalAllocated: this.allocatedCount,
      bufferSize: this.bufferSize,
    };
  }
}
